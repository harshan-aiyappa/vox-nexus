import { useState, useCallback, useRef, useEffect } from 'react';

export function useDirectStream(url = 'ws://localhost:8000/ws') {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState([]);

    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    // Connect to WebSocket
    const connect = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            console.log("🔌 Connecting to Direct Mode WS:", url);
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log("✅ Direct Mode WS Connected");
                setIsConnected(true);
                resolve();
            };

            ws.onclose = () => {
                console.log("❌ Direct Mode WS Disconnected");
                setIsConnected(false);
                stopRecording();
            };

            ws.onerror = (err) => {
                console.error("⚠️ Direct Mode WS Error:", err);
                setIsConnected(false);
                reject(err);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'transcription') {
                        setTranscripts(prev => [...prev, {
                            text: data.text,
                            timestamp: Date.now(),
                            isFinal: data.isFinal,
                            latency: data.latency_ms,
                            participant: 'direct-agent'
                        }]);
                    }
                } catch (e) {
                    console.error("Error parsing WS message:", e);
                }
            };

            wsRef.current = ws;
        });
    }, [url]);

    const disconnect = useCallback(() => {
        stopRecording();
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const startRecording = useCallback(async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WS not open, cannot start recording");
            return;
        }

        try {
            console.log("🎤 Starting Raw PCM Capture...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // AudioContext at 16kHz (preferred for Whisper)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);

            // Using ScriptProcessor for simple PCM capture
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Convert Float32 to Int16
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                    }

                    // Send as base64 chunk
                    // Note: In a production app, we'd send raw binary, but our current WS handles JSON
                    const uint8 = new Uint8Array(pcmData.buffer);
                    let binary = '';
                    for (let i = 0; i < uint8.length; i++) {
                        binary += String.fromCharCode(uint8[i]);
                    }
                    const base64data = btoa(binary);

                    wsRef.current.send(JSON.stringify({
                        type: 'audio',
                        data: base64data
                    }));
                }
            };

            mediaRecorderRef.current = {
                stop: () => {
                    processor.disconnect();
                    source.disconnect();
                    audioContext.close();
                }
            };

            setIsRecording(true);
            console.log("🎙️ Raw PCM Streaming started (Direct Mode)");

        } catch (err) {
            console.error("❌ Error accessing microphone:", err);
        }
    }, [url]);

    const stopRecording = useCallback(() => {
        setIsRecording(false); // Immediate UI update

        if (mediaRecorderRef.current) {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.error("Error stopping recorder:", e);
            }
            mediaRecorderRef.current = null;
            console.log("⏹️ Audio Capture stopped");
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
                console.log(`🎤 Hardware Track Stopped: ${track.label}`);
            });
            streamRef.current = null;
        }
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) stopRecording();
        else startRecording();
    }, [isRecording, startRecording, stopRecording]);

    const setLanguage = useCallback((langCode) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'set_language',
                code: langCode
            }));
            console.log(`🌐 Direct Mode: Language set to ${langCode}`);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    return {
        connect,
        disconnect,
        isConnected,
        isRecording,
        toggleRecording,
        transcripts,
        setLanguage
    };
}
