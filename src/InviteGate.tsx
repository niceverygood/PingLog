import { useState } from "react";
import { Shield, Terminal, Lock, RefreshCw, Wifi, Copy, Check } from "lucide-react";

interface Props {
  onAuth: (code: string) => void;
}

const PRESET_CODES = [
  "PL-A3K7-BX2M-QR9N",
  "PL-Z5P1-YH4C-WD8T",
  "PL-J6N2-LF3V-MK7G",
  "PL-R8T4-SU5X-EC1B",
  "PL-H2W9-DQ6J-NP3Y",
];

export default function InviteGate({ onAuth }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const validate = (code: string) => /^PL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());

  const handleSubmit = () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    setError("");
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

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleUse = (code: string) => {
    setInput(code);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] font-mono flex flex-col items-center justify-center px-6 select-none py-12">
      {/* Top status */}
      <div className="fixed top-0 left-0 right-0 border-b border-[#2a2a2a] bg-[#111] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#555] animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-[10px] text-[#777] tracking-widest">AWAITING AUTHENTICATION</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#555]">
          <Wifi className="w-3 h-3" />
          <span>DISCONNECTED</span>
        </div>
      </div>

      {/* Lock icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-[#666]" />
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-[#aaa] text-base tracking-widest uppercase mb-1">Access Restricted</h1>
        <p className="text-[#555] text-xs">PingLog Network Suite v2.4.1</p>
        <div className="mt-3 px-4 py-2 bg-[#151515] border border-[#2a2a2a] rounded-lg">
          <p className="text-[#666] text-[10px] leading-relaxed">
            This terminal requires an authorized probe key.<br />
            Use one of the keys below or contact a network administrator.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 bg-[#151515] border border-[#333] rounded-xl px-3 py-2.5 focus-within:border-[#00ff41]/30">
          <Terminal className="w-4 h-4 text-[#666] flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="PL-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            className="flex-1 bg-transparent text-[#00d4ff] text-sm outline-none placeholder-[#444] tracking-wider"
            style={{ fontSize: "16px" }}
          />
        </div>

        {error && (
          <p className="text-[#ff5555] text-[10px] tracking-wider px-1">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={checking || !input.trim()}
          className="w-full py-3 rounded-xl text-xs tracking-widest uppercase bg-[#1a1a1a] border border-[#333] text-[#888] active:bg-[#222] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
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

      {/* Preset codes */}
      <div className="w-full max-w-sm mt-8">
        <p className="text-[#555] text-[10px] tracking-widest mb-3 text-center uppercase">— Available Probe Keys —</p>
        <div className="space-y-2">
          {PRESET_CODES.map((code) => (
            <div key={code}
              className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg px-3 py-2 hover:border-[#333] transition-colors">
              <button
                onClick={() => handleUse(code)}
                className="text-[#00d4ff] text-xs tracking-wider text-left hover:text-[#33e0ff] transition-colors"
              >
                {code}
              </button>
              <button
                onClick={() => handleCopy(code)}
                className="text-[#555] hover:text-[#888] transition-colors ml-3"
              >
                {copiedCode === code
                  ? <Check className="w-3.5 h-3.5 text-[#00ff41]" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <p className="mt-10 text-[9px] text-[#333] tracking-wider text-center">
        PingLog Network Diagnostic Suite | Kernel Module v4.2.0
      </p>
    </div>
  );
}
