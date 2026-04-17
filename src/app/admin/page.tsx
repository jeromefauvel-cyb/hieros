"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import TreeEditor, { type TreeNode } from "@/components/TreeEditor";

const RichEditor = lazy(() => import("@/components/RichEditor"));

type TableName = "announcements" | "menu-items" | "submenu-items" | "content-sections" | "templates";
type NavSection = "announcements" | "left-menu" | "right-menu" | "menus" | "content-sections" | "templates" | "media" | "users" | "payments";

interface Record {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface MenuItemRef {
  id: string;
  code: string;
  label: string;
}

interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
}

const TABLE_CONFIG: { [key in TableName]: { label: string; fields: string[] } } = {
  "announcements": { label: "ANNOUNCEMENTS", fields: ["message", "text_align", "is_scrolling", "is_active"] },
  "menu-items": { label: "LEFT MENU", fields: ["code", "label", "sort_order", "is_active", "parent_id", "position"] },
  "submenu-items": { label: "RIGHT SUB MENU", fields: ["code", "label", "ref", "sort_order", "is_active", "parent_id", "position"] },
  "content-sections": { label: "CONTENT SECTIONS", fields: ["module_key", "title", "body", "is_active"] },
  "templates": { label: "TEMPLATES", fields: ["name", "body", "title_color", "body_color"] },
};

const NAV_ITEMS: { key: NavSection; label: string }[] = [
  { key: "announcements", label: "ANNOUNCEMENTS" },
  { key: "menus", label: "MENUS" },
  { key: "content-sections", label: "CONTENT SECTIONS" },
  { key: "media", label: "MEDIA" },
  { key: "users", label: "USERS" },
  { key: "payments", label: "PAYMENTS" },
];

function navToTable(nav: NavSection): TableName {
  if (nav === "left-menu" || nav === "menus") return "menu-items";
  if (nav === "right-menu") return "submenu-items";
  if (nav === "templates") return "templates";
  if (nav === "media") return "announcements"; // dummy, media has its own fetch
  return nav as TableName;
}

