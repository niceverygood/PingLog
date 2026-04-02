import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, Shield, Lock, Terminal, Server, Zap, Eye, EyeOff,
  ChevronRight, RefreshCw, ArrowUpRight, ArrowDownLeft, Wifi,
  Radio, BarChart2, Send, Settings2, Copy, Share2, Check, Plus,
  Trash2, ChevronLeft, Circle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
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

// ─── Invite helpers ─────────────────────────────────────────────────
const INVITE_KEY = "pinglog_invite_codes";
function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const s = (n: number) => Array.from({ length: n }, () => c[Math.floor(Math.random() * c.length)]).join("");
  return `PL-${s(4)}-${s(4)}-${s(4)}`;
}
function getSavedCodes(): { code: string; created: number }[] {
  try { return JSON.parse(localStorage.getItem(INVITE_KEY) || "[]"); } catch { return []; }
}
function saveCodes(codes: { code: string; created: number }[]) {
  localStorage.setItem(INVITE_KEY, JSON.stringify(codes));
}
function buildInviteUrl(code: string) {
  return `${window.location.origin}/?probe-key=${code}`;
}

// ─── Core helpers ────────────────────────────────────────────────────
const nowTs = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const nowShort = () => new Date().toISOString().slice(11, 19);
const randIP = () => `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
const randMs = () => (4 + Math.random() * 60).toFixed(1);
const randProbe = () => `PROBE-${String(Math.floor(1 + Math.random() * 9999)).padStart(4, "0")}`;
const mkMsg = (from: string, text: string, dir: "send" | "recv"): Message => ({
  id: Math.random().toString(36).slice(2), from, text, ts: nowTs(), dir,
});
const PROBE_ID = `PROBE-${Math.floor(1000 + Math.random() * 9000)}`;

const LOGS = [
  () => `[${nowShort()}] [INFO] ICMP Echo Reply from ${randIP()} ttl=64 time=${randMs()}ms`,
  () => `[${nowShort()}] [INFO] Route trace hop ${Math.floor(1 + Math.random() * 12)} -> ${randIP()} (${randMs()}ms)`,
  () => `[${nowShort()}] [DEBUG] TCP handshake SYN_ACK ${randIP()}:${443 + Math.floor(Math.random() * 100)}`,
  () => `[${nowShort()}] [INFO] DNS resolved gateway.internal -> ${randIP()}`,
  () => `[${nowShort()}] [WARN] Packet loss on hop ${Math.floor(3 + Math.random() * 6)}: ${(Math.random() * 5).toFixed(1)}%`,
  () => `[${nowShort()}] [INFO] BGP peer ${randIP()} state: Established`,
  () => `[${nowShort()}] [DEBUG] ARP cache: ${randIP()} -> ${Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":")}`,
  () => `[${nowShort()}] [INFO] MTU path discovery: 1500B confirmed to ${randIP()}`,
];

const REPLIES = [
  "ACK. Packet integrity verified.",
  "Copy. Adjusting route parameters.",
  "Acknowledged. Awaiting next payload.",
  "Data received. Hash verified OK.",
  "Roger. Latency within acceptable range.",
  "Confirmed. Continuing probe sequence.",
  "Signal strength nominal. Standing by.",
];

const INIT_ROUTES: Route[] = [
  {
    id: "r1", probeId: "PROBE-0042", targetHost: "10.0.13.37",
    messages: [
      mkMsg("PROBE-0042", "Route established. Secure channel active.", "recv"),
      mkMsg(PROBE_ID, "ping -c 4 10.0.13.37", "send"),
      mkMsg("PROBE-0042", "ACK. Packet integrity verified.", "recv"),
    ],
    unread: 0, lastActive: Date.now() - 180_000, online: true,
  },
  {
    id: "r2", probeId: "PROBE-1337", targetHost: "192.168.1.254",
    messages: [
      mkMsg("PROBE-1337", "BGP session initialized. Ready.", "recv"),
      mkMsg(PROBE_ID, "traceroute 192.168.1.254", "send"),
      mkMsg("PROBE-1337", "Roger. Latency within acceptable range.", "recv"),
      mkMsg("PROBE-1337", "Signal strength nominal. Standing by.", "recv"),
    ],
    unread: 2, lastActive: Date.now() - 1_020_000, online: true,
  },
  {
    id: "r3", probeId: "PROBE-9981", targetHost: "172.16.0.1",
    messages: [mkMsg("PROBE-9981", "Tunnel established. HMAC handshake OK.", "recv")],
    unread: 0, lastActive: Date.now() - 7_200_000, online: false,
  },
];

// ─── Responsive Sparkline (viewBox-based) ────────────────────────────
function Sparkline({ data, color, h = 32 }: { data: number[]; color: string; h?: number }) {
  if (data.length < 2) return null;
  const W = 300;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${h - ((v - min) / range) * (h - 4) - 2}`
  ).join(" ");
  const last = data[data.length - 1];
  const lx = W, ly = h - ((last - min) / range) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none"
      className="w-full overflow-visible" style={{ height: h }}>
      <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" points={pts} />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-8 w-full">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-500"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.35 + (i / values.length) * 0.65 }} />
      ))}
    </div>
  );
}

