"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import TreeEditor, { type TreeNode } from "@/components/TreeEditor";

const RichEditor = lazy(() => import("@/components/RichEditor"));

type TableName = "announcements" | "menu-items" | "submenu-items" | "content-sections";
type RightSubTab = "listing" | "reach" | "tools";
type NavSection = "announcements" | "left-menu" | "right-menu" | "content-sections";

interface Record {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface MenuItemRef {
  id: string;
  code: string;
  label: string;
}

const TABLE_CONFIG: { [key in TableName]: { label: string; fields: string[] } } = {
  "announcements": { label: "ANNOUNCEMENTS", fields: ["message", "is_active"] },
  "menu-items": { label: "LEFT MENU", fields: ["code", "label", "sort_order", "is_active", "parent_id", "position"] },
  "submenu-items": { label: "RIGHT SUB MENU", fields: ["code", "label", "ref", "sort_order", "is_active", "parent_id", "position"] },
  "content-sections": { label: "CONTENT SECTIONS", fields: ["module_key", "title", "body", "is_active"] },
};

const RIGHT_SUB_TABS: { key: RightSubTab; label: string }[] = [
  { key: "listing", label: "LISTING" },
  { key: "reach", label: "REACH" },
  { key: "tools", label: "TOOLS" },
];

const NAV_ITEMS: { key: NavSection; label: string; hasChildren?: boolean }[] = [
  { key: "announcements", label: "ANNOUNCEMENTS" },
  { key: "left-menu", label: "LEFT MENU" },
  { key: "right-menu", label: "RIGHT MENU", hasChildren: true },
  { key: "content-sections", label: "CONTENT SECTIONS" },
];

function navToTable(nav: NavSection): TableName {
  if (nav === "left-menu") return "menu-items";
  if (nav === "right-menu") return "submenu-items";
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
  const [rightSubTab, setRightSubTab] = useState<RightSubTab>("listing");
  const [records, setRecords] = useState<Record[]>([]);
  const [editing, setEditing] = useState<Record | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuItemsRef, setMenuItemsRef] = useState<MenuItemRef[]>([]);
  const [menuLabel, setMenuLabel] = useState("MENU");
  const [menuLabelSaved, setMenuLabelSaved] = useState(true);

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
    const res = await fetch("/api/admin/menu-items");
    if (res.ok) {
      setMenuItemsRef(await res.json());
    }
  }, []);

  const fetchMenuLabel = useCallback(async () => {
    const res = await fetch("/api/admin/site-settings");
    if (res.ok) {
      const settings = await res.json();
      const found = settings.find((s: { key: string; value: string }) => s.key === "menu_label");
      if (found) {
        setMenuLabel(found.value);
        setMenuLabelSaved(true);
      }
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchRecords();
      fetchMenuItemsRef();
      fetchMenuLabel();
    }
  }, [authenticated, activeTable, fetchRecords, fetchMenuItemsRef, fetchMenuLabel]);

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

  const handleSave = async (record: Record) => {
    const isNew = !record.id;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(`/api/admin/${activeTable}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      setError(err.error || `Erreur ${res.status}`);
      return;
    }
    setEditing(null);
    setError("");
    await fetchRecords();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("SUPPRIMER CET ELEMENT ?")) return;
    await fetch(`/api/admin/${activeTable}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRecords();
  };

  const handleReorder = async (items: { id: string; parent_id: string | null; position: number }[]) => {
    // Optimistic update
    setRecords((prev) => {
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
      body: JSON.stringify({ table: tableToSupabase(activeTable), items }),
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
  const isRightMenu = activeNav === "right-menu";

  // Build TreeNode list from records for tree tables
  const treeItems: TreeNode[] = isTree
    ? records.map((r) => ({
        id: r.id as string,
        label: String(r.label ?? ""),
        code: String(r.code ?? ""),
        parent_id: (r.parent_id as string | null) ?? null,
        position: Number(r.position ?? r.sort_order ?? 0),
        is_active: Boolean(r.is_active),
        ref: r.ref != null ? String(r.ref) : undefined,
      }))
    : [];

  // ─── LOGIN SCREEN ───
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <form onSubmit={handleLogin} className="border border-[#00FF00]/30 p-8 w-[400px]">
          <h1 className="text-[#00FF00] text-xl font-bold mb-6 tracking-widest text-center">
            HIEROS ADMIN
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="MOT DE PASSE"
            className="w-full bg-black border border-[#00FF00]/40 text-[#00FF00] px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-[#00FF00] mb-4"
          />
          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[#00FF00]/10 border border-[#00FF00]/40 text-[#00FF00] py-2 text-sm uppercase tracking-wider hover:bg-[#00FF00]/20 transition-colors"
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
      <div className="border-b border-[#00FF00]/20 px-6 py-3 flex items-center justify-between">
        <h1 className="text-[#00FF00] text-lg tracking-widest font-bold">HIEROS ADMIN</h1>
        <a href="/" className="text-[#00FF00]/50 text-xs hover:text-[#00FF00]">{"\u2190"} RETOUR AU SITE</a>
      </div>

      {/* Primary nav tabs */}
      <div className="border-b border-[#00FF00]/20 px-6 py-2 flex gap-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => { setActiveNav(item.key); setEditing(null); }}
            className={`text-[11px] px-3 py-1 border transition-colors flex items-center gap-1 ${
              activeNav === item.key
                ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
                : "border-[#00FF00]/20 text-[#00FF00]/60 hover:border-[#00FF00]/50"
            }`}
          >
            {item.hasChildren && (
              <span className="text-[8px]">{activeNav === item.key ? "\u25BC" : "\u25B6"}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>

      {/* RIGHT MENU sub-tabs */}
      {isRightMenu && (
        <div className="border-b border-[#00FF00]/10 px-6 py-1.5 flex items-center gap-1 bg-[#00FF00]/[0.02]">
          <span className="text-[9px] text-white/20 mr-2 tracking-wider">{"\u2514\u2500"}</span>
          {RIGHT_SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setRightSubTab(tab.key); setEditing(null); }}
              className={`text-[10px] px-2.5 py-0.5 border transition-colors ${
                rightSubTab === tab.key
                  ? "border-[#FF8C00]/60 text-[#FF8C00] bg-[#FF8C00]/10"
                  : "border-[#00FF00]/15 text-[#00FF00]/40 hover:border-[#00FF00]/30 hover:text-[#00FF00]/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-6">
        {/* RIGHT MENU placeholder for REACH / TOOLS */}
        {isRightMenu && rightSubTab !== "listing" ? (
          <div className="border border-[#00FF00]/15 p-8 flex flex-col items-center justify-center min-h-[200px]">
            <span className="text-[#FF8C00] text-sm tracking-widest font-bold mb-2">
              {RIGHT_SUB_TABS.find((t) => t.key === rightSubTab)?.label}
            </span>
            <span className="text-white/20 text-[10px] tracking-wider">SECTION EN CONSTRUCTION</span>
          </div>
        ) : (
          <>
            {/* Menu label setting (LEFT MENU only) */}
            {activeNav === "left-menu" && (
              <div className="mb-4 border border-[#00FF00]/15 p-3 bg-[#00FF00]/[0.02]">
                <label className="text-[9px] text-[#00FF00]/50 block mb-1 tracking-wider">TITRE DE LA SECTION MENU</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={menuLabel}
                    onChange={(e) => { setMenuLabel(e.target.value); setMenuLabelSaved(false); }}
                    className="bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00] w-[200px]"
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
                        : "border-[#00FF00]/40 text-[#00FF00] hover:bg-[#00FF00]/10"
                    }`}
                  >
                    {menuLabelSaved ? "OK" : "SAUVEGARDER"}
                  </button>
                </div>
              </div>
            )}

            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              {!isTree && (
                <button
                  onClick={() => newRecord(null)}
                  className="border border-[#00FF00]/40 text-[#00FF00] px-4 py-1 text-xs hover:bg-[#00FF00]/10 transition-colors"
                >
                  + AJOUTER
                </button>
              )}
              <span className="text-white/20 text-[9px] tracking-wider">
                {isRightMenu ? "RIGHT MENU \u2192 LISTING" : tableConfig.label}
              </span>
            </div>

            {/* Edit form (shared for tree and non-tree) */}
            {editing && (
              <div className="border border-[#FF8C00]/30 p-4 mb-4 bg-[#FF8C00]/5">
                <h3 className="text-[#FF8C00] text-xs mb-3 tracking-wider">
                  {editing.id ? "MODIFIER" : "CREER"} {isContentSections ? "PAGE / ARTICLE" : ""}
                  {isTree && editing.parent_id && (
                    <span className="text-white/30 ml-2">
                      PARENT: {treeItems.find((t) => t.id === editing.parent_id)?.code || String(editing.parent_id)}
                    </span>
                  )}
                </h3>

                {isContentSections ? (
                  /* ─── CONTENT SECTIONS: Rich Editor Form ─── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] text-[#00FF00]/50 block mb-1">TITRE</label>
                        <input
                          type="text"
                          value={String(editing.title ?? "")}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          placeholder="TITRE DE LA PAGE"
                          className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#00FF00]/50 block mb-1">BOUTON MENU (MODULE_KEY)</label>
                        <select
                          value={String(editing.module_key ?? "")}
                          onChange={(e) => setEditing({ ...editing, module_key: e.target.value })}
                          className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                        >
                          <option value="">-- AUCUN (SAISIE LIBRE) --</option>
                          {menuItemsRef.map((mi) => (
                            <option key={mi.id} value={mi.code.toLowerCase()}>
                              {mi.code} — {mi.label}
                            </option>
                          ))}
                        </select>
                        {editing.module_key && !menuItemsRef.some(
                          (mi) => mi.code.toLowerCase() === String(editing.module_key).toLowerCase()
                        ) && (
                          <input
                            type="text"
                            value={String(editing.module_key ?? "")}
                            onChange={(e) => setEditing({ ...editing, module_key: e.target.value })}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00] mt-1"
                            placeholder="MODULE_KEY PERSONNALISE"
                          />
                        )}
                      </div>
                      <div>
                        <label className="text-[9px] text-[#00FF00]/50 block mb-1">STATUT</label>
                        <select
                          value={String(editing.is_active)}
                          onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "true" })}
                          className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                        >
                          <option value="true">ACTIF</option>
                          <option value="false">INACTIF</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#00FF00]/50 block mb-1">CONTENU</label>
                      <Suspense
                        fallback={
                          <div className="border border-[#00FF00]/30 p-4 text-[#00FF00]/30 text-xs min-h-[300px] flex items-center justify-center">
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
                      <label className="text-[9px] text-[#00FF00]/50 block mb-1">APERCU</label>
                      <div className="border border-[#00FF00]/15 bg-black p-4 min-h-[100px]">
                        <div
                          className="rich-content text-sm"
                          dangerouslySetInnerHTML={{ __html: String(editing.body ?? "") }}
                        />
                      </div>
                    </div>
                  </div>
                ) : isTree ? (
                  /* ─── TREE ITEM FORM ─── */
                  <div className="grid grid-cols-2 gap-3">
                    {treeEditFields.map((field) => (
                      <div key={field}>
                        <label className="text-[9px] text-[#00FF00]/50 block mb-1">{field.toUpperCase()}</label>
                        {field === "is_active" ? (
                          <select
                            value={String(editing[field])}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value === "true" })}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                          >
                            <option value="true">ACTIF</option>
                            <option value="false">INACTIF</option>
                          </select>
                        ) : field === "font_size" ? (
                          <input
                            type="number"
                            min={8}
                            max={32}
                            value={Number(editing[field] ?? 14)}
                            onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(editing[field] ?? "")}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
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
                        <label className="text-[9px] text-[#00FF00]/50 block mb-1">{field}</label>
                        {field === "is_active" ? (
                          <select
                            value={String(editing[field])}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value === "true" })}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
                          >
                            <option value="true">ACTIF</option>
                            <option value="false">INACTIF</option>
                          </select>
                        ) : field === "body" ? (
                          <textarea
                            value={String(editing[field] ?? "")}
                            onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                            rows={3}
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
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
                            className="w-full bg-black border border-[#00FF00]/30 text-white px-2 py-1 text-xs focus:outline-none focus:border-[#00FF00]"
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
                    className="border border-[#00FF00]/40 text-[#00FF00] px-4 py-1 text-xs hover:bg-[#00FF00]/10"
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
              <p className="text-[#00FF00]/50 text-xs">CHARGEMENT...</p>
            ) : isTree ? (
              /* ─── TREE VIEW ─── */
              <TreeEditor
                items={treeItems}
                onReorder={handleReorder}
                onAdd={(parentId) => newRecord(parentId)}
                onEdit={(item) => setEditing(item as unknown as Record)}
                onDelete={handleDelete}
                showRef={activeTable === "submenu-items"}
              />
            ) : isContentSections ? (
              /* ─── CONTENT SECTIONS: Card view ─── */
              <div className="space-y-2">
                {records.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-8">AUCUN ARTICLE</p>
                )}
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="border border-[#00FF00]/15 p-3 hover:border-[#00FF00]/30 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[9px] px-2 py-0.5 border ${
                            r.is_active
                              ? "border-[#00FF00]/40 text-[#00FF00] bg-[#00FF00]/10"
                              : "border-red-500/40 text-red-500 bg-red-500/10"
                          }`}
                        >
                          {r.is_active ? "ACTIF" : "INACTIF"}
                        </span>
                        <span className="text-[#FF8C00] text-xs font-bold tracking-wider">
                          {String(r.title)}
                        </span>
                        <span className="text-[#00FF00]/40 text-[9px]">
                          KEY: {String(r.module_key)}
                        </span>
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
                        onClick={() => setEditing(r)}
                        className="text-[#FF8C00] text-[10px] hover:text-[#FF8C00]/80 border border-[#FF8C00]/30 px-2 py-0.5"
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
            ) : (
              /* ─── GENERIC TABLE ─── */
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#00FF00]/20">
                    {tableConfig.fields.filter((f) => !["parent_id", "position"].includes(f)).map((f) => (
                      <th key={f} className="text-left text-[#00FF00]/50 py-2 px-2 font-normal">
                        {f}
                      </th>
                    ))}
                    <th className="text-right text-[#00FF00]/50 py-2 px-2 font-normal">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[#00FF00]/10 hover:bg-[#00FF00]/5">
                      {tableConfig.fields.filter((f) => !["parent_id", "position"].includes(f)).map((f) => (
                        <td key={f} className="py-2 px-2 text-white/80 max-w-[200px] truncate">
                          {String(r[f] ?? "")}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => setEditing(r)}
                          className="text-[#FF8C00] hover:text-[#FF8C00]/80 mr-3"
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
                      <td colSpan={tableConfig.fields.filter((f) => !["parent_id", "position"].includes(f)).length + 1} className="py-4 text-center text-white/30">
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
