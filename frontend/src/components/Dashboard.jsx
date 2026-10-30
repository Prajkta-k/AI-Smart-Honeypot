import React, { useState, useEffect } from 'react';
import { Activity, ShieldX, Terminal, GlobeLock, MapPin } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("Connecting...");

  // --- STATS LOGIC (UPDATED FOR MULTI-PORT) ---
  const totalAttacks = alerts.length;
  const uniqueIPs = new Set(alerts.map(a => a.ip)).size;
  
  // Dynamic Ports Logic: Ye check karega ki kitne alag-alag ports par attack aaya hai
  const activePortsList = [...new Set(alerts.map(a => a.port))];
  const activePortsCount = activePortsList.length > 0 ? activePortsList.length : 1;
  const displayPorts = activePortsList.length > 0 ? activePortsList.join(', ') : '2222';

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws/alerts');

    socket.onopen = () => setStatus("Connected");
    
    socket.onmessage = (event) => {
      const newAlert = JSON.parse(event.data);
      setAlerts((prev) => [newAlert, ...prev]);
    };

    socket.onclose = () => setStatus("Disconnected");

    return () => socket.close();
  }, []);

  // --- CHART DATA GENERATION ---
  const protocolCount = alerts.reduce((acc, curr) => {
    const proto = curr.protocol || "Unknown";
    acc[proto] = (acc[proto] || 0) + 1;
    return acc;
  }, {});
  const protocolData = Object.keys(protocolCount).map(key => ({ name: key, value: protocolCount[key] }));
  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const timeCount = alerts.reduce((acc, curr) => {
    const t = curr.time.split(' ')[1]; 
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const trendData = Object.keys(timeCount).slice(-15).map(t => ({ time: t, attacks: timeCount[t] }));

  return (
    <div className="space-y-6 p-4">
      
      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-blue-500/30 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Attacks</p>
              <h3 className="text-3xl font-bold text-white">{totalAttacks}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg"><Activity className="text-blue-400 w-6 h-6" /></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-red-500/30 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Malicious IPs</p>
              <h3 className="text-3xl font-bold text-white">{uniqueIPs}</h3>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg"><ShieldX className="text-red-400 w-6 h-6" /></div>
          </div>
        </div>

        {/* DYNAMIC PORTS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-emerald-500/30 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Active Traps</p>
              <h3 className="text-3xl font-bold text-white">
                {activePortsCount} <span className="text-sm font-normal text-slate-500">(Ports: {displayPorts})</span>
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg"><GlobeLock className="text-emerald-400 w-6 h-6" /></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Status</p>
              <h3 className={`text-xl font-bold mt-2 ${status === 'Connected' ? 'text-green-400' : 'text-red-400'}`}>
                {status}
              </h3>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg"><Terminal className="text-slate-400 w-6 h-6" /></div>
          </div>
        </div>
      </div>

      {/* GRAPHICAL CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Live Attack Timeline
          </h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={12} tickMargin={10} />
                <YAxis stroke="#475569" fontSize={12} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="attacks" stroke="#ef4444" fillOpacity={1} fill="url(#colorAttacks)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Protocol Analysis</h2>
          <div className="h-[250px] w-full flex justify-center items-center">
            {protocolData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={protocolData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                    {protocolData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 italic text-sm">Awaiting attack data...</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {protocolData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                {entry.name}: {entry.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Threat Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Real-Time Threat Logs
          </h2>
        </div>
        
        <div className="overflow-x-auto h-[350px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-400 sticky top-0 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">SOURCE IP</th>
                <th className="px-6 py-4 font-medium tracking-wider">PROTO & PORT</th>
                <th className="px-6 py-4 font-medium tracking-wider">TOOL IDENTIFIED</th>
                <th className="px-6 py-4 font-medium tracking-wider">CAPTURED DATA</th>
                <th className="px-6 py-4 font-medium tracking-wider">AI DIAGNOSIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">
                    Waiting for inbound attacks... System is secure.
                  </td>
                </tr>
              ) : (
                alerts.map((alert, index) => (
                  <tr key={index} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-red-400 font-mono bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 w-max">
                          {alert.ip}
                        </span>
                        <span className="text-xs text-blue-400 italic flex items-center gap-1">
                          <MapPin size={10} /> {alert.location || "Tracking..."}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded w-max">
                          {alert.protocol || "Unknown"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Port: {alert.port}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-orange-400 font-medium text-xs">
                      {alert.tool || "Custom Script"}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs truncate max-w-[200px]" title={alert.payload}>
                      {alert.payload && alert.payload !== "Port Scan" 
                        ? <span className="text-green-400">{alert.payload}</span> 
                        : <span className="text-slate-500">Port Scan Only</span>}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {alert.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;