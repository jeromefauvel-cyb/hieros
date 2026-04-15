"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const telegramRef = useRef<HTMLDivElement>(null);

  // Telegram Login Widget
  useEffect(() => {
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
    if (!botName || !telegramRef.current) return;

    // Global callback for Telegram widget
    window.onTelegramAuth = async (user: TelegramUser) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (res.ok) {
          window.location.href = "/client";
        } else {
          const data = await res.json();
          setError(data.error || "ERREUR AUTHENTIFICATION TELEGRAM");
        }
      } catch {
        setError("ERREUR RÉSEAU");
      }
      setLoading(false);
    };

    // Inject Telegram widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    telegramRef.current.appendChild(script);

    return () => {
      if (telegramRef.current) {
        telegramRef.current.innerHTML = "";
      }
    };
  }, []);

  // Email/Password login or signup
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setError("");
        setMode("login");
        alert("VÉRIFIEZ VOTRE EMAIL POUR CONFIRMER VOTRE COMPTE");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        window.location.href = "/client";
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono">
      <div className="border border-[#00FF00]/30 p-8 w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/hieros-logo.jpg"
            alt="HIEROS"
            width={165}
            height={26}
            priority
          />
        </div>

        <h1 className="text-[#00FF00] text-sm font-bold mb-6 tracking-widest text-center">
          {mode === "login" ? "CONNEXION" : "INSCRIPTION"}
        </h1>

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL"
            required
            className="w-full bg-black border border-[#00FF00]/40 text-[#00FF00] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#00FF00] placeholder:text-[#00FF00]/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="MOT DE PASSE"
            required
            minLength={6}
            className="w-full bg-black border border-[#00FF00]/40 text-[#00FF00] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#00FF00] placeholder:text-[#00FF00]/30"
          />
          {error && (
            <p className="text-red-500 text-xs uppercase">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00FF00]/10 border border-[#00FF00]/40 text-[#00FF00] py-2 text-sm uppercase tracking-wider hover:bg-[#00FF00]/20 transition-colors disabled:opacity-50"
          >
            {loading
              ? "CHARGEMENT..."
              : mode === "login"
                ? "CONNEXION"
                : "CRÉER UN COMPTE"}
          </button>
        </form>

        {/* Separator */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-[#00FF00]/20" />
          <span className="text-[#00FF00]/40 text-[10px] tracking-widest">
            OU
          </span>
          <div className="flex-1 border-t border-[#00FF00]/20" />
        </div>

        {/* Telegram Widget */}
        <div ref={telegramRef} className="flex justify-center mb-6" />

        {/* Toggle login/signup */}
        <div className="text-center">
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="text-[#FF8C00] text-[11px] tracking-wider hover:text-[#FF8C00]/80 transition-colors"
          >
            {mode === "login"
              ? "PAS DE COMPTE ? INSCRIPTION"
              : "DÉJÀ UN COMPTE ? CONNEXION"}
          </button>
        </div>

        {/* Back to home */}
        <div className="text-center mt-4">
          <a
            href="/"
            className="text-[#00FF00]/40 text-[10px] hover:text-[#00FF00] transition-colors tracking-wider"
          >
            ← RETOUR
          </a>
        </div>
      </div>
    </div>
  );
}
