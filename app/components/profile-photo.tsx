"use client";
import { useState } from "react";
import type { PublicProfile } from "@/lib/profile";
export function Avatar({ profile }: { profile: PublicProfile }) {
  const [failed, setFailed] = useState("");
  return (
    <div className={`avatar ${profile.role === "beginner" ? "peach" : ""}`}>
      {profile.photo && failed !== profile.photo ? (
        <img
          src={profile.photo}
          alt={`Photo de ${profile.name}`}
          onError={() => setFailed(profile.photo!)}
        />
      ) : (
        profile.name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
export function ProfilePhoto({
  profile,
  onChange,
}: {
  profile: PublicProfile;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(file?: File) {
    setBusy(true);
    setError("");
    try {
      let body: FormData | undefined;
      if (file) {
        if (file.size > 20 * 1024 * 1024)
          throw Error("Choisis une photo de moins de 20 Mo.");
        const bitmap = await createImageBitmap(file).catch(() => {
          throw Error(
            "Cette image ne peut pas être ouverte. Choisis une photo JPEG, PNG ou WebP.",
          );
        });
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 512, 512);
        const side = Math.min(bitmap.width, bitmap.height);
        ctx.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          512,
          512,
        );
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(Error("Photo illisible."))),
            "image/jpeg",
            0.88,
          ),
        );
        body = new FormData();
        body.append("file", blob, "profil.jpg");
      }
      const r = await fetch("/api/profile-photo", {
        method: file ? "POST" : "DELETE",
        body,
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="photo-editor">
      <Avatar profile={profile} />
      <div>
        <h2>Ma photo de profil</h2>
        <p>
          Elle apparaît sur ta carte et ta fiche. La photo est recadrée au
          centre en carré.
        </p>
        <label className="btn secondary">
          {busy
            ? "Enregistrement…"
            : profile.photo
              ? "Changer ma photo"
              : "Ajouter une photo"}
          <input
            aria-label="Choisir ma photo de profil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void change(f);
              e.target.value = "";
            }}
          />
        </label>
        {profile.photo && (
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => void change()}
          >
            Retirer ma photo
          </button>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