function tableToSupabase(table: TableName): string {
  if (table === "menu-items") return "menu_items";
  if (table === "submenu-items") return "submenu_items";
  return table;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeNav, setActiveNav] = useState<NavSection>("announcements");
  const [records, setRecords] = useState<Record[]>([]);
  const [editing, setEditing] = useState<Record | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuItemsRef, setMenuItemsRef] = useState<MenuItemRef[]>([]);
  const [submenuItemsRef, setSubmenuItemsRef] = useState<MenuItemRef[]>([]);
  const [menuLabel, setMenuLabel] = useState("MENU");
  const [menuLabelSize, setMenuLabelSize] = useState("9");
  const [menuLabelColor, setMenuLabelColor] = useState("#FFFFFF80");
  const [menuLabelSaved, setMenuLabelSaved] = useState(true);
  const [submenuLabel, setSubmenuLabel] = useState("SUB MENU_");
  const [submenuLabelSize, setSubmenuLabelSize] = useState("13");
  const [submenuLabelColor, setSubmenuLabelColor] = useState("#33FF33");
  const [submenuLabelSaved, setSubmenuLabelSaved] = useState(true);
  const [submenuLine, setSubmenuLine] = useState("LISTING  CATEGORIE  @");
  const [submenuLineColor, setSubmenuLineColor] = useState("#FFFFFF80");
  const [submenuLineSaved, setSubmenuLineSaved] = useState(true);
  const [templates, setTemplates] = useState<Record[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaCopied, setMediaCopied] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<{ id: string; email: string; display_name: string; card_number: string; telegram_username: string; created_at: string; last_sign_in_at: string }[]>([]);
  const [editingUser, setEditingUser] = useState<{ id: string; card_number: string; display_name: string; telegram_username: string } | null>(null);
  const [payments, setPayments] = useState<{ id: string; from_user_id: string; to_card_number: string; amount: number; currency: string; note: string; status: string; created_at: string }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "with-card" | "no-card" | "telegram">("all");
  const [userDateFrom, setUserDateFrom] = useState("");
  const [userDateTo, setUserDateTo] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserCard, setNewUserCard] = useState("");
  const [newUserTelegram, setNewUserTelegram] = useState("");
  const [viewWallets, setViewWallets] = useState<{ userId: string; wallets: { label: string; url: string; address: string; chain: string }[] } | null>(null);
  const [leftMenuRecords, setLeftMenuRecords] = useState<Record[]>([]);
  const [rightMenuRecords, setRightMenuRecords] = useState<Record[]>([]);
  const [menuEditSide, setMenuEditSide] = useState<"left" | "right">("left");

  const activeTable = navToTable(activeNav);
  const tableConfig = TABLE_CONFIG[activeTable];
  const isTree = activeTable === "menu-items" || activeTable === "submenu-items";

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/${activeTable}`);
    if (res.ok) {
      setRecords(await res.json());
    }
    setLoading(false);
  }, [activeTable]);

  const fetchMenuItemsRef = useCallback(async () => {
    const [menuRes, subRes, tplRes] = await Promise.all([
      fetch("/api/admin/menu-items"),
      fetch("/api/admin/submenu-items"),
      fetch("/api/admin/templates"),
    ]);
    if (menuRes.ok) setMenuItemsRef(await menuRes.json());
    if (subRes.ok) setSubmenuItemsRef(await subRes.json());
    if (tplRes.ok) setTemplates(await tplRes.json());
  }, []);

  const fetchMenus = useCallback(async () => {
    const [leftRes, rightRes] = await Promise.all([
      fetch("/api/admin/menu-items"),
      fetch("/api/admin/submenu-items"),
    ]);
    if (leftRes.ok) setLeftMenuRecords(await leftRes.json());
    if (rightRes.ok) setRightMenuRecords(await rightRes.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setAdminUsers(await res.json());
  }, []);

  const fetchPayments = useCallback(async () => {
    const res = await fetch("/api/admin/payments");
    if (res.ok) setPayments(await res.json());
  }, []);

  const fetchMedia = useCallback(async () => {
    const res = await fetch("/api/admin/upload");
    if (res.ok) setMediaFiles(await res.json());
  }, []);

  const fetchSiteSettings = useCallback(async () => {
    const res = await fetch("/api/admin/site-settings");
    if (res.ok) {
      const settings = await res.json();
      const g = (k: string) => settings.find((s: { key: string; value: string }) => s.key === k)?.value;
      if (g("menu_label")) { setMenuLabel(g("menu_label")!); setMenuLabelSaved(true); }
      if (g("menu_label_size")) setMenuLabelSize(g("menu_label_size")!);
      if (g("menu_label_color")) setMenuLabelColor(g("menu_label_color")!);
      if (g("submenu_label")) { setSubmenuLabel(g("submenu_label")!); setSubmenuLabelSaved(true); }
      if (g("submenu_label_size")) setSubmenuLabelSize(g("submenu_label_size")!);
      if (g("submenu_label_color")) setSubmenuLabelColor(g("submenu_label_color")!);
      if (g("submenu_line")) { setSubmenuLine(g("submenu_line")!); setSubmenuLineSaved(true); }
      if (g("submenu_line_color")) setSubmenuLineColor(g("submenu_line_color")!);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchRecords();
      fetchMenuItemsRef();
      fetchSiteSettings();
      if (activeNav === "menus") fetchMenus();
      if (activeNav === "media") fetchMedia();
      if (activeNav === "users") fetchUsers();
      if (activeNav === "payments") fetchPayments();
    }
  }, [authenticated, activeTable, activeNav, fetchRecords, fetchMenuItemsRef, fetchSiteSettings, fetchMenus, fetchMedia, fetchUsers, fetchPayments]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setError("MOT DE PASSE INCORRECT");
    }
  };

  const getTableForSave = () => {
    if (activeNav === "menus") return menuEditSide === "left" ? "menu-items" : "submenu-items";
    return activeTable;
  };

  const handleSave = async (record: Record) => {
    const table = getTableForSave();
    const isNew = !record.id;
    const method = isNew ? "POST" : "PUT";
    const payload = isNew ? Object.fromEntries(Object.entries(record).filter(([k, v]) => k !== "id" && v !== "")) : record;
    const res = await fetch(`/api/admin/${table}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      setError(err.error || `Erreur ${res.status}`);
      return;
    }
    setEditing(null);
    setError("");
    if (activeNav === "menus") await fetchMenus();
    else await fetchRecords();
  };

  const handleDelete = async (id: string, overrideTable?: string) => {
    if (!confirm("SUPPRIMER CET ELEMENT ?")) return;
    const table = overrideTable || getTableForSave();
    await fetch(`/api/admin/${table}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (activeNav === "menus") fetchMenus();
    else fetchRecords();
  };

  const handleReorder = async (items: { id: string; parent_id: string | null; position: number }[], overrideTable?: string) => {
    const table = overrideTable || tableToSupabase(activeTable);
    // Optimistic update
    const setter = activeNav === "menus"
      ? (overrideTable === "submenu_items" ? setRightMenuRecords : setLeftMenuRecords)
      : setRecords;
    setter((prev) => {
      const updated = [...prev];
      for (const item of items) {
        const idx = updated.findIndex((r) => r.id === item.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], parent_id: item.parent_id, position: item.position, sort_order: item.position };
        }
      }
      return updated;
    });

    await fetch("/api/admin/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, items }),
    });
  };

  const newRecord = (parentId: string | null = null) => {
    const record: Record = { id: "" };
    tableConfig.fields.forEach((f) => {
      if (f === "is_active") record[f] = true;
      else if (f === "sort_order" || f === "position") record[f] = records.length;
      else if (f === "parent_id") record[f] = parentId;
      else record[f] = "";
    });
    setEditing(record);
  };

  const isContentSections = activeTable === "content-sections";
  const isTemplates = activeTable === "templates";
  const isMenus = activeNav === "menus";


  // Build TreeNode list from records for tree tables
  const toTreeNodes = (recs: Record[]): TreeNode[] =>
    recs.map((r) => ({
      id: r.id as string,
      label: String(r.label ?? ""),
      code: String(r.code ?? ""),
      parent_id: (r.parent_id as string | null) ?? null,
      position: Number(r.position ?? r.sort_order ?? 0),
      is_active: Boolean(r.is_active),
      ref: r.ref != null ? String(r.ref) : undefined,
    }));

  const treeItems: TreeNode[] = isTree ? toTreeNodes(records) : [];
  const leftTreeItems = toTreeNodes(leftMenuRecords);
  const rightTreeItems = toTreeNodes(rightMenuRecords);

  // ─── LOGIN SCREEN ───
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <form onSubmit={handleLogin} className="border border-[#33FF33]/30 p-8 w-[400px]">
          <h1 className="text-[#33FF33] text-xl font-bold mb-6 tracking-widest text-center">
            HIEROS ADMIN
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="MOT DE PASSE"
            className="w-full bg-black border border-[#33FF33]/40 text-[#33FF33] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#33FF33] mb-4"
          />
          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[#33FF33]/10 border border-[#33FF33]/40 text-[#33FF33] py-2 text-sm uppercase tracking-wider hover:bg-[#33FF33]/20 transition-colors"
          >
            CONNEXION
          </button>
        </form>
      </div>
    );
  }

  // ─── Editing form fields for tree items ───
  const treeEditFields = activeTable === "submenu-items"
    ? ["code", "label", "ref", "is_active"]
    : ["code", "label", "font_size", "is_active"];

  // ─── ADMIN DASHBOARD ───
  return (
    <div className="min-h-screen bg-black text-white font-mono uppercase">
      {/* Header */}
      <div className="border-b border-[#33FF33]/20 px-6 py-3 flex items-center justify-between">
        <h1 className="text-white text-lg tracking-widest font-bold">HIEROS ADMIN</h1>
        <a href="/" className="text-[#33FF33]/50 text-xs hover:text-[#33FF33]">{"\u2190"} RETOUR AU SITE</a>
      </div>

      {/* Primary nav tabs */}
      <div className="border-b border-[#33FF33]/20 px-6 py-2 flex gap-4 justify-center">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => { setActiveNav(item.key); setEditing(null); }}
            className={`text-[11px] px-3 py-1 border transition-colors ${
              activeNav === item.key
                ? "border-[#DF8301] text-[#DF8301] bg-[#DF8301]/10"
                : "border-[#33FF33]/20 text-[#33FF33]/60 hover:border-[#33FF33]/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-6">
          {isMenus ? (
            /* ─── MENUS (LEFT + RIGHT side by side) ─── */
            <div>
              {/* Edit form (shared, above both panels) */}
              {editing && (
                <div className="border border-[#DF8301]/30 p-4 mb-4 bg-[#DF8301]/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[#DF8301] text-xs tracking-wider">
                      {editing.id ? "MODIFIER" : "CREER"} ({menuEditSide === "left" ? "LEFT" : "RIGHT"})
                    </h3>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleSave(editing)} className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10">SAUVEGARDER</button>
                      <button onClick={() => { setEditing(null); setError(""); }} className="border border-white/20 text-white/50 px-4 py-1 text-xs hover:bg-white/5">ANNULER</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(menuEditSide === "left" ? ["code", "label", "font_size", "is_active"] : ["code", "label", "ref", "is_active"]).map((field) => (
                      <div key={field}>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">{field.toUpperCase()}</label>
                        {field === "is_active" ? (
                          <select value={String(editing[field])} onChange={(e) => setEditing({ ...editing, [field]: e.target.value === "true" })} className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]">
                            <option value="true">ACTIF</option>
                            <option value="false">INACTIF</option>
                          </select>
                        ) : field === "font_size" ? (
                          <input type="number" min={8} max={32} value={Number(editing[field] ?? 12)} onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })} className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                        ) : (
                          <input type="text" value={String(editing[field] ?? "")} onChange={(e) => setEditing({ ...editing, [field]: e.target.value })} className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                        )}
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-red-500 text-xs mt-3 border border-red-500/30 bg-red-500/10 px-3 py-1">{error}</p>}
                </div>
              )}

              {/* Two-column layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT MENU */}
                <div>
                  <div className="mb-3 border border-[#33FF33]/15 p-3 bg-[#33FF33]/[0.02]">
                    <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">TITRE LEFT MENU</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input type="text" value={menuLabel} onChange={(e) => { setMenuLabel(e.target.value); setMenuLabelSaved(false); }} className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[140px]" />
                      <input type="number" min={6} max={32} value={menuLabelSize} onChange={(e) => { setMenuLabelSize(e.target.value); setMenuLabelSaved(false); }} title="TAILLE (PX)" className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[50px]" />
                      <input type="color" value={menuLabelColor.replace(/[^#0-9a-fA-F]/g, "").slice(0, 7) || "#ffffff"} onChange={(e) => { setMenuLabelColor(e.target.value); setMenuLabelSaved(false); }} className="w-7 h-7 bg-black border border-[#33FF33]/30 cursor-pointer" title="COULEUR" />
                      <button
                        onClick={async () => {
                          await Promise.all([
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "menu_label", value: menuLabel }) }),
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "menu_label_size", value: menuLabelSize }) }),
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "menu_label_color", value: menuLabelColor }) }),
                          ]);
                          setMenuLabelSaved(true); setError("");
                        }}
                        disabled={menuLabelSaved}
                        className={`border px-3 py-1 text-xs transition-colors ${menuLabelSaved ? "border-white/10 text-white/20 cursor-default" : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"}`}
                      >{menuLabelSaved ? "OK" : "SAVE"}</button>
                    </div>
                  </div>
                  <TreeEditor
                    items={leftTreeItems}
                    onReorder={(items) => handleReorder(items, "menu_items")}
                    onAdd={() => { setMenuEditSide("left"); setEditing({ id: "", code: "", label: "", font_size: 12, is_active: true, parent_id: null, position: leftMenuRecords.length, sort_order: leftMenuRecords.length }); }}
                    onEdit={(item) => { setMenuEditSide("left"); setEditing(item as unknown as Record); }}
                    onDelete={(id) => handleDelete(id, "menu-items")}
                    flat
                  />
                </div>

                {/* RIGHT MENU */}
                <div>
                  <div className="mb-3 border border-[#33FF33]/15 p-3 bg-[#33FF33]/[0.02]">
                    <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">TITRE RIGHT MENU</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input type="text" value={submenuLabel} onChange={(e) => { setSubmenuLabel(e.target.value); setSubmenuLabelSaved(false); }} className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[140px]" />
                      <input type="number" min={6} max={32} value={submenuLabelSize} onChange={(e) => { setSubmenuLabelSize(e.target.value); setSubmenuLabelSaved(false); }} title="TAILLE (PX)" className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[50px]" />
                      <input type="color" value={submenuLabelColor.replace(/[^#0-9a-fA-F]/g, "").slice(0, 7) || "#00ff00"} onChange={(e) => { setSubmenuLabelColor(e.target.value); setSubmenuLabelSaved(false); }} className="w-7 h-7 bg-black border border-[#33FF33]/30 cursor-pointer" title="COULEUR" />
                      <button
                        onClick={async () => {
                          await Promise.all([
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "submenu_label", value: submenuLabel }) }),
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "submenu_label_size", value: submenuLabelSize }) }),
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "submenu_label_color", value: submenuLabelColor }) }),
                          ]);
                          setSubmenuLabelSaved(true); setError("");
                        }}
                        disabled={submenuLabelSaved}
                        className={`border px-3 py-1 text-xs transition-colors ${submenuLabelSaved ? "border-white/10 text-white/20 cursor-default" : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"}`}
                      >{submenuLabelSaved ? "OK" : "SAVE"}</button>
                    </div>
                    <label className="text-[9px] text-[#33FF33]/50 block mb-1 mt-2 tracking-wider">LIGNE SOUS LE TITRE</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input type="text" value={submenuLine} onChange={(e) => { setSubmenuLine(e.target.value); setSubmenuLineSaved(false); }} className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[140px]" />
                      <input type="color" value={submenuLineColor.replace(/[^#0-9a-fA-F]/g, "").slice(0, 7) || "#ffffff"} onChange={(e) => { setSubmenuLineColor(e.target.value); setSubmenuLineSaved(false); }} className="w-7 h-7 bg-black border border-[#33FF33]/30 cursor-pointer" title="COULEUR" />
                      <button
                        onClick={async () => {
                          await Promise.all([
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "submenu_line", value: submenuLine }) }),
                            fetch("/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "submenu_line_color", value: submenuLineColor }) }),
                          ]);
                          setSubmenuLineSaved(true); setError("");
                        }}
                        disabled={submenuLineSaved}
                        className={`border px-3 py-1 text-xs transition-colors ${submenuLineSaved ? "border-white/10 text-white/20 cursor-default" : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"}`}
                      >{submenuLineSaved ? "OK" : "SAVE"}</button>
                    </div>
                  </div>
                  <TreeEditor
                    items={rightTreeItems}
                    onReorder={(items) => handleReorder(items, "submenu_items")}
                    onAdd={(parentId) => { setMenuEditSide("right"); setEditing({ id: "", code: "", label: "", ref: "", is_active: true, parent_id: parentId, position: rightMenuRecords.length, sort_order: rightMenuRecords.length }); }}
                    onEdit={(item) => { setMenuEditSide("right"); setEditing(item as unknown as Record); }}
                    onDelete={(id) => handleDelete(id, "submenu-items")}
                    showRef
                    addRootLabel="FOLDER"
                    addChildLabel="ITEM"
                  />
                </div>
              </div>
            </div>
          ) : activeNav === "users" ? (
            /* ─── USERS ─── */
            <div>{(() => {
              const filteredUsers = adminUsers.filter((u) => {
                const q = userSearch.toLowerCase();
                if (q && !u.email?.toLowerCase().includes(q) && !u.display_name?.toLowerCase().includes(q) && !u.card_number?.toLowerCase().includes(q) && !u.telegram_username?.toLowerCase().includes(q)) return false;
                if (userFilter === "with-card") { if (!u.card_number) return false; }
                if (userFilter === "no-card") { if (u.card_number) return false; }
                if (userFilter === "telegram") { if (!u.telegram_username) return false; }
                if (userDateFrom && u.created_at && new Date(u.created_at) < new Date(userDateFrom)) return false;
                if (userDateTo && u.created_at && new Date(u.created_at) > new Date(userDateTo + "T23:59:59")) return false;
                return true;
              });
              return (<>
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="RECHERCHER..."
                  className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[200px]"
                />
                {(["all", "with-card", "no-card", "telegram"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`text-[9px] border px-2 py-0.5 transition-colors ${
                      userFilter === f
                        ? "border-[#DF8301] text-[#DF8301] bg-[#DF8301]/10"
                        : "border-[#33FF33]/15 text-white/30 hover:text-white/50"
                    }`}
                  >
                    {f === "all" ? "TOUS" : f === "with-card" ? "AVEC CARD" : f === "no-card" ? "SANS CARD" : "TELEGRAM"}
                  </button>
                ))}
                <span className="text-[9px] text-[#33FF33]/50 ml-2">DU</span>
                <input type="date" value={userDateFrom} onChange={(e) => setUserDateFrom(e.target.value)} className="bg-black border border-[#33FF33]/30 text-white px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-[#33FF33]" />
                <span className="text-[9px] text-[#33FF33]/50">AU</span>
                <input type="date" value={userDateTo} onChange={(e) => setUserDateTo(e.target.value)} className="bg-black border border-[#33FF33]/30 text-white px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-[#33FF33]" />
                {(userDateFrom || userDateTo) && (
                  <button onClick={() => { setUserDateFrom(""); setUserDateTo(""); }} className="text-[9px] text-white/30 hover:text-white/50">X</button>
                )}
                <button
                  onClick={() => { setCreatingUser(true); setEditingUser(null); }}
                  className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-0.5 text-[9px] hover:bg-[#33FF33]/10 transition-colors"
                >+ USER</button>
                <span className="text-white/20 text-[9px] tracking-wider ml-auto">
                  {filteredUsers.length} / {adminUsers.length} UTILISATEUR{adminUsers.length !== 1 ? "S" : ""}
                </span>
              </div>

              {/* Create / Edit user form */}
              {(creatingUser || editingUser) && (
                <div className="border border-[#DF8301]/30 p-4 mb-4 bg-[#DF8301]/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[#DF8301] text-xs tracking-wider">{creatingUser ? "CREER UTILISATEUR" : "MODIFIER UTILISATEUR"}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (creatingUser) {
                            if (!newUserEmail || !newUserPassword) return;
                            const res = await fetch("/api/admin/users", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email: newUserEmail, password: newUserPassword, display_name: newUserName, card_number: newUserCard, telegram_username: newUserTelegram }),
                            });
                            if (res.ok) {
                              setCreatingUser(false);
                              setNewUserEmail(""); setNewUserPassword(""); setNewUserName(""); setNewUserCard(""); setNewUserTelegram("");
                              fetchUsers();
                            } else {
                              const err = await res.json();
                              alert(err.error || "ERREUR");
                            }
                          } else if (editingUser) {
                            await fetch("/api/admin/users", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: editingUser.id, card_number: editingUser.card_number, display_name: editingUser.display_name || "", telegram_username: editingUser.telegram_username || "" }),
                            });
                            setEditingUser(null);
                            fetchUsers();
                          }
                        }}
                        className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10"
                      >SAUVEGARDER</button>
                      <button onClick={() => { setCreatingUser(false); setEditingUser(null); }} className="border border-white/20 text-white/50 px-4 py-1 text-xs hover:bg-white/5">ANNULER</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {creatingUser && (
                      <>
                        <div>
                          <label className="text-[9px] text-[#33FF33]/50 block mb-1">EMAIL</label>
                          <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-white/30" />
                        </div>
                        <div>
                          <label className="text-[9px] text-[#33FF33]/50 block mb-1">MOT DE PASSE</label>
                          <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-white/30" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">NOM</label>
                      <input type="text" value={creatingUser ? newUserName : editingUser?.display_name || ""} onChange={(e) => creatingUser ? setNewUserName(e.target.value) : setEditingUser(editingUser ? { ...editingUser, display_name: e.target.value } : null)} placeholder="NOM" className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-white/30" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">CARD NUMBER</label>
                      <input type="text" value={creatingUser ? newUserCard : editingUser?.card_number || ""} onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 9); const formatted = raw.replace(/(.{3})/g, "$1 ").trim(); creatingUser ? setNewUserCard(formatted) : setEditingUser(editingUser ? { ...editingUser, card_number: formatted } : null); }} maxLength={11} placeholder="000 000 000" className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-white/30 font-mono tracking-[0.15em]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">TELEGRAM</label>
                      <input type="text" value={creatingUser ? newUserTelegram : editingUser?.telegram_username || ""} onChange={(e) => creatingUser ? setNewUserTelegram(e.target.value) : setEditingUser(editingUser ? { ...editingUser, telegram_username: e.target.value } : null)} placeholder="@USERNAME" className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] placeholder:text-white/30" />
                    </div>
                  </div>
                </div>
              )}

              {/* Wallets viewer */}
              {viewWallets && (
                <div className="border border-[#33FF33]/15 p-4 mb-4 bg-[#33FF33]/[0.02]">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] text-[#33FF33]/50 tracking-wider">WALLETS ({viewWallets.wallets.length})</label>
                    <button onClick={() => setViewWallets(null)} className="text-white/30 text-[9px] hover:text-white/50">FERMER</button>
                  </div>
                  {viewWallets.wallets.length === 0 ? (
                    <p className="text-white/30 text-[10px]">AUCUN WALLET</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {viewWallets.wallets.map((w, i) => (
                        <div key={i} className="border border-[#33FF33]/15 p-2">
                          <div className="flex gap-1 mb-1">
                            <span className="text-[9px] text-[#DF8301] border border-[#DF8301]/30 px-1.5 py-0.5 flex-1 text-center">{w.label}</span>
                            {w.chain && <span className="text-[9px] text-white/40 border border-white/15 px-1.5 py-0.5 flex-1 text-center">{w.chain}</span>}
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {w.url && <img src={w.url} alt={w.label} className="w-full object-contain mb-1" />}
                          {w.address && <p className="text-[8px] text-white/40 font-mono break-all">{w.address}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Users list */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#33FF33]/20">
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">EMAIL</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">NOM</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">CARD NUMBER</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">TELEGRAM</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">INSCRIPTION</th>
                    <th className="text-right text-[#33FF33]/50 py-2 px-2 font-normal">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[#33FF33]/10 hover:bg-[#33FF33]/5">
                      <td className="py-2 px-2 text-white/80">{u.email}</td>
                      <td className="py-2 px-2 text-white/80">{u.display_name || "---"}</td>
                      <td className="py-2 px-2 text-white/80 font-mono tracking-[0.15em]">{u.card_number ? u.card_number.replace(/\s/g, "").replace(/(.{3})/g, "$1 ").trim() : "---"}</td>
                      <td className="py-2 px-2 text-white/80">{u.telegram_username ? `@${u.telegram_username}` : "---"}</td>
                      <td className="py-2 px-2 text-white/50">{u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "---"}</td>
                      <td className="py-2 px-2 text-right flex gap-2 justify-end">
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/account/lookup?card=${u.card_number.replace(/\s/g, "")}`);
                            if (res.ok) {
                              const data = await res.json();
                              setViewWallets({ userId: u.id, wallets: data.qr_codes || [] });
                            }
                          }}
                          className="text-[#33FF33]/50 hover:text-[#33FF33]"
                        >
                          QR
                        </button>
                        <button
                          onClick={() => { setEditingUser({ id: u.id, card_number: u.card_number, display_name: u.display_name, telegram_username: u.telegram_username }); setCreatingUser(false); }}
                          className="text-[#DF8301] hover:text-[#DF8301]/80"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`SUPPRIMER ${u.email} ?`)) return;
                            await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id }) });
                            fetchUsers();
                          }}
                          className="text-red-500 hover:text-red-400"
                        >
                          DEL
                        </button>
                      </td>
                    </tr>
                  ))}
                  {adminUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-white/30">AUCUN UTILISATEUR</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </>); })()}
            </div>
          ) : activeNav === "payments" ? (
            /* ─── PAYMENTS ─── */
            <div>
              <div className="mb-4">
                <span className="text-white/20 text-[9px] tracking-wider">{payments.length} DEMANDE{payments.length !== 1 ? "S" : ""}</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#33FF33]/20">
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">DE</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">VERS</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">MONTANT</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">NOTE</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">DATE</th>
                    <th className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">STATUT</th>
                    <th className="text-right text-[#33FF33]/50 py-2 px-2 font-normal">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const fromUser = adminUsers.find((u) => u.id === p.from_user_id);
                    return (
                      <tr key={p.id} className="border-b border-[#33FF33]/10 hover:bg-[#33FF33]/5">
                        <td className="py-2 px-2 text-white/80">{fromUser?.email || fromUser?.display_name || p.from_user_id.slice(0, 8)}</td>
                        <td className="py-2 px-2 text-white/80 font-mono">{p.to_card_number}</td>
                        <td className="py-2 px-2 text-white/80">{p.amount} {p.currency}</td>
                        <td className="py-2 px-2 text-white/50 max-w-[150px] truncate">{p.note || "-"}</td>
                        <td className="py-2 px-2 text-white/50">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                        <td className={`py-2 px-2 ${p.status === "completed" ? "text-[#33FF33]" : p.status === "rejected" ? "text-red-500" : "text-[#DF8301]"}`}>{p.status.toUpperCase()}</td>
                        <td className="py-2 px-2 text-right flex gap-1 justify-end">
                          {p.status === "pending" && (
                            <>
                              <button
                                onClick={async () => {
                                  await fetch("/api/admin/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: "approved" }) });
                                  fetchPayments();
                                }}
                                className="text-[#33FF33] text-[10px] border border-[#33FF33]/30 px-2 py-0.5 hover:bg-[#33FF33]/10"
                              >OK</button>
                              <button
                                onClick={async () => {
                                  await fetch("/api/admin/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: "rejected" }) });
                                  fetchPayments();
                                }}
                                className="text-red-500 text-[10px] border border-red-500/30 px-2 py-0.5 hover:bg-red-500/10"
                              >NON</button>
                            </>
                          )}
                          {p.status === "approved" && (
                            <button
                              onClick={async () => {
                                await fetch("/api/admin/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: "completed" }) });
                                fetchPayments();
                              }}
                              className="text-[#33FF33] text-[10px] border border-[#33FF33]/30 px-2 py-0.5 hover:bg-[#33FF33]/10"
                            >DONE</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {payments.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-center text-white/30">AUCUNE DEMANDE</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeNav === "media" ? (
            /* ─── MEDIA LIBRARY ─── */
            <div>
              <div className="mb-4 flex items-center gap-3">
                <label className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10 transition-colors cursor-pointer">
                  {mediaUploading ? "UPLOAD EN COURS..." : "+ UPLOAD"}
                  <input
                    type="file"
                    accept="image/*,video/*,.gif"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files) return;
                      setMediaUploading(true);
                      for (let i = 0; i < files.length; i++) {
                        const formData = new FormData();
                        formData.append("file", files[i]);
                        await fetch("/api/admin/upload", { method: "POST", body: formData });
                      }
                      setMediaUploading(false);
                      fetchMedia();
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-white/20 text-[9px] tracking-wider">
                  {mediaFiles.length} FICHIER{mediaFiles.length !== 1 ? "S" : ""}
                </span>
              </div>

              {mediaFiles.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-8">AUCUN MEDIA</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {mediaFiles.map((f) => {
                    const isVideo = f.type?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(f.name);
                    const isImage = f.type?.startsWith("image/") || /\.(gif|png|jpg|jpeg|webp|svg|bmp|ico|avif)$/i.test(f.name);
                    return (
                      <div
                        key={f.path}
                        className="border border-[#33FF33]/15 bg-black group relative"
                      >
                        {/* Preview */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <div className="aspect-square flex items-center justify-center overflow-hidden bg-[#33FF33]/[0.02]">
                          {isVideo ? (
                            <video src={f.url} className="max-w-full max-h-full object-contain" muted />
                          ) : isImage ? (
                            <img src={f.url} alt={f.name} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-[#33FF33]/30 text-[10px]">FILE</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-1.5 border-t border-[#33FF33]/10">
                          <p className="text-[8px] text-white/50 truncate" title={f.name}>{f.name}</p>
                          <p className="text-[8px] text-white/20">
                            {f.size > 1024 * 1024
                              ? `${(f.size / 1024 / 1024).toFixed(1)}MB`
                              : `${Math.round(f.size / 1024)}KB`}
                          </p>
                        </div>

                        {/* Actions overlay */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(f.url);
                              setMediaCopied(f.path);
                              setTimeout(() => setMediaCopied(null), 2000);
                            }}
                            className="border border-[#33FF33]/40 text-[#33FF33] px-3 py-1 text-[9px] hover:bg-[#33FF33]/10 transition-colors w-20 text-center"
                          >
                            {mediaCopied === f.path ? "COPIE !" : "COPIER URL"}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("SUPPRIMER CE FICHIER ?")) return;
                              await fetch("/api/admin/upload", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ path: f.path }),
                              });
                              fetchMedia();
                            }}
                            className="border border-red-500/40 text-red-500 px-3 py-1 text-[9px] hover:bg-red-500/10 transition-colors w-20 text-center"
                          >
                            SUPPRIMER
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          <>
            {/* Menu label setting (LEFT MENU only) */}
            {activeNav === "left-menu" && (
              <div className="mb-4 border border-[#33FF33]/15 p-3 bg-[#33FF33]/[0.02]">
                <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">TITRE DE LA SECTION MENU</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={menuLabel}
                    onChange={(e) => { setMenuLabel(e.target.value); setMenuLabelSaved(false); }}
                    className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[200px]"
                  />
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/admin/site-settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: "menu_label", value: menuLabel }),
                      });
                      if (res.ok) {
                        setMenuLabelSaved(true);
                        setError("");
                      } else {
                        const err = await res.json().catch(() => ({ error: "Erreur" }));
                        setError(err.error || "Erreur sauvegarde");
                      }
                    }}
                    disabled={menuLabelSaved}
                    className={`border px-3 py-1 text-xs transition-colors ${
                      menuLabelSaved
                        ? "border-white/10 text-white/20 cursor-default"
                        : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"
                    }`}
                  >
                    {menuLabelSaved ? "OK" : "SAUVEGARDER"}
                  </button>
                </div>
              </div>
            )}

            {/* Submenu label setting (RIGHT MENU only) */}
            {activeNav === "right-menu" && (
              <div className="mb-4 border border-[#33FF33]/15 p-3 bg-[#33FF33]/[0.02]">
                <label className="text-[9px] text-[#33FF33]/50 block mb-1 tracking-wider">TITRE DE LA SECTION SUBMENU</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={submenuLabel}
                    onChange={(e) => { setSubmenuLabel(e.target.value); setSubmenuLabelSaved(false); }}
                    className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[200px]"
                  />
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/admin/site-settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: "submenu_label", value: submenuLabel }),
                      });
                      if (res.ok) {
                        setSubmenuLabelSaved(true);
                        setError("");
                      } else {
                        const err = await res.json().catch(() => ({ error: "Erreur" }));
                        setError(err.error || "Erreur sauvegarde");
                      }
                    }}
                    disabled={submenuLabelSaved}
                    className={`border px-3 py-1 text-xs transition-colors ${
                      submenuLabelSaved
                        ? "border-white/10 text-white/20 cursor-default"
                        : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"
                    }`}
                  >
                    {submenuLabelSaved ? "OK" : "SAUVEGARDER"}
                  </button>
                </div>
                <label className="text-[9px] text-[#33FF33]/50 block mb-1 mt-3 tracking-wider">LIGNE SOUS LE TITRE</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={submenuLine}
                    onChange={(e) => { setSubmenuLine(e.target.value); setSubmenuLineSaved(false); }}
                    className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] w-[300px]"
                  />
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/admin/site-settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: "submenu_line", value: submenuLine }),
                      });
                      if (res.ok) {
                        setSubmenuLineSaved(true);
                        setError("");
                      } else {
                        const err = await res.json().catch(() => ({ error: "Erreur" }));
                        setError(err.error || "Erreur sauvegarde");
                      }
                    }}
                    disabled={submenuLineSaved}
                    className={`border px-3 py-1 text-xs transition-colors ${
                      submenuLineSaved
                        ? "border-white/10 text-white/20 cursor-default"
                        : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"
                    }`}
                  >
                    {submenuLineSaved ? "OK" : "SAUVEGARDER"}
                  </button>
                </div>
              </div>
            )}

            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              {!isTree && (
                <button
                  onClick={() => newRecord(null)}
                  className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10 transition-colors"
                >
                  + AJOUTER
                </button>
              )}
              <span className="text-white/20 text-[9px] tracking-wider">
                {tableConfig.label}
              </span>
            </div>

            {/* Edit form (shared for tree and non-tree) */}
            {editing && (
              <div className="border border-[#DF8301]/30 p-4 mb-4 bg-[#DF8301]/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[#DF8301] text-xs tracking-wider">
                    {editing.id ? "MODIFIER" : "CREER"} {isContentSections ? "PAGE / ARTICLE" : isTemplates ? "TEMPLATE" : ""}
                    {isTree && editing.parent_id && (
                      <span className="text-white/30 ml-2">
                        PARENT: {treeItems.find((t) => t.id === editing.parent_id)?.code || String(editing.parent_id)}
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleSave(editing)}
                      className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10"
                    >
                      SAUVEGARDER
                    </button>
                    <button
                      onClick={() => { setEditing(null); setError(""); }}
                      className="border border-white/20 text-white/50 px-4 py-1 text-xs hover:bg-white/5"
                    >
                      ANNULER
                    </button>
                  </div>
                </div>

                {isContentSections ? (
                  /* ─── CONTENT SECTIONS: Rich Editor Form ─── */
                  <div className="space-y-4">
                    {/* Template loader + saver */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {templates.length > 0 && (
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] text-[#33FF33]/50 tracking-wider shrink-0">CHARGER TEMPLATE</label>
                          <select
                            onChange={(e) => {
                              const tpl = templates.find((t) => t.id === e.target.value);
                              if (tpl && confirm("REMPLACER LE CONTENU PAR LE TEMPLATE ?")) {
                                setEditing({
                                  ...editing,
                                  body: tpl.body ?? "",
                                  title_color: tpl.title_color ?? "#DF8301",
                                  body_color: tpl.body_color ?? "#FFFFFF",
                                  template_id: tpl.id,
                                });
                              }
                              e.target.value = "";
                            }}
                            className="bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                            defaultValue=""
                          >
                            <option value="" disabled>-- SELECTIONNER --</option>
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>{String(tpl.name)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const name = prompt("NOM DU TEMPLATE :");
                          if (!name) return;
                          const res = await fetch("/api/admin/templates", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name, body: editing.body ?? "", title_color: editing.title_color ?? "#DF8301", body_color: editing.body_color ?? "#FFFFFF" }),
                          });
                          if (res.ok) {
                            const tpl = await res.json();
                            setEditing({ ...editing, template_id: tpl.id });
                            fetchMenuItemsRef();
                            alert("TEMPLATE CREE !");
                          }
                        }}
                        className="text-[10px] border border-[#DF8301]/30 text-[#DF8301] px-3 py-1 hover:bg-[#DF8301]/10 transition-colors"
                      >
                        SAUVER COMME TEMPLATE
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">TITRE</label>
                        <input
                          type="text"
                          value={String(editing.title ?? "")}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          placeholder="TITRE DE LA PAGE"
                          className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">BOUTON MENU (MODULE_KEY)</label>
                        <select
                          value={String(editing.module_key ?? "")}
                          onChange={(e) => setEditing({ ...editing, module_key: e.target.value })}
                          className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                        >
                          <option value="">-- AUCUN (SAISIE LIBRE) --</option>
                          <optgroup label="LEFT MENU">
                            {menuItemsRef.map((mi) => (
                              <option key={mi.id} value={mi.code.toLowerCase()}>
                                {mi.code} — {mi.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="RIGHT MENU">
                            {submenuItemsRef.map((si) => (
                              <option key={si.id} value={si.code.toLowerCase()}>
                                {si.code} — {si.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {editing.module_key && ![...menuItemsRef, ...submenuItemsRef].some(
                          (mi) => mi.code.toLowerCase() === String(editing.module_key).toLowerCase()
                        ) && (
                          <input
                            type="text"
                            value={String(editing.module_key ?? "")}
                            onChange={(e) => setEditing({ ...editing, module_key: e.target.value })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33] mt-1"
                            placeholder="MODULE_KEY PERSONNALISE"
                          />
                        )}
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">STATUT</label>
                        <select
                          value={String(editing.is_active)}
                          onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "true" })}
                          className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                        >
                          <option value="true">ACTIF</option>
                          <option value="false">INACTIF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">FULLSCREEN</label>
                        <select
                          value={String(editing.is_fullscreen ?? false)}
                          onChange={(e) => setEditing({ ...editing, is_fullscreen: e.target.value === "true" })}
                          className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                        >
                          <option value="false">NON</option>
                          <option value="true">OUI (SPLASH)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">FOND</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={String(editing.bg_color ?? "#000000")} onChange={(e) => setEditing({ ...editing, bg_color: e.target.value })} className="w-8 h-8 bg-black border border-[#33FF33]/30 cursor-pointer" />
                          <input type="text" value={String(editing.bg_color ?? "#000000")} onChange={(e) => setEditing({ ...editing, bg_color: e.target.value })} className="flex-1 bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">COULEUR TITRE</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={String(editing.title_color ?? "#DF8301")}
                            onChange={(e) => setEditing({ ...editing, title_color: e.target.value })}
                            className="w-8 h-8 bg-black border border-[#33FF33]/30 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={String(editing.title_color ?? "#DF8301")}
                            onChange={(e) => setEditing({ ...editing, title_color: e.target.value })}
                            className="flex-1 bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">COULEUR CONTENU</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={String(editing.body_color ?? "#FFFFFF")}
                            onChange={(e) => setEditing({ ...editing, body_color: e.target.value })}
                            className="w-8 h-8 bg-black border border-[#33FF33]/30 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={String(editing.body_color ?? "#FFFFFF")}
                            onChange={(e) => setEditing({ ...editing, body_color: e.target.value })}
                            className="flex-1 bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">CONTENU</label>
                      <Suspense
                        fallback={
                          <div className="border border-[#33FF33]/30 p-4 text-[#33FF33]/30 text-xs min-h-[300px] flex items-center justify-center">
                            CHARGEMENT EDITEUR...
                          </div>
                        }
                      >
                        <RichEditor
                          content={String(editing.body ?? "")}
                          onChange={(html) => setEditing((prev) => prev ? { ...prev, body: html } : prev)}
                        />
                      </Suspense>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">APERCU</label>
                      <div className="border border-[#33FF33]/15 bg-black p-4 min-h-[100px]">
                        <div
                          className="rich-content text-sm"
                          dangerouslySetInnerHTML={{ __html: String(editing.body ?? "") }}
                        />
                      </div>
                    </div>
                  </div>
                ) : isTemplates ? (
                  /* ─── TEMPLATES: Rich Editor Form ─── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">NOM DU TEMPLATE</label>
                        <input
                          type="text"
                          value={String(editing.name ?? "")}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          placeholder="NOM DU TEMPLATE"
                          className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">COULEUR TITRE</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={String(editing.title_color ?? "#DF8301")} onChange={(e) => setEditing({ ...editing, title_color: e.target.value })} className="w-8 h-8 bg-black border border-[#33FF33]/30 cursor-pointer" />
                          <input type="text" value={String(editing.title_color ?? "#DF8301")} onChange={(e) => setEditing({ ...editing, title_color: e.target.value })} className="flex-1 bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">COULEUR CONTENU</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={String(editing.body_color ?? "#FFFFFF")} onChange={(e) => setEditing({ ...editing, body_color: e.target.value })} className="w-8 h-8 bg-black border border-[#33FF33]/30 cursor-pointer" />
                          <input type="text" value={String(editing.body_color ?? "#FFFFFF")} onChange={(e) => setEditing({ ...editing, body_color: e.target.value })} className="flex-1 bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#33FF33]/50 block mb-1">CONTENU DU TEMPLATE</label>
                      <Suspense fallback={<div className="border border-[#33FF33]/30 p-4 text-[#33FF33]/30 text-xs min-h-[300px] flex items-center justify-center">CHARGEMENT EDITEUR...</div>}>
                        <RichEditor content={String(editing.body ?? "")} onChange={(html) => setEditing((prev) => prev ? { ...prev, body: html } : prev)} />
                      </Suspense>
                    </div>
                  </div>
                ) : isTree ? (
                  /* ─── TREE ITEM FORM ─── */
                  <div className="grid grid-cols-2 gap-3">
                    {treeEditFields.map((field) => (
                      <div key={field}>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">{field.toUpperCase()}</label>
                        {field === "is_active" ? (
                          <select
                            value={String(editing[field])}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value === "true" })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          >
                            <option value="true">ACTIF</option>
                            <option value="false">INACTIF</option>
                          </select>
                        ) : field === "font_size" ? (
                          <input
                            type="number"
                            min={8}
                            max={32}
                            value={Number(editing[field] ?? 12)}
                            onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(editing[field] ?? "")}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ─── GENERIC FORM ─── */
                  <div className="grid grid-cols-2 gap-3">
                    {tableConfig.fields.map((field) => (
                      <div key={field}>
                        <label className="text-[9px] text-[#33FF33]/50 block mb-1">{field}</label>
                        {(field === "is_active" || field === "is_scrolling") ? (
                          <select
                            value={String(editing[field] ?? false)}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value === "true" })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          >
                            {field === "is_scrolling" ? (
                              <><option value="false">STATIQUE</option><option value="true">DEFILANT</option></>
                            ) : (
                              <><option value="true">ACTIF</option><option value="false">INACTIF</option></>
                            )}
                          </select>
                        ) : field === "text_align" ? (
                          <select
                            value={String(editing[field] ?? "center")}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          >
                            <option value="left">GAUCHE</option>
                            <option value="center">CENTRE</option>
                            <option value="right">DROITE</option>
                          </select>
                        ) : field === "body" ? (
                          <textarea
                            value={String(editing[field] ?? "")}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                            rows={3}
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        ) : (
                          <input
                            type={field === "sort_order" ? "number" : "text"}
                            value={String(editing[field] ?? "")}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                [field]: field === "sort_order" ? Number(e.target.value) : e.target.value,
                              })
                            }
                            className="w-full bg-black border border-[#33FF33]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#33FF33]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="text-red-500 text-xs mt-3 border border-red-500/30 bg-red-500/10 px-3 py-1">{error}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleSave(editing)}
                    className="border border-[#33FF33]/40 text-[#33FF33] px-4 py-1 text-xs hover:bg-[#33FF33]/10"
                  >
                    SAUVEGARDER
                  </button>
                  <button
                    onClick={() => { setEditing(null); setError(""); }}
                    className="border border-white/20 text-white/50 px-4 py-1 text-xs hover:bg-white/5"
                  >
                    ANNULER
                  </button>
                </div>
              </div>
            )}

            {/* Records display */}
            {loading ? (
              <p className="text-[#33FF33]/50 text-xs">CHARGEMENT...</p>
            ) : isTree ? (
              /* ─── TREE VIEW ─── */
              <TreeEditor
                items={treeItems}
                onReorder={handleReorder}
                onAdd={(parentId) => newRecord(parentId)}
                onEdit={(item) => setEditing(item as unknown as Record)}
                onDelete={handleDelete}
                showRef={activeTable === "submenu-items"}
                flat={activeTable === "menu-items"}
                addRootLabel={activeTable === "submenu-items" ? "FOLDER" : undefined}
                addChildLabel={activeTable === "submenu-items" ? "ITEM" : undefined}
              />
            ) : isContentSections ? (
              /* ─── CONTENT SECTIONS with TEMPLATES ─── */
              <div>
                {/* Templates section */}
                <div className="mb-4 border border-[#33FF33]/15 p-3 bg-[#33FF33]/[0.02]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] text-[#33FF33]/50 tracking-wider">TEMPLATES</label>
                    <button
                      onClick={() => { setEditing({ id: "", name: "", body: "", title_color: "#DF8301", body_color: "#FFFFFF" }); setActiveNav("templates" as NavSection); }}
                      className="text-[9px] text-[#33FF33] border border-[#33FF33]/30 px-2 py-0.5 hover:bg-[#33FF33]/10 transition-colors"
                    >
                      + TEMPLATE
                    </button>
                  </div>
                  {templates.length === 0 ? (
                    <p className="text-white/20 text-[9px]">AUCUN TEMPLATE</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {templates.map((tpl) => (
                        <div key={tpl.id} className="border border-[#33FF33]/15 px-2.5 py-1 flex items-center gap-2 group hover:border-[#33FF33]/30 transition-colors">
                          <span className="text-[10px] text-[#DF8301]">{String(tpl.name)}</span>
                          <button
                            onClick={() => { setEditing(tpl); setActiveNav("templates" as NavSection); }}
                            className="text-[8px] text-white/20 hover:text-[#DF8301] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("SUPPRIMER CE TEMPLATE ?")) return;
                              await fetch("/api/admin/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tpl.id }) });
                              fetchMenuItemsRef();
                            }}
                            className="text-[8px] text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            DEL
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content sections list */}
                <div className="space-y-2">
                {records.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-8">AUCUN ARTICLE</p>
                )}
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="border border-[#33FF33]/15 p-3 hover:border-[#33FF33]/30 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[9px] px-2 py-0.5 border ${
                            r.is_active
                              ? "border-[#33FF33]/40 text-[#33FF33] bg-[#33FF33]/10"
                              : "border-red-500/40 text-red-500 bg-red-500/10"
                          }`}
                        >
                          {r.is_active ? "ACTIF" : "INACTIF"}
                        </span>
                        {r.is_fullscreen && (
                          <span className="text-[9px] px-2 py-0.5 border border-[#DF8301]/40 text-[#DF8301] bg-[#DF8301]/10">
                            SPLASH
                          </span>
                        )}
                        <span className="text-[#DF8301] text-xs font-bold tracking-wider">
                          {String(r.title)}
                        </span>
                        <span className="text-[#33FF33]/40 text-[9px]">
                          KEY: {String(r.module_key)}
                        </span>
                        {(() => {
                          const tpl = templates.find((t) => t.id === r.template_id);
                          return tpl ? (
                            <span className="text-[9px] px-2 py-0.5 border border-[#33FF33]/20 text-[#33FF33]/50">
                              TPL: {String(tpl.name)}
                            </span>
                          ) : (
                            <span className="text-[9px] text-white/20">PAS DE TEMPLATE</span>
                          );
                        })()}
                      </div>
                      <div
                        className="text-white/40 text-[9px] mt-1 truncate max-w-[600px]"
                        dangerouslySetInnerHTML={{
                          __html: String(r.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 120),
                        }}
                      />
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/content-sections`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: r.id, is_fullscreen: !r.is_fullscreen }),
                          });
                          if (res.ok) fetchRecords();
                        }}
                        className={`text-[10px] border px-2 py-0.5 ${
                          r.is_fullscreen
                            ? "text-[#33FF33] border-[#33FF33]/30 hover:bg-[#33FF33]/10"
                            : "text-white/30 border-white/15 hover:bg-white/5"
                        }`}
                        title={r.is_fullscreen ? "DESACTIVER SPLASH" : "ACTIVER SPLASH"}
                      >
                        SPLASH
                      </button>
                      <button
                        onClick={() => setEditing(r)}
                        className="text-[#DF8301] text-[10px] hover:text-[#DF8301]/80 border border-[#DF8301]/30 px-2 py-0.5"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-500 text-[10px] hover:text-red-400 border border-red-500/30 px-2 py-0.5"
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            ) : isTemplates ? (
              /* ─── TEMPLATES: Card view ─── */
              <div className="space-y-2">
                {records.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-8">AUCUN TEMPLATE</p>
                )}
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="border border-[#33FF33]/15 p-3 hover:border-[#33FF33]/30 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[#DF8301] text-xs font-bold tracking-wider">
                          {String(r.name)}
                        </span>
                        <span className="text-white/20 text-[9px]">
                          COULEURS: <span style={{ color: String(r.title_color ?? "#DF8301") }}>TITRE</span> / <span style={{ color: String(r.body_color ?? "#FFFFFF") }}>CONTENU</span>
                        </span>
                      </div>
                      <div
                        className="text-white/40 text-[9px] mt-1 truncate max-w-[600px]"
                        dangerouslySetInnerHTML={{ __html: String(r.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 120) }}
                      />
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button onClick={() => setEditing(r)} className="text-[#DF8301] text-[10px] hover:text-[#DF8301]/80 border border-[#DF8301]/30 px-2 py-0.5">EDIT</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 text-[10px] hover:text-red-400 border border-red-500/30 px-2 py-0.5">DEL</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ─── GENERIC TABLE ─── */
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#33FF33]/20">
                    {tableConfig.fields.filter((f) => !["parent_id", "position", "is_scrolling", "is_active", "text_align"].includes(f)).map((f) => (
                      <th key={f} className="text-left text-[#33FF33]/50 py-2 px-2 font-normal">
                        {f}
                      </th>
                    ))}
                    <th className="text-right text-[#33FF33]/50 py-2 px-2 font-normal">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[#33FF33]/10 hover:bg-[#33FF33]/5">
                      {tableConfig.fields.filter((f) => !["parent_id", "position", "is_scrolling", "is_active", "text_align"].includes(f)).map((f) => (
                        <td key={f} className="py-2 px-2 text-white/80 max-w-[200px] truncate">
                          {typeof r[f] === "boolean" ? (r[f] ? "OUI" : "NON") : String(r[f] ?? "")}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right flex gap-2 justify-end">
                        {activeTable === "announcements" && (
                          <>
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/admin/announcements`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: r.id, is_active: !r.is_active }),
                                });
                                if (res.ok) fetchRecords();
                              }}
                              className={`text-[10px] border px-2 py-0.5 ${
                                r.is_active
                                  ? "text-[#33FF33] border-[#33FF33]/30 hover:bg-[#33FF33]/10"
                                  : "text-white/30 border-white/15 hover:bg-white/5"
                              }`}
                            >
                              {r.is_active ? "ON" : "OFF"}
                            </button>
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/admin/announcements`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: r.id, is_scrolling: !r.is_scrolling }),
                                });
                                if (res.ok) fetchRecords();
                              }}
                              className={`text-[10px] border px-2 py-0.5 ${
                                r.is_scrolling
                                  ? "text-[#33FF33] border-[#33FF33]/30 hover:bg-[#33FF33]/10"
                                  : "text-white/30 border-white/15 hover:bg-white/5"
                              }`}
                            >
                              SCROLL
                            </button>
                            <button
                              onClick={async () => {
                                const cycle = { left: "center", center: "right", right: "left" } as const;
                                const current = (String(r.text_align || "center")) as "left" | "center" | "right";
                                const next = cycle[current];
                                const res = await fetch(`/api/admin/announcements`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: r.id, text_align: next }),
                                });
                                if (res.ok) fetchRecords();
                              }}
                              className="text-[10px] border border-[#33FF33]/30 text-[#33FF33] px-2 py-0.5 hover:bg-[#33FF33]/10"
                            >
                              {String(r.text_align || "center") === "left" ? "\u21E4" : String(r.text_align || "center") === "right" ? "\u21E5" : "\u21D4"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setEditing(r)}
                          className="text-[#DF8301] hover:text-[#DF8301]/80"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          DEL
                        </button>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={tableConfig.fields.filter((f) => !["parent_id", "position", "is_scrolling", "is_active", "text_align"].includes(f)).length + 1} className="py-4 text-center text-white/30">
                        AUCUN ENREGISTREMENT
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
          )}
      </div>
    </div>
  );
}
