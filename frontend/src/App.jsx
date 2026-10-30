import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Shield, Activity, Network, Terminal, Globe, MapPin, Home, Layers, Clock, Fingerprint, 
  Search, User, Bell, ChevronDown, Monitor, Lock, AlertTriangle, AlertCircle, HardDrive, 
  BarChart2, Settings, ShieldCheck, Maximize, Power, Radio, Target, FileText, Briefcase, Server, Cloud, Download,
  Bot, Send, X, MessageSquare, Eye, EyeOff, Key
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ComposableMap, Geographies, Geography, Marker, Line as GeoLine, ZoomableGroup } from 'react-simple-maps';
import ForceGraph3D from 'react-force-graph-3d';

const SERVER_COORDS = [73.0297, 19.0330]; 
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const getRealCoords = (loc) => {
  if (!loc) return [0, 0];
  const l = loc.toLowerCase();
  if (l.includes('india') || l.includes('mumbai')) return SERVER_COORDS;
  if (l.includes('us') || l.includes('united states')) return [-95.7129, 37.0902];
  if (l.includes('russia')) return [105.3188, 61.5240];
  if (l.includes('china')) return [104.1954, 35.8617];
  if (l.includes('germany')) return [10.4515, 51.1657];
  if (l.includes('brazil')) return [-51.9253, -14.2350];
  return [(l.length * 10 % 360) - 180, (l.length * 10 % 180) - 90]; 
};

const COLORS = { red: '#ef4444', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6', yellow: '#eab308', orange: '#f97316' };

const GfxCard = ({ children, className = "" }) => (
  <div className={`bg-[#0a1122] border border-[#1e293b] rounded-xl flex flex-col relative transition-all duration-300 ease-out hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] ${className}`}>
    {children}
  </div>
);

const RadialProgress = ({ value, color, label }) => {
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={radius} stroke="#1e293b" strokeWidth="5" fill="none" />
          <circle cx="30" cy="30" r={radius} stroke={color} strokeWidth="5" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_currentColor]" strokeLinecap="round" />
        </svg>
        <span className="absolute text-xs font-bold text-white drop-shadow-md">{value}%</span>
      </div>
      <span className="text-[9px] text-zinc-400 uppercase mt-3 text-center tracking-wider">{label}</span>
    </div>
  );
};

