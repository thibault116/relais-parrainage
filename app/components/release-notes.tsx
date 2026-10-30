"use client";
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { memberRelease } from "@/lib/member-release";
import { t } from "./language";
const storageKey = "mentora-member-release";
export function ReleaseNotes() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === memberRelease.id; } catch { /* Optional storage. */ }
    if (!seen && !dialog.current?.open) dialog.current?.showModal();
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue === memberRelease.id) dialog.current?.close();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function acknowledge() {
    try { localStorage.setItem(storageKey, memberRelease.id); } catch { /* Still allow access. */ }
    dialog.current?.close();
  }
  return <dialog ref={dialog} className="release-notes" aria-labelledby="release-title" onCancel={e => e.preventDefault()}>
    <Sparkles size={28} aria-hidden="true" />
    <h2 id="release-title">{t(memberRelease.title)}</h2>
    <ul>{memberRelease.notes.map(note => <li key={note}>{t(note)}</li>)}</ul>
    <a href={memberRelease.guideUrl} onClick={acknowledge}>{t("Installer Mentora et activer les notifications →")}</a>
    <button type="button" className="btn" onClick={acknowledge} autoFocus>{t("C’est noté")}</button>
  </dialog>;
}
