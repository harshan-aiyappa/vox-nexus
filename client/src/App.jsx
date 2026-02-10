import { useState, useCallback, useEffect } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { Mic, MicOff, Activity, MessageSquare, Wifi, WifiOff, AlertCircle, Zap, TrendingUp, Globe, PhoneOff, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';
import { SparklesCore } from './components/ui/sparkles';
import { BackgroundGradient } from './components/ui/background-gradient';
import { MovingBorder } from './components/ui/moving-border';
import { TextGenerateEffect } from './components/ui/text-generate-effect';

function App() {
    const [url, setUrl] = useState(import.meta.env.VITE_LIVEKIT_URL || '');
    const [token, setToken] = useState('');
    const { connect, disconnect, isConnected, connectionState, transcripts, room, connectionQuality, agentConnected, setLanguage, toggleMicrophone, micEnabled } = useLiveKit(url);
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [isSystemCheckOpen, setIsSystemCheckOpen] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

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
            setToken(data.token);
            return data.token;
        } catch (e) {
            console.error("Failed to fetch token", e);
            return null;
        }
    };

    const handleToggleConnect = async () => {
        if (isConnected) {
            await disconnect();
        } else {
            const t = await fetchToken();
            if (t) await connect(t, url);
        }
    };

    const getConnectionQualityColor = () => {
        switch (connectionQuality) {
            case 'excellent': return 'text-emerald-400';
            case 'good': return 'text-blue-400';
            case 'poor': return 'text-amber-400';
            default: return 'text-rose-400';
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">

            {/* Dynamic Spotlight Effect */}
            <div
                className="pointer-events-none fixed inset-0 z-30 transition duration-300 lg:absolute"
                style={{
                    background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(29, 78, 216, 0.15), transparent 80%)`
                }}
            />

            {/* Sparkles Background for Depth */}
            <div className="fixed inset-0 z-0 opacity-30">
                <SparklesCore
                    id="tsparticlesfullpage"
                    background="transparent"
                    minSize={0.6}
                    maxSize={1.4}
                    particleDensity={40}
                    className="w-full h-full"
                    particleColor="#6366f1"
                />
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col h-screen relative z-10">

                {/* Header */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 pb-8 border-b border-slate-800/50">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                            <div className="relative bg-slate-900 p-4 rounded-2xl border border-slate-700 shadow-2xl">
                                <Activity className="w-8 h-8 text-indigo-400" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                                VoxNexus
                            </h1>
                            <p className="text-slate-400 font-medium">Next-Gen Real-time Voice Intelligence</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={() => setIsSystemCheckOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all font-semibold text-sm backdrop-blur-md"
                        >
                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                            Security Scan
                        </button>
                        <div className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm transition-all", getConnectionQualityColor())}>
                            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                            <span className="capitalize font-bold text-sm tracking-wide">{connectionQuality}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <div className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" : "bg-slate-600")} />
                            <span className="text-slate-300 font-bold">{isConnected ? 'System Online' : 'Standby'}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">

                    {/* Left Panel: Connection & Metrics */}
                    <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

                        {/* Connection Strategy Card with Background Gradient */}
                        <BackgroundGradient className="rounded-[22px] p-1 bg-slate-900">
                            <div className="p-7 rounded-[20px] bg-slate-950/90 backdrop-blur-xl">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                        <Zap className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Deployment Controller</h2>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-2.5 h-2.5 rounded-full", agentConnected ? "bg-emerald-500 animate-bounce" : "bg-amber-500")} />
                                            <span className="text-sm font-bold text-slate-300">Neural Worker</span>
                                        </div>
                                        <span className={clsx("text-xs font-black px-3 py-1 rounded-full", agentConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20")}>
                                            {agentConnected ? "ACTIVE" : "PENDING"}
                                        </span>
                                    </div>

                                    <div className="relative group p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 transition-all hover:bg-slate-900">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-5 h-5 text-indigo-400" />
                                                <span className="text-sm font-bold text-slate-300">Linguistic Profile</span>
                                            </div>
                                            <select
                                                value={currentLanguage}
                                                onChange={(e) => setCurrentLanguage(e.target.value)}
                                                className="bg-slate-950 text-xs font-black text-indigo-400 outline-none cursor-pointer border border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/40"
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
                                                        "group relative py-4 px-4 rounded-2xl font-black transition-all duration-300 flex flex-col items-center justify-center gap-2 border shadow-xl overflow-hidden",
                                                        micEnabled
                                                            ? "bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500"
                                                            : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                                                    )}
                                                >
                                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                                        {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                                                        <span className="text-[10px] uppercase tracking-widest">{micEnabled ? "MUTE" : "UNMUTE"}</span>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={handleToggleConnect}
                                                    className="group relative py-4 px-4 rounded-2xl font-black bg-rose-500 text-white hover:bg-rose-600 shadow-2xl shadow-rose-500/30 flex flex-col items-center justify-center gap-2 transition-all"
                                                >
                                                    <PhoneOff className="w-6 h-6" />
                                                    <span className="text-[10px] uppercase tracking-widest">TERMINATE</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="col-span-2">
                                                <MovingBorder
                                                    onClick={handleToggleConnect}
                                                    duration={3000}
                                                    containerClassName="w-full rounded-2xl h-[4.5rem]"
                                                    className="bg-indigo-600 text-white font-black text-lg h-full w-full flex items-center justify-center gap-3 active:scale-95 transition-transform"
                                                >
                                                    <Mic className="w-6 h-6" />
                                                    INITIALIZE LINK
                                                </MovingBorder>
                                            </div>
                                        )}
                                    </div>

                                    {isConnected && (
                                        <div className="flex items-center justify-center gap-3 bg-slate-900/80 py-3 rounded-xl border border-slate-800">
                                            <div className="flex gap-1">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                                ))}
                                            </div>
                                            <span className="text-xs font-black text-indigo-400 tracking-[0.2em] uppercase">Processing Stream</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </BackgroundGradient>

                        {/* Telemetry Card */}
                        <CardContainer className="w-full">
                            <CardBody className="w-full">
                                <div className="p-7 rounded-[22px] bg-slate-900/40 backdrop-blur-md border border-slate-800 flex flex-col gap-6">
                                    <CardItem translateZ={20} className="flex items-center gap-3">
                                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                                        <h2 className="text-lg font-bold text-white tracking-tight">Telemetry</h2>
                                    </CardItem>

                                    <CardItem translateZ={40} className="w-full grid grid-cols-2 gap-4">
                                        <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 group transition-all hover:bg-indigo-500/10">
                                            <span className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Latency</span>
                                            <span className="text-2xl font-mono font-black text-indigo-300">12ms</span>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 group transition-all hover:bg-indigo-500/10">
                                            <span className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Jitter</span>
                                            <span className="text-2xl font-mono font-black text-indigo-300">0.4%</span>
                                        </div>
                                    </CardItem>
                                </div>
                            </CardBody>
                        </CardContainer>

                        {/* System Note */}
                        <div className="p-5 rounded-2x2 bg-indigo-500/5 border border-indigo-500/10">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
                                <div>
                                    <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                                        <strong className="text-slate-200">OPTIMIZATION:</strong> Mobile browser audio requires an active interaction layer. If stream interruptions occur, manually trigger the hardware resume.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Intelligence Output */}
                    <div className="lg:col-span-2 flex flex-col rounded-[2.5rem] bg-slate-900/30 backdrop-blur-3xl border border-slate-800/50 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)]">
                        <div className="p-7 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/20">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-xl bg-indigo-500/10">
                                    <MessageSquare className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <span className="block font-black text-white text-lg tracking-tight">Intelligence Transcript</span>
                                    <span className="text-xs text-slate-400 font-mono">ENCRYPTED_FEED_01</span>
                                </div>
                            </div>
                            <div className="px-4 py-1.5 rounded-full border border-slate-700 bg-slate-950/50 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{transcripts.length} Frames Captured</span>
                            </div>
                        </div>

                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-slate-950/20">
                            {transcripts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                                        <Mic className="relative w-24 h-24 text-slate-800 animate-pulse" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-xl font-black text-slate-600 uppercase tracking-[0.3em]">Awaiting Uplink</p>
                                        <p className="text-sm text-slate-500 font-medium">Connect your hardware to begin real-time neural mapping</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 pb-10">
                                    {transcripts.map((item, i) => (
                                        <div key={i} className="flex gap-6 group animate-in slide-in-from-bottom-6 fade-in duration-700">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center shadow-xl shadow-indigo-900/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <Activity className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <div className="p-6 rounded-3xl rounded-tl-none bg-slate-900/50 border border-slate-700/50 backdrop-blur-md shadow-lg group-hover:bg-slate-900/80 transition-all">
                                                    {i === transcripts.length - 1 ? (
                                                        <TextGenerateEffect words={item.text} className="text-lg text-indigo-50 leading-relaxed font-medium" />
                                                    ) : (
                                                        <p className="text-lg text-slate-300 leading-relaxed font-medium">{item.text}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 px-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest antialiased">Neural Engine Output</span>
                                                    <div className="h-px bg-slate-800 flex-1" />
                                                    <span className="text-[10px] font-mono text-slate-500">
                                                        {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{(item.timestamp % 1000).toString().padStart(3, '0')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
                @keyframes gradient {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
}

export default App;
