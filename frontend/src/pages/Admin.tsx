import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Ban, LoaderCircle, Users } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  last_login: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  "border-amber-400/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  approved: "border-emerald-400/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  blocked:  "border-rose-400/30 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Admin({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/admin/users")
      .then(r => r.ok ? r.json() as Promise<{ users: UserRow[] }> : Promise.reject(r.status))
      .then(d => setUsers(d.users))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  const action = async (id: string, act: "approve" | "block") => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const r = await fetch(`/admin/users/${id}/${act}`, { method: "POST" });
      if (!r.ok) throw new Error();
      setUsers(prev =>
        prev.map(u => u.id === id ? { ...u, status: act === "approve" ? "approved" : "blocked" } : u)
      );
    } catch {
      setError(`Failed to ${act} user.`);
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-4">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Users size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500">Approve or block access requests</p>
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <LoaderCircle className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>User</span>
            <span>Email</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>

          {users.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No users yet.</p>
          )}

          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4 last:border-b-0"
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="size-8 rounded-full" />
                ) : (
                  <div className="grid size-8 place-items-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold dark:bg-indigo-900/40 dark:text-indigo-400">
                    {(u.name ?? u.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.name ?? "—"}</p>
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[u.status] ?? STATUS_BADGE["pending"]}`}>
                    {u.status}
                  </span>
                </div>
              </div>

              {/* Email */}
              <p className="truncate text-sm text-slate-600 dark:text-slate-400">{u.email}</p>

              {/* Date */}
              <p className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(u.created_at)}</p>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {u.status !== "approved" && (
                  <button
                    onClick={() => void action(u.id, "approve")}
                    disabled={busy[u.id]}
                    title="Approve"
                    className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition"
                  >
                    {busy[u.id] ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  </button>
                )}
                {u.status !== "blocked" && (
                  <button
                    onClick={() => void action(u.id, "block")}
                    disabled={busy[u.id]}
                    title="Block"
                    className="grid size-7 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition"
                  >
                    {busy[u.id] ? <LoaderCircle size={13} className="animate-spin" /> : <Ban size={13} />}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
