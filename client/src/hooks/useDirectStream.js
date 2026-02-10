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
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        console.log("🔌 Connecting to Direct Mode WS:", url);
        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log("✅ Direct Mode WS Connected");
            setIsConnected(true);
        };

        ws.onclose = () => {
            console.log("❌ Direct Mode WS Disconnected");
            setIsConnected(false);
            stopRecording(); // Safety stop
        };

        ws.onerror = (err) => {
            console.error("⚠️ Direct Mode WS Error:", err);
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'transcription') {
                    setTranscripts(prev => [...prev, {
                        text: data.text,
                        timestamp: Date.now(),
                        isFinal: data.isFinal,
                        participant: 'direct-agent'
                    }]);
                }
            } catch (e) {
                console.error("Error parsing WS message:", e);
            }
        };

        wsRef.current = ws;
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
            console.log("🎤 Starting Microphone...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Use MediaRecorder to capture chunks
            // mimeType: 'audio/webm' is standard for Chrome/Firefox
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            recorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                    // Convert Blob to Base64
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result.split(',')[1];
                        wsRef.current.send(JSON.stringify({
                            type: 'audio',
                            data: base64data
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            // Slice every 1s (1000ms) to send chunks
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            console.log("🎙️ Recording started (Direct Mode)");

        } catch (err) {
            console.error("❌ Error accessing microphone:", err);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            console.log("⏹️ MediaRecorder stopped");
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) stopRecording();
        else startRecording();
    }, [isRecording, startRecording, stopRecording]);

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
        transcripts
    };
}
