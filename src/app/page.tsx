"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import CarouselRenderer from "@/components/CarouselRenderer";
import TelegramChat from "@/components/TelegramChat";

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
  font_size?: number;
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
  title_color?: string;
  body_color?: string;
  is_fullscreen?: boolean;
  bg_color?: string;
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

/* ─── Account Panel ─── */
function AccountPanel({ user, setUser, onLogout, onClose }: {
  user: User;
  setUser: (u: User) => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [editField, setEditField] = useState<"email" | "name" | "password" | "telegram" | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [fieldConfirm, setFieldConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const startEdit = (field: "email" | "name" | "password" | "telegram") => {
    setEditField(field);
    setError("");
    setMessage("");
    setFieldConfirm("");
    if (field === "email") setFieldValue(user.email || "");
    else if (field === "name") setFieldValue(user.user_metadata?.display_name || "");
    else if (field === "telegram") setFieldValue(user.user_metadata?.telegram_username || "");
    else setFieldValue("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editField === "email") {
        const { error } = await supabase.auth.updateUser({ email: fieldValue });
        if (error) { setError(error.message); setSaving(false); return; }
        setMessage("EMAIL DE CONFIRMATION ENVOYE");
      } else if (editField === "name") {
        const { data, error } = await supabase.auth.updateUser({ data: { display_name: fieldValue } });
        if (error) { setError(error.message); setSaving(false); return; }
        if (data.user) setUser(data.user);
        setMessage("NOM MIS A JOUR");
      } else if (editField === "password") {
        if (fieldValue.length < 6) { setError("6 CARACTERES MINIMUM"); setSaving(false); return; }
        if (fieldValue !== fieldConfirm) { setError("LES MOTS DE PASSE NE CORRESPONDENT PAS"); setSaving(false); return; }
        const { error } = await supabase.auth.updateUser({ password: fieldValue });
        if (error) { setError(error.message); setSaving(false); return; }
        setMessage("MOT DE PASSE MIS A JOUR");
      } else if (editField === "telegram") {
        const res = await fetch("/api/account/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, telegram_username: fieldValue }),
        });
        if (!res.ok) { const err = await res.json(); setError(err.error || "ERREUR"); setSaving(false); return; }
        const { data } = await supabase.auth.getUser();
        if (data.user) setUser(data.user);
        setMessage("TELEGRAM LIE — ENVOYEZ /START A @HI3ROS_BOT POUR FINALISER");
      }
      setEditField(null);
      setFieldValue("");
      setFieldConfirm("");
    } catch {
      setError("ERREUR RESEAU");
    }
    setSaving(false);
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <h2 className="font-marsek text-lg text-white mb-6 tracking-widest">
        ACCOUNT
      </h2>

      {message && (
        <div className="border border-[#33FF33]/30 bg-[#33FF33]/10 px-3 py-2 mb-4 text-[11px] text-[#33FF33] tracking-wider">
          {message}
        </div>
      )}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 mb-4 text-[11px] text-red-500 tracking-wider">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Email + Password side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Email */}
          <div className="border border-[#33FF33]/15 p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] text-[#33FF33]/50 tracking-wider">EMAIL</label>
              <button onClick={() => startEdit("email")} className="text-[9px] text-[#DF8301] hover:text-[#DF8301]/80 tracking-wider">MODIFIER</button>
            </div>
            {editField === "email" ? (
              <div className="flex gap-2 mt-1">
                <input type="email" value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} className="flex-1 bg-black border border-[#33FF33]/30 text-[#33FF33] px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                <button onClick={handleSave} disabled={saving} className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-1 text-[10px] hover:bg-[#33FF33]/10 disabled:opacity-50">OK</button>
                <button onClick={() => setEditField(null)} className="border border-white/20 text-white/40 px-3 py-1 text-[10px] hover:bg-white/5">X</button>
              </div>
            ) : (
              <p className="text-[13px] text-white/80">{user.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="border border-[#33FF33]/15 p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] text-[#33FF33]/50 tracking-wider">MOT DE PASSE</label>
              <button onClick={() => startEdit("password")} className="text-[9px] text-[#DF8301] hover:text-[#DF8301]/80 tracking-wider">MODIFIER</button>
            </div>
            {editField === "password" ? (
              <div className="space-y-2 mt-1">
                <input type="password" value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} placeholder="NOUVEAU MOT DE PASSE" minLength={6} className="w-full bg-black border border-[#33FF33]/30 text-[#33FF33] px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/20" />
                <input type="password" value={fieldConfirm} onChange={(e) => setFieldConfirm(e.target.value)} placeholder="CONFIRMER MOT DE PASSE" className="w-full bg-black border border-[#33FF33]/30 text-[#33FF33] px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/20" />
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-1 text-[10px] hover:bg-[#33FF33]/10 disabled:opacity-50">OK</button>
                  <button onClick={() => setEditField(null)} className="border border-white/20 text-white/40 px-3 py-1 text-[10px] hover:bg-white/5">X</button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-white/40">••••••••</p>
            )}
          </div>
        </div>

        {/* Nom + Card Number side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Nom */}
          <div className="border border-[#33FF33]/15 p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] text-[#33FF33]/50 tracking-wider">NOM</label>
              <button onClick={() => startEdit("name")} className="text-[9px] text-[#DF8301] hover:text-[#DF8301]/80 tracking-wider">MODIFIER</button>
            </div>
            {editField === "name" ? (
              <div className="flex gap-2 mt-1">
                <input type="text" value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} placeholder="VOTRE NOM" className="flex-1 bg-black border border-[#33FF33]/30 text-[#33FF33] px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/20" />
                <button onClick={handleSave} disabled={saving} className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-1 text-[10px] hover:bg-[#33FF33]/10 disabled:opacity-50">OK</button>
                <button onClick={() => setEditField(null)} className="border border-white/20 text-white/40 px-3 py-1 text-[10px] hover:bg-white/5">X</button>
              </div>
            ) : (
              <p className="text-[13px] text-white/80">{user.user_metadata?.display_name || "---"}</p>
            )}
          </div>

          {/* Card Number */}
          <div className="border border-[#33FF33]/15 p-4">
            <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">CARD NUMBER</label>
            <p className="text-[13px] text-white/80 font-mono tracking-[0.2em]">
              {(() => {
                const raw = user.user_metadata?.card_number
                  || (user.id ? parseInt(user.id.replace(/[^a-f0-9]/g, "").slice(0, 8), 16).toString().padStart(9, "0").slice(0, 9) : "---");
                return raw.replace(/\s/g, "").replace(/(.{3})/g, "$1 ").trim();
              })()}
            </p>
          </div>
        </div>

        {/* Telegram */}
        <div className="border border-[#33FF33]/15 p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] text-[#33FF33]/50 tracking-wider">TELEGRAM</label>
            {user.user_metadata?.telegram_username ? (
              <button
                onClick={async () => {
                  if (!confirm("DISSOCIER TELEGRAM ?")) return;
                  await fetch("/api/account/telegram", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: user.id }),
                  });
                  const { data } = await supabase.auth.getUser();
                  if (data.user) setUser(data.user);
                  setMessage("TELEGRAM DISSOCIE");
                }}
                className="text-[9px] text-red-500 hover:text-red-400 tracking-wider"
              >DISSOCIER</button>
            ) : (
              <button onClick={() => startEdit("telegram")} className="text-[9px] text-[#DF8301] hover:text-[#DF8301]/80 tracking-wider">CONNECTER</button>
            )}
          </div>
          {editField === "telegram" ? (
            <div className="space-y-2 mt-1">
              <p className="text-[10px] text-white/40 leading-relaxed">
                1. ENVOYEZ /START A @HI3ROS_BOT SUR TELEGRAM<br />
                2. ENTREZ VOTRE USERNAME TELEGRAM CI-DESSOUS
              </p>
              <div className="flex gap-2">
                <input type="text" value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} placeholder="@USERNAME" className="flex-1 bg-black border border-[#33FF33]/30 text-[#33FF33] px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/20" />
                <button onClick={handleSave} disabled={saving} className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-1 text-[10px] hover:bg-[#33FF33]/10 disabled:opacity-50">OK</button>
                <button onClick={() => setEditField(null)} className="border border-white/20 text-white/40 px-3 py-1 text-[10px] hover:bg-white/5">X</button>
              </div>
            </div>
          ) : user.user_metadata?.telegram_username ? (
            <div className="flex items-center gap-3">
              <p className="text-[13px] text-white/80">@{user.user_metadata.telegram_username}</p>
              {user.user_metadata?.telegram_id ? (
                <span className="text-[9px] text-[#33FF33] border border-[#33FF33]/30 px-2 py-0.5">LIE</span>
              ) : (
                <span className="text-[9px] text-[#DF8301] border border-[#DF8301]/30 px-2 py-0.5">EN ATTENTE — ENVOYEZ /START AU BOT</span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-white/40">NON CONNECTE</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-[#33FF33]/15 p-4">
            <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">MEMBRE DEPUIS</label>
            <p className="text-[13px] text-white/80">
              {user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }) : "---"}
            </p>
          </div>
          <div className="border border-[#33FF33]/15 p-4">
            <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">DERNIERE CONNEXION</label>
            <p className="text-[13px] text-white/80">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("fr-FR") : "---"}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
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
  const [announcement, setAnnouncement] = useState("");
  const [announcementScrolling, setAnnouncementScrolling] = useState(false);
  const [announcementAlign, setAnnouncementAlign] = useState("center");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(fallbackMenuItems);
  const [submenuItems, setSubmenuItems] = useState<SubmenuItem[]>(fallbackSubmenuItems);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [menuLabel, setMenuLabel] = useState("MENU");
  const [menuLabelSize, setMenuLabelSize] = useState("9");
  const [menuLabelColor, setMenuLabelColor] = useState("#FFFFFF80");
  const [submenuLabel, setSubmenuLabel] = useState("SUB MENU_");
  const [submenuLabelSize, setSubmenuLabelSize] = useState("13");
  const [submenuLabelColor, setSubmenuLabelColor] = useState("#33FF33");
  const [submenuLine, setSubmenuLine] = useState("LISTING  CATEGORIE  @");
  const [submenuLineColor, setSubmenuLineColor] = useState("#FFFFFF80");
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
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

    const [annRes, menuRes, subRes, contentRes, settingsRes] = await Promise.all([
      supabase.from("announcements").select("*").eq("is_active", true).limit(1).single(),
      supabase.from("menu_items").select("*").eq("is_active", true).order("position").order("sort_order"),
      supabase.from("submenu_items").select("*").eq("is_active", true).order("position").order("sort_order"),
      supabase.from("content_sections").select("*").eq("is_active", true).order("module_key"),
      supabase.from("site_settings").select("key, value"),
    ]);

    if (annRes.data) {
      setAnnouncement(annRes.data.message);
      setAnnouncementScrolling(annRes.data.is_scrolling ?? false);
      setAnnouncementAlign(annRes.data.text_align ?? "center");
    }
    if (menuRes.data) setMenuItems(menuRes.data);
    if (subRes.data) setSubmenuItems(subRes.data);
    if (contentRes.data) setContentSections(contentRes.data);
    if (settingsRes.data) {
      const g = (k: string) => settingsRes.data.find((s: { key: string; value: string }) => s.key === k)?.value;
      if (g("menu_label")) setMenuLabel(g("menu_label")!);
      if (g("menu_label_size")) setMenuLabelSize(g("menu_label_size")!);
      if (g("menu_label_color")) setMenuLabelColor(g("menu_label_color")!);
      if (g("submenu_label")) setSubmenuLabel(g("submenu_label")!);
      if (g("submenu_label_size")) setSubmenuLabelSize(g("submenu_label_size")!);
      if (g("submenu_label_color")) setSubmenuLabelColor(g("submenu_label_color")!);
      if (g("submenu_line")) setSubmenuLine(g("submenu_line")!);
      if (g("submenu_line_color")) setSubmenuLineColor(g("submenu_line_color")!);
    }
  }, [isSupabaseConfigured]);

  /* ─── Initial fetch + polling fallback (10s) ─── */
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, [fetchData]);

  /* ─── Auto-show splash on first visit (per session) ─── */
  useEffect(() => {
    if (splashDismissed) return;
    const seen = sessionStorage.getItem("hieros_splash_seen");
    if (seen) {
      setSplashDismissed(true);
      return;
    }
    const splash = contentSections.find((c) => c.is_fullscreen);
    if (splash && !activeModule) {
      setActiveModule(splash.module_key);
    }
  }, [contentSections, splashDismissed, activeModule]);

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
        style={{ fontSize: item.font_size ? `${item.font_size}px` : undefined }}
        className={`inline-flex items-center gap-1 px-[8px] py-0.5 text-[10px] font-bold tracking-wider transition-colors border w-fit
          ${activeModule === item.code.toLowerCase()
            ? "bg-[#DF8301]/10 border-[#DF8301]/30 text-[#DF8301]"
            : "bg-[#33FF33]/10 border-[#33FF33]/30 text-[#33FF33] hover:bg-[#33FF33]/20"
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
          onClick={!isParent ? () => setActiveModule(item.code.toLowerCase()) : undefined}
          className={`flex justify-between py-0.5 hover:bg-[#33FF33]/5 px-1 ${isParent ? "cursor-default" : "cursor-pointer"}`}
          style={{ paddingLeft: `${depth * 8 + 4}px` }}
        >
          <span className={`text-[12px] ${isParent ? "text-[#33FF33]/90 font-bold" : "text-white/70"}`}>
            {depth > 0 && <span className="text-[#33FF33]/20 mr-1">{"\u2514"}</span>}
            {item.label}
          </span>
          <span className="text-[#33FF33]/30 text-[10px]">{item.ref}</span>
        </div>
        {children.map((child) => renderSubmenuNode(child, depth + 1))}
      </div>
    );
  };

  const rootSubmenuItems = submenuTree.get(null) || [];

  /* ─── Fullscreen splash overlay ─── */
  if (activeContent?.is_fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        style={{ backgroundColor: activeContent.bg_color || '#000000' }}
      >
        {/* Close / Enter button */}
        <button
          onClick={() => { setActiveModule(null); setSplashDismissed(true); sessionStorage.setItem("hieros_splash_seen", "1"); }}
          className="absolute top-4 right-4 z-10 border border-white/20 text-white/60 px-4 py-1.5 text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-colors uppercase"
        >
          ENTER
        </button>

        {/* Fullscreen content */}
        <div className="flex-1 overflow-y-auto" style={{ display: "flex" }}>
          <div className="flex flex-col items-center justify-center w-full p-6 m-auto">
            {activeContent.title && (
              <div className="text-center pb-4">
                <h1
                  className="font-marsek text-2xl tracking-[0.3em]"
                  style={{ color: activeContent.title_color || '#DF8301' }}
                >
                  {activeContent.title}
                </h1>
              </div>
            )}
            <CarouselRenderer
              html={activeContent.body}
              className="rich-content w-full"
              style={{ color: activeContent.body_color || '#FFFFFF', textAlign: 'center' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white font-terminal flex flex-col overflow-hidden select-none">
      {/* ════════════════════ TOP HEADER ════════════════════ */}
      <header className="flex border-b border-[#33FF33]/20">
        {/* Left section */}
        <div className="w-[200px] min-w-[200px] flex items-center justify-center px-3 py-2 border-r border-[#33FF33]/20">
          <a href="/">
            <Image
              src="/hieros-logo.jpg"
              alt="HIEROS"
              width={165}
              height={26}
              className="object-contain"
              priority
            />
          </a>
        </div>

        {/* Center section */}
        <div className="flex-1 flex items-center p-0 border-r border-[#33FF33]/20">
          <div className="flex-1 border border-[#33FF33]/15 px-3 py-1 m-3 overflow-hidden min-h-[24px]">
            {announcement && (
              announcementScrolling ? (
                <div className="marquee-container">
                  <span className="marquee-text text-[11px] text-white/70 tracking-widest whitespace-nowrap">
                    {announcement}
                  </span>
                </div>
              ) : (
                <span className={`text-[11px] text-white/70 tracking-widest block text-${announcementAlign}`}>
                  {announcement}
                </span>
              )
            )}
          </div>
        </div>

        {/* Right section — Auth */}
        <div className="w-[200px] min-w-[200px] px-3 py-2 flex items-center justify-end">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveModule("account")}
                className="text-[11px] text-white hover:text-[#DF8301] cursor-pointer tracking-wider transition-colors"
              >
                ACCOUNT
              </button>
              <button
                onClick={handleLogout}
                className="border border-red-500/40 text-red-500 px-2 py-0.5 text-[11px] hover:bg-red-500/30 transition-colors shrink-0 tracking-wider"
              >
                CHECK OUT
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveModule("login")}
              className="text-[11px] text-white hover:text-[#DF8301] cursor-pointer tracking-wider"
            >
              &gt; CHECK IN
            </button>
          )}
        </div>
      </header>

      {/* ════════════════════ SUB HEADER — TICKER ════════════════════ */}
      <div className="flex border-b border-[#33FF33]/20">
        <div className="w-[200px] min-w-[200px] border-r border-[#33FF33]/20" />

        <div className="flex-1 flex items-center justify-center py-1 border-r border-[#33FF33]/20 text-[13px] tracking-wider">
          <span className="text-[#33FF33]">BTC </span>
          <span className="text-white font-bold ml-1">{prices.btc?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#33FF33]">XAU </span>
          <span className="text-white font-bold ml-1">{prices.xau?.toFixed(2) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#33FF33]">EUR/USD </span>
          <span className="text-white font-bold ml-1">{prices.eurusd?.toFixed(4) ?? "---"}</span>
          <span className="text-white/40 mx-2">—</span>
          <span className="text-[#33FF33]">SPY </span>
          <span className="text-white font-bold ml-1">{prices.spy?.toFixed(2) ?? "---"}</span>
        </div>

        <div className="w-[200px] min-w-[200px] px-3 py-1" />
      </div>

      {/* ════════════════════ MAIN 3-COL LAYOUT ════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ──────── LEFT COLUMN ──────── */}
        <aside className="w-[200px] min-w-[200px] border-r border-[#33FF33]/20 flex flex-col">
          {/* Info blocs GMT / YMD / GPS / IPV */}
          <div className="p-3 space-y-1 text-[12px]">
            <div className="flex items-center">
              <span className="bg-[#33FF33]/10 border border-[#33FF33]/30 px-2 py-0.5 text-[12px] text-[#33FF33] font-bold w-[36px] text-center shrink-0">
                GMT
              </span>
              <span className="text-white/80 ml-2">{time}</span>
            </div>
            <div className="flex items-center">
              <span className="bg-[#33FF33]/10 border border-[#33FF33]/30 px-2 py-0.5 text-[12px] text-[#33FF33] font-bold w-[36px] text-center shrink-0">
                YMD
              </span>
              <span className="text-white/80 ml-2">{date}</span>
            </div>
            <div className="flex items-start">
              <span className="bg-[#33FF33]/10 border border-[#33FF33]/30 px-2 py-0.5 text-[12px] text-[#33FF33] font-bold w-[36px] text-center shrink-0">
                GPS
              </span>
              <span className="text-white/80 text-[12px] leading-tight ml-2">
                {visitor.lat === "---" ? "---" : toDMS(parseFloat(visitor.lat), true)}
                <br />
                {visitor.lon === "---" ? "---" : toDMS(parseFloat(visitor.lon), false)}
              </span>
            </div>
            <div className="flex items-center">
              <span className="bg-[#33FF33]/10 border border-[#33FF33]/30 px-2 py-0.5 text-[12px] text-[#33FF33] font-bold w-[36px] text-center shrink-0">
                IPV
              </span>
              <span className="text-white/80 text-[12px] ml-2">{visitor.ip}</span>
            </div>
          </div>

          <div className="border-t border-[#33FF33]/15 mx-3" />

          {/* MENU label */}
          <div className="px-3 pt-3 pb-0">
            <p className="leading-tight" style={{ fontSize: `${menuLabelSize}px`, color: menuLabelColor }}>
              {menuLabel}
            </p>
          </div>

          {/* Menu buttons — mosaic layout */}
          <div className="p-3 flex-1 overflow-y-auto flex flex-wrap gap-2 content-start">
            {menuItems.sort((a, b) => a.position - b.position || a.sort_order - b.sort_order).map((item) => renderMenuButton(item))}
          </div>
        </aside>

        {/* ──────── CENTER CONTENT ──────── */}
        <main className="flex-1 border-r border-[#33FF33]/20 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 flex items-center justify-center min-h-0">
            <div className={`border border-[#33FF33]/15 w-full h-full overflow-y-auto ${activeContent ? "flex flex-col items-stretch" : "flex items-center justify-center"}`}>
              {activeModule === "login" && !user ? (
                <div className="w-[380px] p-6">
                  <h2 className="font-marsek text-lg text-[#33FF33] mb-6 tracking-widest text-center">
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
                      className="w-full bg-black border border-[#33FF33]/40 text-[#33FF33] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/30"
                    />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="MOT DE PASSE"
                      required
                      minLength={6}
                      className="w-full bg-black border border-[#33FF33]/40 text-[#33FF33] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#33FF33] placeholder:text-[#33FF33]/30"
                    />
                    {authError && (
                      <p className="text-red-500 text-xs uppercase">{authError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-[#33FF33]/10 border border-[#33FF33]/40 text-[#33FF33] py-2 text-sm uppercase tracking-wider hover:bg-[#33FF33]/20 transition-colors disabled:opacity-50"
                    >
                      {authLoading ? "CHARGEMENT..." : authMode === "login" ? "CONNEXION" : "CRÉER UN COMPTE"}
                    </button>
                  </form>

                  {/* Separator */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 border-t border-[#33FF33]/20" />
                    <span className="text-[#33FF33]/40 text-[10px] tracking-widest">OU</span>
                    <div className="flex-1 border-t border-[#33FF33]/20" />
                  </div>

                  {/* Telegram Widget */}
                  <div ref={telegramRef} className="flex justify-center mb-6" />

                  {/* Toggle login/signup */}
                  <div className="text-center">
                    <button
                      onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}
                      className="text-[#DF8301] text-[11px] tracking-wider hover:text-[#DF8301]/80 transition-colors"
                    >
                      {authMode === "login" ? "PAS DE COMPTE ? INSCRIPTION" : "DÉJÀ UN COMPTE ? CONNEXION"}
                    </button>
                  </div>
                </div>
              ) : activeModule === "account" && user ? (
                <AccountPanel user={user} setUser={setUser} onLogout={handleLogout} onClose={() => setActiveModule(null)} />
              ) : activeModule === "telegram" && user ? (
                <TelegramChat user={user} />
              ) : activeContent ? (
                <div className="w-full h-full overflow-y-auto p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2
                      className="font-marsek text-lg tracking-widest"
                      style={{ color: activeContent.title_color || '#DF8301' }}
                    >
                      / {activeContent.title}
                    </h2>
                    <span className="text-[10px] text-white/30 tracking-wider shrink-0 ml-4">
                      {submenuItems.find(s => s.code.toLowerCase() === activeContent.module_key)?.ref || activeContent.module_key.toUpperCase()}
                    </span>
                  </div>
                  <CarouselRenderer
                    html={activeContent.body}
                    className="rich-content"
                    style={{ color: activeContent.body_color || '#FFFFFF' }}
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
            <h3 className="font-marsek tracking-widest" style={{ fontSize: `${submenuLabelSize}px`, color: submenuLabelColor }}>
              {submenuLabel}
            </h3>
            <div className="mt-1 text-[10px]" style={{ color: submenuLineColor }}>
              {submenuLine}
            </div>
          </div>

          <div className="border-t border-[#33FF33]/15 mx-3" />

          {/* Submenu tree — all categories + children */}
          <div className="flex-1 px-3 py-3 overflow-y-auto space-y-0">
            {rootSubmenuItems.map((item) => renderSubmenuNode(item, 0))}
          </div>

          <div className="border-t border-[#33FF33]/15 mx-3" />

          {/* SEND + PAYMENT */}
          <div className="px-3 py-3 flex items-center justify-between">
            <div className="border border-[#DF8301]/60 px-3 py-1 text-[10px] text-[#DF8301] hover:bg-[#DF8301]/10 cursor-pointer tracking-wider">
              SEND
            </div>
            <span className="text-[10px] text-white/60 tracking-wider">
              PAYMENT
            </span>
          </div>
        </aside>
      </div>

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="border-t border-[#33FF33]/20 px-3 py-2 flex items-center justify-between text-[10px]">
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
