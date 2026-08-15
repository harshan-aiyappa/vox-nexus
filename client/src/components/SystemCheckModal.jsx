import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Server, Wifi, Mic, Globe, CheckCircle2, XCircle, Loader2, AlertTriangle, Fingerprint, Activity } from 'lucide-react';
import clsx from 'clsx';

const CheckItem = memo(({ icon: Icon, label, status, detail }) => {
    const isReady = status === 'ready';
    const isError = status === 'error';
    const isChecking = status === 'checking';

    return (
        <div className={clsx(
            "flex items-center justify-between p-5 rounded-3xl border transition-all duration-500 bg-white/50 backdrop-blur-sm",
            isReady ? "border-zinc-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" :
                isError ? "border-zinc-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" :
                    "border-zinc-100 shadow-sm"
        )}>
            <div className="flex items-center gap-4">
                <div className={clsx(
                    "p-3 rounded-2xl transition-all duration-500",
                    isReady ? "bg-zinc-900 text-white" :
                        isError ? "bg-zinc-100 text-zinc-500" :
                            "bg-zinc-50 text-zinc-500"
                )}>
                    <Icon className={clsx("w-6 h-6", isChecking && "animate-pulse")} />
                </div>
                <div>
                    <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">{label}</p>
                    <p className="text-xs font-bold text-zinc-500 tracking-wider">
                        {isChecking ? "Checking..." : detail}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {isChecking && <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />}
                {isReady && <CheckCircle2 className="w-6 h-6 text-zinc-900" />}
                {isError && <XCircle className="w-6 h-6 text-zinc-500" />}
            </div>
        </div>
    );
});

// The speech model needs ~15s from cold, so allow generously more than that.
const WORKER_POLL_ATTEMPTS = 20;
const WORKER_POLL_INTERVAL_MS = 2000;