function fmtTime(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return `${Math.floor(d / 86_400_000)}d`;
}

// ─── Main Component ──────────────────────────────────────────────────
type Tab = "monitor" | "channel" | "config";

export default function PingLog() {
  // ── Monitor ────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("monitor");
  const [logs, setLogs] = useState<string[]>(() =>
    Array.from({ length: 14 }, () => LOGS[Math.floor(Math.random() * LOGS.length)]()));
  const [latData, setLatData] = useState(() => Array.from({ length: 24 }, () => 10 + Math.random() * 50));
  const [lossData, setLossData] = useState(() => Array.from({ length: 16 }, () => Math.random() * 4));
  const [thrData, setThrData] = useState(() => Array.from({ length: 24 }, () => 50 + Math.random() * 150));
  const [uptime] = useState(() => Math.floor(100 + Math.random() * 9000));

  // ── Secret ─────────────────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(false);
  const [clicks, setClicks] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Routes ─────────────────────────────────────────────────────────
  const [routes, setRoutes] = useState<Route[]>(INIT_ROUTES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRoute = routes.find(r => r.id === activeId) ?? null;
  const [input, setInput] = useState("");
  const [stealthMode, setStealthMode] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newHost, setNewHost] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);

  // ── Invite ─────────────────────────────────────────────────────────
  const [inviteCodes, setInviteCodes] = useState(() => getSavedCodes());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // ── Lock ───────────────────────────────────────────────────────────
  const [locked, setLocked] = useState(false);
  const [lockP, setLockP] = useState(0);

  // ── Tickers ────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setLogs(p => [...p, LOGS[Math.floor(Math.random() * LOGS.length)]()].slice(-100));
      setLatData(p => [...p.slice(-23), 10 + Math.random() * 50]);
      setLossData(p => [...p.slice(-15), Math.random() * 4]);
      setThrData(p => [...p.slice(-23), 50 + Math.random() * 150]);
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRoute?.messages.length]);

  // ── Secret unlock ──────────────────────────────────────────────────
  const handleVersion = useCallback(() => {
    if (unlocked) { setUnlocked(false); setTab("monitor"); setClicks(0); return; }
    setClicks(p => {
      const n = p + 1;
      if (n >= 5) { setUnlocked(true); setTab("channel"); return 0; }
      return n;
    });
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setClicks(0), 1200);
  }, [unlocked]);

  // ── Route actions ──────────────────────────────────────────────────
  const openRoute = (id: string) => {
    setRoutes(p => p.map(r => r.id === id ? { ...r, unread: 0 } : r));
    setActiveId(id);
    setInput("");
  };
  const closeRoute = () => setActiveId(null);

  const handleSend = () => {
    if (!input.trim() || !activeId) return;
    const msg = mkMsg(PROBE_ID, input.trim(), "send");
    setRoutes(p => p.map(r => r.id === activeId ? { ...r, messages: [...r.messages, msg], lastActive: Date.now() } : r));
    setInput("");
    setProbing(true);
    setTimeout(() => {
      setProbing(false);
      const reply = mkMsg(activeRoute?.probeId ?? randProbe(), REPLIES[Math.floor(Math.random() * REPLIES.length)], "recv");
      setRoutes(p => p.map(r => r.id === activeId ? { ...r, messages: [...r.messages, reply], lastActive: Date.now() } : r));
    }, 1500 + Math.random() * 2500);
  };

  const handleCreateRoute = () => {
    if (!newHost.trim()) return;
    const r: Route = {
      id: Math.random().toString(36).slice(2), probeId: randProbe(),
      targetHost: newHost.trim(), messages: [mkMsg("SYSTEM", "Route established. Secure channel active.", "recv")],
      unread: 0, lastActive: Date.now(), online: true,
    };
    setRoutes(p => [r, ...p]);
    setNewHost(""); setShowNewRoute(false);
    openRoute(r.id);
  };

  // ── Lock ───────────────────────────────────────────────────────────
  const handleLock = () => {
    setLocked(true); setLockP(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => { setLocked(false); setLockP(0); }, 1200); }
      setLockP(p);
    }, 200);
  };

  // ── Invite ─────────────────────────────────────────────────────────
  const handleGenCode = () => {
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
    if (navigator.share) navigator.share({ title: "PingLog Probe Key", url: buildInviteUrl(code) });
    else handleCopy(code);
  };

  const totalUnread = routes.reduce((s, r) => s + r.unread, 0);
  const latestLat = latData[latData.length - 1]?.toFixed(1);
  const latestLoss = lossData[lossData.length - 1]?.toFixed(2);
  const latestThr = thrData[thrData.length - 1]?.toFixed(0);

  // ── Lock screen ────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center font-mono text-[#555] px-8">
        <RefreshCw className="w-10 h-10 animate-spin text-[#2a2a2a] mb-5" />
        <p className="text-sm mb-4 tracking-widest">RECONNECTING TO SERVER...</p>
        <div className="w-full max-w-xs h-1.5 bg-[#1a1a1a] rounded overflow-hidden">
          <div className="h-full bg-[#333] rounded transition-all duration-200" style={{ width: `${lockP}%` }} />
        </div>
        <p className="text-xs mt-2 text-[#333]">Establishing secure tunnel... {Math.min(Math.floor(lockP), 100)}%</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Sub-views (shared between mobile/desktop)
  // ─────────────────────────────────────────────────────────────────

  // Monitor panel
  const MonitorPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-3 pb-2">
        {/* Latency */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
          <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Latency</p>
          <p className="text-[#00ff41] text-xl font-bold leading-none mb-2">
            {latestLat}<span className="text-xs font-normal text-[#555]">ms</span>
          </p>
          <Sparkline data={latData} color="#00ff41" h={28} />
        </div>
        {/* Packet Loss */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
          <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Pkt Loss</p>
          <p className="text-[#ff5555] text-xl font-bold leading-none mb-2">
            {latestLoss}<span className="text-xs font-normal text-[#555]">%</span>
          </p>
          <MiniBar values={lossData} color="#ff5555" />
        </div>
        {/* Throughput */}
        <div className="col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-[#444] uppercase tracking-widest">Throughput</p>
            <p className="text-[#00d4ff] text-xl font-bold leading-none">
              {latestThr}<span className="text-xs font-normal text-[#555]"> Mbps</span>
            </p>
          </div>
          <Sparkline data={thrData} color="#00d4ff" h={28} />
        </div>
      </div>
      {/* Ping log */}
      <div className="flex-1 mx-3 mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] bg-[#111] flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-[#00ff41]" />
            <span className="text-[9px] text-[#555] uppercase tracking-widest">Ping Log — Live Feed</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-0" style={{ fontSize: "10px" }}>
          {logs.map((log, i) => (
            <div key={i} className={`leading-relaxed break-all ${log.includes("[WARN]") ? "text-[#ffaa00]" : log.includes("[DEBUG]") ? "text-[#555]" : "text-[#00ff41]/70"}`}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Route list panel
  const RouteList = () => (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-[#00d4ff]" />
          <span className="text-xs text-[#555] uppercase tracking-wider">Route List</span>
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#00d4ff]/15 text-[#00d4ff] text-[9px]">{totalUnread} pending</span>
          )}
        </div>
        <button onClick={() => setShowNewRoute(v => !v)}
          className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2010] border border-[#00ff41]/20 text-[#00ff41] text-[10px] active:bg-[#0d2a14]">
          <Plus className="w-3 h-3" />New Route
        </button>
      </div>
      {/* New route input */}
      {showNewRoute && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#0f0f0f] space-y-2">
          <p className="text-[9px] text-[#444] uppercase tracking-widest">New Probe Route</p>
          <div className="flex gap-2">
            <input type="text" value={newHost} onChange={e => setNewHost(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateRoute()} autoFocus
              placeholder="Target host (e.g. 10.0.0.5)"
              className="flex-1 min-h-[40px] bg-[#1a1a1a] border border-[#222] rounded-lg px-3 text-sm text-[#00d4ff] outline-none focus:border-[#00d4ff]/30 placeholder-[#333]"
              style={{ fontSize: "16px" }} />
            <button onClick={handleCreateRoute}
              className="min-h-[40px] px-3 rounded-lg bg-[#0a1a2a] border border-[#00d4ff]/20 text-[#00d4ff] text-xs">
              Open
            </button>
            <button onClick={() => { setShowNewRoute(false); setNewHost(""); }}
              className="min-h-[40px] px-3 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#555] text-xs">
              ✕
            </button>
          </div>
        </div>
      )}
      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Radio className="w-8 h-8 text-[#1e1e1e] mb-3" />
            <p className="text-[#333] text-xs">No active routes.</p>
          </div>
        ) : routes.map(route => {
          const lastMsg = route.messages[route.messages.length - 1];
          const isActive = activeId === route.id;
          return (
            <button key={route.id} onClick={() => openRoute(route.id)}
              className={`w-full min-h-[68px] px-4 py-3 border-b border-[#131313] flex items-center gap-3 text-left transition-colors ${isActive ? "bg-[#0f1a0f]" : "active:bg-[#0f0f0f]"}`}>
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#0f1f2a] border border-[#1a2a3a] flex items-center justify-center">
                  <span className="text-[#00d4ff] text-xs font-bold">{route.probeId.slice(-2)}</span>
                </div>
                {route.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00ff41] border-2 border-[#0a0a0a]" />}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className={`text-xs truncate ${route.unread > 0 ? "text-[#ddd] font-semibold" : "text-[#888]"}`}>{route.probeId}</span>
                  <span className="text-[9px] text-[#333] flex-shrink-0 ml-2">{fmtTime(route.lastActive)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] truncate ${stealthMode ? "blur-sm" : route.unread > 0 ? "text-[#555]" : "text-[#3a3a3a]"}`}>
                    {lastMsg ? <>{lastMsg.dir === "send" && <span className="text-[#333]">You: </span>}{lastMsg.text}</> : <span className="text-[#2a2a2a]">No packets</span>}
                  </p>
                  {route.unread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#00d4ff] text-[#0a0a0a] text-[9px] font-bold flex items-center justify-center px-1">
                      {route.unread}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-[#2a2a2a] mt-0.5">{route.targetHost}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Conversation panel
  const Conversation = ({ showBack = true }: { showBack?: boolean }) => (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0" style={{ fontSize: "11px" }}>
        {activeRoute ? activeRoute.messages.map(msg => (
          <div key={msg.id} className={stealthMode ? "blur-sm active:blur-none transition-all" : ""}>
            {msg.dir === "recv" ? (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-[#0f1f2a] border border-[#00d4ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#00d4ff] text-[8px] font-bold">{msg.from.slice(-2)}</span>
                </div>
                <div className="max-w-[80%]">
                  <p className="text-[9px] text-[#444] mb-0.5">{msg.from} · {msg.ts.slice(11, 19)}</p>
                  <div className="bg-[#0f1f2a] border border-[#00d4ff]/10 rounded-2xl rounded-tl-none px-3 py-2 text-[#aad4e8] leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-start flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-[#0a2a0f] border border-[#00ff41]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#00ff41] text-[8px] font-bold">{PROBE_ID.slice(-2)}</span>
                </div>
                <div className="max-w-[80%] flex flex-col items-end">
                  <p className="text-[9px] text-[#444] mb-0.5">{msg.ts.slice(11, 19)}</p>
                  <div className="bg-[#0a2010] border border-[#00ff41]/10 rounded-2xl rounded-tr-none px-3 py-2 text-[#a8e8b8] leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Radio className="w-8 h-8 text-[#1e1e1e] mb-3" />
            <p className="text-[#333] text-xs">Select a route to begin</p>
          </div>
        )}
        {probing && (
          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-[#0f1f2a] border border-[#00d4ff]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#00d4ff] text-[9px] animate-pulse">···</span>
            </div>
            <span className="text-[#444] text-xs">probing...</span>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>
      {/* Input */}
      {activeRoute && (
        <div className="flex-shrink-0 border-t border-[#1a1a1a] bg-[#111] px-3 pt-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-[#00ff41] flex-shrink-0" />
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Command line argument..."
              className="flex-1 min-h-[44px] bg-[#1a1a1a] border border-[#222] rounded-xl px-3 text-[#ccc] outline-none focus:border-[#00ff41]/30 placeholder-[#333]"
              style={{ fontSize: "16px" }} />
            <button onClick={handleSend}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#00ff41]/10 active:bg-[#00ff41]/20 border border-[#00ff41]/20 flex-shrink-0">
              <Send className="w-4 h-4 text-[#00ff41]" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#2a2a2a] pb-1">
            <span>HMAC-SHA256 · {activeRoute.targetHost}</span>
            <span className={probing ? "text-[#ffaa00]" : "text-[#00ff41]/60"}>{probing ? "PROBING" : "IDLE"}</span>
          </div>
        </div>
      )}
    </div>
  );

  // Config panel
  const ConfigPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
        <Settings2 className="w-3.5 h-3.5 text-[#555]" />
        <span className="text-xs text-[#555] uppercase tracking-wider">Route Config</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {/* Probe info */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 space-y-2.5">
          <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Current Probe</p>
          {[["Probe ID", PROBE_ID, "#00d4ff"], ["Active Routes", `${routes.filter(r=>r.online).length} online`, "#00ff41"], ["Encryption", "AES-256 / HMAC-SHA256", "#555"]].map(([k, v, col]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-[#555]">{k}</span>
              <span className="text-xs" style={{ color: col }}>{v}</span>
            </div>
          ))}
        </div>
        {/* Manage routes */}
        <div className="space-y-2">
          <p className="text-[9px] text-[#444] uppercase tracking-widest">Manage Routes</p>
          {routes.map(r => (
            <div key={r.id} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl px-3 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00d4ff]">{r.probeId}</p>
                <p className="text-[9px] text-[#333]">{r.targetHost}</p>
              </div>
              <div className="flex items-center gap-2">
                <Circle className={`w-2 h-2 ${r.online ? "fill-[#00ff41] text-[#00ff41]" : "fill-[#333] text-[#333]"}`} />
                <button onClick={() => setRoutes(p => p.filter(x => x.id !== r.id))}
                  className="p-1.5 text-[#333] active:text-[#ff5555]"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        {/* Probe keys */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-[#444] uppercase tracking-widest">Probe Keys</p>
            <button onClick={handleGenCode}
              className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2010] border border-[#00ff41]/20 text-[#00ff41] text-[10px]">
              <Plus className="w-3 h-3" />Generate Key
            </button>
          </div>
          {inviteCodes.length === 0 ? (
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-5 text-center">
              <p className="text-[#2a2a2a] text-xs">No probe keys generated yet.</p>
            </div>
          ) : inviteCodes.map(({ code, created }) => (
            <div key={code} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#00d4ff] text-xs tracking-wider font-bold">{code}</span>
                <button onClick={() => { const u = inviteCodes.filter(c => c.code !== code); setInviteCodes(u); saveCodes(u); }}
                  className="p-1 text-[#333] active:text-[#ff5555]"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[#222] text-[9px] mb-2 break-all">{buildInviteUrl(code)}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#333] flex-1">{new Date(created).toLocaleDateString()}</span>
                <button onClick={() => handleCopy(code)}
                  className="min-h-[32px] flex items-center gap-1 px-2.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[10px] text-[#555]">
                  {copiedCode === code ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
                  {copiedCode === code ? "Copied" : "Copy"}
                </button>
                <button onClick={() => handleShare(code)}
                  className="min-h-[32px] flex items-center gap-1 px-2.5 rounded-lg bg-[#0a1a2a] border border-[#00d4ff]/20 text-[10px] text-[#00d4ff]">
                  <Share2 className="w-3 h-3" />Share
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Install hint */}
        <div className="bg-[#0a0f0a] border border-[#00ff41]/10 rounded-xl p-4">
          <p className="text-[9px] text-[#00ff41]/40 uppercase tracking-widest mb-2">Install App</p>
          <ul className="space-y-1.5">
            {[["Android", "Chrome → 메뉴 → \"홈 화면에 추가\""], ["iOS", "Safari → 공유 → \"홈 화면에 추가\""]].map(([os, desc]) => (
              <li key={os} className="text-[10px] text-[#555] flex items-start gap-1.5">
                <span className="text-[#00ff41]/40 mt-0.5">›</span>
                <span><span className="text-[#666]">{os}:</span> {desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // Nav items
  const navItems = [
    { id: "monitor" as Tab, icon: BarChart2, label: "Monitor", color: "#00ff41", always: true },
    { id: "channel" as Tab, icon: Radio, label: "Channel", color: "#00d4ff", always: false },
    { id: "config" as Tab, icon: Settings2, label: "Config", color: "#555", always: false },
  ].filter(item => item.always || unlocked);

  // ─────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-[#b0b0b0] font-mono flex flex-col md:flex-row overflow-hidden">

      {/* ════════════════════════════════════════════════════════════
          DESKTOP LEFT SIDEBAR (md+)
      ═══════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex flex-col items-center border-r border-[#1a1a1a] bg-[#0d0d0d] w-16 flex-shrink-0"
        style={{ paddingTop: "var(--sat)" }}>
        {/* Logo */}
        <div className="w-full flex items-center justify-center py-4 border-b border-[#1a1a1a]">
          <Activity className="w-5 h-5 text-[#00ff41]" />
        </div>
        {/* Nav icons */}
        <div className="flex-1 flex flex-col items-center gap-1 py-3 w-full">
          {navItems.map(({ id, icon: Icon, label, color }) => (
            <button key={id} onClick={() => { setTab(id); if (id !== "channel") setActiveId(null); }}
              title={label}
              className={`w-full flex flex-col items-center gap-1 py-3 transition-colors relative ${tab === id ? "text-[var(--c)]" : "text-[#333] hover:text-[#555]"}`}
              style={{ "--c": color } as React.CSSProperties}>
              <Icon className="w-5 h-5" />
              {id === "channel" && totalUnread > 0 && tab !== "channel" && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00d4ff]" />
              )}
            </button>
          ))}
        </div>
        {/* Bottom: lock + version */}
        <div className="flex flex-col items-center gap-2 py-3 border-t border-[#1a1a1a] w-full"
          style={{ paddingBottom: "max(12px, var(--sab))" }}>
          <button onClick={handleLock} title="Screen Lock"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[#444] hover:text-[#666] hover:bg-[#1a1a1a] transition-colors">
            <Lock className="w-4 h-4" />
          </button>
          <button onClick={handleVersion}
            className="text-[9px] text-[#2a2a2a] hover:text-[#444] tracking-wider py-1 transition-colors">
            {clicks > 0 ? "·".repeat(clicks) : "v2.4"}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top header ─────────────────────────────────────────── */}
        <header className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] flex items-center justify-between px-4"
          style={{ paddingTop: "max(10px, var(--sat))", paddingBottom: "10px" }}>
          {/* Mobile: logo | Desktop: context title */}
          <div className="flex items-center gap-2">
            {/* Mobile back button inside conversation */}
            {tab === "channel" && activeId && (
              <button onClick={closeRoute} className="flex items-center gap-1 text-[#00d4ff] md:hidden">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {/* Logo (mobile only) */}
            <div className="flex items-center gap-2 md:hidden">
              {!(tab === "channel" && activeId) && <Activity className="w-4 h-4 text-[#00ff41]" />}
              {!(tab === "channel" && activeId) && <span className="text-[#00ff41] font-bold tracking-wider text-sm">PingLog</span>}
            </div>
            {/* Conversation title (mobile) */}
            {tab === "channel" && activeRoute && (
              <div className="md:hidden flex flex-col">
                <span className="text-xs text-[#ccc]">{activeRoute.probeId}</span>
                <span className="text-[9px] text-[#444]">{activeRoute.targetHost}</span>
              </div>
            )}
            {/* Desktop: page title */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-[#444] uppercase tracking-widest">
                {tab === "monitor" ? "Network Monitor" : tab === "channel" ? "Probe Channels" : "Route Config"}
              </span>
            </div>
          </div>

          {/* Right: status + controls */}
          <div className="flex items-center gap-3">
            {tab === "channel" && activeId && (
              <button onClick={() => setStealthMode(s => !s)}
                className="min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] bg-[#1a1a1a] text-[#555] border border-[#222]">
                {stealthMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Stealth</span>
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#444]">
              <Shield className="w-3 h-3 text-[#00ff41]" /><span>TLS</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#444]">
              <Wifi className="w-3 h-3 text-[#00d4ff]" /><span>ON</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#444]">
              <Server className="w-2.5 h-2.5" /><span className="text-[#00d4ff] hidden xs:inline">{PROBE_ID}</span>
            </div>
            <button onClick={handleLock}
              className="min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] bg-[#1a1a1a] text-[#555] border border-[#222] md:hidden">
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden min-h-0">

          {/* MONITOR */}
          {tab === "monitor" && <MonitorPanel />}

          {/* CHANNEL */}
          {tab === "channel" && unlocked && (
            <div className="h-full flex overflow-hidden">
              {/* Route list: always visible on desktop, hidden on mobile when in conversation */}
              <div className={`${activeId ? "hidden md:flex" : "flex"} flex-col md:w-80 md:border-r md:border-[#1a1a1a] w-full`}>
                <RouteList />
              </div>
              {/* Conversation: full on mobile, right panel on desktop */}
              <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
                <Conversation />
              </div>
            </div>
          )}

          {/* CONFIG */}
          {tab === "config" && <ConfigPanel />}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MOBILE BOTTOM NAV
      ═══════════════════════════════════════════════════════════════ */}
      <nav className="md:hidden flex-shrink-0 border-t border-[#1a1a1a] bg-[#0d0d0d] flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navItems.map(({ id, icon: Icon, label, color }) => (
          <button key={id} onClick={() => { setTab(id); if (id !== "channel") setActiveId(null); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors relative ${tab === id ? "text-[var(--c)]" : "text-[#3a3a3a]"}`}
            style={{ "--c": color, minHeight: "56px" } as React.CSSProperties}>
            <Icon className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-widest">{label}</span>
            {id === "channel" && totalUnread > 0 && tab !== "channel" && (
              <span className="absolute top-2 right-[calc(50%-14px)] min-w-[16px] h-4 rounded-full bg-[#00d4ff] text-[#0a0a0a] text-[8px] font-bold flex items-center justify-center px-1">
                {totalUnread}
              </span>
            )}
          </button>
        ))}
        {/* Version tap zone */}
        <button onClick={handleVersion}
          className="px-4 flex flex-col items-center justify-center gap-0.5 py-3 text-[#222]"
          style={{ minHeight: "56px" }}>
          <span className="text-[9px] tracking-widest">{clicks > 0 ? "·".repeat(clicks) : "v2.4.1"}</span>
        </button>
      </nav>
    </div>
  );
}
