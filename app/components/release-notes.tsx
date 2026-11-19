"use client";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { Sparkles } from "lucide-react";
import { memberRelease, retiredMemberReleaseIds } from "@/lib/member-release";
import { t } from "./language";
const storageKey = "mentora-member-release";
export function ReleaseNotes() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (isPending || !userId) {
      dialog.current?.close();
      return;
    }
    let seen = false;
    try {
      const stored = localStorage.getItem(storageKey);
      seen =
        stored === memberRelease.id ||
        retiredMemberReleaseIds.includes(stored || "");
      if (retiredMemberReleaseIds.includes(stored || ""))
        localStorage.setItem(storageKey, memberRelease.id);
    } catch {
      /* Optional storage. */
    }
    if (!seen && !dialog.current?.open) dialog.current?.showModal();
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue === memberRelease.id)
        dialog.current?.close();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [isPending, userId]);
  function acknowledge() {
    try {
      localStorage.setItem(storageKey, memberRelease.id);
    } catch {
      /* Still allow access. */
    }
    dialog.current?.close();
  }
  return (
    <dialog
      ref={dialog}
      className="release-notes"
      aria-labelledby="release-title"
      onCancel={(e) => e.preventDefault()}
    >
      <Sparkles size={28} aria-hidden="true" />
      <h2 id="release-title">{t(memberRelease.title)}</h2>
      <ul>
        {memberRelease.notes.map((note) => (
          <li key={note}>{t(note)}</li>
        ))}
      </ul>
      <a href={memberRelease.guideUrl} onClick={acknowledge}>
        {t(memberRelease.guideLabel)}
      </a>
      <button type="button" className="btn" onClick={acknowledge} autoFocus>
        {t("C’est noté")}
      </button>
    </dialog>
  );
}
