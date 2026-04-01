import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, Shield, Lock, Terminal, Server, Zap, Eye, EyeOff,
  ChevronRight, RefreshCw, ArrowUpRight, ArrowDownLeft, Wifi,
  Radio, BarChart2, Send, Settings2, Copy, Share2, Check, Plus,
  Trash2, ChevronLeft, Circle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface Message {
  id: string;
  from: string;
  text: string;
  ts: string;
  dir: "send" | "recv";
}

interface Route {
  id: string;
  probeId: string;
  targetHost: string;
  messages: Message[];
  unread: number;
  lastActive: number;
  online: boolean;
}

// ─── Invite helpers ──────────────────────────────────────────────────
const INVITE_CODES_KEY = "pinglog_invite_codes";
function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `PL-${seg(4)}-${seg(4)}-${seg(4)}`;
}
function getSavedCodes(): Array<{ code: string; created: number }> {
  try { return JSON.parse(localStorage.getItem(INVITE_CODES_KEY) || "[]"); }
  catch { return []; }
}
function saveCodes(codes: Array<{ code: string; created: number }>) {
  localStorage.setItem(INVITE_CODES_KEY, JSON.stringify(codes));
}
function buildInviteUrl(code: string): string {
  return `${window.location.origin}/?probe-key=${code}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const tsShort = () => new Date().toISOString().slice(11, 19);
const randomIP = () =>
  `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
const randomLatency = () => (4 + Math.random() * 60).toFixed(1);
const PROBE_ID = `PROBE-${Math.floor(1000 + Math.random() * 9000)}`;

const mkMsg = (from: string, text: string, dir: "send" | "recv"): Message => ({
  id: Math.random().toString(36).slice(2),
  from, text, ts: ts(), dir,
});

const REPLIES = [
  "ACK. Packet integrity verified.",
  "Copy. Adjusting route parameters.",
  "Acknowledged. Awaiting next payload.",
  "Data received. Hash verified OK.",
  "Roger. Latency within acceptable range.",
  "Confirmed. Continuing probe sequence.",
  "Signal strength nominal. Standing by.",
  "Encryption handshake complete.",
];
const randReply = () => REPLIES[Math.floor(Math.random() * REPLIES.length)];
const randProbe = () => `PROBE-${String(Math.floor(1 + Math.random() * 9999)).padStart(4, "0")}`;

const INITIAL_ROUTES: Route[] = [
  {
    id: "r1",
    probeId: "PROBE-0042",
    targetHost: "10.0.13.37",
    messages: [
      mkMsg("PROBE-0042", "Route established. Secure channel active.", "recv"),
      mkMsg(PROBE_ID, "ping -c 4 10.0.13.37", "send"),
      mkMsg("PROBE-0042", "ACK. Packet integrity verified.", "recv"),
    ],
    unread: 0,
    lastActive: Date.now() - 1000 * 60 * 3,
    online: true,
  },
  {
    id: "r2",
    probeId: "PROBE-1337",
    targetHost: "192.168.1.254",
    messages: [
      mkMsg("PROBE-1337", "BGP session initialized. Ready.", "recv"),
      mkMsg(PROBE_ID, "traceroute 192.168.1.254", "send"),
      mkMsg("PROBE-1337", "Roger. Latency within acceptable range.", "recv"),
      mkMsg("PROBE-1337", "Signal strength nominal. Standing by.", "recv"),
    ],
    unread: 2,
    lastActive: Date.now() - 1000 * 60 * 17,
    online: true,
  },
  {
    id: "r3",
    probeId: "PROBE-9981",
    targetHost: "172.16.0.1",
    messages: [
      mkMsg("PROBE-9981", "Tunnel established. HMAC handshake OK.", "recv"),
    ],
    unread: 0,
    lastActive: Date.now() - 1000 * 60 * 60 * 2,
    online: false,
  },
];

const LOG_TEMPLATES = [
  () => `[${tsShort()}] [INFO] ICMP Echo Reply from ${randomIP()} ttl=64 time=${randomLatency()}ms`,
  () => `[${tsShort()}] [INFO] Route trace hop ${Math.floor(1 + Math.random() * 12)} -> ${randomIP()} (${randomLatency()}ms)`,
  () => `[${tsShort()}] [DEBUG] TCP handshake SYN_ACK ${randomIP()}:${443 + Math.floor(Math.random() * 100)}`,
  () => `[${tsShort()}] [INFO] DNS resolved gateway.internal -> ${randomIP()}`,
  () => `[${tsShort()}] [WARN] Packet loss on hop ${Math.floor(3 + Math.random() * 6)}: ${(Math.random() * 5).toFixed(1)}%`,
  () => `[${tsShort()}] [INFO] BGP peer ${randomIP()} state: Established`,
  () => `[${tsShort()}] [DEBUG] ARP cache: ${randomIP()} -> ${Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":")}`,
  () => `[${tsShort()}] [INFO] MTU path discovery: 1500B confirmed to ${randomIP()}`,
];

// ─── Mini Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, color, h = 32, w = 80 }: { data: number[]; color: string; h?: number; w?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-500"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.4 + (i / values.length) * 0.6 }} />
      ))}
    </div>
  );
}

