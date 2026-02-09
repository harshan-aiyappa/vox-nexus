import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, ConnectionState } from 'livekit-client';

export const useLiveKit = (defaultUrl) => {
    const [room, setRoom] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [transcripts, setTranscripts] = useState([]);
    const [connectionQuality, setConnectionQuality] = useState('excellent');
    const roomRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(async (token, url) => {
        const wsUrl = url || defaultUrl;
        if (!wsUrl || !token) {
            console.error("Missing URL or Token");
            return;
        }

        const newRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
            // iOS compatibility
            audioCaptureDefaults: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 48000, // Lock to 48kHz for iOS compatibility
            },
        });

        roomRef.current = newRoom;

        // Connection state monitoring
        newRoom
            .on(RoomEvent.Connected, () => {
                console.log('✅ Room Connected');
                setConnectionState('connected');
                setIsConnected(true); // Ensure isConnected is true
                reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
            })
            .on(RoomEvent.Reconnecting, () => {
                console.log('🔄 Reconnecting to Room...');
                setConnectionState('reconnecting');
            })
            .on(RoomEvent.Reconnected, () => {
                console.log('✅ Room Reconnected');
                setConnectionState('connected');
                setIsConnected(true); // Ensure isConnected is true
                reconnectAttemptsRef.current = 0; // Reset attempts on successful reconnection
            })
            .on(RoomEvent.Disconnected, (reason) => {
                console.log(`❌ Room Disconnected. Reason: ${reason}`);
                setConnectionState('disconnected');
                setIsConnected(false);
                // handleReconnect(token, url); // Reconnect logic disabled by user request
            })
            .on(RoomEvent.ConnectionStateChanged, (state) => {
                console.log('Connection state:', state);
                // The specific handlers above cover most cases, but this can catch others if needed.
                // We keep this for general logging, but the specific handlers manage `isConnected` and `connectionState`.
            });

        // Connection quality monitoring
        newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            if (participant.isLocal) {
                setConnectionQuality(quality);
            }
        });

        // Data received handler
        newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
            const decoder = new TextDecoder();
            const str = decoder.decode(payload);
            try {
                const data = JSON.parse(str);
                if (data.type === 'transcription') {
                    setTranscripts(prev => [...prev, { text: data.text, timestamp: Date.now() }]);
                }
            } catch (e) {
                console.error('Failed to parse data message', e);
            }
        });

        // Track subscribed handler
        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log(`🎧 Track Subscribed: ${track.kind} from ${participant.identity} (sid: ${participant.sid})`);
            if (track.kind === Track.Kind.Audio) {
                track.attach(); // Attach audio tracks to play them
            }
        });

        // Track unsubscribed handler
        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log(`🔇 Track Unsubscribed: ${track.kind} from ${participant.identity}`);
            track.detach(); // Detach tracks when unsubscribed
        });

        if (token) {
            console.log("🔗 Connecting to LiveKit room with token...");
            try {
                await newRoom.connect(wsUrl, token);

                // Publish Microphone with iOS-compatible settings
                const track = await createLocalAudioTrack({
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                });

                await newRoom.localParticipant.publishTrack(track, {
                    name: 'microphone',
                    source: 'microphone',
                });

                setRoom(newRoom);
                // setIsConnected(true); // Handled by RoomEvent.Connected
                console.log("✅ Successfully connected to LiveKit!");
            } catch (err) {
                console.error("❌ Failed to connect to LiveKit:", err);
                setError(err); // Set error state
                // setIsConnected(false); // Handled by RoomEvent.Disconnected or error
                handleReconnect(token, url);
            }
        }
    }, [defaultUrl]);

    const handleReconnect = useCallback((token, url) => {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff, max 30s

        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            connect(token, url);
        }, delay);
    }, [connect]);

    const disconnect = useCallback(async () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (roomRef.current) {
            await roomRef.current.disconnect();
            setRoom(null);
            setIsConnected(false);
            roomRef.current = null;
            reconnectAttemptsRef.current = 0;
        }
    }, []);

    // iOS resume handling
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && roomRef.current && !isConnected) {
                console.log('App resumed, checking connection...');
                // Try to resume audio context on iOS
                if (roomRef.current.localParticipant) {
                    const audioTracks = Array.from(roomRef.current.localParticipant.audioTracks.values());
                    for (const pub of audioTracks) {
                        if (pub.track) {
                            await pub.track.restartTrack();
                        }
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isConnected]);

    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
        };
    }, []);

    const [agentConnected, setAgentConnected] = useState(false);

    useEffect(() => {
        if (!room) return;

        const checkAgents = () => {
            const participants = Array.from(room.remoteParticipants.values());
            const hasAgent = participants.some(p => p.identity.startsWith('agent-') || p.kind === 'agent');
            setAgentConnected(hasAgent);
            console.log('Worker/Agent Status:', hasAgent ? 'Online' : 'Offline', participants.map(p => p.identity));
        };

        room.on(RoomEvent.ParticipantConnected, checkAgents);
        room.on(RoomEvent.ParticipantDisconnected, checkAgents);
        checkAgents(); // Initial check

        return () => {
            room.off(RoomEvent.ParticipantConnected, checkAgents);
            room.off(RoomEvent.ParticipantDisconnected, checkAgents);
        };
    }, [room]);

    const setLanguage = async (langCode) => {
        if (!room) return;
        const payload = JSON.stringify({ type: 'set_language', code: langCode });
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        await room.localParticipant.publishData(data, { reliable: true });
    };

    const [micEnabled, setMicEnabled] = useState(true);

    const toggleMicrophone = async () => {
        if (!room) return;
        const newState = !micEnabled;
        await room.localParticipant.setMicrophoneEnabled(newState);
        setMicEnabled(newState);
    };

    return { connect, disconnect, isConnected, connectionState, transcripts, room, connectionQuality, agentConnected, setLanguage, toggleMicrophone, micEnabled };
};
