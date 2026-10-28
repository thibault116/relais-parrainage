"use client";
import { t as translateUi, locale } from "@/app/components/language";
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
        {translateUi("Membre depuis")}{" "}
        {translateUi(
          p.memberSince ? (
            <time dateTime={p.memberSince}>
              {translateUi("le ")}
              {translateUi(frenchDate(p.memberSince, locale()))}
            </time>
          ) : (
            "une date non renseignée"
          ),
        )}
      </p>
      <p>
        {translateUi("Derni\u00E8re activit\u00E9 :")}{" "}
        {translateUi(
          p.lastActiveAt ? (
            <time
              dateTime={p.lastActiveAt}
              title={translateUi(
                new Date(p.lastActiveAt).toLocaleString(locale()),
              )}
            >
              {translateUi(
                elapsedLabel(p.lastActiveAt, now, "activity", locale()),
              )}
            </time>
          ) : (
            "pas encore enregistrée"
          ),
        )}
      </p>
      {p.availableSince ? (
        <p>
          {translateUi(
            p.role === "mentor" ? "Place disponible" : "Cherche un parrain",
          )}{" "}
          <time dateTime={p.availableSince}>
            {translateUi(
              elapsedLabel(p.availableSince, now, "since", locale()),
            )}
          </time>
        </p>
      ) : (
        <p>
          {translateUi(
            p.role === "mentor" ? "Aucune place disponible" : "Déjà accompagné",
          )}
        </p>
      )}
    </div>
  );
}
export function AvailabilityBadge({ profile: p }: { profile: PublicProfile }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, p.capacity - (p.activeCount ?? 0));
  const mentor = p.role === "mentor";
  return (
    <span
      className={`badge availability-badge ${mentor && remaining ? "green" : ""}`}
    >
      <strong>
        {translateUi(
          mentor
            ? locale() === "en-GB"
              ? `${remaining} place${remaining !== 1 ? "s" : ""} available`
              : `${remaining} place${remaining > 1 ? "s" : ""} libre${remaining > 1 ? "s" : ""}`
            : "Débutant",
        )}
      </strong>
      {translateUi(
        p.availableSince && (!mentor || remaining > 0) && (
          <small>
            {translateUi(mentor ? "Place disponible" : "Cherche un parrain")}{" "}
            <time dateTime={p.availableSince}>
              {translateUi(
                elapsedLabel(p.availableSince, now, "since", locale()),
              )}
            </time>
          </small>
        ),
      )}
    </span>
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
