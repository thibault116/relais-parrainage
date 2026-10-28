"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, Plus, Pencil, Trash2 } from "lucide-react";
type Task = { id: string; body: string; done: boolean };
type List = {
  id: string;
  side: "mentor" | "beginner";
  status: string;
  partner_name: string;
  blocked: number;
  tasks: Task[];
  completed: number;
  total: number;
  progress: number;
};
async function api(method = "GET", body?: unknown) {
  const r = await fetch("/api/tasks", {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Impossible de charger les tâches.");
  return d;
}
export function TodoLists() {
  const [lists, setLists] = useState<List[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    try {
      const d = await api();
      if (n !== generation.current) return;
      setLists(d.lists);
      setSelected((current) =>
        d.lists.some((l: List) => l.id === current)
          ? current
          : d.lists[0]?.id || "",
      );
      setError("");
    } catch (e) {
      if (n === generation.current) setError((e as Error).message);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const list = lists.find((l) => l.id === selected);
  return (
    <section className="verification-panel todo-panel">
      <span className="eyebrow">UN PAS APRÈS L’AUTRE</span>
      <h2>
        <ListChecks size={25} /> To-do list
      </h2>
      <p>
        Le parrain prépare les actions à réaliser. Le débutant coche ses
        avancées, à son rythme.
      </p>
      <button className="text-btn" onClick={() => void load()}>
        Actualiser les listes
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p>Chargement…</p>
      ) : !lists.length ? (
        <p>
          Ta liste sera disponible dès qu’une demande de parrainage aura été
          acceptée.
        </p>
      ) : (
        <>
          <label className="todo-selector">
            Mon binôme
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.partner_name} ·{" "}
                  {l.status === "active" ? "En cours" : "Terminé"}
                </option>
              ))}
            </select>
          </label>
          {list && <TaskList key={list.id} list={list} reload={load} />}
        </>
      )}
    </section>
  );
}
function TaskList({
  list,
  reload,
}: {
  list: List;
  reload: () => Promise<void>;
}) {
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const writable = list.status === "active" && !Number(list.blocked);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", { pairId: list.id, body });
      setBody("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="todo-list">
      <div className="todo-progress-heading">
        <h3>Avec {list.partner_name}</h3>
        <strong>{list.progress} %</strong>
      </div>
      <progress
        className="todo-progress"
        value={list.progress}
        max={100}
        aria-label={`Progression des tâches avec ${list.partner_name}`}
      />
      <p className="small-text" aria-live="polite">
        {list.completed} tâche(s) terminée(s) sur {list.total}
        {list.total > 0 && list.progress === 100
          ? " · Bravo, tout est fait !"
          : ""}
      </p>
      {!writable && (
        <p>
          Cette liste est conservée en lecture seule
          {list.status === "completed"
            ? " : l’accompagnement est terminé."
            : "."}
        </p>
      )}
      {list.side === "mentor" && writable && (
        <form className="todo-add" onSubmit={add}>
          <label>
            Nouvelle tâche ou amélioration
            <textarea
              required
              maxLength={1000}
              value={body}
              disabled={busy}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ex. Refaire les photos de tes trois annonces les plus anciennes à la lumière naturelle."
            />
          </label>
          <button className="btn" disabled={busy || !body.trim()}>
            <Plus size={18} />
            {busy ? "Ajout…" : "Ajouter la tâche"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {list.tasks.length ? (
        <ul className="todo-items">
          {list.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              mentor={list.side === "mentor"}
              writable={writable}
              reload={reload}
            />
          ))}
        </ul>
      ) : (
        <p>
          {list.side === "mentor"
            ? "Ajoute une première action pour guider ton débutant."
            : "Ton parrain n’a pas encore ajouté de tâche."}
        </p>
      )}
    </div>
  );
}
function TaskRow({
  task,
  mentor,
  writable,
  reload,
}: {
  task: Task;
  mentor: boolean;
  writable: boolean;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(task.body),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(method: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(method, data);
      setEditing(false);
      setDeleting(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className={`todo-item ${task.done ? "is-done" : ""}`}>
      {editing && writable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change("PATCH", { id: task.id, body: draft });
          }}
        >
          <label>
            Modifier la tâche
            <textarea
              required
              maxLength={1000}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div className="pair-actions">
            <button className="btn" disabled={busy || !draft.trim()}>
              Enregistrer
            </button>
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="todo-item-main">
          <label>
            <input
              type="checkbox"
              checked={task.done}
              disabled={busy || mentor || !writable}
              onChange={(e) =>
                void change("PATCH", { id: task.id, done: e.target.checked })
              }
            />
            <span>{task.body}</span>
          </label>
          {mentor && writable && (
            <div className="todo-item-actions">
              <button
                className="text-btn"
                aria-label="Modifier la tâche"
                disabled={busy}
                onClick={() => {
                  setDraft(task.body);
                  setEditing(true);
                  setDeleting(false);
                }}
              >
                <Pencil size={18} />
              </button>
              <button
                className="text-btn"
                aria-label="Supprimer la tâche"
                disabled={busy}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      )}
      {deleting && writable && (
        <div>
          <p>Supprimer cette tâche de la liste ?</p>
          <div className="pair-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => void change("DELETE", { id: task.id })}
            >
              Confirmer la suppression
            </button>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
