import { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { Mic, MicOff, Activity, MessageSquare, Wifi, WifiOff, AlertCircle, Zap, TrendingUp, Globe, PhoneOff, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';
import { SparklesCore } from './components/ui/sparkles';
import { BackgroundGradient } from './components/ui/background-gradient';
import { MovingBorder } from './components/ui/moving-border';
import { TextGenerateEffect } from './components/ui/text-generate-effect';

// Optimized Spotlight Component to prevent full App re-renders
const Spotlight = memo(() => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const smoothX = useSpring(mouseX, { damping: 50, stiffness: 400 });
    const smoothY = useSpring(mouseY, { damping: 50, stiffness: 400 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);

    return (
        <motion.div
            className="pointer-events-none fixed inset-0 z-30 lg:absolute pointer-events-none"
            style={{
                background: `radial-gradient(800px at var(--x) var(--y), rgba(99, 102, 241, 0.06), transparent 80%)`,
                '--x': smoothX.get() + 'px',
                '--y': smoothY.get() + 'px'
            }}
            // Use framer-motion to update CSS variables efficiently
            animate={{
                '--x': 'var(--current-x)',
                '--y': 'var(--current-y)'
            }}
        />
    );
});

// Actually, animating CSS vars via framer-motion is okay, but simpler is better.
// Let's use a simple div with inline style that doesn't trigger React re-renders for the whole app.
const HighlyOptimizedSpotlight = memo(() => {
    const spotlightRef = useRef(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (spotlightRef.current) {
                spotlightRef.current.style.setProperty('--x', `${e.clientX}px`);
                spotlightRef.current.style.setProperty('--y', `${e.clientY}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div
            ref={spotlightRef}
            className="pointer-events-none fixed inset-0 z-30 lg:absolute will-change-[background]"
            style={{
                background: `radial-gradient(800px at var(--x, -1000px) var(--y, -1000px), rgba(99, 102, 241, 0.07), transparent 80%)`,
            }}
        />
    );
});

// Memoized Background Components
const MemoizedSparkles = memo(() => (
    <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <SparklesCore
            id="tsparticlesfullpage"
            background="transparent"
            minSize={0.8}
            maxSize={2.0}
            particleDensity={30}
            className="w-full h-full"
            particleColor="#6366f1"
        />
    </div>
));

function App() {
    const [url, setUrl] = useState(import.meta.env.VITE_LIVEKIT_URL || '');
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

    useEffect(() => {
        const hasChecked = sessionStorage.getItem('vox_nexus_system_checked');
        if (!hasChecked) {
            setIsSystemCheckOpen(true);
        }
    }, []);

    useEffect(() => {
        if (isConnected && agentConnected) {
            setLanguage(currentLanguage);
        }
    }, [isConnected, agentConnected, currentLanguage, setLanguage]);

    const fetchToken = async () => {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
            const userId = `user-${Math.floor(Math.random() * 1000)}`;
            const response = await fetch(`${backendUrl}/token?room=vox-nexus&name=${userId}`);
            if (!response.ok) throw new Error('Token fetch failed');
            const data = await response.json();
            return data.token;
        } catch (e) {
            console.error("Failed to fetch token", e);
            return null;
        }
    };

    const handleToggleConnect = useCallback(async () => {
        if (isConnected) {
            await disconnect();
        } else {
            const t = await fetchToken();
            if (t) await connect(t, url);
        }
    }, [isConnected, disconnect, connect, url]);

    const getConnectionQualityColor = () => {
        switch (connectionQuality) {
            case 'excellent': return 'text-emerald-500';
            case 'good': return 'text-blue-500';
            case 'poor': return 'text-amber-500';
            default: return 'text-rose-500';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 overflow-x-hidden relative">

            <HighlyOptimizedSpotlight />
            <MemoizedSparkles />

            <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col lg:h-screen relative z-10 transition-all duration-500">

                {/* Header */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 md:mb-12 pb-6 md:pb-8 border-b border-indigo-100/80">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity" />
                            <div className="relative bg-white p-3 sm:p-4 rounded-2xl border border-indigo-100 shadow-xl">
                                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 bg-clip-text text-transparent">
                                VoxNexus
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider">Real-time Neural Voice Engine</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 font-bold">
                        <button
                            onClick={() => setIsSystemCheckOpen(true)}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white border border-indigo-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-all text-xs sm:text-sm shadow-sm backdrop-blur-md active:scale-95"
                        >
                            <ShieldCheck className="w-4 h-4 text-indigo-500" />
                            Health
                        </button>
                        <div className={clsx("flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white border border-indigo-50 shadow-sm transition-all", getConnectionQualityColor())}>
                            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                            <span className="capitalize text-xs sm:text-sm tracking-wide">{connectionQuality || 'offline'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white border border-indigo-50 shadow-sm">
                            <div className={clsx("w-2.5 h-2.5 rounded-full", isConnected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse" : "bg-slate-300")} />
                            <span className="text-slate-600 tracking-tight">{isConnected ? 'LIVE' : 'IDLE'}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 overflow-hidden lg:min-h-0">

                    {/* Left Panel: Connection & Metrics */}
                    <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto lg:pr-2 lg:custom-scrollbar max-lg:pb-4">

                        {/* Control Deck */}
                        <BackgroundGradient className="rounded-[28px] p-1 bg-white shadow-lg shadow-indigo-100/30">
                            <div className="p-6 sm:p-8 rounded-[24px] bg-white/95 backdrop-blur-xl h-full flex flex-col border border-indigo-50/50">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                                        <Zap className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">System Core</h2>
                                </div>

                                <div className="space-y-4 sm:space-y-6 flex-1">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-indigo-50 transition-colors hover:bg-white hover:border-indigo-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-3 h-3 rounded-full", agentConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
                                            <span className="text-sm font-black text-slate-700">Neural Worker</span>
                                        </div>
                                        <span className={clsx("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest", agentConnected ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200")}>
                                            {agentConnected ? "ACTIVE" : "STANDBY"}
                                        </span>
                                    </div>

                                    <div className="relative p-4 bg-slate-50 rounded-2xl border border-indigo-50 transition-all hover:bg-white hover:border-indigo-100 hover:shadow-md group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-indigo-100 group-hover:bg-indigo-600 transition-colors">
                                                    <Globe className="w-4 h-4 text-indigo-600 group-hover:text-white" />
                                                </div>
                                                <span className="text-sm font-black text-slate-700">Linguistic Profile</span>
                                            </div>
                                            <select
                                                value={currentLanguage}
                                                onChange={(e) => setCurrentLanguage(e.target.value)}
                                                className="bg-white text-xs font-black text-indigo-600 outline-none cursor-pointer border border-indigo-100 rounded-xl px-3 py-2 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                            >
                                                <option value="en">ENGLISH (US)</option>
                                                <option value="es">SPANISH</option>
                                                <option value="fr">FRENCH</option>
                                                <option value="de">GERMAN</option>
                                                <option value="hi">HINDI</option>
                                                <option value="ja">JAPANESE</option>
                                                <option value="zh">CHINESE</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {isConnected ? (
                                            <>
                                                <button
                                                    onClick={toggleMicrophone}
                                                    className={clsx(
                                                        "group relative py-5 px-4 rounded-2xl font-black transition-all duration-300 flex flex-col items-center justify-center gap-3 border shadow-sm overflow-hidden active:scale-95",
                                                        micEnabled
                                                            ? "bg-white border-indigo-100 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/30"
                                                            : "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100/50"
                                                    )}
                                                >
                                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                                        {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                                                        <span className="text-[10px] uppercase tracking-[0.2em]">{micEnabled ? "MUTE" : "UNMUTE"}</span>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={handleToggleConnect}
                                                    className="group relative py-5 px-4 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-200 flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
                                                >
                                                    <PhoneOff className="w-6 h-6" />
                                                    <span className="text-[10px] uppercase tracking-[0.2em]">QUIT</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="col-span-2">
                                                <MovingBorder
                                                    onClick={handleToggleConnect}
                                                    duration={3500}
                                                    containerClassName="w-full rounded-2xl h-16 sm:h-20"
                                                    className="bg-indigo-600 text-white font-black text-lg h-full w-full flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-200"
                                                >
                                                    <Mic className="w-6 h-6" />
                                                    UPLINK
                                                </MovingBorder>
                                            </div>
                                        )}
                                    </div>

                                    {isConnected && (
                                        <div className="flex items-center justify-center gap-3 bg-indigo-50/50 py-4 rounded-2xl border border-indigo-100/50">
                                            <div className="flex gap-1.5 px-2">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                                ))}
                                            </div>
                                            <span className="text-xs font-black text-indigo-700 tracking-[0.15em] uppercase antialiased">Decoding...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </BackgroundGradient>

                        {/* Telemetry Module */}
                        <CardContainer className="w-full" containerClassName="py-0">
                            <CardBody className="w-full">
                                <div className="p-7 rounded-[28px] bg-white border border-indigo-100/60 shadow-xl shadow-indigo-100/20 flex flex-col gap-6 group hover:border-indigo-300 transition-all">
                                    <CardItem translateZ={20} className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <h2 className="text-lg font-black text-slate-800 tracking-tight">Active Telemetry</h2>
                                    </CardItem>

                                    <CardItem translateZ={40} className="w-full grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all transform-gpu">
                                            <span className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Latency</span>
                                            <span className="text-2xl font-mono font-black text-slate-800">12<span className="text-xs text-slate-400 ml-1 italic font-normal">ms</span></span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all transform-gpu">
                                            <span className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Packet Loss</span>
                                            <span className="text-2xl font-mono font-black text-slate-800">0.0<span className="text-xs text-slate-400 ml-1 italic font-normal">%</span></span>
                                        </div>
                                    </CardItem>
                                </div>
                            </CardBody>
                        </CardContainer>

                        {/* Optimization Protocol */}
                        <div className="p-5 rounded-[22px] bg-amber-50 border border-amber-100 transition-all hover:bg-amber-100/50">
                            <div className="flex items-start gap-4">
                                <div className="p-1.5 rounded-lg bg-white border border-amber-200">
                                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[11px] leading-relaxed text-amber-900 font-black uppercase tracking-wide">Protocol Insight</p>
                                    <p className="text-[11px] leading-relaxed text-amber-700/80 font-semibold mt-0.5">Mobile devices require direct user gestures for hardware stream activation. Manual resume may be needed.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Data Stream */}
                    <div className="lg:col-span-2 flex flex-col rounded-[2.5rem] bg-white border border-indigo-100/80 overflow-hidden shadow-2xl shadow-indigo-100/40 relative">
                        <div className="p-6 sm:p-8 border-b border-indigo-50 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/50 backdrop-blur-md z-10">
                            <div className="flex items-center gap-4 self-start sm:self-auto">
                                <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 transition-transform hover:scale-105 active:scale-95">
                                    <MessageSquare className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-black text-slate-900 text-xl tracking-tight">Intelligence Feed</span>
                                    <span className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.25em]">Secure Uplink • Node_01</span>
                                </div>
                            </div>
                            <div className="px-5 py-2 rounded-full border border-indigo-100 bg-white text-indigo-600 flex items-center gap-3 self-end sm:self-auto shadow-sm transition-all hover:shadow-md">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-widest">{transcripts.length} Captured</span>
                            </div>
                        </div>

                        <div className="flex-1 p-6 sm:p-10 overflow-y-auto lg:custom-scrollbar bg-slate-50/20">
                            {transcripts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6 opacity-40 grayscale-[0.6] transition-all duration-700 hover:grayscale-0 hover:opacity-100">
                                    <div className="p-10 bg-indigo-50 rounded-full relative">
                                        <div className="absolute inset-0 bg-indigo-200 blur-3xl rounded-full opacity-30" />
                                        <Mic className="relative w-16 h-16 sm:w-20 sm:h-20 text-indigo-600" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-xl font-black text-slate-500 uppercase tracking-[0.3em]">Awaiting Link</p>
                                        <p className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-widest">Initialize hardware to begin neural mapping</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-10 pb-12 max-w-4xl mx-auto">
                                    {transcripts.map((item, i) => (
                                        <div key={i} className="flex gap-5 sm:gap-8 group animate-in slide-in-from-bottom-8 fade-in h-auto duration-1000 will-change-transform">
                                            <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all group-hover:bg-indigo-600 group-hover:border-indigo-600 flex-shrink-0 group-hover:rotate-6">
                                                <Activity className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div className="p-6 sm:p-8 rounded-[2rem] rounded-tl-none bg-white border border-indigo-50 shadow-md transform-gpu group-hover:shadow-2xl group-hover:border-indigo-100 group-hover:-translate-y-1 transition-all duration-500">
                                                    {i === transcripts.length - 1 ? (
                                                        <TextGenerateEffect words={item.text} className="text-base sm:text-lg md:text-xl text-slate-800 leading-relaxed font-bold tracking-tight" />
                                                    ) : (
                                                        <p className="text-base sm:text-lg md:text-xl text-slate-700 leading-relaxed font-bold tracking-tight">{item.text}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 px-2">
                                                    <span className="text-[10px] font-black text-indigo-300 group-hover:text-indigo-500 uppercase tracking-[0.2em] transition-colors antialiased">Neural Frame Decoding</span>
                                                    <div className="h-[2px] bg-indigo-50 flex-1 rounded-full group-hover:bg-indigo-100 transition-colors" />
                                                    <span className="text-[10px] font-mono font-black text-slate-400">
                                                        {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Gradient Shadow Overlay */}
                        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white/80 via-white/20 to-transparent pointer-events-none z-10" />
                    </div>

                </main>
            </div>

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
                    background: #e2e8f0;
                    border-radius: 12px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            `}</style>
        </div>
    );
}

export default App;
