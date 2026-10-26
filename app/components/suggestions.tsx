"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lightbulb, X, Paperclip } from "lucide-react";
import { usePlatformSettings } from "./platform-settings";
import { authClient } from "@/lib/auth-client";
export function SuggestionWidget() {
  const { suggestionsEnabled } = usePlatformSettings();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null),
    requestId = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("textarea,button")?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      previous?.focus();
    };
  }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      if (file && file.size > 4 * 1024 * 1024)
        throw Error("La pièce jointe doit faire au maximum 4 Mo.");
      requestId.current ||= crypto.randomUUID();
      const form = new FormData();
      form.append("id", requestId.current);
      form.append("message", message);
      const page = location.hash.slice(1);
      form.append(
        "page",
        [
          "home",
          "directory",
          "guide",
          "faq",
          "profile",
          "moderation",
          "help",
        ].includes(page)
          ? page
          : "home",
      );
      if (file) form.append("file", file);
      const r = await fetch("/api/suggestions", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSent(true);
      setMessage("");
      setFile(null);
      requestId.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!suggestionsEnabled) return null;
  return (
    <>
      <button
        ref={launcher}
        className="suggestion-launcher"
        aria-label={open ? "Fermer les suggestions" : "Proposer une idée"}
        aria-expanded={open}
        aria-controls="suggestion-dialog"
        title="Proposer une idée"
        onClick={() => {
          setOpen((v) => !v);
          setSent(false);
        }}
      >
        {open ? <X size={20} /> : <Lightbulb size={21} />}
      </button>
      {open && (
        <div
          className="suggestion-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={panel}
            id="suggestion-dialog"
            className="suggestion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-title"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),textarea:not(:disabled)",
              );
              if (!nodes.length) return;
              if (e.shiftKey && document.activeElement === nodes[0]) {
                e.preventDefault();
                nodes[nodes.length - 1].focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === nodes[nodes.length - 1]
              ) {
                e.preventDefault();
                nodes[0].focus();
              }
            }}
          >
            <button
              className="suggestion-close"
              aria-label="Fermer la fenêtre de suggestion"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            <h2 id="suggestion-title">
              <Lightbulb size={22} /> Une idée pour Mentora ?
            </h2>
            {sent ? (
              <p role="status">
                Merci ! Ta suggestion a été envoyée à l’administration.
              </p>
            ) : (
              <form onSubmit={submit}>
                <p>Une amélioration, une idée ou un souci ? Écris-nous.</p>
                <label>
                  Ta suggestion
                  <textarea
                    required
                    minLength={5}
                    maxLength={5000}
                    value={message}
                    disabled={busy}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ce qui m’aiderait, ce serait…"
                  />
                </label>
                <label className="suggestion-file">
                  <Paperclip size={17} /> Ajouter une photo ou un fichier
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setError("");
                    }}
                  />
                </label>
                <small>
                  Une image ou un PDF, 4 Mo maximum. Visible uniquement par
                  l’administration.
                </small>
                {file && (
                  <p className="suggestion-filename">
                    {file.name}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setFile(null);
                        const input =
                          panel.current?.querySelector<HTMLInputElement>(
                            "input[type=file]",
                          );
                        if (input) input.value = "";
                      }}
                    >
                      Retirer
                    </button>
                  </p>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {session ? (
                  <button className="btn" disabled={busy}>
                    {busy ? "Envoi…" : "Envoyer ma suggestion"}
                  </button>
                ) : (
                  <>
                    <p>Connecte-toi pour envoyer ta suggestion.</p>
                    <button
                      className="btn"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(new Event("mentora-login"));
                      }}
                    >
                      Se connecter
                    </button>
                  </>
                )}
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
type Suggestion = {
  id: string;
  message: string;
  page: string;
  status: "new" | "reviewed";
  created_at: string;
  name: string;
  email: string;
  attachment: { name: string; size: number } | null;
};
export function AdminSuggestions() {
  const [items, setItems] = useState<Suggestion[]>([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    fetch("/api/suggestions?page=" + page, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) {
          setItems(d.items);
          setTotal(d.total);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, reload]);
  async function mark(s: Suggestion) {
    setBusy(s.id);
    setError("");
    try {
      const r = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          status: s.status === "new" ? "reviewed" : "new",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setReload((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <h2>Suggestions des membres</h2>
      <p>
        {total} suggestion{total === 1 ? "" : "s"} · Les nouvelles sont
        affichées en premier.
      </p>
      <button className="text-btn" onClick={() => setReload((v) => v + 1)}>
        Actualiser les suggestions
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Chargement…</p>
      ) : !items.length ? (
        <p>Aucune suggestion pour le moment.</p>
      ) : (
        items.map((s) => (
          <article className="verification-panel" key={s.id}>
            <span className="badge">
              {s.status === "new" ? "Nouvelle" : "Examinée"}
            </span>
            <h3>{s.name || "Ancien membre"}</h3>
            <p>
              {s.email} · {new Date(s.created_at).toLocaleString("fr-FR")} ·
              Page :{" "}
              {(
                {
                  home: "Accueil",
                  directory: "Trouver mon binôme",
                  guide: "Comment ça marche",
                  faq: "FAQ",
                  profile: "Mon profil",
                  moderation: "Administration",
                  help: "Aide",
                } as Record<string, string>
              )[s.page] || "Accueil"}
            </p>
            <p className="suggestion-message">{s.message}</p>
            {s.attachment && (
              <p>
                <a
                  href={"/api/suggestions?file=" + s.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Télécharger : {s.attachment.name}
                </a>{" "}
                ({Math.ceil(s.attachment.size / 1024)} Ko)
              </p>
            )}
            <button
              className="btn secondary"
              disabled={!!busy}
              onClick={() => void mark(s)}
            >
              {busy === s.id
                ? "Enregistrement…"
                : s.status === "new"
                  ? "Marquer comme examinée"
                  : "Remettre dans les nouvelles"}
            </button>
          </article>
        ))
      )}
      {total > 30 && (
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage((v) => v - 1)}>
            Précédent
          </button>
          <span>Page {page + 1}</span>
          <button
            disabled={(page + 1) * 30 >= total}
            onClick={() => setPage((v) => v + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </section>
  );
}
