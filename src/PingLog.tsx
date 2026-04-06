import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, Shield, Lock, Terminal, Server, Wifi,
  RefreshCw, Radio, BarChart2, Send, Settings2, Copy, Share2,
  Check, Plus, Trash2, Circle, Smile, Paperclip,
  MoreVertical, Phone, Video, Search, ArrowLeft,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface Message {
  id: string;
  from: string;
  text: string;
  ts: number; // epoch ms
  dir: "send" | "recv";
  status?: "sent" | "delivered" | "read";
}
interface Route {
  id: string;
  name: string;          // display name (e.g. "Alex", "Team Alpha")
  probeId: string;       // internal ID (hidden)
  targetHost: string;    // internal (hidden)
  avatar: string;        // emoji avatar
  color: string;         // avatar bg color
  messages: Message[];
  unread: number;
  lastActive: number;
  online: boolean;
  isGroup?: boolean;
}

// ─── Invite helpers ──────────────────────────────────────────────────
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
const nowShort = () => new Date().toISOString().slice(11, 19);
const randIP = () => `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
const randMs = () => (4 + Math.random() * 60).toFixed(1);
const randProbe = () => `PROBE-${String(Math.floor(1 + Math.random() * 9999)).padStart(4, "0")}`;
const PROBE_ID = `PROBE-${Math.floor(1000 + Math.random() * 9000)}`;
const MY_NAME = "Me";

const mkMsg = (from: string, text: string, dir: "send" | "recv"): Message => ({
  id: Math.random().toString(36).slice(2), from, text,
  ts: Date.now(), dir,
  status: dir === "send" ? "read" : undefined,
});

// ─── Chat time formatters ─────────────────────────────────────────────
function fmtMsgTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtListTime(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "방금";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}분 전`;
  if (d < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "numeric", day: "numeric" });
}
function fmtDateDivider(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

// ─── Avatar colors ────────────────────────────────────────────────────
const AVATAR_COLORS = ["#1a4a6b", "#1a4a2e", "#4a1a1a", "#3a1a4a", "#1a3a4a", "#4a3a1a"];

// ─── Initial data ─────────────────────────────────────────────────────
const REPLIES = [
  "ㅇㅇ 알겠어",
  "잠깐만",
  "나중에 연락할게",
  "ㅋㅋ 맞아",
  "그래 확인했어",
  "오케이",
  "언제 볼 수 있어?",
  "아 진짜?",
  "ㅇㅋ 고마워",
  "나 지금 바쁜데",
  "이따가 얘기해",
  "👍",
];

const now = Date.now();
const INIT_ROUTES: Route[] = [
  {
    id: "r1", name: "Alex", probeId: "PROBE-0042", targetHost: "10.0.13.37",
    avatar: "A", color: AVATAR_COLORS[0],
    messages: [
      { id: "m1", from: "Alex", text: "야 언제 와?", ts: now - 3_600_000 * 3, dir: "recv", status: undefined },
      { id: "m2", from: MY_NAME, text: "좀 이따 갈게", ts: now - 3_600_000 * 3 + 60_000, dir: "send", status: "read" },
      { id: "m3", from: "Alex", text: "ㅇㅋ 기다릴게", ts: now - 180_000, dir: "recv" },
    ],
    unread: 0, lastActive: now - 180_000, online: true,
  },
  {
    id: "r2", name: "Team Alpha", probeId: "PROBE-1337", targetHost: "192.168.1.254",
    avatar: "T", color: AVATAR_COLORS[4],
    messages: [
      { id: "g1", from: "Sarah", text: "내일 미팅 몇 시야?", ts: now - 1_020_000, dir: "recv" },
      { id: "g2", from: "James", text: "오후 2시로 잡자", ts: now - 1_000_000, dir: "recv" },
      { id: "g3", from: "Sarah", text: "👍", ts: now - 980_000, dir: "recv" },
    ],
    unread: 2, lastActive: now - 980_000, online: true, isGroup: true,
  },
  {
    id: "r3", name: "Jamie", probeId: "PROBE-7721", targetHost: "10.0.0.88",
    avatar: "J", color: AVATAR_COLORS[2],
    messages: [
      { id: "j1", from: MY_NAME, text: "밥 먹었어?", ts: now - 7_200_000, dir: "send", status: "read" },
      { id: "j2", from: "Jamie", text: "아직", ts: now - 7_100_000, dir: "recv" },
    ],
    unread: 0, lastActive: now - 7_100_000, online: false,
  },
  {
    id: "r4", name: "Sam", probeId: "PROBE-9981", targetHost: "172.16.0.1",
    avatar: "S", color: AVATAR_COLORS[3],
    messages: [
      { id: "s1", from: "Sam", text: "주말에 뭐 해?", ts: now - 86_400_000, dir: "recv" },
    ],
    unread: 1, lastActive: now - 86_400_000, online: false,
  },
];

// ─── Monitor log templates ────────────────────────────────────────────
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

// ─── Responsive Sparkline ─────────────────────────────────────────────
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

// ─── Read receipt icon ────────────────────────────────────────────────
function ReadReceipt({ status }: { status?: "sent" | "delivered" | "read" }) {
  if (!status) return null;
  if (status === "sent") return <Check className="w-3 h-3 text-[#555]" />;
  if (status === "delivered") return (
    <span className="flex"><Check className="w-3 h-3 text-[#555]" /><Check className="w-3 h-3 -ml-1.5 text-[#555]" /></span>
  );
  return (
    <span className="flex"><Check className="w-3 h-3 text-[#4fc3f7]" /><Check className="w-3 h-3 -ml-1.5 text-[#4fc3f7]" /></span>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-[#1e1e1e] rounded-2xl rounded-bl-sm w-fit">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-[#555] inline-block"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
type Tab = "monitor" | "channel" | "config";

export default function PingLog() {
  // Monitor
  const [tab, setTab] = useState<Tab>("monitor");
  const [logs, setLogs] = useState<string[]>(() =>
    Array.from({ length: 14 }, () => LOGS[Math.floor(Math.random() * LOGS.length)]()));
  const [latData, setLatData] = useState(() => Array.from({ length: 24 }, () => 10 + Math.random() * 50));
  const [lossData, setLossData] = useState(() => Array.from({ length: 16 }, () => Math.random() * 4));
  const [thrData, setThrData] = useState(() => Array.from({ length: 24 }, () => 50 + Math.random() * 150));
  // Secret
  const [unlocked, setUnlocked] = useState(false);
  const [clicks, setClicks] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Routes / Chat
  const [routes, setRoutes] = useState<Route[]>(INIT_ROUTES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRoute = routes.find(r => r.id === activeId) ?? null;
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Invite
  const [inviteCodes, setInviteCodes] = useState(() => getSavedCodes());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Lock
  const [locked, setLocked] = useState(false);
  const [lockP, setLockP] = useState(0);

  // Tickers
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
  }, [activeRoute?.messages.length, typing]);

  // Secret unlock
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

  // Chat actions
  const openRoute = (id: string) => {
    setRoutes(p => p.map(r => r.id === id ? { ...r, unread: 0 } : r));
    setActiveId(id);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSend = () => {
    if (!input.trim() || !activeId) return;
    const text = input.trim();
    const msg = mkMsg(MY_NAME, text, "send");
    setRoutes(p => p.map(r => r.id === activeId
      ? { ...r, messages: [...r.messages, msg], lastActive: Date.now() } : r));
    setInput("");
    setTyping(true);
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      setTyping(false);
      const reply = { ...mkMsg(activeRoute?.name ?? "Unknown", REPLIES[Math.floor(Math.random() * REPLIES.length)], "recv") };
      setRoutes(p => p.map(r => r.id === activeId
        ? { ...r, messages: [...r.messages, reply], lastActive: Date.now() } : r));
    }, delay);
  };

  const handleCreateRoute = () => {
    if (!newName.trim()) return;
    const initial = newName.trim()[0].toUpperCase();
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const r: Route = {
      id: Math.random().toString(36).slice(2),
      name: newName.trim(), probeId: randProbe(), targetHost: `10.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
      avatar: initial, color,
      messages: [mkMsg(newName.trim(), "안녕! 연결됐어 👋", "recv")],
      unread: 1, lastActive: Date.now(), online: true,
    };
    setRoutes(p => [r, ...p]);
    setNewName(""); setShowNewRoute(false);
    openRoute(r.id);
  };

  // Lock
  const handleLock = () => {
    setLocked(true); setLockP(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => { setLocked(false); setLockP(0); }, 1200); }
      setLockP(p);
    }, 200);
  };

  // Invite
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
    if (navigator.share) navigator.share({ title: "PingLog", url: buildInviteUrl(code) });
    else handleCopy(code);
  };

  const totalUnread = routes.reduce((s, r) => s + r.unread, 0);
  const filteredRoutes = searchQuery
    ? routes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : routes;

  // ── Lock screen ────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center font-mono text-[#555] px-8"
        style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
        <RefreshCw className="w-10 h-10 animate-spin text-[#2a2a2a] mb-5" />
        <p className="text-sm mb-4 tracking-widest">RECONNECTING TO SERVER...</p>
        <div className="w-full max-w-xs h-1.5 bg-[#1a1a1a] rounded overflow-hidden">
          <div className="h-full bg-[#333] rounded transition-all duration-200" style={{ width: `${lockP}%` }} />
        </div>
        <p className="text-xs mt-2 text-[#333]">Establishing secure tunnel... {Math.min(Math.floor(lockP), 100)}%</p>
      </div>
    );
  }

  // ── Monitor stats ──────────────────────────────────────────────────
  const latestLat = latData[latData.length - 1]?.toFixed(1);
  const latestLoss = lossData[lossData.length - 1]?.toFixed(2);
  const latestThr = thrData[thrData.length - 1]?.toFixed(0);

  // ══════════════════════════════════════════════════════════════════
  // CHAT SUBVIEWS
  // ══════════════════════════════════════════════════════════════════

  // ── Chat Route List ────────────────────────────────────────────────
  const ChatList = () => (
    <div className="h-full flex flex-col bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white not-italic" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            채팅
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewRoute(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[#aaa] active:bg-[#2a2a2a]">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-[#1e1e1e] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-[#555] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="검색"
            className="flex-1 bg-transparent text-sm text-[#ccc] outline-none placeholder-[#555]"
            style={{ fontSize: "16px", fontFamily: "system-ui, -apple-system, sans-serif" }}
          />
        </div>
      </div>

      {/* New chat input */}
      {showNewRoute && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-[#1e1e1e] bg-[#151515] flex gap-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreateRoute()} autoFocus
            placeholder="이름 입력..."
            className="flex-1 bg-[#1e1e1e] rounded-xl px-3 py-2 text-sm text-[#ccc] outline-none placeholder-[#555]"
            style={{ fontSize: "16px", fontFamily: "system-ui, -apple-system, sans-serif" }} />
          <button onClick={handleCreateRoute}
            className="px-3 py-2 rounded-xl bg-[#2a5a3a] text-[#00ff41] text-sm font-medium">확인</button>
          <button onClick={() => { setShowNewRoute(false); setNewName(""); }}
            className="px-3 py-2 rounded-xl bg-[#1e1e1e] text-[#666] text-sm">취소</button>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[#333] text-sm" style={{ fontFamily: "system-ui, sans-serif" }}>채팅이 없습니다</p>
          </div>
        ) : filteredRoutes.map(route => {
          const lastMsg = route.messages[route.messages.length - 1];
          const isActive = activeId === route.id;
          return (
            <button key={route.id} onClick={() => openRoute(route.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left ${isActive ? "bg-[#1a2a1a]" : "active:bg-[#1a1a1a]"}`}
              style={{ minHeight: "72px" }}>
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: route.color, fontFamily: "system-ui, sans-serif" }}>
                  {route.avatar}
                </div>
                {route.online && (
                  <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[#00e676] border-2 border-[#111]" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className={`text-sm font-semibold truncate ${route.unread > 0 ? "text-white" : "text-[#ccc]"}`}
                    style={{ fontFamily: "system-ui, sans-serif" }}>
                    {route.name}
                    {route.isGroup && <span className="ml-1 text-xs text-[#555]">👥</span>}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ml-2 ${route.unread > 0 ? "text-[#00e676]" : "text-[#555]"}`}
                    style={{ fontFamily: "system-ui, sans-serif" }}>
                    {fmtListTime(route.lastActive)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] truncate ${route.unread > 0 ? "text-[#aaa]" : "text-[#555]"}`}
                    style={{ fontFamily: "system-ui, sans-serif" }}>
                    {lastMsg ? (
                      <>
                        {lastMsg.dir === "send" && <span className="text-[#555]">나: </span>}
                        {lastMsg.text}
                      </>
                    ) : <span className="text-[#333]">메시지 없음</span>}
                  </p>
                  {route.unread > 0 && (
                    <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-[#00e676] text-[#0a0a0a] text-[11px] font-bold flex items-center justify-center px-1.5"
                      style={{ fontFamily: "system-ui, sans-serif" }}>
                      {route.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Conversation View ──────────────────────────────────────────────
  const ConversationView = () => {
    // Group messages by date
    const grouped: { date: string; msgs: Message[] }[] = [];
    if (activeRoute) {
      let currentDate = "";
      activeRoute.messages.forEach(msg => {
        const d = fmtDateDivider(msg.ts);
        if (d !== currentDate) {
          grouped.push({ date: d, msgs: [] });
          currentDate = d;
        }
        grouped[grouped.length - 1].msgs.push(msg);
      });
    }

    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: "#0f0f0f" }}>
        {/* Conversation header */}
        {activeRoute && (
          <div className="flex-shrink-0 flex items-center gap-3 px-3 border-b border-[#1e1e1e] bg-[#111]"
            style={{ minHeight: "60px", paddingTop: "max(12px, var(--sat))", paddingBottom: "10px" }}>
            {/* Back (mobile) */}
            <button onClick={() => setActiveId(null)}
              className="md:hidden flex items-center justify-center w-8 h-8 -ml-1 text-[#aaa] active:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: activeRoute.color, fontFamily: "system-ui, sans-serif" }}>
                {activeRoute.avatar}
              </div>
              {activeRoute.online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00e676] border-2 border-[#111]" />
              )}
            </div>
            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate"
                style={{ fontFamily: "system-ui, sans-serif" }}>{activeRoute.name}</p>
              <p className="text-[11px]" style={{ fontFamily: "system-ui, sans-serif",
                color: activeRoute.online ? "#00e676" : "#555" }}>
                {typing ? "입력 중..." : activeRoute.online ? "온라인" : "오프라인"}
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#888] active:bg-[#1e1e1e]">
                <Phone className="w-4.5 h-4.5" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#888] active:bg-[#1e1e1e]">
                <Video className="w-4.5 h-4.5" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#888] active:bg-[#1e1e1e]">
                <MoreVertical className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 space-y-1">
          {!activeRoute ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-[#1e1e1e] flex items-center justify-center mb-4">
                <Radio className="w-7 h-7 text-[#333]" />
              </div>
              <p className="text-[#555] text-sm" style={{ fontFamily: "system-ui, sans-serif" }}>
                대화를 선택하세요
              </p>
            </div>
          ) : grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#444] px-2"
                  style={{ fontFamily: "system-ui, sans-serif" }}>{date}</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>
              {/* Messages in group */}
              {msgs.map((msg, idx) => {
                const isSend = msg.dir === "send";
                const nextSameDir = idx < msgs.length - 1 && msgs[idx + 1].dir === msg.dir;
                return (
                  <div key={msg.id}
                    className={`flex items-end gap-2 ${isSend ? "flex-row-reverse" : ""} ${nextSameDir ? "mb-0.5" : "mb-2"}`}>
                    {/* Avatar (recv, group, last in sequence) */}
                    {!isSend && (
                      <div className="flex-shrink-0 mb-1">
                        {(!nextSameDir) ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: activeRoute.color, fontFamily: "system-ui, sans-serif" }}>
                            {msg.from[0]}
                          </div>
                        ) : <div className="w-7" />}
                      </div>
                    )}
                    {/* Bubble */}
                    <div className={`max-w-[72%] flex flex-col ${isSend ? "items-end" : "items-start"}`}>
                      {/* Sender name in group */}
                      {!isSend && activeRoute.isGroup && idx === 0 && (
                        <p className="text-[11px] text-[#00e676] mb-1 ml-1"
                          style={{ fontFamily: "system-ui, sans-serif" }}>{msg.from}</p>
                      )}
                      {!isSend && activeRoute.isGroup && idx > 0 && msgs[idx - 1].from !== msg.from && (
                        <p className="text-[11px] text-[#00e676] mb-1 ml-1"
                          style={{ fontFamily: "system-ui, sans-serif" }}>{msg.from}</p>
                      )}
                      <div className={`px-3.5 py-2 ${
                        isSend
                          ? "bg-[#1a3a2a] rounded-2xl rounded-br-sm"
                          : "bg-[#1e1e1e] rounded-2xl rounded-bl-sm"
                      }`}>
                        <p className={`text-[14px] leading-relaxed ${isSend ? "text-[#d4f0d4]" : "text-[#e0e0e0]"}`}
                          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                          {msg.text}
                        </p>
                      </div>
                      {/* Time + read receipt */}
                      <div className={`flex items-center gap-1 mt-0.5 mx-1 ${isSend ? "flex-row-reverse" : ""}`}>
                        <span className="text-[10px] text-[#444]"
                          style={{ fontFamily: "system-ui, sans-serif" }}>
                          {fmtMsgTime(msg.ts)}
                        </span>
                        {isSend && <ReadReceipt status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {/* Typing indicator */}
          {typing && activeRoute && (
            <div className="flex items-end gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: activeRoute.color, fontFamily: "system-ui, sans-serif" }}>
                {activeRoute.avatar}
              </div>
              <TypingDots />
            </div>
          )}
          <div ref={msgEndRef} />
        </div>

        {/* Input bar */}
        {activeRoute && (
          <div className="flex-shrink-0 bg-[#111] border-t border-[#1e1e1e] px-3 pt-2"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              <button className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[#555] active:bg-[#1e1e1e]">
                <Paperclip className="w-5 h-5" />
              </button>
              {/* Input */}
              <div className="flex-1 min-h-[40px] max-h-32 bg-[#1e1e1e] rounded-2xl px-4 py-2.5 flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-transparent text-sm text-[#e0e0e0] outline-none placeholder-[#555]"
                  style={{ fontSize: "16px", fontFamily: "system-ui, -apple-system, sans-serif" }}
                />
                <button className="flex-shrink-0 ml-2 text-[#555] active:text-[#888]">
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              {/* Send */}
              <button onClick={handleSend}
                className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                  input.trim() ? "bg-[#00e676]" : "bg-[#1e1e1e]"
                }`}>
                <Send className={`w-4 h-4 ${input.trim() ? "text-[#0a0a0a]" : "text-[#555]"}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Monitor Panel ──────────────────────────────────────────────────
  const MonitorPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-3 pb-2 space-y-2">
        {/* Top row: Latency + Pkt Loss */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3">
            <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1 font-mono">Latency</p>
            <p className="text-[#00ff41] text-2xl font-bold leading-none mb-2 font-mono">
              {latestLat}<span className="text-xs font-normal text-[#555]">ms</span></p>
            <Sparkline data={latData} color="#00ff41" h={32} />
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3">
            <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1 font-mono">Pkt Loss</p>
            <p className="text-[#ff5555] text-2xl font-bold leading-none mb-2 font-mono">
              {latestLoss}<span className="text-xs font-normal text-[#555]">%</span></p>
            <MiniBar values={lossData} color="#ff5555" />
          </div>
        </div>
        {/* Throughput full width */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-[#444] uppercase tracking-widest font-mono">Throughput</p>
            <p className="text-[#00d4ff] text-2xl font-bold leading-none font-mono">
              {latestThr}<span className="text-xs font-normal text-[#555]"> Mbps</span></p>
          </div>
          <Sparkline data={thrData} color="#00d4ff" h={36} />
        </div>
      </div>
      {/* Terminal log */}
      <div className="flex-1 mx-3 mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1a1a1a] bg-[#111] flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#00ff41]" />
            <span className="text-[9px] text-[#555] uppercase tracking-widest font-mono">Ping Log — Live Feed</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 font-mono" style={{ fontSize: "11px", lineHeight: "1.6" }}>
          {logs.map((log, i) => (
            <div key={i} className={`break-all ${log.includes("[WARN]") ? "text-[#ffaa00]" : log.includes("[DEBUG]") ? "text-[#555]" : "text-[#00ff41]/70"}`}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Config Panel ───────────────────────────────────────────────────
  const ConfigPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
        <Settings2 className="w-3.5 h-3.5 text-[#555]" />
        <span className="text-xs text-[#555] uppercase tracking-wider font-mono">Route Config</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 space-y-2.5">
          <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1 font-mono">Current Probe</p>
          {[["Probe ID", PROBE_ID, "#00d4ff"], ["Active Routes", `${routes.filter(r=>r.online).length} online`, "#00ff41"], ["Encryption", "AES-256 / HMAC-SHA256", "#555"]].map(([k, v, col]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-[#555] font-mono">{k}</span>
              <span className="text-xs font-mono" style={{ color: col }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[9px] text-[#444] uppercase tracking-widest font-mono">Manage Routes</p>
          {routes.map(r => (
            <div key={r.id} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: r.color, fontFamily: "system-ui, sans-serif" }}>{r.avatar}</div>
                <div>
                  <p className="text-xs text-[#ccc]" style={{ fontFamily: "system-ui, sans-serif" }}>{r.name}</p>
                  <p className="text-[9px] text-[#333] font-mono">{r.probeId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Circle className={`w-2 h-2 ${r.online ? "fill-[#00e676] text-[#00e676]" : "fill-[#333] text-[#333]"}`} />
                <button onClick={() => setRoutes(p => p.filter(x => x.id !== r.id))}
                  className="p-1.5 text-[#333] active:text-[#ff5555]"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-[#444] uppercase tracking-widest font-mono">Probe Keys</p>
            <button onClick={handleGenCode}
              className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2010] border border-[#00ff41]/20 text-[#00ff41] text-[10px] font-mono">
              <Plus className="w-3 h-3" />Generate Key
            </button>
          </div>
          {inviteCodes.length === 0 ? (
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-5 text-center">
              <p className="text-[#2a2a2a] text-xs font-mono">No probe keys generated yet.</p>
            </div>
          ) : inviteCodes.map(({ code, created }) => (
            <div key={code} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#00d4ff] text-xs tracking-wider font-bold font-mono">{code}</span>
                <button onClick={() => { const u = inviteCodes.filter(c => c.code !== code); setInviteCodes(u); saveCodes(u); }}
                  className="p-1 text-[#333] active:text-[#ff5555]"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[#222] text-[9px] mb-2 break-all font-mono">{buildInviteUrl(code)}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#333] flex-1 font-mono">{new Date(created).toLocaleDateString()}</span>
                <button onClick={() => handleCopy(code)}
                  className="min-h-[32px] flex items-center gap-1 px-2.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[10px] text-[#555] font-mono">
                  {copiedCode === code ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
                  {copiedCode === code ? "Copied" : "Copy"}
                </button>
                <button onClick={() => handleShare(code)}
                  className="min-h-[32px] flex items-center gap-1 px-2.5 rounded-lg bg-[#0a1a2a] border border-[#00d4ff]/20 text-[10px] text-[#00d4ff] font-mono">
                  <Share2 className="w-3 h-3" />Share
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#0a0f0a] border border-[#00ff41]/10 rounded-xl p-4">
          <p className="text-[9px] text-[#00ff41]/40 uppercase tracking-widest mb-2 font-mono">Install App</p>
          <ul className="space-y-1.5">
            {[["Android", "Chrome → 메뉴 → \"홈 화면에 추가\""], ["iOS", "Safari → 공유 → \"홈 화면에 추가\""]].map(([os, desc]) => (
              <li key={os} className="text-[10px] text-[#555] flex items-start gap-1.5 font-mono">
                <span className="text-[#00ff41]/40 mt-0.5">›</span>
                <span><span className="text-[#666]">{os}:</span> {desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  // Nav items — always visible
  const navItems = [
    { id: "monitor" as Tab, icon: BarChart2, label: "Monitor", color: "#00ff41" },
    { id: "channel" as Tab, icon: Radio, label: "채팅", color: "#00e676" },
    { id: "config" as Tab, icon: Settings2, label: "Config", color: "#00d4ff" },
  ];

  // 모바일에서 채팅방 열려있으면 bottom nav 숨김
  const hideBottomNav = tab === "channel" && !!activeId;

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-[#b0b0b0] font-mono flex flex-col md:flex-row overflow-hidden">

      {/* ── Desktop left sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex flex-col items-center border-r border-[#1a1a1a] bg-[#0d0d0d] w-16 flex-shrink-0"
        style={{ paddingTop: "var(--sat)" }}>
        <div className="w-full flex items-center justify-center py-4 border-b border-[#1a1a1a]">
          <Activity className="w-5 h-5 text-[#00ff41]" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 py-3 w-full">
          {navItems.map(({ id, icon: Icon, label, color }) => (
            <button key={id}
              onClick={() => { setTab(id); if (id !== "channel") setActiveId(null); }}
              title={label}
              className={`w-full flex flex-col items-center gap-1 py-3 transition-colors relative ${tab === id ? "" : "text-[#333] hover:text-[#555]"}`}
              style={{ color: tab === id ? color : undefined }}>
              <Icon className="w-5 h-5" />
              {id === "channel" && totalUnread > 0 && tab !== "channel" && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00e676]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 py-3 border-t border-[#1a1a1a] w-full"
          style={{ paddingBottom: "max(12px, var(--sab))" }}>
          <button onClick={handleLock} title="Screen Lock"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[#444] hover:text-[#666] hover:bg-[#1a1a1a]">
            <Lock className="w-4 h-4" />
          </button>
          <button onClick={handleVersion}
            className="text-[9px] text-[#2a2a2a] hover:text-[#444] tracking-wider py-1">
            {clicks > 0 ? "·".repeat(clicks) : "v2.4"}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Mobile top header (unified) ── */}
        {/* Channel with conversation open: ConversationView handles its own header */}
        {!(tab === "channel" && activeId) && (
          <header className="md:hidden flex-shrink-0 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between px-4"
            style={{
              paddingTop: "max(14px, var(--sat))",
              paddingBottom: "12px",
            }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00ff41]" />
              <span className="text-[#00ff41] font-bold tracking-wider text-sm font-mono">PingLog</span>
              <span className="text-[#333] text-xs font-mono hidden xs:inline">
                {tab === "monitor" ? "/ monitor" : tab === "config" ? "/ config" : "/ 채팅"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[9px] text-[#444] font-mono">
                <Shield className="w-3 h-3 text-[#00ff41]" />
                <span className="hidden sm:inline">TLS</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-[#444] font-mono">
                <Wifi className="w-3 h-3 text-[#00d4ff]" />
                <span className="hidden sm:inline">ON</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-[#00d4ff] font-mono">
                <Server className="w-3 h-3" />
                <span className="hidden xs:inline">{PROBE_ID}</span>
              </div>
              <button onClick={handleLock}
                className="ml-1 w-9 h-9 flex items-center justify-center rounded-xl bg-[#151515] border border-[#222] text-[#555] active:bg-[#1e1e1e]">
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        {/* ── Desktop top header ── */}
        {tab !== "channel" && (
          <header className="hidden md:flex flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] items-center justify-between px-4 py-2.5 font-mono"
            style={{ paddingTop: "max(10px, var(--sat))" }}>
            <span className="text-xs text-[#444] uppercase tracking-widest">
              {tab === "monitor" ? "Network Monitor" : "Route Config"}
            </span>
            <div className="flex items-center gap-3 text-[10px] text-[#444]">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#00ff41]" />TLS</span>
              <span className="flex items-center gap-1"><Wifi className="w-3 h-3 text-[#00d4ff]" />ON</span>
              <span className="flex items-center gap-1 text-[#00d4ff]"><Server className="w-2.5 h-2.5" />{PROBE_ID}</span>
            </div>
          </header>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0">
          {tab === "monitor" && <MonitorPanel />}
          {tab === "channel" && (
            <div className="h-full flex overflow-hidden">
              {/* List panel */}
              <div className={`${activeId ? "hidden md:flex" : "flex"} flex-col md:w-80 lg:w-96 md:border-r md:border-[#1e1e1e] w-full`}>
                <ChatList />
              </div>
              {/* Conversation panel */}
              <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
                <ConversationView />
              </div>
            </div>
          )}
          {tab === "config" && <ConfigPanel />}
        </div>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      {!hideBottomNav && (
        <nav className="md:hidden flex-shrink-0 border-t border-[#1a1a1a] bg-[#0d0d0d] flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {navItems.map(({ id, icon: Icon, label, color }) => (
            <button key={id}
              onClick={() => { setTab(id); if (id !== "channel") setActiveId(null); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors relative`}
              style={{ color: tab === id ? color : "#3a3a3a", minHeight: "60px" }}>
              {/* Active indicator bar */}
              {tab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: color }} />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[9px] uppercase tracking-widest font-mono">{label}</span>
              {id === "channel" && totalUnread > 0 && tab !== "channel" && (
                <span className="absolute top-2 right-[calc(50%-18px)] min-w-[16px] h-4 rounded-full bg-[#00e676] text-[#0a0a0a] text-[8px] font-bold flex items-center justify-center px-1">
                  {totalUnread}
                </span>
              )}
            </button>
          ))}
          {/* Version / secret unlock */}
          <button onClick={handleVersion}
            className="px-4 flex flex-col items-center justify-center gap-0.5 py-3"
            style={{ minHeight: "60px", color: clicks > 0 ? "#555" : "#222" }}>
            <span className="text-[9px] tracking-widest font-mono">{clicks > 0 ? "·".repeat(clicks) : "v2.4.1"}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
