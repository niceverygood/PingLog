import { useState } from "react";
import { Shield, Terminal, Lock, RefreshCw, Wifi } from "lucide-react";

interface Props {
  onAuth: (code: string) => void;
}

export default function InviteGate({ onAuth }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const validate = (code: string) => /^PL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());

  const handleSubmit = () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    setError("");
    // Simulate verification delay
    setTimeout(() => {
      setChecking(false);
      if (validate(code)) {
        onAuth(code);
      } else {
        setError("ERR: Invalid probe key. Authentication failed.");
        setInput("");
      }
    }, 1200);
  };

  return (
    <div className="h-screen bg-[#0a0a0a] font-mono flex flex-col items-center justify-center px-6 select-none">
      {/* Top status */}
      <div className="absolute top-0 left-0 right-0 border-b border-[#1a1a1a] bg-[#0d0d0d] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#333] animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-[10px] text-[#333] tracking-widest">AWAITING AUTHENTICATION</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#2a2a2a]">
          <Wifi className="w-3 h-3" />
          <span>DISCONNECTED</span>
        </div>
      </div>

      {/* Lock icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-[#333]" />
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-[#555] text-base tracking-widest uppercase mb-1">Access Restricted</h1>
        <p className="text-[#2a2a2a] text-xs">PingLog Network Suite v2.4.1</p>
        <div className="mt-3 px-4 py-2 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg">
          <p className="text-[#444] text-[10px] leading-relaxed">
            This terminal requires an authorized probe key.<br />
            Contact a network administrator for access credentials.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl px-3 py-2.5 focus-within:border-[#00ff41]/20">
          <Terminal className="w-4 h-4 text-[#444] flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="PL-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            className="flex-1 bg-transparent text-[#00d4ff] text-sm outline-none placeholder-[#2a2a2a] tracking-wider"
            style={{ fontSize: "16px" }}
          />
        </div>

        {error && (
          <p className="text-[#ff5555] text-[10px] tracking-wider px-1">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={checking || !input.trim()}
          className="w-full py-3 rounded-xl text-xs tracking-widest uppercase bg-[#111] border border-[#1e1e1e] text-[#555] active:bg-[#181818] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying probe key...</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              <span>Authenticate</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom hint */}
      <p className="absolute bottom-6 text-[9px] text-[#1e1e1e] tracking-wider text-center">
        PingLog Network Diagnostic Suite | Kernel Module v4.2.0
      </p>
    </div>
  );
}
