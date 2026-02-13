import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, XCircle, Info, WifiOff, ServerCrash, MicOff } from 'lucide-react';
import clsx from 'clsx';

export const toast = (message, type = 'info', duration = 4000) => {
    window.dispatchEvent(new CustomEvent('toast-message', { detail: { message, type, duration } }));
};

const icons = {
    error: XCircle,
    success: CheckCircle2,
    warning: AlertCircle,
    info: Info,
    disconnect: WifiOff,
    server: ServerCrash,
    mic: MicOff
};

export function Toaster() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handleToast = (e) => {
            const { message, type, duration } = e.detail;
            const id = Date.now();
            setToasts(prev => [...prev, { id, message, type, duration }]);

            if (duration > 0) {
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== id));
                }, duration);
            }
        };

        window.addEventListener('toast-message', handleToast);
        return () => window.removeEventListener('toast-message', handleToast);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => {
                    const Icon = icons[toast.type] || Info;
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            layout
                            className={clsx(
                                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border backdrop-blur-md min-w-[300px]",
                                toast.type === 'error' || toast.type === 'disconnect' || toast.type === 'server' || toast.type === 'mic' ? "bg-red-50/90 border-red-100 dark:bg-red-950/80 dark:border-red-900" :
                                    toast.type === 'success' ? "bg-emerald-50/90 border-emerald-100 dark:bg-emerald-950/80 dark:border-emerald-900" :
                                        "bg-white/90 border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800"
                            )}
                        >
                            <div className={clsx(
                                "p-2 rounded-xl",
                                toast.type === 'error' || toast.type === 'disconnect' || toast.type === 'server' || toast.type === 'mic' ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400" :
                                    toast.type === 'success' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" :
                                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className={clsx(
                                    "text-sm font-bold",
                                    toast.type === 'error' || toast.type === 'disconnect' || toast.type === 'server' || toast.type === 'mic' ? "text-red-900 dark:text-red-200" :
                                        toast.type === 'success' ? "text-emerald-900 dark:text-emerald-200" :
                                            "text-zinc-900 dark:text-zinc-200"
                                )}>
                                    {toast.message}
                                </p>
                            </div>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <XCircle className="w-4 h-4 opacity-40 hover:opacity-100" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
