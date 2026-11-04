"use client";
import { useEffect, useState } from "react";
import {
  monthLabel,
  publicAnswers,
  type Onboarding,
  type PublicOnboarding,
} from "@/lib/onboarding-schema";
export function OnboardingSummary({
  data,
  profileId,
}: {
  data?: PublicOnboarding;
  profileId?: string;
}) {
  if (!data) return null;
  const money = (v: number) =>
    v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  return (
    <section className="verification-panel">
      <h3>Parcours et accompagnement</h3>
      <p>
        <strong>Catégories :</strong>{" "}
        {data.categories
          .map((c) => (c === "Autre" ? data.categoryOther : c))
          .join(" · ")}
      </p>
      {data.role === "mentor" ? (
        <>
          <p>
            <strong>Depuis :</strong> {monthLabel(data.started)}
          </p>
          <p>
            <strong>Record mensuel :</strong> {money(data.record)}
          </p>
          <p>
            <strong>Plateformes :</strong> {data.platforms}
          </p>
          <p>
            <strong>Marques et références testées :</strong> {data.brands}
          </p>
          {data.specialtyOther && (
            <p>
              <strong>Autre spécialité :</strong> {data.specialtyOther}
            </p>
          )}
          <p>
            <strong>Activité :</strong>{" "}
            {data.model === "Autre" ? data.modelOther : data.model}
          </p>
          <p>
            <strong>Accompagne :</strong> {data.audience.join(" · ")}
          </p>
          <p>
            <strong>Appels :</strong> {data.calls ? "Oui" : "Non"}
          </p>
          <h4>Sa plus belle réussite</h4>
          {data.flexText && (
            <p style={{ whiteSpace: "pre-wrap" }}>{data.flexText}</p>
          )}
          {data.hasFlexImage && profileId && (
            <img
              src={"/api/profile-flex?id=" + profileId}
              alt="Réussite partagée par ce parrain"
              loading="lazy"
              style={{
                maxWidth: "100%",
                maxHeight: 360,
                objectFit: "contain",
                borderRadius: 12,
              }}
            />
          )}
        </>
      ) : (
        <>
          <p>
            <strong>Niveau et expérience :</strong> {data.experienceText}
          </p>
          <p>
            <strong>Objectifs :</strong> {data.objectives}
          </p>
          <p>
            <strong>Principal blocage :</strong> {data.blocker}
          </p>
          <p>
            <strong>Accompagnement :</strong>{" "}
            {data.support
              .map((s) => (s === "Autre" ? data.supportOther : s))
              .join(" · ")}
          </p>
          <p>
            <strong>Échange préféré :</strong> {data.exchange}
          </p>
          <p>
            <strong>Trésorerie disponible :</strong> {money(data.cash)}
          </p>
        </>
      )}
    </section>
  );
}
export function AdminOnboarding() {
  const [page, setPage] = useState(0),
    [items, setItems] = useState<
      { name: string; userId: string; answers: Onboarding }[]
    >([]),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/onboarding?page=" + page, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          setItems(d.items);
          setMore(d.hasMore);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page]);
  return (
    <section className="verification-panel">
      <h2>Questionnaires d’inscription</h2>
      <p>
        Les captures sont privées. Vérifie les mois et les quatre indicateurs
        avant d’attribuer le badge dans le dossier de vérification habituel.
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((item) => (
        <details key={item.userId}>
          <summary>
            {item.name} ·{" "}
            {item.answers.role === "mentor" ? "Parrain" : "Débutant"}
          </summary>
          <OnboardingSummary data={publicAnswers(item.answers)} />
          {item.answers.role === "mentor" && (
            <>
              {item.answers.months.map((m) => (
                <p key={m.month}>
                  {monthLabel(m.month)} :{" "}
                  {m.files.map((id, i) => (
                    <a
                      key={id}
                      href={"/api/verification-files?id=" + id}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginRight: 12 }}
                    >
                      Capture {i + 1}
                    </a>
                  ))}
                </p>
              ))}
              {item.answers.flexFile && (
                <a
                  href={"/api/verification-files?id=" + item.answers.flexFile}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Image de sa réussite
                </a>
              )}
            </>
          )}
        </details>
      ))}
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </button>
        <span>Page {page + 1}</span>
        <button disabled={!more} onClick={() => setPage((p) => p + 1)}>
          Suivant
        </button>
      </div>
    </section>
  );
}
