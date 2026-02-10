import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, Track } from 'livekit-client';

export const useLiveKit = (defaultUrl) => {
    const [room, setRoom] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [transcripts, setTranscripts] = useState([]);
    const [connectionQuality, setConnectionQuality] = useState('excellent');
    const [micEnabled, setMicEnabled] = useState(true);
    const [agentConnected, setAgentConnected] = useState(false);

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

        // Cleanup existing room
        if (roomRef.current) {
            await roomRef.current.disconnect();
        }

        const newRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 48000,
            },
        });

        roomRef.current = newRoom;

        // --- Event Handlers ---

        newRoom.on(RoomEvent.Connected, () => {
            console.log('✅ Room Connected');
            setConnectionState('connected');
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
        });

        newRoom.on(RoomEvent.Reconnecting, () => {
            console.log('🔄 Reconnecting...');
            setConnectionState('reconnecting');
        });

        newRoom.on(RoomEvent.Reconnected, () => {
            console.log('✅ Room Reconnected');
            setConnectionState('connected');
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
        });

        newRoom.on(RoomEvent.Disconnected, (reason) => {
            console.log(`❌ Room Disconnected: ${reason}`);
            setConnectionState('disconnected');
            setIsConnected(false);
        });

        newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            if (participant.isLocal) {
                setConnectionQuality(quality);
            }
        });

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

        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log(`🎧 Track Subscribed: ${track.kind} from ${participant.identity}`);
            if (track.kind === Track.Kind.Audio) {
                track.attach();
            }
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log(`🔇 Track Unsubscribed: ${track.kind} from ${participant.identity}`);
            track.detach();
        });

        const checkAgents = () => {
            const participants = Array.from(newRoom.remoteParticipants.values());
            const hasAgent = participants.some(p => p.identity.startsWith('agent-') || p.kind === 'agent');
            setAgentConnected(hasAgent);
        };

        newRoom.on(RoomEvent.ParticipantConnected, checkAgents);
        newRoom.on(RoomEvent.ParticipantDisconnected, checkAgents);

        try {
            console.log("🔗 Connecting to LiveKit room...");
            await newRoom.connect(wsUrl, token);

            // Publish Microphone
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
            // Initial agent check
            checkAgents();

        } catch (err) {
            console.error("❌ Failed to connect to LiveKit:", err);
            setIsConnected(false);
        }
    }, [defaultUrl]);

    const disconnect = useCallback(async () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (roomRef.current) {
            await roomRef.current.disconnect();
            roomRef.current = null;
        }
        setRoom(null);
        setIsConnected(false);
        setConnectionState('disconnected');
    }, []);

    const toggleMicrophone = async () => {
        if (!room) return;
        const newState = !micEnabled;
        await room.localParticipant.setMicrophoneEnabled(newState);
        setMicEnabled(newState);
    };

    const setLanguage = async (langCode) => {
        if (!room) return;
        const payload = JSON.stringify({ type: 'set_language', code: langCode });
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        await room.localParticipant.publishData(data, { reliable: true });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // iOS resume handling
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && roomRef.current && !isConnected) {
                if (roomRef.current.localParticipant) {
                    const audioTracks = Array.from(roomRef.current.localParticipant.audioTracks.values());
                    for (const pub of audioTracks) {
                        if (pub.track) {
                            // Attempt to restart or resume if needed (mostly handled by browser, but good for some contexts)
                            // pub.track.restartTrack(); 
                        }
                    }
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isConnected]);

    return {
        connect,
        disconnect,
        isConnected,
        connectionState,
        transcripts,
        room,
        connectionQuality,
        agentConnected,
        setLanguage,
        toggleMicrophone,
        micEnabled
    };
};
