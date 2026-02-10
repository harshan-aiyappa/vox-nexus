import { useState, useCallback, useEffect, useRef } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { useDirectStream } from './hooks/useDirectStream';
import { Mic, MicOff, Activity, MessageSquare, Zap, TrendingUp, PhoneOff, ShieldCheck, Layers, Cpu, Radio, AlertCircle, Server, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';
import { TextGenerateEffect } from './components/ui/text-generate-effect';
import { WavyBackground } from './components/ui/wavy-background';

function App() {
    // View State: 'landing' | 'app'
    const [view, setView] = useState('landing');
    // Mode State: 'agent' (LiveKit) | 'direct' (WebSocket)
    const [mode, setMode] = useState('agent');

    // LiveKit Hooks
    const [url] = useState(import.meta.env.VITE_LIVEKIT_URL || '');
    const agent = useLiveKit(url);

    // Direct Mode Hooks
    const direct = useDirectStream('ws://localhost:8000/ws');

    // Unified State Handlers
    const isConnected = mode === 'agent' ? agent.isConnected : direct.isConnected;
    const isRecording = mode === 'agent' ? agent.micEnabled : direct.isRecording;
    const transcripts = mode === 'agent' ? agent.transcripts : direct.transcripts;

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
    }, [transcripts, view]);

    useEffect(() => {
        const checkStatus = sessionStorage.getItem('vox_nexus_system_checked');
        if (checkStatus === 'true') {
            setIsSystemChecked(true);
        }
        // We do NOT automatically open system check on landing page load.
        // It is enforced when entering a mode.
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

        if (mode === 'agent') {
            if (agent.isConnected) await agent.disconnect();
            else {
                const t = await fetchToken();
                if (t) await agent.connect(t, url);
            }
        } else {
            // Direct Mode
            if (direct.isConnected) direct.disconnect();
            else direct.connect();
        }
    }, [isSystemChecked, mode, agent, direct, url, fetchToken]);

    const handleToggleMic = useCallback(() => {
        if (!isSystemChecked) {
            setIsSystemCheckOpen(true);
            return;
        }

        if (mode === 'agent') {
            agent.toggleMicrophone();
        } else {
            direct.toggleRecording();
        }
    }, [isSystemChecked, mode, agent, direct]);

    const handleEnterMode = (selectedMode) => {
        setMode(selectedMode);
        setView('app');
        // Enforce System Check on every mode entry
        setIsSystemChecked(false);
        setIsSystemCheckOpen(true);
    };

    const handleBackHome = async () => {
        if (isConnected) {
            await handleToggleConnect(); // Ensure clean disconnect
        }
        setView('landing');
        setIsSystemChecked(false); // Reset check state on exit
    };

    return (
        <WavyBackground
            className="w-full h-full flex flex-col"
            containerClassName="h-screen bg-white"
            backgroundFill="white"
            waveOpacity={0.2}
            blur={8}
            colors={["#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#52525b"]} // Zinc scale for waves
        >
            {/* Global Header */}
            <nav className="h-16 md:h-20 bg-transparent border-b border-zinc-100 flex items-center justify-between px-4 md:px-8 z-50 shrink-0 w-full relative">
                <div className="flex items-center gap-3 md:gap-4">
                    <button
                        onClick={view === 'app' ? handleBackHome : undefined}
                        className={clsx("flex items-center gap-3 transition-opacity text-left", view === 'app' ? "cursor-pointer hover:opacity-70" : "cursor-default")}
                    >
                        <img src="/logo.png" alt="VoxNexus Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-sm brightness-0" />
                        <div>
                            <h1 className="text-lg md:text-xl lg:text-2xl font-black tracking-tighter text-zinc-900 leading-none">VoxNexus</h1>
                            <p className="text-[10px] md:text-[11px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mt-0.5 md:mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                                Lingotran
                            </p>
                        </div>
                    </button>
                    {view === 'app' && (
                        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-zinc-200 ml-2">
                            <span className="px-2 py-1 rounded-md bg-zinc-100 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                {mode === 'agent' ? 'Agent Mode' : 'Direct Stream'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                    {view === 'app' && (
                        <div className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-1.5 md:py-2 bg-white/80 rounded-xl border border-zinc-200 hidden sm:flex shadow-sm backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className={clsx("w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors duration-500", isConnected ? "bg-zinc-900 animate-pulse" : "bg-zinc-300")} />
                                <span className="text-[9px] md:text-[10px] lg:text-xs font-black uppercase text-zinc-600 tracking-wider">
                                    {isConnected ? (mode === 'agent' ? "Live Uplink" : "Direct Stream") : "Neural Standby"}
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSystemCheckOpen(true)}
                        className="p-2 md:p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-black hover:border-black/10 transition-all hover:shadow-sm active:scale-95"
                    >
                        <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
            </nav>

            <AnimatePresence mode="wait">
                {view === 'landing' ? (
                    <motion.main
                        key="landing"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 w-full"
                    >
                        <div className="text-center mb-10 md:mb-16">
                            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tighter mb-4">Select Communication Protocol</h2>
                            <p className="text-zinc-500 text-sm md:text-base font-medium max-w-xl mx-auto">
                                Choose the architecture layer for your session. Agent Mode utilizes cloud edge logistics, while Direct Stream runs completely local.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 max-w-5xl w-full px-4">
                            {/* Agent Mode Card */}
                            <CardContainer className="inter-var">
                                <CardBody className="bg-white relative group/card hover:shadow-2xl hover:shadow-zinc-500/[0.1] border-zinc-200 w-auto sm:w-[24rem] h-auto rounded-[2rem] p-6 border transition-all duration-300">
                                    <div onClick={() => handleEnterMode('agent')} className="cursor-pointer">
                                        <CardItem translateZ="50" className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                                            Agent Mode
                                        </CardItem>
                                        <CardItem as="p" translateZ="60" className="text-zinc-500 text-sm max-w-sm mt-2 font-medium">
                                            LiveKit WebRTC Cloud Intelligence
                                        </CardItem>
                                        <CardItem translateZ="100" className="w-full mt-8 bg-zinc-50 rounded-xl p-6 flex items-center justify-center border border-zinc-100 group-hover/card:bg-zinc-100 transition-colors">
                                            <Server className="w-20 h-20 text-zinc-800 drop-shadow-sm" />
                                        </CardItem>
                                        <div className="flex justify-between items-center mt-10">
                                            <CardItem translateZ={20} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-zinc-500 bg-zinc-100 tracking-widest">
                                                Ultra-Low Latency
                                            </CardItem>
                                            <CardItem translateZ={20} as="button" className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                                                Initialize &rarr;
                                            </CardItem>
                                        </div>
                                    </div>
                                </CardBody>
                            </CardContainer>

                            {/* Direct Mode Card */}
                            <CardContainer className="inter-var">
                                <CardBody className="bg-white relative group/card hover:shadow-2xl hover:shadow-zinc-500/[0.1] border-zinc-200 w-auto sm:w-[24rem] h-auto rounded-[2rem] p-6 border transition-all duration-300">
                                    <div onClick={() => handleEnterMode('direct')} className="cursor-pointer">
                                        <CardItem translateZ="50" className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                                            Direct Stream
                                        </CardItem>
                                        <CardItem as="p" translateZ="60" className="text-zinc-500 text-sm max-w-sm mt-2 font-medium">
                                            Local WebSocket Stream
                                        </CardItem>
                                        <CardItem translateZ="100" className="w-full mt-8 bg-zinc-50 rounded-xl p-6 flex items-center justify-center border border-zinc-100 group-hover/card:bg-zinc-100 transition-colors">
                                            <Wifi className="w-20 h-20 text-zinc-400 drop-shadow-sm" />
                                        </CardItem>
                                        <div className="flex justify-between items-center mt-10">
                                            <CardItem translateZ={20} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-zinc-500 bg-zinc-100 tracking-widest">
                                                Raw Socket Pipe
                                            </CardItem>
                                            <CardItem translateZ={20} as="button" className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 transition-colors">
                                                Connect &rarr;
                                            </CardItem>
                                        </div>
                                    </div>
                                </CardBody>
                            </CardContainer>
                        </div>
                    </motion.main>
                ) : (
                    <motion.main
                        key="app"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 overflow-hidden flex flex-col lg:flex-row relative z-10 w-full max-w-[1920px] mx-auto bg-transparent"
                    >
                        {/* Left Controls */}
                        <aside className="w-full lg:w-[400px] border-b lg:border-b-0 lg:border-r border-zinc-100 flex flex-col bg-white/60 backdrop-blur-sm p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto no-scrollbar scroll-smooth shrink-0 max-h-[40vh] lg:max-h-none">

                            {/* Core Systems */}
                            <div className="space-y-3 lg:space-y-4">
                                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                                    <Layers className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-900" />
                                    <h2 className="text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-[0.2em] text-zinc-400">System Command</h2>
                                </div>

                                <div className="rounded-[2rem] md:rounded-[2.5rem] p-1 bg-gradient-to-br from-zinc-100 to-white shadow-sm border border-zinc-100">
                                    <div className="bg-white rounded-[1.8rem] md:rounded-[2.2rem] p-4 md:p-6 space-y-4 md:space-y-6">

                                        {/* Status Card */}
                                        <div className="flex items-center justify-between p-3 md:p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className={clsx("w-2.5 h-2.5 md:w-3 md:h-3 rounded-full transition-colors duration-300",
                                                    (mode === 'agent' ? agent.agentConnected : direct.isConnected) ? "bg-zinc-800" : "bg-zinc-300"
                                                )} />
                                                <span className="text-[10px] md:text-[11px] font-black uppercase text-zinc-700">
                                                    {mode === 'agent' ? 'Neural Agent' : 'Socket Relay'}
                                                </span>
                                            </div>
                                            <span className="text-[8px] md:text-[9px] font-black text-zinc-900 uppercase tracking-widest">
                                                {(mode === 'agent' ? agent.agentConnected : direct.isConnected) ? "Online" : "Offline"}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Linguistic Profile</label>
                                            <select
                                                value={currentLanguage}
                                                onChange={(e) => setCurrentLanguage(e.target.value)}
                                                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-3 md:px-4 py-2.5 md:py-3 text-[10px] md:text-xs font-black text-zinc-600 appearance-none outline-none focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200 transition-all cursor-pointer hover:bg-zinc-100"
                                            >
                                                <option value="en">English (Global)</option>
                                                <option value="es">Spanish (ES)</option>
                                                <option value="fr">French (FR)</option>
                                                <option value="hi">Hindi (IN)</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                                            <button
                                                onClick={handleToggleMic}
                                                className={clsx(
                                                    "flex flex-col items-center justify-center gap-2 md:gap-3 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] transition-all duration-300 active:scale-95 border",
                                                    !isSystemChecked ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed opacity-60" :
                                                        isRecording
                                                            ? "bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-200 hover:bg-black"
                                                            : "bg-white border-zinc-200 text-zinc-600 shadow-sm hover:bg-zinc-50 hover:border-zinc-300"
                                                )}
                                            >
                                                {isRecording ? <Mic className="w-5 h-5 md:w-6 md:h-6 animate-pulse" /> : <MicOff className="w-5 h-5 md:w-6 md:h-6" />}
                                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                                                    {!isSystemChecked ? "Locked" : isRecording ? "Live" : "Start"}
                                                </span>
                                            </button>
                                            <button
                                                onClick={handleToggleConnect}
                                                className={clsx(
                                                    "flex flex-col items-center justify-center gap-2 md:gap-3 py-4 md:py-5 rounded-[1.5rem] md:rounded-3xl transition-all duration-500 active:scale-95",
                                                    !isSystemChecked ? "bg-zinc-100 text-zinc-300 cursor-not-allowed grayscale" :
                                                        isConnected
                                                            ? "bg-white border-zinc-200 border text-zinc-900 shadow-xl shadow-zinc-100 hover:bg-zinc-50"
                                                            : "bg-zinc-900 text-white shadow-xl shadow-zinc-200 hover:bg-black border border-zinc-900"
                                                )}
                                            >
                                                {isConnected ? <PhoneOff className="w-4 h-4 md:w-5 md:h-5" /> : <Zap className="w-4 h-4 md:w-5 md:h-5" />}
                                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{!isSystemChecked ? "Locked" : isConnected ? "Leave" : "Connect"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Telemetry Visualizer */}
                            <div className="space-y-3 lg:space-y-4 hidden md:block">
                                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                                    <Radio className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-900" />
                                    <h2 className="text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Stream Analytics</h2>
                                </div>
                                <CardContainer containerClassName="py-0">
                                    <CardBody>
                                        <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-4 md:space-y-6">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="p-2 md:p-2.5 bg-zinc-100 rounded-xl border border-zinc-200">
                                                    <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-900" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] md:text-xs font-black text-zinc-700">Packet Integrity</p>
                                                    <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase">Real-time stats</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                                <CardItem translateZ={40} className="p-3 md:p-4 bg-zinc-50 rounded-2xl space-y-1">
                                                    <span className="text-[8px] md:text-[9px] font-black text-zinc-400 tracking-widest uppercase">Ping</span>
                                                    <p className="text-lg md:text-xl font-black text-zinc-900">12<span className="text-zinc-400 text-[9px] md:text-[10px] ml-0.5">ms</span></p>
                                                </CardItem>
                                                <CardItem translateZ={40} className="p-3 md:p-4 bg-zinc-50 rounded-2xl space-y-1">
                                                    <span className="text-[8px] md:text-[9px] font-black text-zinc-400 tracking-widest uppercase">Jitter</span>
                                                    <p className="text-lg md:text-xl font-black text-zinc-900">0.2<span className="text-zinc-400 text-[9px] md:text-[10px] ml-0.5">ms</span></p>
                                                </CardItem>
                                            </div>
                                        </div>
                                    </CardBody>
                                </CardContainer>
                            </div>

                            {/* Tech Insight */}
                            <div className="bg-zinc-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-zinc-200 relative group overflow-hidden transition-all hover:bg-zinc-100 hidden sm:block">
                                <Cpu className="absolute -right-4 -bottom-4 w-20 h-20 md:w-24 md:h-24 text-zinc-900 opacity-[0.03] group-hover:scale-110 transition-transform duration-700" />
                                <div className="flex items-start gap-3 md:gap-4 relative z-10">
                                    <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[9px] md:text-[10px] font-black text-zinc-900 uppercase tracking-widest mb-1">Optimized Path</p>
                                        <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 leading-relaxed opacity-80">
                                            {mode === 'agent'
                                                ? "Neural processing is optimized for ultra-low latency via WebRTC global edge network."
                                                : "Direct Stream mode bypasses cloud edge for local offline-first processing via WebSocket."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Right Area: Spacious Translation Feed */}
                        <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-sm overflow-hidden border-l border-zinc-100 h-full">
                            {/* Feed Header */}
                            <div className="px-5 md:px-10 h-16 md:h-20 border-b border-zinc-100 bg-white/60 backdrop-blur-md flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="p-2 md:p-2.5 bg-black rounded-xl shadow-lg shadow-black/20">
                                        <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                    </div>
                                    <span className="text-xs md:text-sm font-black text-zinc-900 uppercase tracking-[0.15em]">Neural Intelligence Feed</span>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 rounded-full bg-white border border-zinc-200 shadow-sm">
                                    <span className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">{transcripts.length} Packets</span>
                                </div>
                            </div>

                            {/* Scrollable Region: Scrollbar hidden */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-16 no-scrollbar pb-32 md:pb-20"
                            >
                                <AnimatePresence mode="popLayout">
                                    {transcripts.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="h-full flex flex-col items-center justify-center opacity-40 mix-blend-multiply py-20"
                                        >
                                            <div className="p-8 md:p-12 bg-white rounded-full mb-6 md:mb-8 shadow-sm border border-zinc-100">
                                                <Radio className="w-12 h-12 md:w-16 md:h-16 text-zinc-300 animate-pulse" />
                                            </div>
                                            <p className="text-lg md:text-2xl font-black text-zinc-800 uppercase tracking-[0.3em]">Listening</p>
                                            <p className="text-[9px] md:text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-2">{mode === 'agent' ? "Standing by for audio capture" : "Waiting for socket stream"}</p>
                                        </motion.div>
                                    ) : (
                                        <div className="space-y-8 md:space-y-12 max-w-4xl mx-auto pb-20">
                                            {transcripts.map((item, i) => (
                                                <motion.div
                                                    key={item.timestamp + i}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex gap-4 md:gap-8 group"
                                                >
                                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center shrink-0 group-hover:bg-zinc-900 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-zinc-200 hidden sm:flex">
                                                        <Activity className="w-4 h-4 md:w-5 md:h-5 text-zinc-400 group-hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="flex-1 space-y-3 md:space-y-4">
                                                        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] rounded-tl-none border border-zinc-100 shadow-[0_4px_30px_rgba(0,0,0,0.02)] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.05)] group-hover:border-zinc-200 transition-all duration-700">
                                                            <TextGenerateEffect words={item.text} className="text-lg md:text-xl lg:text-2xl font-bold text-zinc-800 leading-relaxed" />
                                                        </div>
                                                        <div className="flex items-center gap-4 px-2">
                                                            <div className="h-[1px] bg-zinc-200 flex-1" />
                                                            <span className="text-[8px] md:text-[9px] font-mono font-black text-zinc-400 uppercase tracking-widest">
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
                            <div className="h-16 md:h-20 bg-gradient-to-t from-white/90 to-transparent absolute bottom-0 left-0 right-0 pointer-events-none" />
                        </div>
                    </motion.main>
                )}
            </AnimatePresence>

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
        </WavyBackground>
    );
}

export default App;