// ─── Time formatter ───────────────────────────────────────────────────
function fmtTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Main App ─────────────────────────────────────────────────────────
type Tab = "monitor" | "channel" | "config";

export default function PingLog() {
  const [tab, setTab] = useState<Tab>("monitor");

  // Monitor data
  const [fakeLogs, setFakeLogs] = useState<string[]>(() =>
    Array.from({ length: 12 }, () => LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]()));
  const [latencyData, setLatencyData] = useState<number[]>(() => Array.from({ length: 20 }, () => 10 + Math.random() * 50));
  const [packetLossData, setPacketLossData] = useState<number[]>(() => Array.from({ length: 14 }, () => Math.random() * 4));
  const [throughputData, setThroughputData] = useState<number[]>(() => Array.from({ length: 20 }, () => 50 + Math.random() * 150));
  const [uptime] = useState(() => Math.floor(100 + Math.random() * 9000));

  // Secret unlock
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Routes (채팅방 목록)
  const [routes, setRoutes] = useState<Route[]>(INITIAL_ROUTES);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const activeRoute = routes.find(r => r.id === activeRouteId) ?? null;

  // Conversation state
  const [inputValue, setInputValue] = useState("");
  const [stealthMode, setStealthMode] = useState(false);
  const [probing, setProbing] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  // New route modal
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newHost, setNewHost] = useState("");

  // Lock
  const [locked, setLocked] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);

  // Invite codes
  const [inviteCodes, setInviteCodes] = useState<Array<{ code: string; created: number }>>(() => getSavedCodes());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // ── Tickers ────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setFakeLogs(prev => [...prev, LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]()].slice(-80));
      setLatencyData(prev => [...prev.slice(-19), 10 + Math.random() * 50]);
      setPacketLossData(prev => [...prev.slice(-13), Math.random() * 4]);
      setThroughputData(prev => [...prev.slice(-19), 50 + Math.random() * 150]);
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRoute?.messages.length]);

  // ── Secret unlock ──────────────────────────────────────────────────
  const handleVersionClick = useCallback(() => {
    if (secretUnlocked) {
      setSecretUnlocked(false);
      setTab("monitor");
      setClickCount(0);
      return;
    }
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) { setSecretUnlocked(true); setTab("channel"); return 0; }
      return next;
    });
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setClickCount(0), 1200);
  }, [secretUnlocked]);

  // ── Enter route (채팅방 입장) ───────────────────────────────────────
  const openRoute = (id: string) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, unread: 0 } : r));
    setActiveRouteId(id);
    setInputValue("");
  };

  // ── Send message ───────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputValue.trim() || !activeRouteId) return;
    const msg = mkMsg(PROBE_ID, inputValue.trim(), "send");
    setRoutes(prev => prev.map(r => r.id === activeRouteId
      ? { ...r, messages: [...r.messages, msg], lastActive: Date.now() }
      : r));
    setInputValue("");
    setProbing(true);
    setTimeout(() => {
      setProbing(false);
      const reply = mkMsg(activeRoute?.probeId ?? randProbe(), randReply(), "recv");
      setRoutes(prev => prev.map(r => r.id === activeRouteId
        ? { ...r, messages: [...r.messages, reply], lastActive: Date.now() }
        : r));
    }, 1500 + Math.random() * 2500);
  };

  // ── New route (새 채팅방) ──────────────────────────────────────────
  const handleCreateRoute = () => {
    if (!newHost.trim()) return;
    const newRoute: Route = {
      id: Math.random().toString(36).slice(2),
      probeId: randProbe(),
      targetHost: newHost.trim(),
      messages: [mkMsg("SYSTEM", "Route established. Secure channel active.", "recv")],
      unread: 0,
      lastActive: Date.now(),
      online: true,
    };
    setRoutes(prev => [newRoute, ...prev]);
    setNewHost("");
    setShowNewRoute(false);
    openRoute(newRoute.id);
  };

  // ── Delete route ───────────────────────────────────────────────────
  const handleDeleteRoute = (id: string) => {
    setRoutes(prev => prev.filter(r => r.id !== id));
    if (activeRouteId === id) setActiveRouteId(null);
  };

  // ── Lock ────────────────────────────────────────────────────────────
  const handleLock = () => {
    setLocked(true); setLockProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => { setLocked(false); setLockProgress(0); }, 1200); }
      setLockProgress(p);
    }, 200);
  };

  // ── Invite ──────────────────────────────────────────────────────────
  const handleGenerateCode = () => {
    const code = genCode();
    const updated = [{ code, created: Date.now() }, ...inviteCodes].slice(0, 10);
    setInviteCodes(updated); saveCodes(updated);
  };
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(buildInviteUrl(code)).then(() => {
      setCopiedCode(code); setTimeout(() => setCopiedCode(null), 2000);
    });
  };
  const handleShare = (code: string) => {
    if (navigator.share) navigator.share({ title: "PingLog Probe Key", text: "Network diagnostic access key:", url: buildInviteUrl(code) });
    else handleCopy(code);
  };

  // ── Total unread ────────────────────────────────────────────────────
  const totalUnread = routes.reduce((s, r) => s + r.unread, 0);

  // ── Lock screen ─────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-mono text-[#555] select-none px-8">
        <RefreshCw className="w-10 h-10 animate-spin text-[#2a2a2a] mb-5" />
        <p className="text-sm mb-4 tracking-widest text-center">RECONNECTING TO SERVER...</p>
        <div className="w-full max-w-xs h-1.5 bg-[#1a1a1a] rounded overflow-hidden">
          <div className="h-full bg-[#333] rounded transition-all duration-200" style={{ width: `${lockProgress}%` }} />
        </div>
        <p className="text-xs mt-2 text-[#333]">Establishing secure tunnel... {Math.min(Math.floor(lockProgress), 100)}%</p>
      </div>
    );
  }

  const latestLatency = latencyData[latencyData.length - 1]?.toFixed(1);
  const latestLoss = packetLossData[packetLossData.length - 1]?.toFixed(2);
  const latestThroughput = throughputData[throughputData.length - 1]?.toFixed(0);

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0a0a0a] text-[#b0b0b0] font-mono flex flex-col overflow-hidden select-none">

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] px-4 py-2.5 flex items-center justify-between">
        {/* Back button when inside a conversation */}
        {tab === "channel" && activeRouteId ? (
          <button onClick={() => setActiveRouteId(null)} className="flex items-center gap-1 text-[#00d4ff]">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs">Routes</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00ff41]" />
            <span className="text-[#00ff41] font-bold tracking-wider">PingLog</span>
          </div>
        )}

        {/* Center: conversation title */}
        {tab === "channel" && activeRoute && (
          <div className="flex flex-col items-center">
            <span className="text-xs text-[#ccc]">{activeRoute.probeId}</span>
            <span className="text-[9px] text-[#444]">{activeRoute.targetHost}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {tab === "channel" && activeRoute && (
            <button onClick={() => setStealthMode(s => !s)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#1a1a1a] active:bg-[#222] text-[#555] border border-[#222]">
              {stealthMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
          {!(tab === "channel" && activeRouteId) && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-[#444]">
                <Shield className="w-3 h-3 text-[#00ff41]" />
                <span>TLS 1.3</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#444]">
                <Wifi className="w-3 h-3 text-[#00d4ff]" />
                <span>ON</span>
              </div>
            </>
          )}
          <button onClick={handleLock}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] bg-[#1a1a1a] active:bg-[#252525] text-[#666] border border-[#222]">
            <Lock className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* ── Probe info bar (hide inside conversations) ────────────── */}
      {!(tab === "channel" && activeRouteId) && (
        <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0a0a0a] px-4 py-1.5 flex items-center gap-4 overflow-x-auto text-[10px] text-[#444]">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Server className="w-2.5 h-2.5" />
            <span className="text-[#00d4ff]">{PROBE_ID}</span>
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Zap className="w-2.5 h-2.5" />Up: {uptime}s
          </span>
          <span className="whitespace-nowrap ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse inline-block" />ACTIVE
          </span>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ── MONITOR TAB ─────────────────────────────────────────── */}
        {tab === "monitor" && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-3 pb-2">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
                <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Latency</p>
                <p className="text-[#00ff41] text-xl font-bold leading-none mb-2">{latestLatency}<span className="text-xs font-normal text-[#555]">ms</span></p>
                <Sparkline data={latencyData} color="#00ff41" h={28} w={100} />
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
                <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Pkt Loss</p>
                <p className="text-[#ff5555] text-xl font-bold leading-none mb-2">{latestLoss}<span className="text-xs font-normal text-[#555]">%</span></p>
                <MiniBar values={packetLossData} color="#ff5555" />
              </div>
              <div className="col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] text-[#444] uppercase tracking-widest">Throughput</p>
                  <p className="text-[#00d4ff] text-xl font-bold leading-none">{latestThroughput}<span className="text-xs font-normal text-[#555]"> Mbps</span></p>
                </div>
                <Sparkline data={throughputData} color="#00d4ff" h={28} w={999} />
              </div>
            </div>
            <div className="flex-1 mx-3 mb-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] bg-[#111]">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-[#00ff41]" />
                  <span className="text-[9px] text-[#555] uppercase tracking-widest">Ping Log — Live Feed</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ fontSize: "10px" }}>
                {fakeLogs.map((log, i) => {
                  const isWarn = log.includes("[WARN]");
                  const isDebug = log.includes("[DEBUG]");
                  return (
                    <div key={i} className={`leading-relaxed break-all ${isWarn ? "text-[#ffaa00]" : isDebug ? "text-[#555]" : "text-[#00ff41]/70"}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── CHANNEL TAB ─────────────────────────────────────────── */}
        {tab === "channel" && secretUnlocked && (
          <div className="h-full flex flex-col overflow-hidden">

            {/* ── ROUTE LIST ────────────────────────────────────── */}
            {!activeRouteId && (
              <>
                {/* List header */}
                <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#111] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#00d4ff]" />
                    <span className="text-xs text-[#555] uppercase tracking-wider">Route List</span>
                    {totalUnread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#00d4ff]/15 text-[#00d4ff] text-[9px]">
                        {totalUnread} pending
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowNewRoute(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0a2010] border border-[#00ff41]/20 text-[#00ff41] text-[10px] active:bg-[#0d2a14]">
                    <Plus className="w-3 h-3" />New Route
                  </button>
                </div>

                {/* New route modal */}
                {showNewRoute && (
                  <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#0f0f0f] space-y-2">
                    <p className="text-[9px] text-[#444] uppercase tracking-widest">New Probe Route</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newHost}
                        onChange={e => setNewHost(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreateRoute()}
                        placeholder="Target host (e.g. 10.0.0.5)"
                        autoFocus
                        className="flex-1 bg-[#1a1a1a] border border-[#222] rounded-lg px-3 py-2 text-xs text-[#00d4ff] outline-none focus:border-[#00d4ff]/30 placeholder-[#333]"
                        style={{ fontSize: "16px" }}
                      />
                      <button onClick={handleCreateRoute}
                        className="px-3 py-2 rounded-lg bg-[#0a1a2a] border border-[#00d4ff]/20 text-[#00d4ff] text-xs active:bg-[#0d1f33]">
                        Open
                      </button>
                      <button onClick={() => { setShowNewRoute(false); setNewHost(""); }}
                        className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#555] text-xs">
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Route items */}
                <div className="flex-1 overflow-y-auto">
                  {routes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                      <Radio className="w-8 h-8 text-[#1e1e1e] mb-3" />
                      <p className="text-[#333] text-xs">No active routes.</p>
                      <p className="text-[#222] text-[10px] mt-1">Tap "New Route" to open a probe channel.</p>
                    </div>
                  ) : (
                    routes.map(route => {
                      const lastMsg = route.messages[route.messages.length - 1];
                      return (
                        <button
                          key={route.id}
                          onClick={() => openRoute(route.id)}
                          className="w-full px-4 py-3.5 border-b border-[#131313] flex items-center gap-3 active:bg-[#0f0f0f] text-left"
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-[#0f1f2a] border border-[#1a2a3a] flex items-center justify-center">
                              <span className="text-[#00d4ff] text-xs font-bold">
                                {route.probeId.slice(-2)}
                              </span>
                            </div>
                            {route.online && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00ff41] border border-[#0a0a0a]" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-[#ccc] truncate">{route.probeId}</span>
                              <span className="text-[9px] text-[#333] flex-shrink-0 ml-2">{fmtTime(route.lastActive)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[10px] truncate ${stealthMode ? "blur-sm" : "text-[#444]"}`}>
                                {lastMsg ? (
                                  <span>
                                    {lastMsg.dir === "send" ? <span className="text-[#333]">You: </span> : null}
                                    {lastMsg.text}
                                  </span>
                                ) : (
                                  <span className="text-[#2a2a2a]">No packets yet</span>
                                )}
                              </p>
                              {route.unread > 0 && (
                                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#00d4ff] text-[#0a0a0a] text-[9px] font-bold flex items-center justify-center">
                                  {route.unread}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-[#2a2a2a] mt-0.5">{route.targetHost}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* ── CONVERSATION VIEW ─────────────────────────────── */}
            {activeRouteId && activeRoute && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ fontSize: "11px" }}>
                  {activeRoute.messages.map((msg) => (
                    <div key={msg.id} className={`${stealthMode ? "blur-sm active:blur-none" : ""} transition-all`}>
                      {msg.dir === "recv" ? (
                        <div className="flex gap-2 items-start">
                          <div className="w-7 h-7 rounded-full bg-[#0f1f2a] border border-[#00d4ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[#00d4ff] text-[8px] font-bold">{msg.from.slice(-2)}</span>
                          </div>
                          <div className="flex-1 max-w-[82%]">
                            <p className="text-[9px] text-[#444] mb-0.5">{msg.from} · {msg.ts.slice(11, 19)}</p>
                            <div className="bg-[#0f1f2a] border border-[#00d4ff]/10 rounded-xl rounded-tl-none px-3 py-2 text-[#aad4e8] leading-relaxed">
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-start flex-row-reverse">
                          <div className="w-7 h-7 rounded-full bg-[#0a2a0f] border border-[#00ff41]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[#00ff41] text-[8px] font-bold">{PROBE_ID.slice(-2)}</span>
                          </div>
                          <div className="flex-1 max-w-[82%] flex flex-col items-end">
                            <p className="text-[9px] text-[#444] mb-0.5">{msg.ts.slice(11, 19)}</p>
                            <div className="bg-[#0a2010] border border-[#00ff41]/10 rounded-xl rounded-tr-none px-3 py-2 text-[#a8e8b8] leading-relaxed">
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {probing && (
                    <div className="flex gap-2 items-center px-1">
                      <div className="w-7 h-7 rounded-full bg-[#0f1f2a] border border-[#00d4ff]/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#00d4ff] text-[9px] animate-pulse">···</span>
                      </div>
                      <span className="text-[#444] text-xs">probing...</span>
                    </div>
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Input bar */}
                <div className="flex-shrink-0 border-t border-[#1a1a1a] bg-[#111] p-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#00ff41] flex-shrink-0" />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSend()}
                      placeholder="Command line argument..."
                      className="flex-1 bg-[#1a1a1a] border border-[#222] rounded-xl px-3 py-2.5 text-sm text-[#ccc] outline-none focus:border-[#00ff41]/30 placeholder-[#333]"
                      style={{ fontSize: "16px" }}
                    />
                    <button onClick={handleSend}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#00ff41]/10 active:bg-[#00ff41]/20 border border-[#00ff41]/20 flex-shrink-0">
                      <Send className="w-4 h-4 text-[#00ff41]" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#333]">
                    <span>HMAC-SHA256 · {activeRoute.targetHost}</span>
                    <span className={probing ? "text-[#ffaa00]" : "text-[#00ff41]"}>{probing ? "PROBING" : "IDLE"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CONFIG TAB ──────────────────────────────────────────── */}
        {tab === "config" && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-[#555]" />
              <span className="text-xs text-[#555] uppercase tracking-wider">Route Config</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
                <p className="text-[9px] text-[#444] uppercase tracking-widest mb-3">Current Probe</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#555]">Probe ID</span>
                  <span className="text-[#00d4ff] text-xs">{PROBE_ID}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#555]">Active Routes</span>
                  <span className="text-[#00ff41] text-xs">{routes.filter(r => r.online).length} online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#555]">Encryption</span>
                  <span className="text-[#555] text-xs">AES-256 / HMAC-SHA256</span>
                </div>
              </div>

              {/* Routes management */}
              <div className="space-y-2">
                <p className="text-[9px] text-[#444] uppercase tracking-widest">Manage Routes</p>
                {routes.map(route => (
                  <div key={route.id} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#00d4ff]">{route.probeId}</p>
                      <p className="text-[9px] text-[#333]">{route.targetHost}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 ${route.online ? "fill-[#00ff41] text-[#00ff41]" : "fill-[#333] text-[#333]"}`} />
                      <button onClick={() => handleDeleteRoute(route.id)} className="text-[#333] active:text-[#ff5555] p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Probe keys */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-[#444] uppercase tracking-widest">Probe Keys</p>
                  <button onClick={handleGenerateCode}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2010] border border-[#00ff41]/20 text-[#00ff41] text-[10px] active:bg-[#0d2a14]">
                    <Plus className="w-3 h-3" />Generate Key
                  </button>
                </div>
                {inviteCodes.length === 0 ? (
                  <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-5 text-center">
                    <p className="text-[#2a2a2a] text-xs">No probe keys generated yet.</p>
                  </div>
                ) : (
                  inviteCodes.map(({ code, created }) => (
                    <div key={code} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#00d4ff] text-xs tracking-wider font-bold">{code}</span>
                        <button onClick={() => { const u = inviteCodes.filter(c => c.code !== code); setInviteCodes(u); saveCodes(u); }} className="text-[#333] active:text-[#ff5555]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[#2a2a2a] text-[9px] mb-2 break-all">{buildInviteUrl(code)}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#333] flex-1">{new Date(created).toLocaleDateString()}</span>
                        <button onClick={() => handleCopy(code)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[10px] text-[#555]">
                          {copiedCode === code ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
                          {copiedCode === code ? "Copied" : "Copy"}
                        </button>
                        <button onClick={() => handleShare(code)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0a1a2a] border border-[#00d4ff]/20 text-[10px] text-[#00d4ff]">
                          <Share2 className="w-3 h-3" />Share
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-[#0a0f0a] border border-[#00ff41]/10 rounded-xl p-4">
                <p className="text-[9px] text-[#00ff41]/40 uppercase tracking-widest mb-2">Install App</p>
                <ul className="space-y-1">
                  <li className="text-[10px] text-[#555] flex items-start gap-1.5">
                    <span className="text-[#00ff41]/50 mt-0.5">›</span>
                    <span><span className="text-[#666]">Android:</span> Chrome → "Add to Home Screen"</span>
                  </li>
                  <li className="text-[10px] text-[#555] flex items-start gap-1.5">
                    <span className="text-[#00ff41]/50 mt-0.5">›</span>
                    <span><span className="text-[#666]">iOS:</span> Safari → Share → "Add to Home Screen"</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ─────────────────────────────────────────── */}
      <nav className="flex-shrink-0 border-t border-[#1a1a1a] bg-[#0d0d0d] flex items-stretch">
        <button onClick={() => setTab("monitor")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${tab === "monitor" ? "text-[#00ff41]" : "text-[#444]"}`}>
          <BarChart2 className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-widest">Monitor</span>
        </button>

        {secretUnlocked && (
          <button onClick={() => { setTab("channel"); setActiveRouteId(null); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors relative ${tab === "channel" ? "text-[#00d4ff]" : "text-[#444]"}`}>
            <Radio className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-widest">Channel</span>
            {totalUnread > 0 && tab !== "channel" && (
              <span className="absolute top-2 right-[calc(50%-14px)] min-w-[14px] h-[14px] rounded-full bg-[#00d4ff] text-[#0a0a0a] text-[8px] font-bold flex items-center justify-center px-0.5">
                {totalUnread}
              </span>
            )}
          </button>
        )}

        {secretUnlocked && (
          <button onClick={() => setTab("config")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${tab === "config" ? "text-[#555]" : "text-[#333]"}`}>
            <Settings2 className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-widest">Config</span>
          </button>
        )}

        <button onClick={handleVersionClick}
          className="px-4 flex flex-col items-center justify-center gap-1 py-3 text-[#2a2a2a] hover:text-[#333] transition-colors">
          <span className="text-[9px] tracking-widest">v2.4.1</span>
          {clickCount > 0 && <span className="text-[8px] text-[#333]">{"·".repeat(clickCount)}</span>}
        </button>
      </nav>
    </div>
  );
}
