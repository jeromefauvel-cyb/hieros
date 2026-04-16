"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function ClientPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
      } else {
        // No Supabase session — check cookie session (Telegram)
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.user) {
              setUser(d.user);
            } else {
              window.location.href = "/login";
            }
          })
          .catch(() => {
            window.location.href = "/login";
          });
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Also clear Telegram cookie
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <span className="text-[#33FF33] text-sm tracking-widest animate-pulse">
          CHARGEMENT...
        </span>
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.telegram_username ||
    user?.email ||
    "UTILISATEUR";

  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-black text-white font-mono uppercase">
      {/* Header */}
      <div className="border-b border-[#33FF33]/20 px-6 py-3 flex items-center justify-between">
        <h1 className="text-[#33FF33] text-lg tracking-widest font-bold">
          HIEROS CLIENT
        </h1>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-[#33FF33]/50 text-xs hover:text-[#33FF33]"
          >
            ← RETOUR AU SITE
          </a>
          <button
            onClick={handleLogout}
            className="border border-red-500/40 text-red-500 px-3 py-1 text-[10px] hover:bg-red-500/10 transition-colors"
          >
            DÉCONNEXION
          </button>
        </div>
      </div>

      {/* User info */}
      <div className="p-6">
        <div className="border border-[#33FF33]/20 p-6 max-w-[600px]">
          <div className="flex items-center gap-4 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="w-12 h-12 rounded border border-[#33FF33]/30"
              />
            )}
            <div>
              <p className="text-[#33FF33] text-sm tracking-wider font-bold">
                {displayName}
              </p>
              {user?.user_metadata?.telegram_username && (
                <p className="text-[#DF8301] text-[10px] tracking-wider">
                  @{user.user_metadata.telegram_username}
                </p>
              )}
              {user?.email && !user.email.includes("@telegram.hieros.app") && (
                <p className="text-white/50 text-[10px]">{user.email}</p>
              )}
            </div>
          </div>

          <div className="border-t border-[#33FF33]/15 pt-4">
            <p className="text-white/30 text-[11px] tracking-[0.3em] text-center">
              ◇ ESPACE CLIENT ◇
            </p>
            <p className="text-white/20 text-[9px] mt-2 text-center">
              BIENVENUE DANS VOTRE TABLEAU DE BORD
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
