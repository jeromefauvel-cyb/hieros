"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

/* ─── Types ─── */
interface Prices {
  btc: number | null;
  xau: number | null;
  eurusd: number | null;
  spy: number | null;
}

interface VisitorInfo {
  ip: string;
  lat: string;
  lon: string;
}

interface MenuItem {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  parent_id: string | null;
  position: number;
}

interface SubmenuItem {
  id: string;
  code: string;
  label: string;
  ref: string;
  parent_id: string | null;
  position: number;
}

interface ContentSection {
  id: string;
  module_key: string;
  title: string;
  body: string;
}

/* ─── Fallback data (used when Supabase is not configured) ─── */
const fallbackMenuItems: MenuItem[] = [
  { id: "1", code: "BTV", label: "BTV", sort_order: 1, parent_id: null, position: 1 },
  { id: "2", code: "G7", label: "G7", sort_order: 2, parent_id: null, position: 2 },
  { id: "3", code: "CRE", label: "CRE", sort_order: 3, parent_id: null, position: 3 },
  { id: "4", code: "RLY", label: "RLY", sort_order: 4, parent_id: null, position: 4 },
  { id: "5", code: "$", label: "$", sort_order: 5, parent_id: null, position: 5 },
  { id: "6", code: "€", label: "€", sort_order: 6, parent_id: null, position: 6 },
  { id: "7", code: "£", label: "£", sort_order: 7, parent_id: null, position: 7 },
  { id: "8", code: "¥", label: "¥", sort_order: 8, parent_id: null, position: 8 },
  { id: "9", code: "SUR", label: "SUR", sort_order: 9, parent_id: null, position: 9 },
  { id: "10", code: "CCM", label: "CCM", sort_order: 10, parent_id: null, position: 10 },
  { id: "11", code: "JVH", label: "JVH", sort_order: 11, parent_id: null, position: 11 },
  { id: "12", code: "PIZ", label: "PIZ", sort_order: 12, parent_id: null, position: 12 },
  { id: "13", code: "PYP", label: "PYP", sort_order: 13, parent_id: null, position: 13 },
];

const fallbackSubmenuItems: SubmenuItem[] = [
  { id: "1", code: "ZE-NE13", label: "ZE-NE13", ref: "", parent_id: null, position: 1 },
  { id: "2", code: "FLAMOTS", label: "FLAMOTS", ref: "LM-M665/A", parent_id: null, position: 2 },
  { id: "3", code: "TIMEOUT", label: "TIMEOUT", ref: "IS-R31b/C", parent_id: null, position: 3 },
  { id: "4", code: "DGL_2115", label: "DGL_2115", ref: "", parent_id: null, position: 4 },
  { id: "5", code: "JPK_GVR", label: "JPK_GVR", ref: "LO-c324/C", parent_id: null, position: 5 },
  { id: "6", code: "REDUNO_WP", label: "REDUNO_WP", ref: "LN-5523", parent_id: null, position: 6 },
  { id: "7", code: "UNICODE", label: "UNICODE", ref: "", parent_id: null, position: 7 },
  { id: "8", code: "MATRIX", label: "MATRIX", ref: "N-RE90", parent_id: null, position: 8 },
  { id: "9", code: "WB_READY", label: "WB_READY", ref: "FE-/094", parent_id: null, position: 9 },
  { id: "10", code: "_MCN", label: "_MCN", ref: "", parent_id: null, position: 10 },
  { id: "11", code: "MATT_THQ", label: "MATT_THQ", ref: "CB-S4C5", parent_id: null, position: 11 },
  { id: "12", code: "HANDLER", label: "HANDLER", ref: "RQ-28C/3", parent_id: null, position: 12 },
];

/* ─── Tree helpers ─── */
function buildMenuTree<T extends { id: string; parent_id: string | null; position: number }>(
  items: T[]
): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.parent_id || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  // Sort each group by position
  const keys = Array.from(map.keys());
  for (let i = 0; i < keys.length; i++) {
    const children = map.get(keys[i])!;
    children.sort((a, b) => a.position - b.position);
  }
  return map;
}

