"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DecisionForm({ id, hasEmail }: { id: string; hasEmail: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const decision = new FormData(event.currentTarget).get("decision");
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/legal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", id, decision }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      router.refresh();
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="legal-form" onSubmit={submit}>
      <label>Décision motivée
        <textarea name="decision" required minLength={15} maxLength={3000} rows={4} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy}>
        {hasEmail ? "Enregistrer et transmettre la décision" : "Enregistrer la décision"}
      </button>
    </form>
  );
}
