"use client";

import { useState, useEffect, useCallback } from "react";

type TableName = "announcements" | "menu-items" | "submenu-items" | "content-sections";

interface Record {
  id: string;
  [key: string]: string | number | boolean;
}

const TABLES: { key: TableName; label: string; fields: string[] }[] = [
  { key: "announcements", label: "ANNOUNCEMENTS", fields: ["message", "is_active"] },
  { key: "menu-items", label: "MENU ITEMS", fields: ["code", "label", "sort_order", "is_active"] },
  { key: "submenu-items", label: "SUBMENU ITEMS", fields: ["code", "label", "ref", "sort_order", "is_active"] },
  { key: "content-sections", label: "CONTENT SECTIONS", fields: ["module_key", "title", "body", "is_active"] },
];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTable, setActiveTable] = useState<TableName>("announcements");
  const [records, setRecords] = useState<Record[]>([]);
  const [editing, setEditing] = useState<Record | null>(null);
  const [loading, setLoading] = useState(false);

  const tableConfig = TABLES.find((t) => t.key === activeTable)!;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/${activeTable}`);
    if (res.ok) {
      setRecords(await res.json());
    }
    setLoading(false);
  }, [activeTable]);

  useEffect(() => {
    if (authenticated) fetchRecords();
  }, [authenticated, activeTable, fetchRecords]);

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
    await fetch(`/api/admin/${activeTable}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    setEditing(null);
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("SUPPRIMER CET ÉLÉMENT ?")) return;
    await fetch(`/api/admin/${activeTable}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRecords();
  };

  const newRecord = () => {
    const record: Record = { id: "" };
    tableConfig.fields.forEach((f) => {
      if (f === "is_active") record[f] = true;
      else if (f === "sort_order") record[f] = 0;
      else record[f] = "";
    });
    setEditing(record);
  };

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

  // ─── ADMIN DASHBOARD ───
  return (
    <div className="min-h-screen bg-black text-white font-mono uppercase">
      {/* Header */}
      <div className="border-b border-[#00FF00]/20 px-6 py-3 flex items-center justify-between">
        <h1 className="text-[#00FF00] text-lg tracking-widest font-bold">HIEROS ADMIN</h1>
        <a href="/" className="text-[#00FF00]/50 text-xs hover:text-[#00FF00]">← RETOUR AU SITE</a>
      </div>

      {/* Table tabs */}
      <div className="border-b border-[#00FF00]/20 px-6 py-2 flex gap-4">
        {TABLES.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTable(t.key); setEditing(null); }}
            className={`text-[11px] px-3 py-1 border transition-colors ${
              activeTable === t.key
                ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
                : "border-[#00FF00]/20 text-[#00FF00]/60 hover:border-[#00FF00]/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Add button */}
        <div className="mb-4">
          <button
            onClick={newRecord}
            className="border border-[#00FF00]/40 text-[#00FF00] px-4 py-1 text-xs hover:bg-[#00FF00]/10 transition-colors"
          >
            + AJOUTER
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="border border-[#FF8C00]/30 p-4 mb-4 bg-[#FF8C00]/5">
            <h3 className="text-[#FF8C00] text-xs mb-3 tracking-wider">
              {editing.id ? "MODIFIER" : "CRÉER"}
            </h3>
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
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleSave(editing)}
                className="border border-[#00FF00]/40 text-[#00FF00] px-4 py-1 text-xs hover:bg-[#00FF00]/10"
              >
                SAUVEGARDER
              </button>
              <button
                onClick={() => setEditing(null)}
                className="border border-white/20 text-white/50 px-4 py-1 text-xs hover:bg-white/5"
              >
                ANNULER
              </button>
            </div>
          </div>
        )}

        {/* Records table */}
        {loading ? (
          <p className="text-[#00FF00]/50 text-xs">CHARGEMENT...</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#00FF00]/20">
                {tableConfig.fields.map((f) => (
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
                  {tableConfig.fields.map((f) => (
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
                  <td colSpan={tableConfig.fields.length + 1} className="py-4 text-center text-white/30">
                    AUCUN ENREGISTREMENT
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
