import { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { Mic, MicOff, Activity, MessageSquare, Wifi, WifiOff, AlertCircle, Zap, TrendingUp, Globe, PhoneOff, ShieldCheck, ChevronRight, BarChart3, Fingerprint } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';
import { SparklesCore } from './components/ui/sparkles';
import { BackgroundGradient } from './components/ui/background-gradient';
import { MovingBorder } from './components/ui/moving-border';
import { TextGenerateEffect } from './components/ui/text-generate-effect';

// --- Highly Optimized Background Components ---

const GeometricBackground = memo(() => (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-5%] w-[30%] h-[30%] rounded-full bg-blue-600 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
    </div>
));

const HighlyOptimizedSpotlight = memo(() => {
    const spotlightRef = useRef(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (spotlightRef.current) {
                // Use requestAnimationFrame for buttery smooth movement
                requestAnimationFrame(() => {
                    spotlightRef.current.style.setProperty('--x', `${e.clientX}px`);
                    spotlightRef.current.style.setProperty('--y', `${e.clientY}px`);
                });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div
            ref={spotlightRef}
            className="pointer-events-none fixed inset-0 z-30 lg:absolute will-change-transform"
            style={{
                background: `radial-gradient(1000px at var(--x, -1000px) var(--y, -1000px), rgba(99, 102, 241, 0.05), transparent 80%)`,
            }}
        />
    );
});

const MemoizedSparkles = memo(() => (
    <div className="fixed inset-0 z-0 opacity-[0.15] pointer-events-none">
        <SparklesCore
            id="tsparticlesfullpage"
            background="transparent"
            minSize={1}
            maxSize={2.5}
            particleDensity={20}
            className="w-full h-full"
            particleColor="#6366f1"
        />
    </div>
));

// --- Main Application ---

function App() {
    const [url] = useState(import.meta.env.VITE_LIVEKIT_URL || '');
    const {
        connect,
        disconnect,
        isConnected,
        transcripts,
        connectionQuality,
        agentConnected,
        setLanguage,
        toggleMicrophone,
        micEnabled
    } = useLiveKit(url);

    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [isSystemCheckOpen, setIsSystemCheckOpen] = useState(false);
    const hasCheckedSession = useRef(false);

    // Initial System Check Trigger
    useEffect(() => {
        const checkStatus = sessionStorage.getItem('vox_nexus_system_checked');
        if (!checkStatus && !hasCheckedSession.current) {
            hasCheckedSession.current = true;
            // Slight delay for better entry animation feel
            const timer = setTimeout(() => setIsSystemCheckOpen(true), 800);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (isConnected && agentConnected) {
            setLanguage(currentLanguage);
        }
    }, [isConnected, agentConnected, currentLanguage, setLanguage]);

    const fetchToken = useCallback(async () => {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
            const userId = `vx-${Math.floor(Math.random() * 9000) + 1000}`;
            const response = await fetch(`${backendUrl}/token?room=vox-nexus&name=${userId}`);
            if (!response.ok) throw new Error('ERR_TOKEN_FETCH');
            const data = await response.json();
            return data.token;
        } catch (e) {
            console.error("[VOX_NEXUS] Token failure:", e);
            return null;
        }
    }, []);

    const handleToggleConnect = useCallback(async () => {
        if (isConnected) {
            await disconnect();
        } else {
            const t = await fetchToken();
            if (t) await connect(t, url);
        }
    }, [isConnected, disconnect, connect, url, fetchToken]);

    const qualityConfig = useMemo(() => {
        switch (connectionQuality) {
            case 'excellent': return { color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Optimized' };
            case 'good': return { color: 'text-blue-500', bg: 'bg-blue-50', label: 'Stable' };
            case 'poor': return { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Degraded' };
            default: return { color: 'text-slate-400', bg: 'bg-slate-100', label: 'Initializing' };
        }
    }, [connectionQuality]);

    return (
        <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans selection:bg-indigo-100 overflow-x-hidden relative">

            <HighlyOptimizedSpotlight />
            <GeometricBackground />
            <MemoizedSparkles />

            <div className="max-w-[1400px] mx-auto p-4 sm:p-6 md:p-8 flex flex-col lg:h-screen relative z-10">

                {/* Dashboard Header - Linear/Modern Style */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10 pb-10 border-b border-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={() => window.location.reload()}>
                            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                            <div className="relative bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 rounded-[1.25rem] border border-slate-100 transition-all duration-300 group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] group-hover:scale-105 active:scale-95">
                                <Activity className="w-8 h-8 text-indigo-600 stroke-[2.5]" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl md:text-4xl font-[900] tracking-tight text-slate-900 flex items-center gap-2">
                                VoxNexus
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-widest mt-1">v2.0</span>
                            </h1>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5" />
                                Neural Processing Core
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={() => setIsSystemCheckOpen(true)}
                            className="group flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-400 hover:bg-slate-50 transition-all font-bold text-sm shadow-sm active:scale-95"
                        >
                            <ShieldCheck className="w-4 h-4 text-indigo-500 group-hover:rotate-12 transition-transform" />
                            Integrity Scan
                        </button>

                        <div className={clsx("flex items-center gap-2.5 px-6 py-3 rounded-2xl border transition-all shadow-sm font-black text-sm", qualityConfig.bg, qualityConfig.color, "border-transparent")}>
                            {isConnected ? <Wifi className="w-4 h-4 animate-pulse" /> : <WifiOff className="w-4 h-4" />}
                            <span className="uppercase tracking-widest">{qualityConfig.label}</span>
                        </div>

                        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                            <div className={clsx("w-3 h-3 rounded-full relative", isConnected ? "bg-emerald-500" : "bg-slate-200")}>
                                {isConnected && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40" />}
                            </div>
                            <span className="text-slate-500 font-black text-sm uppercase tracking-widest">{isConnected ? 'Uplink active' : 'Disconnected'}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden lg:min-h-0">

                    {/* Sidebar: System Controls (4 cols) */}
                    <aside className="lg:col-span-4 flex flex-col gap-8 overflow-y-auto lg:pr-2 lg:custom-scrollbar max-lg:pb-4">

                        {/* Control Module */}
                        <BackgroundGradient className="rounded-[32px] p-1 bg-white">
                            <div className="p-8 rounded-[28px] bg-white h-full flex flex-col">
                                <div className="flex items-center justify-between mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                                            <Zap className="w-6 h-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">System Command</h2>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Auth Level: 0x99</p>
                                        </div>
                                    </div>
                                    <Fingerprint className="w-6 h-6 text-slate-200" />
                                </div>

                                <div className="space-y-6 flex-1">
                                    {/* Worker Status Box */}
                                    <div className="flex items-center justify-between p-5 bg-slate-50/80 rounded-2xl border border-slate-100 transition-all hover:border-indigo-100 group">
                                        <div className="flex items-center gap-4">
                                            <div className={clsx("w-3 h-3 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)]", agentConnected ? "bg-emerald-500" : "bg-amber-400")} />
                                            <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Neural Worker</span>
                                        </div>
                                        <span className={clsx("text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.1em]", agentConnected ? "bg-emerald-100/50 text-emerald-700 border border-emerald-200" : "bg-amber-100/50 text-amber-700 border border-amber-200")}>
                                            {agentConnected ? "Online" : "Booting"}
                                        </span>
                                    </div>

                                    {/* Language Selector */}
                                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-white border border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                                                    <Globe className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" />
                                                </div>
                                                <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Dialect</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300" />
                                        </div>
                                        <select
                                            value={currentLanguage}
                                            onChange={(e) => setCurrentLanguage(e.target.value)}
                                            className="w-full bg-white text-xs font-black text-slate-600 outline-none cursor-pointer border border-slate-200 rounded-2xl px-4 py-3 focus:ring-[6px] focus:ring-indigo-500/5 focus:border-indigo-400 transition-all appearance-none"
                                        >
                                            <option value="en">ENGLISH (US-CORE)</option>
                                            <option value="es">SPANISH (EUROPE)</option>
                                            <option value="fr">FRENCH (PARISIAN)</option>
                                            <option value="de">GERMAN (STANDARD)</option>
                                            <option value="hi">HINDI (BHARAT)</option>
                                            <option value="ja">JAPANESE (TOKYO)</option>
                                            <option value="zh">CHINESE (MANDARIN)</option>
                                        </select>
                                    </div>

                                    {/* Master Action Buttons */}
                                    <div className="grid grid-cols-2 gap-5 pt-4">
                                        {isConnected ? (
                                            <>
                                                <button
                                                    onClick={toggleMicrophone}
                                                    className={clsx(
                                                        "group relative py-6 px-4 rounded-[2rem] font-black transition-all duration-500 shadow-sm border active:scale-95 flex flex-col items-center justify-center gap-4",
                                                        micEnabled
                                                            ? "bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:shadow-indigo-100"
                                                            : "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 hover:shadow-rose-100"
                                                    )}
                                                >
                                                    <div className="p-3 rounded-full bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                                                        {micEnabled ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-[0.25em]">{micEnabled ? "Capture" : "Silence"}</span>
                                                </button>
                                                <button
                                                    onClick={handleToggleConnect}
                                                    className="group relative py-6 px-4 rounded-[2rem] font-black bg-slate-900 text-white hover:bg-indigo-950 shadow-2xl shadow-indigo-200/50 flex flex-col items-center justify-center gap-4 transition-all duration-500 active:scale-95"
                                                >
                                                    <div className="p-3 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                                                        <PhoneOff className="w-7 h-7" />
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-[0.25em]">Terminate</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="col-span-2">
                                                <MovingBorder
                                                    onClick={handleToggleConnect}
                                                    duration={4000}
                                                    containerClassName="w-full rounded-[2rem] h-24"
                                                    className="bg-indigo-600 text-white font-black text-xl h-full w-full flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_20px_40px_rgba(79,70,229,0.25)] hover:shadow-[0_25px_50px_rgba(79,70,229,0.35)]"
                                                >
                                                    <Zap className="w-7 h-7 fill-white" />
                                                    ESTABLISH LINK
                                                </MovingBorder>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </BackgroundGradient>

                        {/* Telemetry Module (Now Fixed 3D) */}
                        <CardContainer className="w-full" containerClassName="py-0">
                            <CardBody className="w-full">
                                <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] transition-all duration-500">
                                    <CardItem translateZ={30} className="flex items-center gap-4 mb-8">
                                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                                            <BarChart3 className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">Live Analytics</h2>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Metrics Real-time</p>
                                        </div>
                                    </CardItem>

                                    <CardItem translateZ={60} className="w-full grid grid-cols-2 gap-5">
                                        <div className="p-6 rounded-[1.75rem] bg-slate-50 border border-slate-100 group-hover:border-indigo-200 transition-all duration-300">
                                            <span className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Latency</span>
                                            <span className="text-3xl font-black text-slate-900 tracking-tighter">12<span className="text-sm text-indigo-500 ml-1">ms</span></span>
                                        </div>
                                        <div className="p-6 rounded-[1.75rem] bg-slate-50 border border-slate-100 group-hover:border-indigo-200 transition-all duration-300">
                                            <span className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Loss Rate</span>
                                            <span className="text-3xl font-black text-slate-900 tracking-tighter">0.0<span className="text-sm text-indigo-500 ml-1">%</span></span>
                                        </div>
                                    </CardItem>
                                </div>
                            </CardBody>
                        </CardContainer>

                        {/* Note Module */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-[1.75rem] bg-[#FFFBEB] border border-[#FEF3C7] shadow-sm relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertCircle size={60} />
                            </div>
                            <div className="flex items-start gap-4 relative z-10">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-1 text-amber-600" />
                                <div>
                                    <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1">Optimizer</p>
                                    <p className="text-xs leading-relaxed text-amber-800 font-bold opacity-80">
                                        Detected mobile hardware requires direct interaction for audio routing. Tap manually if uplink status stalls.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </aside>

                    {/* Content Area: Transcription (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.02)] relative lg:h-full">

                        {/* Feed Header */}
                        <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/80 backdrop-blur-xl z-10">
                            <div className="flex items-center gap-5 self-start sm:self-auto">
                                <div className="p-4 rounded-2xl bg-indigo-600 shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer">
                                    <MessageSquare className="w-7 h-7 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-black text-slate-900 text-2xl tracking-tight">Intelligence Stream</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em]">Secure Node</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="text-[10px] text-slate-400 font-mono">ID: VX-99-X</span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-2.5 rounded-full border border-slate-100 bg-white text-slate-600 flex items-center gap-3 self-end sm:self-auto shadow-sm hover:shadow-md transition-all group">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">{transcripts.length} Captured Packets</span>
                            </div>
                        </div>

                        {/* Scrollable Feed */}
                        <div className="flex-1 p-8 sm:p-12 overflow-y-auto lg:custom-scrollbar bg-slate-50/20">
                            <AnimatePresence mode='popLayout'>
                                {transcripts.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.1 }}
                                        className="h-full flex flex-col items-center justify-center gap-8 opacity-[0.25] grayscale-[0.8]"
                                    >
                                        <div className="p-14 bg-indigo-50 rounded-full relative">
                                            <div className="absolute inset-0 bg-indigo-200 blur-[80px] rounded-full opacity-20" />
                                            <Mic className="relative w-24 h-24 text-indigo-600" />
                                        </div>
                                        <div className="text-center space-y-3">
                                            <p className="text-2xl font-black text-slate-400 uppercase tracking-[0.4em]">Standby</p>
                                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest max-w-[300px]">Waiting for hardware signal to begin neural capture</p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="space-y-12 pb-16 max-w-4xl mx-auto">
                                        {transcripts.map((item, i) => (
                                            <motion.div
                                                key={item.timestamp + i}
                                                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                transition={{ duration: 0.7, type: 'spring' }}
                                                className="flex gap-6 sm:gap-10 group"
                                            >
                                                <div className="w-14 h-14 rounded-3xl bg-white border border-slate-100 flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] group-hover:shadow-[0_12px_40px_rgba(79,70,229,0.15)] group-hover:bg-indigo-600 group-hover:border-indigo-600 flex-shrink-0 group-hover:rotate-12 transition-all duration-500">
                                                    <Activity className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <div className="p-8 sm:p-10 rounded-[2.5rem] rounded-tl-none bg-white border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.02)] group-hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)] group-hover:translate-x-2 transition-all duration-700">
                                                        {i === transcripts.length - 1 ? (
                                                            <TextGenerateEffect words={item.text} className="text-lg sm:text-xl md:text-2xl text-slate-800 leading-relaxed font-[700] tracking-tight" />
                                                        ) : (
                                                            <p className="text-lg sm:text-xl md:text-2xl text-slate-700 leading-relaxed font-[700] tracking-tight">{item.text}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-5 px-3">
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] antialiased">Neural Frame</span>
                                                        <div className="h-[2px] bg-slate-100 flex-1 rounded-full group-hover:bg-indigo-100 transition-colors" />
                                                        <span className="text-[10px] font-mono font-black text-slate-400">
                                                            {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{(item.timestamp % 1000).toString().padStart(3, '0')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Bottom Fog */}
                        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
                    </div>

                </main>
            </div>

            {/* Enhanced System Check Entrance */}
            <SystemCheckModal
                isOpen={isSystemCheckOpen}
                onClose={() => setIsSystemCheckOpen(false)}
                onComplete={() => {
                    sessionStorage.setItem('vox_nexus_system_checked', 'true');
                    setIsSystemCheckOpen(false);
                }}
            />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #F1F5F9;
                    border-radius: 20px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #E2E8F0;
                    background-clip: content-box;
                }
            `}</style>
        </div>
    );
}

export default App;
