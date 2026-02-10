import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Mic, Server, Globe, Zap, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

export const SystemCheckModal = ({ isOpen, onClose, onComplete }) => {
    const [checks, setChecks] = useState({
        backend: { status: 'idle', label: 'Backend Server' },
        livekit: { status: 'idle', label: 'LiveKit Cloud' },
        mic: { status: 'idle', label: 'Microphone Access' },
        internet: { status: 'idle', label: 'Internet Stability' },
    });

    const [isRunning, setIsRunning] = useState(false);

    const runChecks = useCallback(async () => {
        setIsRunning(true);

        // 1. Backend Check
        setChecks(prev => ({ ...prev, backend: { ...prev.backend, status: 'running' } }));
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        let backendHealthy = false;

        try {
            const res = await fetch(`${backendUrl}/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    setChecks(prev => ({ ...prev, backend: { ...prev.backend, status: 'success' } }));
                    backendHealthy = true;
                } else {
                    throw new Error('Invalid health response');
                }
            } else {
                throw new Error('Backend unreachable');
            }
        } catch (e) {
            setChecks(prev => ({ ...prev, backend: { ...prev.backend, status: 'error' } }));
        }
        await new Promise(r => setTimeout(r, 600));

        // 2. Internet Check
        setChecks(prev => ({ ...prev, internet: { ...prev.internet, status: 'running' } }));
        if (navigator.onLine) {
            setChecks(prev => ({ ...prev, internet: { ...prev.internet, status: 'success' } }));
        } else {
            setChecks(prev => ({ ...prev, internet: { ...prev.internet, status: 'error' } }));
        }
        await new Promise(r => setTimeout(r, 600));

        // 3. LiveKit Connection Check (Integration Test via Backend)
        setChecks(prev => ({ ...prev, livekit: { ...prev.livekit, status: 'running' } }));
        if (backendHealthy) {
            try {
                // Request a dummy token to verify LiveKit API Key/Secret on backend
                const res = await fetch(`${backendUrl}/token?room=system-check&name=check-bot`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.token) {
                        setChecks(prev => ({ ...prev, livekit: { ...prev.livekit, status: 'success' } }));
                    } else {
                        throw new Error('No token returned');
                    }
                } else {
                    throw new Error('Token endpoint failed');
                }
            } catch (e) {
                console.error("LiveKit Check Failed:", e);
                setChecks(prev => ({ ...prev, livekit: { ...prev.livekit, status: 'error' } }));
            }
        } else {
            // Cannot check LiveKit if backend is down
            setChecks(prev => ({ ...prev, livekit: { ...prev.livekit, status: 'error' } }));
        }
        await new Promise(r => setTimeout(r, 600));

        // 4. Mic Check
        setChecks(prev => ({ ...prev, mic: { ...prev.mic, status: 'running' } }));
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setChecks(prev => ({ ...prev, mic: { ...prev.mic, status: 'success' } }));
        } catch (e) {
            console.error("Mic Check Failed:", e);
            setChecks(prev => ({ ...prev, mic: { ...prev.mic, status: 'error' } }));
        }

        setIsRunning(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            runChecks();
        } else {
            setChecks({
                backend: { status: 'idle', label: 'Backend Server' },
                livekit: { status: 'idle', label: 'LiveKit Cloud' },
                mic: { status: 'idle', label: 'Microphone Access' },
                internet: { status: 'idle', label: 'Internet Stability' },
            });
        }
    }, [isOpen]);

    const allPassed = Object.values(checks).every(c => c.status === 'success');
    const allFinished = Object.values(checks).every(c => c.status === 'success' || c.status === 'error');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20"
                    >
                        {/* Header */}
                        <div className="p-8 bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ShieldCheck size={120} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <ShieldCheck className="w-7 h-7" />
                                    System Integrity Check
                                </h2>
                                <p className="text-indigo-100 text-sm mt-1">Verifying your environment for optimal voice AI performance.</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-6">
                            <div className="grid gap-4">
                                {Object.entries(checks).map(([key, check]) => (
                                    <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "p-2.5 rounded-xl",
                                                check.status === 'success' ? "bg-emerald-100 text-emerald-600" :
                                                    check.status === 'error' ? "bg-rose-100 text-rose-600" :
                                                        check.status === 'running' ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"
                                            )}>
                                                {key === 'backend' && <Server size={20} />}
                                                {key === 'livekit' && <Zap size={20} />}
                                                {key === 'mic' && <Mic size={20} />}
                                                {key === 'internet' && <Globe size={20} />}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-800 text-sm">{check.label}</h3>
                                                <p className="text-xs text-slate-500">
                                                    {check.status === 'idle' && 'Pending check...'}
                                                    {check.status === 'running' && 'In progress...'}
                                                    {check.status === 'success' && 'Connection secure'}
                                                    {check.status === 'error' && 'Failed to connect'}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            {check.status === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                                            {check.status === 'error' && <XCircle className="w-6 h-6 text-rose-500" />}
                                            {check.status === 'running' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="pt-4">
                                <button
                                    disabled={!allFinished || isRunning}
                                    onClick={allPassed ? onComplete : runChecks}
                                    className={clsx(
                                        "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg transform active:scale-[0.98]",
                                        allPassed
                                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200"
                                            : !allFinished
                                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200"
                                    )}
                                >
                                    {allPassed ? (
                                        <>Continue to VoxNexus <ArrowRight size={20} /></>
                                    ) : !allFinished ? (
                                        <>Running Checks... <Loader2 size={20} className="animate-spin" /></>
                                    ) : (
                                        <>Retry System Check</>
                                    )}
                                </button>
                                {allFinished && !allPassed && (
                                    <p className="text-center text-xs text-rose-500 mt-3 font-medium">
                                        Please fix the highlighted issues and retry.
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