export function SystemCheckModal({ isOpen, mode, onClose, onComplete }) {
    const [checks, setChecks] = useState({
        internet: 'idle',
        backend: 'idle',
        worker: 'idle',
        livekit: 'idle',
        mic: 'idle'
    });
    const [isScanning, setIsScanning] = useState(false);
    const dialogRef = useRef(null);
    const previouslyFocused = useRef(null);

    const runChecks = useCallback(async () => {
        setIsScanning(true);
        const update = (id, status) => setChecks(prev => ({ ...prev, [id]: status }));

        // 1. Uplink (Internet)
        update('internet', 'checking');
        update('internet', navigator.onLine ? 'ready' : 'error');
        await new Promise(r => setTimeout(r, 400));

        // 2. Gateway (Backend Server)
        update('backend', 'checking');
        try {
            const res = await fetch('/health');
            const data = await res.json();
            update('backend', res.ok ? 'ready' : 'error');

            // 3. Engine Core (Worker - Verified via Backend)
            // The speech model takes ~15s to load from cold. Keep polling while
            // it reports 'loading' instead of leaving the check stuck, which
            // used to lock the user out with no way forward but a page reload.
            update('worker', 'checking');
            let workerState = data.worker;
            for (let i = 0; i < WORKER_POLL_ATTEMPTS && workerState === 'loading'; i++) {
                await new Promise(r => setTimeout(r, WORKER_POLL_INTERVAL_MS));
                try {
                    const poll = await fetch('/health');
                    workerState = (await poll.json()).worker;
                } catch {
                    workerState = 'offline';
                }
            }
            update('worker', workerState === 'online' ? 'ready' : 'error');
        } catch {
            update('backend', 'error');
            update('worker', 'error');
        }

        // 4. Audio Interface (Mic Hardware)
        update('mic', 'checking');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            await new Promise(r => setTimeout(r, 500));
            update('mic', 'ready');
        } catch {
            update('mic', 'error');
        }

        // 5. Cloud Protocol (LiveKit - Only for Agent Mode)
        if (mode === 'agent') {
            update('livekit', 'checking');
            const url = import.meta.env.VITE_LIVEKIT_URL;
            await new Promise(r => setTimeout(r, 600));
            update('livekit', url ? 'ready' : 'error');
        } else {
            update('livekit', 'ready');
        }

        setIsScanning(false);
    }, [mode]);

    useEffect(() => {
        if (isOpen) runChecks();
    }, [isOpen, runChecks]);

    // The modal blocks the whole application, so it must be operable by
    // keyboard: Escape closes it, Tab is trapped inside, and focus returns
    // to whatever opened it. Previously it could only be dismissed by
    // clicking the backdrop, which a keyboard-only user cannot reach.
    useEffect(() => {
        if (!isOpen) return;

        previouslyFocused.current = document.activeElement;
        dialogRef.current?.focus();

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusables = dialogRef.current?.querySelectorAll(
                'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusables?.length) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            previouslyFocused.current?.focus?.();
        };
    }, [isOpen, onClose]);

    const allReady = Object.values(checks).every(s => s === 'ready');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
                    {/* Backdrop with Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        aria-hidden="true"
                        className="absolute inset-0 bg-zinc-900/20 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, rotateX: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="system-check-title"
                        tabIndex={-1}
                        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto scroll-fade bg-white/95 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 p-8 md:p-12 opacity-[0.02] pointer-events-none">
                            <Activity size={240} className="text-black font-black" />
                        </div>

                        {/* Modal Header */}
                        <div className="relative z-10 text-center space-y-3 md:space-y-4 mb-8 md:mb-10">
                            <div className="inline-flex p-4 md:p-5 rounded-[2rem] bg-black shadow-2xl shadow-zinc-200 mb-2">
                                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white stroke-[2.5]" />
                            </div>
                            <div>
                                <h2 id="system-check-title" className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">System Check</h2>
                                <p className="text-xs md:text-sm text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Verifying network, server, speech engine and microphone</p>
                            </div>
                        </div>

                        {/* Check Grid */}
                        <div className="relative z-10 grid grid-cols-1 gap-3 md:gap-4 mb-8 md:mb-10">
                            <CheckItem
                                icon={Globe}
                                label="Uplink Connection"
                                status={checks.internet}
                                detail="Network Availability Check"
                            />
                            <CheckItem
                                icon={Server}
                                label="System Gateway"
                                status={checks.backend}
                                detail={`${import.meta.env.VITE_BACKEND_URL || 'Local'} Node Response`}
                            />
                            <CheckItem
                                icon={Fingerprint}
                                label="Engine Core"
                                status={checks.worker}
                                detail="Whisper Synchronization"
                            />
                            <CheckItem
                                icon={Mic}
                                label="Audio Interface"
                                status={checks.mic}
                                detail="Hardware Stream Protocol"
                            />
                            {mode === 'agent' && (
                                <CheckItem
                                    icon={Wifi}
                                    label="LiveKit Protocol"
                                    status={checks.livekit}
                                    detail="RTC Cloud Synchronization"
                                />
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="relative z-10 flex flex-col gap-4">
                            <button
                                disabled={isScanning || !allReady}
                                onClick={onComplete}
                                className={clsx(
                                    "w-full py-4 md:py-5 rounded-[2rem] font-black text-base md:text-lg transition-all duration-500 shadow-2xl active:scale-95 flex items-center justify-center gap-3 md:gap-4",
                                    allReady
                                        ? "bg-black text-white shadow-zinc-200 hover:shadow-zinc-300 hover:-translate-y-1"
                                        : "bg-zinc-100 text-zinc-500 cursor-not-allowed border border-zinc-200"
                                )}
                            >
                                {isScanning ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Fingerprint className="w-5 h-5 md:w-6 md:h-6" />}
                                {isScanning ? "Checking..." : allReady ? "Start session" : "Checks incomplete"}
                            </button>

                            {!allReady && !isScanning && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-center gap-2 text-zinc-600 bg-zinc-50 py-3 rounded-2xl">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-xs font-bold">
                                            {checks.worker === 'error' && checks.backend === 'ready'
                                                ? "Speech engine isn't responding yet"
                                                : checks.backend === 'error'
                                                    ? "Can't reach the server on port 8080"
                                                    : checks.mic === 'error'
                                                        ? "Microphone access was blocked"
                                                        : "Some checks didn't pass"}
                                        </span>
                                    </div>
                                    <button
                                        onClick={runChecks}
                                        aria-label="Run the system checks again"
                                        className="w-full py-3 rounded-2xl bg-white border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-50 active:scale-95 transition-all"
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
