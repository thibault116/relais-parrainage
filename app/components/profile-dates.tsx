"use client";
import { useEffect, useState } from "react";
import { type PublicProfile } from "@/lib/profile";
import { frenchDate, elapsedLabel } from "@/lib/profile-dates";
export function ProfileDates({ profile: p }: { profile: PublicProfile }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="profile-dates">
      <p>
        Membre depuis{" "}
        {p.memberSince ? (
          <time dateTime={p.memberSince}>le {frenchDate(p.memberSince)}</time>
        ) : (
          "une date non renseignée"
        )}
      </p>
      <p>
        Dernière activité :{" "}
        {p.lastActiveAt ? (
          <time
            dateTime={p.lastActiveAt}
            title={new Date(p.lastActiveAt).toLocaleString("fr-FR")}
          >
            {elapsedLabel(p.lastActiveAt, now, "activity")}
          </time>
        ) : (
          "pas encore enregistrée"
        )}
      </p>
      {p.availableSince ? (
        <p>
          {p.role === "mentor" ? "Place disponible" : "Cherche un parrain"}{" "}
          <time dateTime={p.availableSince}>
            {elapsedLabel(p.availableSince, now, "since")}
          </time>
        </p>
      ) : (
        <p>
          {p.role === "mentor" ? "Aucune place disponible" : "Déjà accompagné"}
        </p>
      )}
    </div>
  );
}
export function ActivityTracker({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) return;
    const ping = () => {
      if (document.visibilityState === "visible")
        void fetch("/api/activity", { method: "POST" }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 60000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [userId]);
  return null;
}
