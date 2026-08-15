import { useState, useCallback, useRef, useEffect } from 'react';

// How long to hold the socket open after asking the worker to flush, so the
// final transcript has time to come back before we close.
const FLUSH_GRACE_MS = 2000;

export function useDirectStream(url = 'ws://localhost:8000/ws') {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState([]);

    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    // Declared before connect/disconnect so both can depend on it without
    // tripping the temporal dead zone.
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

        // Ask the worker to transcribe whatever is still buffered. Without this
        // any speech shorter than its 3s window is discarded, which in practice
        // means the last words before the user stops talking.
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end_utterance' }));
            console.log("⏏️ Flush requested for trailing audio");
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

                    if (data.type === 'error') {
                        console.warn(`⚠️ Worker: ${data.message}`);
                        return;
                    }

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
    }, [url, stopRecording]);

    const disconnect = useCallback(() => {
        stopRecording();   // queues the end_utterance flush

        const ws = wsRef.current;
        wsRef.current = null;
        if (ws) {
            // Hold the socket open briefly so the flushed transcript can arrive;
            // closing immediately would discard the very audio we just asked for.
            setTimeout(() => {
                try { ws.close(); } catch { /* already closed */ }
            }, FLUSH_GRACE_MS);
        }
        setIsConnected(false);
    }, [stopRecording]);

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
    }, [stopRecording]);

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
