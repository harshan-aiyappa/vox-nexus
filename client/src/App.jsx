import { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { Mic, MicOff, Activity, MessageSquare, Wifi, WifiOff, AlertCircle, Zap, TrendingUp, Globe, PhoneOff, ShieldCheck, ChevronRight, BarChart3, Fingerprint, Layers, Cpu, Radio } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';
import { SparklesCore } from './components/ui/sparkles';
import { BackgroundGradient } from './components/ui/background-gradient';
import { MovingBorder } from './components/ui/moving-border';
import { TextGenerateEffect } from './components/ui/text-generate-effect';

// --- Optimized Background Components ---

const GeometricBackground = memo(() => (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-[0.04]">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-indigo-500 blur-[130px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] rounded-full bg-blue-500 blur-[110px]" />
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
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
                background: `radial-gradient(1100px at var(--x, -1000px) var(--y, -1000px), rgba(99, 102, 241, 0.04), transparent 80%)`,
            }}
        />
    );
});

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
    const [isSystemChecked, setIsSystemChecked] = useState(false);
    const scrollRef = useRef(null);

    // Auto-scroll logic for feed
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [transcripts]);

    useEffect(() => {
        const checkStatus = sessionStorage.getItem('vox_nexus_system_checked');
        if (checkStatus === 'true') {
            setIsSystemChecked(true);
        } else {
            const timer = setTimeout(() => setIsSystemCheckOpen(true), 600);
            return () => clearTimeout(timer);
        }
    }, []);

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
        if (!isSystemChecked) {
            setIsSystemCheckOpen(true);
            return;
        }
        if (isConnected) await disconnect();
        else {
            const t = await fetchToken();
            if (t) await connect(t, url);
        }
    }, [isConnected, disconnect, connect, url, fetchToken, isSystemChecked]);

    const handleToggleMic = useCallback(() => {
        if (!isSystemChecked) {
            setIsSystemCheckOpen(true);
            return;
        }
        toggleMicrophone();
    }, [toggleMicrophone, isSystemChecked]);

    return (
        <div className="h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 overflow-hidden relative flex flex-col">

            <HighlyOptimizedSpotlight />
            <GeometricBackground />

            {/* Top Navigation Bar */}
            <nav className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-8 z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-100">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">VoxNexus</h1>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Linguistic Processing Node</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                {isConnected ? "Live Uplink" : "Neural Standby"}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSystemCheckOpen(true)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all hover:shadow-sm"
                    >
                        <ShieldCheck className="w-5 h-5" />
                    </button>
                </div>
            </nav>

            <main className="flex-1 overflow-hidden flex flex-col lg:flex-row relative z-10">

                {/* Left Controls: Balanced Positioning */}
                <aside className="w-full lg:w-[400px] border-r border-slate-100 flex flex-col bg-white/40 p-8 space-y-8 overflow-y-auto no-scrollbar scroll-smooth">

                    {/* Core Systems */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">System Command</h2>
                        </div>

                        <BackgroundGradient className="rounded-[2.5rem] p-1 bg-white">
                            <div className="bg-white rounded-[2.2rem] p-6 space-y-6">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("w-3 h-3 rounded-full", agentConnected ? "bg-emerald-500" : "bg-amber-400")} />
                                        <span className="text-[11px] font-black uppercase text-slate-700">Neural Agent</span>
                                    </div>
                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Running</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Linguistic Profile</label>
                                    <select
                                        value={currentLanguage}
                                        onChange={(e) => setCurrentLanguage(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-600 appearance-none outline-none focus:border-indigo-300 transition-all"
                                    >
                                        <option value="en">English (Global)</option>
                                        <option value="es">Spanish (ES)</option>
                                        <option value="fr">French (FR)</option>
                                        <option value="hi">Hindi (IN)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleToggleMic}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-3 py-5 rounded-3xl transition-all duration-500 active:scale-95",
                                            !isSystemChecked ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60" :
                                                micEnabled ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" : "bg-slate-50 text-slate-400 border border-slate-200"
                                        )}
                                    >
                                        {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest">{!isSystemChecked ? "Locked" : micEnabled ? "Mute" : "Speak"}</span>
                                    </button>
                                    <button
                                        onClick={handleToggleConnect}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-3 py-5 rounded-3xl transition-all duration-500 active:scale-95 text-white",
                                            !isSystemChecked ? "bg-slate-200 text-slate-400 cursor-not-allowed grayscale" :
                                                isConnected ? "bg-slate-900 shadow-xl shadow-slate-200" : "bg-indigo-600 shadow-xl shadow-indigo-100"
                                        )}
                                    >
                                        {isConnected ? <PhoneOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest">{!isSystemChecked ? "Locked" : isConnected ? "Quit" : "Link"}</span>
                                    </button>
                                </div>
                            </div>
                        </BackgroundGradient>
                    </div>

                    {/* Telemetry Visualizer */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                            <Radio className="w-4 h-4 text-emerald-500" />
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Stream Analytics</h2>
                        </div>

                        <CardContainer containerClassName="py-0">
                            <CardBody>
                                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-700">Packet Integrity</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Real-time stats</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <CardItem translateZ={40} className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Ping</span>
                                            <p className="text-xl font-black text-slate-900">12<span className="text-indigo-500 text-[10px] ml-0.5">ms</span></p>
                                        </CardItem>
                                        <CardItem translateZ={40} className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Jitter</span>
                                            <p className="text-xl font-black text-slate-900">0.2<span className="text-indigo-500 text-[10px] ml-0.5">ms</span></p>
                                        </CardItem>
                                    </div>
                                </div>
                            </CardBody>
                        </CardContainer>
                    </div>

                    {/* Tech Insight */}
                    <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 relative group overflow-hidden transition-all">
                        <Cpu className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-600 opacity-5 group-hover:scale-110 transition-transform duration-700" />
                        <div className="flex items-start gap-4 relative z-10">
                            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">Optimized Path</p>
                                <p className="text-[10px] font-bold text-indigo-700 leading-relaxed opacity-70">
                                    Neural processing is optimized for ultra-low latency. Mobile devices require manual trigger for audio routing.
                                </p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Area: Spacious Translation Feed */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    {/* Feed Header */}
                    <div className="px-10 h-20 border-b border-slate-50 bg-white/50 backdrop-blur-md flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-slate-900 rounded-xl">
                                <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-black text-slate-900 uppercase tracking-[0.15em]">Neural Intelligence Feed</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{transcripts.length} Packets</span>
                        </div>
                    </div>

                    {/* Scrollable Region: Scrollbar hidden */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-10 lg:p-16 no-scrollbar"
                    >
                        <AnimatePresence mode="popLayout">
                            {transcripts.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="h-full flex flex-col items-center justify-center opacity-20"
                                >
                                    <div className="p-12 bg-slate-100 rounded-full mb-8">
                                        <Radio className="w-16 h-16 text-slate-400 animate-pulse" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">Listening</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Standing by for audio capture</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-12 max-w-4xl mx-auto pb-20">
                                    {transcripts.map((item, i) => (
                                        <motion.div
                                            key={item.timestamp + i}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex gap-8 group"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-indigo-100">
                                                <Activity className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div className="bg-white p-8 rounded-[2.5rem] rounded-tl-none border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.02)] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.04)] group-hover:border-indigo-100 transition-all duration-700">
                                                    <TextGenerateEffect words={item.text} className="text-xl font-bold text-slate-800 leading-relaxed" />
                                                </div>
                                                <div className="flex items-center gap-4 px-2">
                                                    <div className="h-[1px] bg-slate-100 flex-1" />
                                                    <span className="text-[9px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                                        {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Feed Footer Gradient */}
                    <div className="h-20 bg-gradient-to-t from-white to-transparent absolute bottom-0 left-0 right-0 pointer-events-none" />
                </div>

            </main>

            <SystemCheckModal
                isOpen={isSystemCheckOpen}
                onClose={() => setIsSystemCheckOpen(false)}
                onComplete={() => {
                    sessionStorage.setItem('vox_nexus_system_checked', 'true');
                    setIsSystemChecked(true);
                    setIsSystemCheckOpen(false);
                }}
            />

            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

export default App;