/* ─── Decimal → DMS conversion ─── */
function toDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(1);
  const dir = isLat ? (decimal >= 0 ? "N" : "S") : (decimal >= 0 ? "E" : "W");
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(4, "0")}"${dir}`;
}

export default function Home() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [visitor, setVisitor] = useState<VisitorInfo>({
    ip: "---",
    lat: "---",
    lon: "---",
  });
  const [prices, setPrices] = useState<Prices>({ btc: null, xau: null, eurusd: null, spy: null });
  const [announcement, setAnnouncement] = useState("ANNOUCEMENT / MESSAGE");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(fallbackMenuItems);
  const [submenuItems, setSubmenuItems] = useState<SubmenuItem[]>(fallbackSubmenuItems);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const telegramRef = useRef<HTMLDivElement>(null);

  const isSupabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

  /* ─── Fetch data from Supabase ─── */
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const [annRes, menuRes, subRes, contentRes] = await Promise.all([
      supabase.from("announcements").select("*").eq("is_active", true).limit(1).single(),
      supabase.from("menu_items").select("*").eq("is_active", true).order("position").order("sort_order"),
      supabase.from("submenu_items").select("*").eq("is_active", true).order("position").order("sort_order"),
      supabase.from("content_sections").select("*").eq("is_active", true).order("module_key"),
    ]);

    if (annRes.data) setAnnouncement(annRes.data.message);
    if (menuRes.data) setMenuItems(menuRes.data);
    if (subRes.data) setSubmenuItems(subRes.data);
    if (contentRes.data) setContentSections(contentRes.data);
  }, [isSupabaseConfigured]);

  /* ─── Initial fetch ─── */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Realtime subscriptions ─── */
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("hieros-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "submenu_items" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "content_sections" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConfigured, fetchData]);

  /* ─── Clock (local time from browser timezone) ─── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const offsetMin = -now.getTimezoneOffset();
      const offsetH = Math.trunc(offsetMin / 60);
      const sign = offsetH >= 0 ? "+" : "";
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s} UTC${sign}${offsetH}`);
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      setDate(`${y} ${mo} ${d}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ─── Prices (every 30s) ─── */
  useEffect(() => {
    const fetchPrices = () =>
      fetch("/api/prices")
        .then((r) => r.json())
        .then((d: Prices) => setPrices(d))
        .catch(() => {});
    fetchPrices();
    const id = setInterval(fetchPrices, 30000);
    return () => clearInterval(id);
  }, []);

  /* ─── Visitor IP ─── */
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setVisitor((v) => ({ ...v, ip: d.ip })))
      .catch(() => {});
  }, []);

  /* ─── Geolocation ─── */
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setVisitor((v) => ({
          ...v,
          lat: pos.coords.latitude.toFixed(6),
          lon: pos.coords.longitude.toFixed(6),
        }));
      },
      () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => {
            if (d.latitude && d.longitude) {
              setVisitor((v) => ({
                ...v,
                lat: String(d.latitude),
                lon: String(d.longitude),
              }));
            }
          })
          .catch(() => {});
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ─── Auth: check session on mount ─── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
      } else {
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.user) setUser(d.user); })
          .catch(() => {});
      }
    });
  }, []);

  /* ─── Auth: Telegram widget injection ─── */
  useEffect(() => {
    if (activeModule !== "login" || user) return;
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
    if (!botName || !telegramRef.current) return;

    window.onTelegramAuth = async (tgUser: TelegramUser) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tgUser),
        });
        if (res.ok) {
          const meRes = await fetch("/api/auth/me");
          const meData = await meRes.json();
          if (meData?.user) setUser(meData.user);
          setActiveModule(null);
        } else {
          const data = await res.json();
          setAuthError(data.error || "ERREUR TELEGRAM");
        }
      } catch {
        setAuthError("ERREUR RÉSEAU");
      }
      setAuthLoading(false);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    telegramRef.current.innerHTML = "";
    telegramRef.current.appendChild(script);
  }, [activeModule, user]);

  /* ─── Auth: email/password submit ─── */
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) {
        setAuthError(error.message);
      } else {
        setAuthMode("login");
        setAuthError("VÉRIFIEZ VOTRE EMAIL POUR CONFIRMER");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        setUser(data.user);
        setActiveModule(null);
        setAuthEmail("");
        setAuthPassword("");
      }
    }
    setAuthLoading(false);
  };

  /* ─── Auth: logout ─── */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  /* ─── Active content ─── */
  const activeContent = contentSections.find((c) => c.module_key === activeModule);

  /* ─── Build tree structures ─── */
  const submenuTree = buildMenuTree(submenuItems);

  /* ─── Render left menu tree recursively ─── */
  const renderMenuButton = (item: MenuItem): React.ReactNode => {
    return (
      <button
        key={item.id}
        onClick={() => setActiveModule(item.code.toLowerCase())}
        className={`inline-flex items-center gap-1 px-[8px] py-0.5 text-[10px] font-bold tracking-wider transition-colors border w-fit
          ${activeModule === item.code.toLowerCase()
            ? "bg-[#FF8C00]/10 border-[#FF8C00]/30 text-[#FF8C00]"
            : "bg-[#00FF00]/10 border-[#00FF00]/30 text-[#00FF00] hover:bg-[#00FF00]/20"
          }`}
      >
        {item.code}
      </button>
    );
  };

  /* ─── Render right submenu tree recursively ─── */
  const renderSubmenuNode = (item: SubmenuItem, depth: number): React.ReactNode => {
    const children = submenuTree.get(item.id) || [];
    const isParent = children.length > 0;

    return (
      <div key={item.id}>
        <div
          className="flex justify-between py-0.5 hover:bg-[#00FF00]/5 px-1 cursor-default"
          style={{ paddingLeft: `${depth * 8 + 4}px` }}
        >
          <span className={`text-[9px] ${isParent ? "text-[#00FF00]/90 font-bold" : "text-[#00FF00]/70"}`}>
            {depth > 0 && <span className="text-[#00FF00]/20 mr-1">{"\u2514"}</span>}
            {item.label}
          </span>
          <span className="text-[#00FF00]/40 text-[9px]">{item.ref}</span>
        </div>
        {children.map((child) => renderSubmenuNode(child, depth + 1))}
      </div>
    );
  };

  const rootSubmenuItems = submenuTree.get(null) || [];

  return (
    <div className="h-screen bg-black text-white font-terminal flex flex-col overflow-hidden select-none">
      {/* ════════════════════ TOP HEADER ════════════════════ */}
      <header className="flex border-b border-[#00FF00]/20">
        {/* Left section */}
        <div className="w-[200px] min-w-[200px] flex items-center justify-center px-3 py-2 border-r border-[#00FF00]/20">
          <Image
            src="/hieros-logo.jpg"
            alt="HIEROS"
            width={165}
            height={26}
            className="object-contain"
            priority
          />
        </div>

        {/* Center section */}
        <div className="flex-1 flex items-center p-0 border-r border-[#00FF00]/20">
          <div className="flex-1 border border-[#00FF00]/30 px-3 py-1 m-3">
            <span className="text-[11px] text-white/70 tracking-widest">
              {announcement}
            </span>
          </div>
        </div>

        {/* Right section — Auth */}
        <div className="w-[200px] min-w-[200px] px-3 py-2 flex items-center justify-end">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#00FF00] truncate max-w-[120px]">
                {user.user_metadata?.display_name || user.user_metadata?.telegram_username || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="border border-red-500/40 text-red-500 px-2 py-0.5 text-[9px] hover:bg-red-500/10 transition-colors shrink-0"
              >
                OUT
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveModule("login")}
              className="text-[11px] text-white hover:text-[#FF8C00] cursor-pointer tracking-wider"
            >
              LOGIN / SIGN UP
            </button>
          )}
        </div>
      </header>

      {/* ════════════════════ SUB HEADER — TICKER ════════════════════ */}
      <div className="flex border-b border-[#00FF00]/20">
        <div className="w-[200px] min-w-[200px] border-r border-[#00FF00]/20" />

        <div className="flex-1 flex items-center justify-center py-1 border-r border-[#00FF00]/20 text-[13px] tracking-wider">
          <span className="text-[#00FF00]">BTC </span>
          <span className="text-white font-bold ml-1">{prices.btc?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#00FF00]">XAU </span>
          <span className="text-white font-bold ml-1">{prices.xau?.toFixed(2) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#00FF00]">EUR/USD </span>
          <span className="text-white font-bold ml-1">{prices.eurusd?.toFixed(4) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#00FF00]">SPY </span>
          <span className="text-white font-bold ml-1">{prices.spy?.toFixed(2) ?? "---"}</span>
        </div>

        <div className="w-[200px] min-w-[200px] px-3 py-1" />
      </div>

      {/* ════════════════════ MAIN 3-COL LAYOUT ════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ──────── LEFT COLUMN ──────── */}
        <aside className="w-[200px] min-w-[200px] border-r border-[#00FF00]/20 flex flex-col">
          {/* Info blocs GMT / YMD / GPS / IPV */}
          <div className="p-3 space-y-1 text-[11px]">
            <div className="flex items-center">
              <span className="bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] text-[#00FF00] font-bold w-[36px] text-center shrink-0">
                GMT
              </span>
              <span className="text-white/80 ml-2">{time}</span>
            </div>
            <div className="flex items-center">
              <span className="bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] text-[#00FF00] font-bold w-[36px] text-center shrink-0">
                YMD
              </span>
              <span className="text-white/80 ml-2">{date}</span>
            </div>
            <div className="flex items-start">
              <span className="bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] text-[#00FF00] font-bold w-[36px] text-center shrink-0">
                GPS
              </span>
              <span className="text-white/80 text-[10px] leading-tight ml-2">
                {visitor.lat === "---" ? "---" : toDMS(parseFloat(visitor.lat), true)}
                <br />
                {visitor.lon === "---" ? "---" : toDMS(parseFloat(visitor.lon), false)}
              </span>
            </div>
            <div className="flex items-center">
              <span className="bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] text-[#00FF00] font-bold w-[36px] text-center shrink-0">
                IPV
              </span>
              <span className="text-white/80 text-[10px] ml-2">{visitor.ip}</span>
            </div>
          </div>

          <div className="border-t border-[#00FF00]/15 mx-3" />

          {/* MENU label */}
          <div className="px-3 pb-0">
            <p className="text-[9px] text-white/50 leading-tight">
              MENU
            </p>
          </div>

          {/* Menu buttons — mosaic layout */}
          <div className="p-3 flex-1 overflow-y-auto flex flex-wrap gap-1 content-start">
            {menuItems.sort((a, b) => a.position - b.position || a.sort_order - b.sort_order).map((item) => renderMenuButton(item))}
          </div>
        </aside>

        {/* ──────── CENTER CONTENT ──────── */}
        <main className="flex-1 border-r border-[#00FF00]/20 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 flex items-center justify-center">
            <div className="border border-[#00FF00]/15 w-full h-full flex items-center justify-center overflow-y-auto">
              {activeModule === "login" && !user ? (
                <div className="w-[380px] p-6">
                  <h2 className="font-marsek text-lg text-[#00FF00] mb-6 tracking-widest text-center">
                    {authMode === "login" ? "CONNEXION" : "INSCRIPTION"}
                  </h2>

                  {/* Email / Password form */}
                  <form onSubmit={handleAuthSubmit} className="space-y-3 mb-6">
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="EMAIL"
                      required
                      className="w-full bg-black border border-[#00FF00]/40 text-[#00FF00] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#00FF00] placeholder:text-[#00FF00]/30"
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="MOT DE PASSE"
                      required
                      minLength={6}
                      className="w-full bg-black border border-[#00FF00]/40 text-[#00FF00] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#00FF00] placeholder:text-[#00FF00]/30"
                    />
                    {authError && (
                      <p className="text-red-500 text-xs uppercase">{authError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-[#00FF00]/10 border border-[#00FF00]/40 text-[#00FF00] py-2 text-sm uppercase tracking-wider hover:bg-[#00FF00]/20 transition-colors disabled:opacity-50"
                    >
                      {authLoading ? "CHARGEMENT..." : authMode === "login" ? "CONNEXION" : "CRÉER UN COMPTE"}
                    </button>
                  </form>

                  {/* Separator */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 border-t border-[#00FF00]/20" />
                    <span className="text-[#00FF00]/40 text-[10px] tracking-widest">OU</span>
                    <div className="flex-1 border-t border-[#00FF00]/20" />
                  </div>

                  {/* Telegram Widget */}
                  <div ref={telegramRef} className="flex justify-center mb-6" />

                  {/* Toggle login/signup */}
                  <div className="text-center">
                    <button
                      onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}
                      className="text-[#FF8C00] text-[11px] tracking-wider hover:text-[#FF8C00]/80 transition-colors"
                    >
                      {authMode === "login" ? "PAS DE COMPTE ? INSCRIPTION" : "DÉJÀ UN COMPTE ? CONNEXION"}
                    </button>
                  </div>
                </div>
              ) : activeContent ? (
                <div className="w-full h-full overflow-y-auto p-6">
                  <h2 className="font-marsek text-lg text-[#FF8C00] mb-4 tracking-widest text-center">
                    &#9654; {activeContent.title}
                  </h2>
                  <div
                    className="rich-content"
                    dangerouslySetInnerHTML={{ __html: activeContent.body }}
                  />
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-white/30 text-[11px] tracking-[0.3em]">
                    ◇ FLUX PRINCIPAL ◇
                  </p>
                  <p className="text-white/20 text-[9px] mt-2">
                    SÉLECTIONNER UN MODULE
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ──────── RIGHT COLUMN ──────── */}
        <aside className="w-[200px] min-w-[200px] flex flex-col">
          {/* SUB MENU header */}
          <div className="px-3 pt-3 pb-3">
            <h3 className="font-marsek text-[13px] text-[#00FF00] tracking-widest">
              SUB MENU_
            </h3>
            <div className="flex gap-3 mt-1 text-[10px]">
              <span className="text-[#00FF00]/80 hover:text-[#FF8C00] cursor-pointer">
                LISTING
              </span>
              <span className="text-[#00FF00]/80 hover:text-[#FF8C00] cursor-pointer">
                REACH
              </span>
              <span className="text-[#00FF00]/80 hover:text-[#FF8C00] cursor-pointer">
                TOOLS
              </span>
            </div>
            <div className="text-[8px] text-white/30 mt-1 text-right">
              _ING.COM
            </div>
          </div>

          <div className="border-t border-[#00FF00]/15 mx-3" />

          {/* Hierarchical submenu tree */}
          <div className="flex-1 px-3 py-2 overflow-y-auto space-y-0">
            {rootSubmenuItems.map((item) => renderSubmenuNode(item, 0))}
          </div>

          <div className="border-t border-[#00FF00]/15 mx-3" />

          {/* SEND + PAYMENT */}
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="border border-[#FF8C00]/60 px-3 py-1 text-[10px] text-[#FF8C00] hover:bg-[#FF8C00]/10 cursor-pointer tracking-wider">
              SEND
            </div>
            <span className="text-[10px] text-white/60 tracking-wider">
              PAYMENT
            </span>
          </div>
        </aside>
      </div>

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="border-t border-[#00FF00]/20 px-3 py-2 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-4">
          <span className="text-white/80 font-bold">FEB 17</span>
          <span className="text-white/80 font-bold">MAR 03</span>
        </div>
        <div className="text-[8px] text-white/30 text-center">
          <span>CALENDRIER BLOCKS HTTPS://WWW.ECLIPSEWISE.COM</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/80 font-bold">AUG 12</span>
          <span className="text-white/80 font-bold">AUG 28</span>
        </div>
      </footer>
    </div>
  );
}
