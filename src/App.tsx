import { useState, useEffect } from "react";
import PingLog from "./PingLog";
import InviteGate from "./InviteGate";

const AUTH_KEY = "pinglog_auth_code";
const VALID_PATTERN = /^PL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function isValidCode(code: string) {
  return VALID_PATTERN.test(code.toUpperCase());
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    // 1. Check if already authenticated
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored && isValidCode(stored)) {
      setAuthed(true);
      return;
    }

    // 2. Check URL params for ?probe-key=PL-XXXX-XXXX-XXXX
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("probe-key");
    if (urlCode && isValidCode(urlCode)) {
      localStorage.setItem(AUTH_KEY, urlCode.toUpperCase());
      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
      setAuthed(true);
      return;
    }

    setAuthed(false);
  }, []);

  const handleAuth = (code: string) => {
    localStorage.setItem(AUTH_KEY, code.toUpperCase());
    setAuthed(true);
  };

  // Still checking
  if (authed === null) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center font-mono">
        <span className="text-[#1e1e1e] text-xs tracking-widest animate-pulse">INITIALIZING...</span>
      </div>
    );
  }

  if (!authed) {
    return <InviteGate onAuth={handleAuth} />;
  }

  return <PingLog />;
}
