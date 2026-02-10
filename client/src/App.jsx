import { useState, useCallback, useEffect } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { Mic, MicOff, Activity, MessageSquare, Wifi, WifiOff, AlertCircle, Zap, TrendingUp, Globe, PhoneOff, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { CardContainer, CardBody, CardItem } from './components/ui/3d-card';
import { SystemCheckModal } from './components/SystemCheckModal';

function App() {
    const [url, setUrl] = useState(import.meta.env.VITE_LIVEKIT_URL || '');
    const [token, setToken] = useState('');
    const { connect, disconnect, isConnected, connectionState, transcripts, room, connectionQuality, agentConnected, setLanguage, toggleMicrophone, micEnabled } = useLiveKit(url);
    const [isRecording, setIsRecording] = useState(false);
    const [latency, setLatency] = useState(0);
    const [packetLoss, setPacketLoss] = useState(0);
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [isSystemCheckOpen, setIsSystemCheckOpen] = useState(false);

    // Initial system check
    useEffect(() => {
        const hasChecked = sessionStorage.getItem('vox_nexus_system_checked');
        if (!hasChecked) {
            setIsSystemCheckOpen(true);
        }
    }, []);

    // Sync language when agent connects
    useEffect(() => {
        if (isConnected && agentConnected) {
            setLanguage(currentLanguage);
        }
    }, [isConnected, agentConnected, currentLanguage, setLanguage]);

    const fetchToken = async () => {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
            // Use a consistent user ID or random for demo
            const userId = `user-${Math.floor(Math.random() * 1000)}`;
            const response = await fetch(`${backendUrl}/token?room=vox-nexus&name=${userId}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch token: ${response.statusText}`);
            }

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
            setIsRecording(false);
        } else {
            const t = await fetchToken();
            if (t) {
                await connect(t, url);
                setIsRecording(true);
            }
        }
    };

    const getConnectionQualityColor = () => {
        switch (connectionQuality) {
            case 'excellent': return 'text-emerald-600';
            case 'good': return 'text-blue-600';
            case 'poor': return 'text-amber-600';
            default: return 'text-rose-600';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-gray-900 font-sans selection:bg-indigo-200">

            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto p-6 flex flex-col h-screen relative z-10">

                {/* Header */}
                <header className="flex items-center justify-between mb-8 pb-6 border-b border-indigo-200/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur-lg opacity-50" />
                            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
                                <Activity className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                VoxNexus
                            </h1>
                            <p className="text-sm text-gray-500">Real-time Voice AI</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSystemCheckOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-gray-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium text-sm"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Check System
                        </button>
                        <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-gray-200", getConnectionQualityColor())}>
                            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                            <span className="capitalize font-medium text-sm">{connectionQuality}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-white shadow-md border border-gray-200">
                            <div className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" : "bg-gray-400")} />
                            <span className="text-gray-700 font-medium">{isConnected ? 'Connected' : 'Offline'}</span>
                        </div>
                    </div>
                </header>

                {/* Main Interface */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">

                    {/* Controls Sidebar */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Connection Card */}
                        <CardContainer className="h-full">
                            <CardBody className="h-full">
                                <div className="p-6 rounded-2xl bg-white shadow-xl border border-gray-200/50 backdrop-blur-sm h-full flex flex-col justify-between">
                                    <CardItem translateZ={20}>
                                        <div className="flex items-center gap-2 mb-6">
                                            <Zap className="w-5 h-5 text-indigo-600" />
                                            <h2 className="text-lg font-semibold text-gray-900">Connection</h2>
                                        </div>
                                    </CardItem>

                                    <CardItem translateZ={40} className="w-full">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={clsx("w-2 h-2 rounded-full", agentConnected ? "bg-emerald-500 animate-pulse" : "bg-orange-400")} />
                                                    <span className="text-sm font-medium text-gray-600">AI Worker</span>
                                                </div>
                                                <span className={clsx("text-xs font-bold px-2 py-1 rounded-md", agentConnected ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>
                                                    {agentConnected ? "ONLINE" : "OFFLINE"}
                                                </span>
                                            </div>

                                            {/* Language Selector */}
                                            <div className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100 mb-4 transition-all hover:bg-white hover:shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-indigo-500" />
                                                    <span className="text-sm font-medium text-gray-600">Language</span>
                                                </div>
                                                <select
                                                    value={currentLanguage}
                                                    onChange={(e) => setCurrentLanguage(e.target.value)}
                                                    className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors py-1 pl-2 pr-1 rounded focus:ring-2 focus:ring-indigo-500/20"
                                                >
                                                    <option value="en">English</option>
                                                    <option value="es">Spanish</option>
                                                    <option value="fr">French</option>
                                                    <option value="de">German</option>
                                                    <option value="hi">Hindi</option>
                                                    <option value="ja">Japanese</option>
                                                    <option value="zh">Chinese</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {isConnected ? (
                                                    <>
                                                        <button
                                                            onClick={toggleMicrophone}
                                                            className={clsx(
                                                                "py-3 px-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm border",
                                                                micEnabled
                                                                    ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                                    : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                                            )}
                                                        >
                                                            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                                            {micEnabled ? "Mute" : "Unmuted"}
                                                        </button>
                                                        <button
                                                            onClick={handleToggleConnect}
                                                            className="py-3 px-4 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all"
                                                        >
                                                            <PhoneOff className="w-5 h-5" /> End
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={handleToggleConnect}
                                                        className={clsx(
                                                            "col-span-2 w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg",
                                                            "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-indigo-500/30"
                                                        )}
                                                    >
                                                        <Mic className="w-5 h-5" /> Connect & Start
                                                    </button>
                                                )}
                                            </div>

                                            {isRecording && (
                                                <div className="flex items-center justify-center gap-2 text-sm text-rose-600 font-medium animate-pulse">
                                                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                                                    Live
                                                </div>
                                            )}
                                        </div>
                                    </CardItem>
                                </div>
                            </CardBody>
                        </CardContainer>

                        {/* Performance Card */}
                        <CardContainer>
                            <CardBody>
                                <div className="p-6 rounded-2xl bg-white shadow-xl border border-gray-200/50">
                                    <CardItem translateZ={20}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                                            <h2 className="text-lg font-semibold text-gray-900">Performance</h2>
                                        </div>
                                    </CardItem>
                                    <CardItem translateZ={40}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-100">
                                                <span className="block text-gray-600 text-xs mb-1 font-medium">Latency</span>
                                                <span className={clsx("font-mono text-2xl font-bold", latency < 100 ? "text-emerald-600" : latency < 200 ? "text-amber-600" : "text-rose-600")}>
                                                    {latency}
                                                    <span className="text-sm ml-1">ms</span>
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
                                                <span className="block text-gray-600 text-xs mb-1 font-medium">Loss</span>
                                                <span className={clsx("font-mono text-2xl font-bold", packetLoss < 1 ? "text-emerald-600" : packetLoss < 5 ? "text-amber-600" : "text-rose-600")}>
                                                    {packetLoss}
                                                    <span className="text-sm ml-1">%</span>
                                                </span>
                                            </div>
                                        </div>
                                    </CardItem>
                                </div>
                            </CardBody>
                        </CardContainer>

                        {/* iOS Notice */}
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                                <div>
                                    <strong className="font-semibold">iOS Users:</strong> If audio stops, tap the screen to resume.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transcript View */}
                    <div className="lg:col-span-2 flex flex-col rounded-2xl bg-white shadow-xl border border-gray-200/50 overflow-hidden">
                        <div className="p-5 border-b border-gray-200 flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                            <span className="font-semibold text-gray-900">Live Transcript</span>
                            <span className="ml-auto text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                {transcripts.length} messages
                            </span>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto space-y-4 scroll-smooth bg-gradient-to-b from-gray-50/50 to-white">
                            {transcripts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <Mic className="w-16 h-16 mb-4 text-gray-300" />
                                    <p className="text-lg font-medium text-gray-500">
                                        {isConnected ? 'Listening... speak into your microphone' : 'Connect to start transcribing'}
                                    </p>
                                </div>
                            ) : (
                                transcripts.map((item, i) => (
                                    <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg">
                                            AI
                                        </div>
                                        <div className="flex-1">
                                            <div className="p-4 rounded-2xl rounded-tl-none bg-gradient-to-br from-indigo-50 to-purple-50 text-gray-900 leading-relaxed border border-indigo-100 shadow-md">
                                                {item.text}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-2 ml-1 font-mono">
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <SystemCheckModal
                isOpen={isSystemCheckOpen}
                onClose={() => setIsSystemCheckOpen(false)}
                onComplete={() => {
                    sessionStorage.setItem('vox_nexus_system_checked', 'true');
                    setIsSystemCheckOpen(false);
                }}
            />
        </div>
    );
}

export default App;