const App = () => {
  // 🔐 AUTHENTICATION STATES 🔐
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // 📊 DASHBOARD STATES 📊
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [isConnected, setIsConnected] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [povLogs, setPovLogs] = useState([]);
  
  // 🟢 AMBIENT TRAFFIC ENGINE 🟢
  const [ambientTraffic, setAmbientTraffic] = useState(0);
  const [ambientSys, setAmbientSys] = useState({ cpu: 12, mem: 45, net: 20 });
  const socketRef = useRef(null);

  // 🤖 AI SOC CHATBOT STATES 🤖
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Hello Prajakta! I am your NetGuard SOC Co-Pilot. Ask me anything about real-time attacks, ports, or logs.' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Auth Initialization
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.message || 'Invalid Username or Password');
      }
    } catch (err) {
      setAuthError('Backend server offline or unreachable.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Backend Fetches
    fetch('http://127.0.0.1:8000/api/logs').then(r => r.json()).then(d => setAlerts(d.data || []));
    fetch('http://127.0.0.1:8000/api/nodes').then(r => r.json()).then(d => setNodes(d.data || []));

    // WebSocket Logic
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/alerts');
    socketRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setAlerts(prev => [data, ...prev].slice(0, 500));
      setPovLogs(prev => [`[${data.time?.split(' ')[1]}] [Port ${data.port}] ${data.ip} : ${data.payload}`, ...prev].slice(0, 100));
      setChartData(prev => {
        const newData = [...prev, { time: data.time?.split(' ')[1]?.slice(0,5) || "Live", inbound: Math.floor(Math.random() * 800) + 200, outbound: Math.floor(Math.random() * 400) + 50 }];
        return newData.length > 30 ? newData.slice(1) : newData;
      });
    };

    // Background Fluctuation Interval
    const trafficInterval = setInterval(() => {
      setAmbientTraffic(prev => prev + Math.floor(Math.random() * 12) + 3);
      setAmbientSys({
        cpu: 12 + Math.floor(Math.random() * 8),
        mem: 45 + Math.floor(Math.random() * 4),
        net: 20 + Math.floor(Math.random() * 15)
      });
    }, 2500);

    return () => {
      ws.close();
      clearInterval(trafficInterval);
    };
  }, [isAuthenticated]);

  const toggleNode = async (port, status) => {
    await fetch('http://127.0.0.1:8000/api/nodes/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port, action: status === "Online" ? "stop" : "start" }) });
    fetch('http://127.0.0.1:8000/api/nodes').then(r => r.json()).then(d => setNodes(d.data));
  };

  // 🤖 CHATBOT HANDLER 🤖
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/soc-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'bot', text: 'Failed to connect to AI SOC Engine. Ensure backend is running.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- DYNAMIC DATA CALCULATIONS ---
  const totalHits = alerts.length;
  const criticalHits = alerts.filter(a => a.is_critical).length;
  const dataTransferred = (2.45 + (totalHits * 0.005) + (ambientTraffic * 0.0001)).toFixed(2);
  
  const epActive = nodes.filter(n => n.status === 'Online').length || 1;
  const epInactive = nodes.filter(n => n.status !== 'Online').length || 0;
  const epCompromised = criticalHits > 0 ? (criticalHits % 20) + 1 : 0;
  const epTotal = epActive + epInactive + epCompromised;

  const fwBlocked = criticalHits; 
  const fwFiltered = (totalHits - criticalHits) + Math.floor(ambientTraffic / 3);
  const fwAllowed = 8452 + ambientTraffic + (totalHits * 2); 
  const fwTotal = fwBlocked + fwFiltered + fwAllowed;

  const portHits = useMemo(() => {
    const counts = {};
    alerts.forEach(a => { counts[a.port] = (counts[a.port] || 0) + 1; });
    return counts;
  }, [alerts]);

  const sysCPU = Math.min(99, ambientSys.cpu + (totalHits > 0 ? (totalHits % 30) : 0));
  const sysMem = Math.min(99, ambientSys.mem + (criticalHits > 0 ? (criticalHits % 20) : 0));
  const sysNet = Math.min(99, ambientSys.net + (totalHits > 0 ? (totalHits % 25) : 0));

  const sparkData = useMemo(() => Array(15).fill(0).map(() => ({ val: Math.random() * 100 })), [alerts, ambientTraffic]);

  const threatData = useMemo(() => {
    const counts = { Malware: 0, DDoS: 0, 'Brute Force': 0, 'SQL Injection': 0, XSS: 0 };
    alerts.forEach(a => {
      if(a.is_critical && a.payload.includes('aws')) counts.Malware++;
      else if(a.payload === "Port Scan") counts.DDoS++;
      else if(a.port === 22) counts['Brute Force']++;
      else if(a.payload.toLowerCase().includes('select') || a.payload.toLowerCase().includes('drop')) counts['SQL Injection']++;
      else counts.XSS++;
    });
    const total = alerts.length || 1;
    return Object.keys(counts).map(k => ({ name: k, value: counts[k], pct: Math.round((counts[k]/total)*100) })).sort((a,b) => b.value - a.value);
  }, [alerts]);

  const sourceData = useMemo(() => {
    const counts = {};
    alerts.forEach(a => { const loc = a.location || "Unknown"; counts[loc] = (counts[loc] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([loc, count], i) => ({ loc, count, color: Object.values(COLORS)[i] }));
  }, [alerts]);

  const graphData3D = useMemo(() => {
    const validNodes = [{ id: 'CORE_SERVER', group: 1, name: 'AWS Hub' }];
    const validLinks = [];
    const seenIps = new Set();
    alerts.slice(0, 30).forEach(a => {
      if (a && a.ip && !seenIps.has(a.ip)) {
          seenIps.add(a.ip);
          validNodes.push({ id: a.ip, group: a.is_critical ? 3 : 2, name: a.ip });
          validLinks.push({ source: a.ip, target: 'CORE_SERVER' });
      }
    });
    return { nodes: validNodes, links: validLinks };
  }, [alerts]);

  // ==========================================
  // 🔐 RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050811] relative overflow-hidden font-sans select-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row w-full max-w-4xl bg-[#0a1020]/95 backdrop-blur-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#1e293b] z-10 overflow-hidden m-4">
          
          {/* Left Branding Area */}
          <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center p-12 relative border-r border-[#1e293b] bg-gradient-to-br from-[#0a1226] to-[#050811]">
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-6 flex items-center justify-center">
                <Shield size={86} className="text-blue-500 fill-blue-500/10 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
                <Lock size={30} className="text-white absolute mt-1" />
              </div>
              
              <h1 className="text-3xl font-black tracking-widest text-white mb-3 uppercase">
                NET<span className="text-blue-500">GUARD</span>
              </h1>
              <div className="h-1 w-12 bg-blue-500 mb-6 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
              <p className="text-zinc-400 text-sm font-medium leading-relaxed tracking-wide">
                Secure. Monitor. Protect.<br/>Always.
              </p>
            </div>
          </div>

          {/* Right Form Area */}
          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-[#070d1a]">
            <div className="w-full max-w-sm mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-1.5 tracking-wide">Welcome Back</h2>
                <p className="text-zinc-400 text-xs">Login to your NetGuard account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User size={16} className="text-zinc-500" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 pr-3 py-2.5 border border-[#1e293b] rounded-lg bg-[#040814] text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs transition-all"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock size={16} className="text-zinc-500" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="block w-full pl-10 pr-10 py-2.5 border border-[#1e293b] rounded-lg bg-[#040814] text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs transition-all"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-zinc-500 hover:text-zinc-300"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center text-zinc-400 cursor-pointer">
                    <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded bg-[#040814] border-[#1e293b] text-blue-600 focus:ring-0 mr-2" />
                    Remember Me
                  </label>
                  <a href="#" className="text-blue-400 hover:underline">Forgot Password?</a>
                </div>

                {authError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-lg text-center font-medium">
                    {authError}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all text-xs uppercase tracking-wider active:scale-[0.98]"
                >
                  Login
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#1e293b]"></div>
                  <span className="flex-shrink mx-3 text-zinc-500 text-[10px] uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-[#1e293b]"></div>
                </div>

                <button 
                  type="button" 
                  onClick={() => alert("API Key Auth activated. Enter direct developer key in config.")}
                  className="w-full border border-[#1e293b] hover:bg-[#0f172a] text-zinc-300 font-medium py-2 px-4 rounded-lg transition-all text-xs flex items-center justify-center gap-2"
                >
                  <Key size={14} className="text-blue-400" /> Login with API Key
                </button>
              </form>

              <p className="text-center text-[10px] text-zinc-600 mt-8">© 2026 NetGuard. All rights reserved.</p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // 📊 MAIN SOC DASHBOARD
  // ==========================================
  const renderContent = () => {
    switch (activeTab) {
      case 'Live Monitor':
        return (
          <div className="flex h-full gap-6 pb-6">
            <GfxCard className="flex-1 p-6 relative overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Terminal className="w-5 h-5"/> Live Payload Terminal</h3>
                  <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded text-emerald-500 text-xs border border-emerald-500/30 animate-pulse"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Socket Active</div>
               </div>
               <div className="flex-1 bg-[#040914] rounded-lg border border-[#1e293b] p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar shadow-inner">
                  <div className="text-zinc-600 mb-4">root@smart-netguard:~# tail -f /var/log/honeypot/all.log</div>
                  {povLogs.length === 0 ? <div className="text-zinc-500">Waiting for connections on public interface...</div> : povLogs.map((log, i) => (
                    <div key={i} className={`mb-1.5 ${log.includes('aws') || log.includes('select') ? 'text-red-400' : 'text-emerald-400'}`}>{log}</div>
                  ))}
               </div>
            </GfxCard>
            <GfxCard className="w-1/3 p-6">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-6">Bandwidth Allocation</h3>
              <div className="flex-1 w-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.length > 0 ? chartData : [{time: '00:00', inbound: 0, outbound: 0}]}>
                      <defs>
                         <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                         <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <Area type="monotone" dataKey="inbound" stroke="#10b981" strokeWidth={2} fill="url(#colorIn)" />
                      <Area type="monotone" dataKey="outbound" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOut)" />
                    </AreaChart>
                  </ResponsiveContainer>
              </div>
            </GfxCard>
          </div>
        );

      case 'Network Analytics':
        return (
          <div className="flex h-full gap-6 pb-6">
            <GfxCard className="w-1/4 p-6">
               <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-6">Topology Stats</h3>
               <div className="space-y-6">
                  <div className="bg-[#040914] p-4 rounded border border-[#1e293b]">
                     <p className="text-xs text-zinc-500 uppercase">Tracked Nodes</p>
                     <p className="text-3xl font-black text-blue-400 mt-1">{graphData3D.nodes.length}</p>
                  </div>
                  <div className="bg-[#040914] p-4 rounded border border-[#1e293b]">
                     <p className="text-xs text-zinc-500 uppercase">Active Vectors</p>
                     <p className="text-3xl font-black text-emerald-400 mt-1">{graphData3D.links.length}</p>
                  </div>
                  <div className="bg-[#040914] p-4 rounded border border-[#1e293b]">
                     <p className="text-xs text-zinc-500 uppercase">Core Infrastructure</p>
                     <p className="text-xl font-bold text-white mt-2">AWS EC2 (us-east-1)</p>
                  </div>
               </div>
            </GfxCard>
            <GfxCard className="flex-1 p-6 relative overflow-hidden">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2"><Network className="w-5 h-5 text-blue-500" /> 3D Neural Threat Topology</h3>
              <div className="absolute inset-0 top-16 bg-[#040914] rounded-xl border border-[#1e293b] m-6 mt-0 shadow-inner flex items-center justify-center">
                 <ForceGraph3D graphData={graphData3D} backgroundColor="rgba(0,0,0,0)" nodeColor={n => n.group === 1 ? '#3b82f6' : n.group === 3 ? '#ef4444' : '#10b981'} linkColor={() => '#1e293b'} linkWidth={1} linkOpacity={0.8} nodeRelSize={6} />
              </div>
            </GfxCard>
          </div>
        );

      case 'Incidents':
        return (
          <GfxCard className="p-6 h-full pb-6">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500"/> Critical Incidents Queue</h3>
             </div>
             <div className="grid grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-6">
                {alerts.filter(a => a.is_critical).map((a, i) => (
                  <div key={i} className="bg-[#040914] border border-red-500/30 rounded-xl p-5 relative overflow-hidden group hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all">
                     <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                     <div className="flex justify-between items-start mb-4">
                        <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Severity: High</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{a.time}</span>
                     </div>
                     <h4 className="text-lg font-bold text-white mb-1">{a.ip}</h4>
                     <p className="text-xs text-zinc-400 mb-4">{a.location}</p>
                     <div className="bg-[#0a1122] border border-[#1e293b] p-3 rounded text-[10px] font-mono text-zinc-300 mb-4 truncate" title={a.payload}>{a.payload}</div>
                     <p className="text-xs text-red-400 font-medium line-clamp-2">{a.ai_explanation}</p>
                  </div>
                ))}
                {alerts.filter(a => a.is_critical).length === 0 && <div className="col-span-3 text-center text-zinc-500 py-20">No Critical Incidents Detected Yet. Waiting for unauthorized access.</div>}
             </div>
          </GfxCard>
        );

      case 'Deception Honeypots':
        return (
          <GfxCard className="p-8 h-full pb-6">
             <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3"><Server className="w-6 h-6 text-emerald-500 animate-pulse" /> AWS Honeypot Cluster Management</h3>
             <div className="grid grid-cols-4 gap-8">
                {nodes.map((n, i) => (
                  <div key={i} className={`border ${n.status==='Online' ? 'border-[#1e293b] bg-[#040914]' : 'border-red-500/30 bg-red-500/5'} rounded-xl p-6 relative overflow-hidden transition-all duration-300`}>
                    <div className={`absolute top-0 left-0 w-full h-1 ${n.status==='Online' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></div>
                    <div className="flex justify-between items-center mb-6 mt-2">
                       <span className={`text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded bg-[#1e293b] ${n.status==='Online' ? 'text-emerald-400' : 'text-red-400'}`}>{n.status}</span>
                       <Power className={`w-5 h-5 ${n.status==='Online' ? 'text-emerald-500' : 'text-zinc-600'}`} />
                    </div>
                    <h4 className="text-3xl font-black text-white mb-2 tracking-wider">PORT {n.port}</h4>
                    <p className="text-xs text-zinc-500 uppercase mb-6">{n.service} Emulator</p>
                    <div className="bg-[#0a1122] border border-[#1e293b] rounded p-3 mb-8 flex justify-between items-center">
                       <span className="text-[10px] text-zinc-400 uppercase">Hits Captured</span>
                       <span className="text-sm font-bold text-blue-400">{portHits[n.port] || 0}</span>
                    </div>
                    <button onClick={() => toggleNode(n.port, n.status)} className={`w-full py-3 rounded-lg text-xs font-bold uppercase transition-all border ${n.status==='Online' ? 'border-red-500/50 text-red-500 hover:bg-red-500/20' : 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/20'}`}> {n.status==='Online' ? 'Deactivate Node' : 'Deploy to Cloud'}</button>
                  </div>
                ))}
             </div>
          </GfxCard>
        );

      case 'Reports & Logs':
        return (
          <GfxCard className="p-6 h-full pb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Global Traffic Ledger</h3>
              <button onClick={() => alert("Report Exported to S3 Bucket Successfully!")} className="bg-blue-600/20 border border-blue-500/50 text-blue-400 px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"><Download className="w-4 h-4"/> Export PDF</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#0a1122] z-10"><tr className="text-xs text-zinc-400 uppercase border-b border-[#1e293b]"><th className="pb-4 px-4">Timestamp</th><th className="pb-4 px-4">Source IP</th><th className="pb-4 px-4">Location</th><th className="pb-4 px-4">Port</th><th className="pb-4 px-4">Payload/Vector</th><th className="pb-4 px-4">AI Analysis</th><th className="pb-4 px-4 text-right">Status</th></tr></thead>
                <tbody className="divide-y divide-[#1e293b]">
                  {alerts.length > 0 ? alerts.map((a, i) => (
                    <tr key={i} className={`hover:bg-[#040914] transition-all ${a.is_critical ? 'bg-red-500/5' : ''}`}>
                      <td className="py-4 px-4 text-zinc-400 font-mono text-[11px]">{a.time}</td>
                      <td className={`py-4 px-4 font-mono text-[11px] ${a.is_critical ? 'text-red-400' : 'text-blue-400'}`}>{a.ip}</td>
                      <td className="py-4 px-4 text-zinc-300 text-[11px]">{a.location}</td>
                      <td className="py-4 px-4 text-zinc-400 text-[11px]">{a.port}</td>
                      <td className="py-4 px-4 text-zinc-400 font-mono text-[10px] max-w-[150px] truncate" title={a.payload}>{a.payload}</td>
                      <td className="py-4 px-4 text-zinc-300 text-[11px] max-w-xs truncate" title={a.ai_explanation}>{a.ai_explanation}</td>
                      <td className="py-4 px-4 text-right"><span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wider ${a.is_critical ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{a.is_critical ? 'BLOCKED' : 'LOGGED'}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" className="py-10 text-center text-zinc-500">Database is clean. No threats recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </GfxCard>
        );

      case 'Overview':
      default:
        return (
          <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
            <div className="grid grid-cols-6 gap-6">
              {[
                { title: 'TOTAL ATTACKS', val: totalHits.toLocaleString(), p: '18.6%', up: false, color: 'red', icon: Shield },
                { title: 'LIVE ATTACKS', val: criticalHits.toLocaleString(), p: '12.4%', up: false, color: 'red', icon: Target },
                { title: 'BLOCKED ATTACKS', val: fwBlocked.toLocaleString(), p: '28.7%', up: true, color: 'green', icon: ShieldCheck },
                { title: 'COMPROMISED ATTEMPTS', val: epCompromised, p: '8.6%', up: false, color: 'purple', icon: AlertTriangle },
                { title: 'DATA TRANSFER', val: `${dataTransferred} TB`, p: '14.5%', up: true, color: 'blue', icon: HardDrive },
                { title: 'ACTIVE ENDPOINTS', val: epActive, p: '6.3%', up: true, color: 'green', icon: Monitor }
              ].map((c, i) => (
                <GfxCard key={i} className="p-4 group">
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-15 blur-2xl pointer-events-none rounded-full transition-opacity duration-300 group-hover:opacity-30" style={{backgroundColor: COLORS[c.color]}}></div>
                  <div className="flex gap-3 items-start relative z-10">
                    <div className="p-2 rounded-lg bg-[#040914] border border-[#1e293b] shadow-inner"><c.icon className="w-5 h-5" style={{color: COLORS[c.color]}} /></div>
                    <div className="flex-1">
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">{c.title}</p>
                      <div className="flex items-end gap-1 mt-1"><span className="text-xl font-black text-white leading-none">{c.val}</span><span className={`text-[9px] ${c.up ? 'text-emerald-500' : 'text-red-500'} font-bold`}>{c.up?'▲':'▼'} {c.p}</span></div>
                    </div>
                  </div>
                  <div className="h-8 w-full mt-4 relative z-10"><ResponsiveContainer width="100%" height="100%"><LineChart data={sparkData}><Line type="monotone" dataKey="val" stroke={COLORS[c.color]} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </GfxCard>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-6">
              <GfxCard className="col-span-3 p-5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">ATTACK VECTOR DISTRIBUTION</h3>
                <div className="relative h-48 w-full flex justify-center items-center mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={threatData} innerRadius={65} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                        {threatData.map((e, i) => <Cell key={i} fill={[COLORS.red, COLORS.orange, COLORS.yellow, COLORS.blue, COLORS.purple][i % 5]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
                     <span className="text-2xl font-black text-white">{totalHits}</span>
                     <span className="text-[10px] text-zinc-500">Total</span>
                  </div>
                </div>
                <div className="space-y-2 mt-auto">
                  {threatData.slice(0,5).map((t, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] p-1 rounded hover:bg-white/5 transition-colors"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full shadow-md" style={{backgroundColor: [COLORS.red, COLORS.orange, COLORS.yellow, COLORS.blue, COLORS.purple][i]}}></div><span className="text-zinc-300">{t.name}</span></div><span className="text-zinc-400 font-mono">{t.value} ({t.pct}%)</span></div>
                  ))}
                </div>
              </GfxCard>

              <GfxCard className="col-span-6 p-5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#040914] to-[#040914] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-4 z-10 relative">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div> LIVE GLOBAL ATTACK MAP</h3>
                  <span className="text-[8px] bg-[#1e293b] px-2 py-1 rounded text-zinc-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Scroll to Zoom / Drag to Pan</span>
                </div>
                <div className="flex-1 relative w-full h-full min-h-[250px] flex items-center justify-center bg-[#061024] rounded-lg border border-[#1e293b] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden cursor-crosshair">
                   <ComposableMap projection="geoMercator" projectionConfig={{ scale: 120 }} className="w-[100%] h-[100%] opacity-90">
                      <ZoomableGroup zoom={1} minZoom={1} maxZoom={8}>
                        <Geographies geography={geoUrl}>{({ geographies }) => geographies.map(geo => (<Geography key={geo.rsmKey} geography={geo} fill="#0b1736" stroke="#1e293b" strokeWidth={0.5} style={{ hover: { fill: "#0f172a", outline: "none" }, default: { outline: "none" }, pressed: { outline: "none" } }} />))}</Geographies>
                        {alerts.slice(0, 15).map((a, i) => {
                          const coords = getRealCoords(a.location);
                          return (
                            <React.Fragment key={i}>
                              <GeoLine from={coords} to={SERVER_COORDS} stroke={a.is_critical ? COLORS.red : COLORS.orange} strokeWidth={a.is_critical ? 2 : 1} strokeDasharray="4,4" className="animate-pulse drop-shadow-[0_0_5px_currentColor]" opacity={0.8} />
                              <Marker coordinates={coords}><circle r={a.is_critical ? 8 : 4} fill={a.is_critical ? COLORS.red : COLORS.orange} className="animate-ping" opacity={0.6} /><circle r={a.is_critical ? 3 : 2} fill="#fff" className="drop-shadow-[0_0_5px_#fff]" /></Marker>
                            </React.Fragment>
                          );
                        })}
                        <Marker coordinates={SERVER_COORDS}><circle r={12} fill={COLORS.green} className="animate-pulse" opacity={0.3} /><circle r={5} fill={COLORS.green} className="drop-shadow-[0_0_10px_#10b981]" /><text y={-12} textAnchor="middle" style={{ fill: "#10b981", fontSize: "6px", fontWeight: "900", letterSpacing: "1px" }}>AWS_HUB</text></Marker>
                      </ZoomableGroup>
                   </ComposableMap>
                </div>
              </GfxCard>

              <GfxCard className="col-span-3 p-5">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">TOP ATTACK SOURCES</h3><span className="text-[9px] text-zinc-500 bg-[#040914] px-2 py-1 rounded border border-[#1e293b]">Live ▼</span></div>
                <div className="space-y-5 flex-1">
                  {sourceData.length > 0 ? sourceData.map((s, i) => (
                    <div key={i} className="group-hover:translate-x-1 transition-transform">
                      <div className="flex justify-between items-center mb-1.5 text-[10px]"><div className="flex items-center gap-2"><img src={`https://flagcdn.com/w20/${s.loc.toLowerCase().includes('us')?'us':s.loc.toLowerCase().includes('russia')?'ru':s.loc.toLowerCase().includes('china')?'cn':s.loc.toLowerCase().includes('germany')?'de':s.loc.toLowerCase().includes('brazil')?'br':'in'}.png`} className="w-4 h-3 rounded-sm shadow-sm" alt=""/><span className="text-zinc-200">{s.loc.split(',')[0]}</span></div><span className="text-zinc-400 font-mono">{s.count.toLocaleString()}</span></div>
                      <div className="w-full bg-[#1e293b] rounded-full h-1.5"><div className="h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{width: `${Math.min(s.count * 10, 100)}%`, backgroundColor: s.color}}></div></div>
                    </div>
                  )) : (
                    <p className="text-zinc-600 text-[10px] text-center mt-10">No sources tracked</p>
                  )}
                </div>
              </GfxCard>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <GfxCard className="col-span-7 p-5">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">NETWORK TRAFFIC</h3></div>
                <div className="text-[9px] text-blue-500 mb-2">Mbps Data Rate</div>
                <div className="flex-1 w-full min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.length > 0 ? chartData : [{time: '00:00', inbound: 0, outbound: 0}]}>
                      <defs><linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient><linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                      <Area type="monotone" dataKey="inbound" stroke="#10b981" strokeWidth={2} fill="url(#colorIn)" className="drop-shadow-[0_0_5px_#10b981]"/>
                      <Area type="monotone" dataKey="outbound" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOut)" className="drop-shadow-[0_0_5px_#3b82f6]"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GfxCard>

              <GfxCard className="col-span-5 p-5">
                <div className="flex justify-between items-center mb-5"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">SECURITY ALERTS</h3></div>
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                  {alerts.length > 0 ? alerts.slice(0, 6).map((a, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] p-2 hover:bg-white/5 rounded border border-transparent hover:border-[#1e293b] transition-all">
                          <div className="flex items-center gap-3 w-3/5"><div className={`p-1.5 rounded-full ${a.is_critical ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>{a.is_critical ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0"/> : <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0"/>}</div><span className="text-zinc-300 truncate font-medium">{a.ai_explanation.split('.')[0]}</span></div>
                          <span className="text-zinc-500 font-mono">{a.time?.split(' ')[1]?.slice(0,5)}</span>
                          <span className={`font-bold tracking-wider ${a.is_critical ? 'text-red-500 drop-shadow-[0_0_3px_#ef4444]' : 'text-yellow-500'}`}>{a.is_critical ? 'CRITICAL' : 'HIGH'}</span>
                      </div>
                  )) : (
                     <p className="text-zinc-600 text-[10px] text-center mt-10">No active alerts</p>
                  )}
                </div>
              </GfxCard>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <GfxCard className="col-span-4 p-5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">FIREWALL STATISTICS</h3>
                <div className="flex items-center justify-between flex-1">
                    <div className="relative w-28 h-28 group-hover:scale-105 transition-transform duration-500"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{v: fwAllowed}, {v: fwBlocked}, {v: fwFiltered}]} innerRadius={35} outerRadius={50} paddingAngle={3} dataKey="v" stroke="none"><Cell fill={COLORS.green}/><Cell fill={COLORS.red}/><Cell fill={COLORS.orange}/></Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs font-black text-white">{fwTotal.toLocaleString()}</span></div></div>
                    <div className="flex flex-col gap-3 w-full pl-6 text-[10px]">
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div><span className="text-zinc-300">Allowed</span></div><span className="text-zinc-400 font-mono">{fwAllowed.toLocaleString()}</span></div>
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></div><span className="text-zinc-300">Blocked</span></div><span className="text-zinc-400 font-mono">{fwBlocked.toLocaleString()}</span></div>
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_5px_#f97316]"></div><span className="text-zinc-300">Filtered</span></div><span className="text-zinc-400 font-mono">{fwFiltered.toLocaleString()}</span></div>
                    </div>
                </div>
              </GfxCard>

              <GfxCard className="col-span-4 p-5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">ENDPOINT STATUS</h3>
                <div className="flex items-center justify-between flex-1">
                    <div className="relative w-28 h-28 group-hover:scale-105 transition-transform duration-500"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{v: epActive}, {v: epInactive}, {v: epCompromised}]} innerRadius={35} outerRadius={50} paddingAngle={3} dataKey="v" stroke="none"><Cell fill={COLORS.green}/><Cell fill={COLORS.orange}/><Cell fill={COLORS.red}/></Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xs font-black text-white">{epTotal}</span></div></div>
                    <div className="flex flex-col gap-3 w-full pl-6 text-[10px]">
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-zinc-300">Active</span></div><span className="text-emerald-400 font-mono">{epActive}</span></div>
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-zinc-300">Inactive</span></div><span className="text-orange-400 font-mono">{epInactive}</span></div>
                        <div className="flex justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-zinc-300">Compromised</span></div><span className="text-red-400 font-mono">{epCompromised}</span></div>
                    </div>
                </div>
              </GfxCard>

              <GfxCard className="col-span-4 p-5">
                 <div className="flex justify-between items-center mb-5"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">HONEYPOT ACTIVITY</h3><span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">Active: {nodes.filter(n=>n.status==='Online').length}</span></div>
                 <div className="flex-1 text-[10px] uppercase tracking-wider">
                    <table className="w-full text-left"><thead className="text-zinc-500 border-b border-[#1e293b]"><tr className="pb-2"><th className="pb-3">Node ID</th><th className="pb-3">Type</th><th className="pb-3 text-right">Hits</th></tr></thead>
                    <tbody className="divide-y divide-[#1e293b]/50">
                       {nodes.length > 0 ? nodes.map((n, i) => (
                         <tr key={i} className="text-zinc-300 hover:bg-white/5 transition-colors">
                           <td className="py-2.5">HP-NODE-{n.port}</td>
                           <td className="py-2.5">{n.service}</td>
                           <td className="py-2.5 text-right text-blue-400 font-mono font-bold">{portHits[n.port] || 0}</td>
                         </tr>
                       )) : (
                          <tr className="text-zinc-500"><td colSpan="3" className="py-4 text-center">No Nodes Connected</td></tr>
                       )}
                    </tbody></table>
                 </div>
              </GfxCard>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <GfxCard className="col-span-6 p-5">
                 <div className="flex justify-between items-center mb-5"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">RECENT ACTIVITY LOG</h3><a href="#" className="text-[10px] text-blue-400 hover:text-blue-300">View Full Log</a></div>
                 <div className="flex-1 text-[10px]">
                    {alerts.length > 0 ? (
                      <table className="w-full text-left"><tbody className="divide-y divide-[#1e293b]/50">
                        {alerts.slice(0, 5).map((a, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 text-zinc-500 whitespace-nowrap font-mono">{a.time?.split(' ')[1]}</td>
                            <td className={`py-3 px-3 font-bold tracking-wide ${a.is_critical ? 'text-red-400 drop-shadow-[0_0_2px_#ef4444]' : 'text-emerald-400'}`}>{a.is_critical ? 'Threat Blocked' : 'Scanned'}</td>
                            <td className="py-3 px-3 text-zinc-300 font-mono">{a.ip}</td>
                            <td className="py-3 px-3 text-blue-400 font-mono">Port {a.port}</td>
                            <td className="py-3 text-zinc-500 text-right">{a.location?.split(',')[0]}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-600 pb-4">No recent activity detected.</div>
                    )}
                 </div>
              </GfxCard>

              <GfxCard className="col-span-6 p-5">
                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-8 flex items-center gap-2"><Cloud className="w-4 h-4 text-blue-500"/> SYSTEM RESOURCES (AWS)</h3>
                 <div className="flex justify-around items-center flex-1">
                    <RadialProgress value={sysCPU} color={COLORS.green} label="CPU USAGE" />
                    <RadialProgress value={sysMem} color={COLORS.orange} label="MEMORY USAGE" />
                    <RadialProgress value={45} color={COLORS.blue} label="DISK USAGE" />
                    <RadialProgress value={sysNet} color={COLORS.purple} label="NETWORK I/O" />
                 </div>
              </GfxCard>
            </div>

          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#040914] text-gray-300 font-sans overflow-hidden text-[11px] selection:bg-cyan-500/30">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }`}</style>
      
      <aside className="w-60 bg-[#040914] border-r border-[#1e293b] flex flex-col z-30 shadow-[10px_0_30px_rgba(0,0,0,0.5)] relative">
        <div className="p-5 flex flex-col border-b border-[#1e293b] relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-600/20 blur-3xl rounded-full"></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <Shield className="w-10 h-10 text-blue-500 fill-blue-500/20 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <div>
              <h1 className="text-lg font-black text-white tracking-wider uppercase">SMART NETGUARD AI</h1>
              <p className="text-[9px] text-zinc-400 tracking-widest uppercase mt-0.5 font-bold">SOC DASHBOARD</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto hide-scroll">
          {[
            { id: 'Overview', icon: Home, label: 'Overview' },
            { id: 'Live Monitor', icon: Activity, label: 'Live Terminal', badge: 'LIVE' },
            { id: 'Network Analytics', icon: Network, label: '3D Neural Network' },
            { id: 'Incidents', icon: AlertTriangle, label: 'Critical Incidents', count: criticalHits },
            { id: 'Deception Honeypots', icon: Server, label: 'Node Management' },
            { id: 'Reports & Logs', icon: FileText, label: 'Security Reports' },
          ].map((item) => (
            <div key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-[1.02]' : 'text-zinc-400 hover:text-white hover:bg-[#1e293b]/50 hover:translate-x-1'}`}>
              <div className="flex items-center gap-3"><item.icon className="w-4 h-4" /><span className="font-bold text-[11px] tracking-wide">{item.label}</span></div>
              {item.badge && <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-black border border-emerald-500/30 animate-pulse">{item.badge}</span>}
              {item.count !== undefined && item.count > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black shadow-[0_0_5px_#ef4444]">{item.count}</span>}
            </div>
          ))}
        </nav>

        <div className="p-5 bg-[#0a1122] border-t border-[#1e293b] flex items-center justify-between group hover:bg-[#1e293b]/30 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white border-2 border-[#1e293b] shadow-[0_0_10px_rgba(59,130,246,0.3)]">PR</div>
            <div><p className="text-[11px] font-black text-white tracking-wide group-hover:text-blue-400 transition-colors">Prajakta</p><p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Super Admin</p></div>
          </div>
          <button onClick={handleLogout} title="Logout Session">
            <Power className="w-4 h-4 text-red-500 hover:text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)] cursor-pointer" />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#040914] relative">
        <header className="h-20 border-b border-[#1e293b] flex items-center justify-between px-8 bg-[#040914]/80 backdrop-blur-md z-20 sticky top-0">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-md">{activeTab === 'Overview' ? 'SECURITY OPERATIONS CENTER' : activeTab}</h2>
            <p className="text-[10px] text-zinc-400 tracking-widest mt-1 uppercase font-bold text-emerald-500/70">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse shadow-[0_0_5px_#10b981]"></span>
              {isConnected ? 'LIVE CONNECTION ESTABLISHED' : 'AWAITING CONNECTION'}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-[#0a1122] border border-[#1e293b] rounded-full px-4 py-2 w-72 focus-within:border-blue-500/50 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
              <Search className="w-4 h-4 text-blue-500" />
              <input type="text" placeholder="Search IP, Domain, Hash..." className="bg-transparent border-none outline-none text-[11px] text-white w-full placeholder-zinc-600" />
              <div className="bg-[#1e293b] rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 font-bold">⌘K</div>
            </div>

            <div className="flex items-center gap-5 text-zinc-400 border-l border-[#1e293b] pl-6">
              <div className="relative cursor-pointer hover:text-white hover:scale-110 transition-transform">
                  <Bell className="w-5 h-5 text-blue-400" />
                  {alerts.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 rounded-full border-2 border-[#040914] shadow-[0_0_5px_#ef4444]">{alerts.length}</span>}
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[10px] text-zinc-300 font-mono font-bold">{new Date().toLocaleString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</span>
                 <span className="text-[10px] text-emerald-400 font-mono font-bold drop-shadow-[0_0_2px_#10b981]">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden">
           {renderContent()}
        </div>

        {/* 🟢 FLOATING SOC AI CHATBOT WIDGET 🟢 */}
        <div className="fixed bottom-6 right-6 z-50">
          {!isChatOpen ? (
            <button 
              onClick={() => setIsChatOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center gap-2 font-bold transition-all transform hover:scale-105"
            >
              <Bot className="w-6 h-6 animate-bounce" />
              <span className="text-xs tracking-wider uppercase pr-1">SOC Co-Pilot</span>
            </button>
          ) : (
            <div className="w-96 bg-[#0a1122] border border-blue-500/40 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col h-[480px] overflow-hidden">
              <div className="bg-[#040914] p-4 border-b border-[#1e293b] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <div>
                    <h4 className="font-black text-white text-xs tracking-wider uppercase">NETGUARD AI ASSISTANT</h4>
                    <p className="text-[9px] text-emerald-400 font-mono">SOC Real-Time Co-Pilot</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar text-[11px]">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-xl ${m.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#040914] border border-[#1e293b] text-zinc-200 rounded-bl-none font-sans'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#040914] border border-[#1e293b] p-3 rounded-xl text-blue-400 animate-pulse text-[10px]">
                      Analyzing MongoDB telemetry logs...
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChatMessage} className="p-3 bg-[#040914] border-t border-[#1e293b] flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask: 'Any critical SQL attacks recently?'" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#0a1122] border border-[#1e293b] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 text-[11px]"
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default App;