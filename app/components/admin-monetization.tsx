"use client";
import {
  Crown,
  Coins,
  Wallet,
  BarChart3,
  ClipboardList,
  Plus,
  ChevronRight,
  CreditCard,
  FileText,
  CircleX,
  ArrowDownToLine,
  Check,
  MoreHorizontal,
  Rocket,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import type { serviceSchema } from "@/lib/monetization/store";
import type { z } from "zod";
import { annualPrice, customCreditsPrice, maxCustomCredits, type plans, type packs } from "@/lib/monetization/catalog";
type Service = z.infer<typeof serviceSchema>;
type Booking = {
  id: string;
  snapshot: Service;
  credits: number;
  payout_cents: number;
  status: string;
  notes: string;
  slot: string;
};
type Data = {
  plans: typeof plans;
  packs: typeof packs;
  comparison: { label: string; values: string[] }[];
  configured: boolean;
  payoutRate: number;
  balance: number;
  account: { plan: string; status: string; cancel_at_end: number };
  services: { id: string; data: Service }[];
  bookings: Booking[];
  ledger: { delta: number; kind: string; created_at: string }[];
  payments: {
    id: string;
    amount: number;
    credits: number;
    refund_amount: number;
    invoice_url: string | null;
    created_at: string;
  }[];
};
const euro = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const blank: Service = {
  title: "",
  description: "",
  category: "Autre",
  duration: 0,
  calls: 0,
  followup: "",
  availability: "À convenir",
  credits: 12,
  capacity: 5,
  published: false,
};
const status: Record<string, string> = {
  reserved: "À accepter",
  accepted: "Acceptée",
  completed: "Terminée · rémunération due",
  cancelled: "Annulée",
  declined: "Refusée",
  refunded: "Crédits restitués",
};
export function AdminMonetization({
  initialTab = "plans",
  dedicated = false,
}: {
  initialTab?: string;
  dedicated?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState(initialTab),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [form, setForm] = useState<Service>(blank),
    [editId, setEditId] = useState<string | undefined>(),
    [selected, setSelected] = useState<string | null>(null),
    [notes, setNotes] = useState(""),
    [slot, setSlot] = useState("");
  const [billing, setBilling] = useState<any>(null);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [panel, setPanel] = useState("");
  const creditDialog = useRef<HTMLDialogElement>(null);
  const [customCredits, setCustomCredits] = useState("");
  const [simulatedCredits, setSimulatedCredits] = useState(12);
  const [simulationStep, setSimulationStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [serviceMenu, setServiceMenu] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/monetization", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      window.dispatchEvent(new Event("mentora-billing-updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  const loadBilling = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/monetization/billing", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setBilling(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (tab !== "plans") return;
    void loadBilling();
    const refresh = () => void loadBilling();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [tab, loadBilling]);
  async function send(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/monetization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            returnTo: dedicated
              ? tab === "wallet"
                ? "credits"
                : "billing"
              : "admin",
          }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.url) {
        window.location.assign(d.url);
        return true;
      }
      setMessage(d.message || "Enregistré dans ton espace de test.");
      await load();
      if (tab === "plans") await loadBilling();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof Service>(key: K, value: Service[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  if (!data)
    return <p role="status">{error || "Chargement du système privé…"}</p>;
  const annual = billing?.period === "year";
  if (
    dedicated &&
    !editing &&
    ["plans", "wallet", "payouts", "services"].includes(tab)
  ) {
    const current =
      data.plans.find((p) => p.id === data.account.plan) || data.plans[0];
    const completed = data.bookings.filter((b) => b.status === "completed");
    const customPrice = customCreditsPrice(Number(customCredits));
    const due = completed.reduce((n, b) => n + b.payout_cents, 0);
    const toggle = (name: string) => setPanel(panel === name ? "" : name);
    const row = (
      label: string,
      Icon: typeof Crown,
      action: () => void,
      danger = false,
    ) => (
      <button
        type="button"
        className={`commerce-row ${danger ? "danger" : ""}`}
        onClick={action}
        disabled={busy}
      >
        <Icon size={21} />
        <span>{label}</span>
        <ChevronRight size={17} />
      </button>
    );
    const portal = () => void send({ action: "portal" });
    const invoices = (
      <div className="commerce-history">
        {billing?.invoices?.length ? (
          billing.invoices.map((i: any) => (
            <article key={i.id}>
              <span>
                {i.number || "Facture"}
                <small>
                  {new Date(i.date * 1000).toLocaleDateString("fr-FR")}
                </small>
              </span>
              <strong>{euro(i.amount)}</strong>
              {i.url && (
                <a href={i.url} target="_blank" rel="noreferrer">
                  Voir
                </a>
              )}
              {i.pdf && (
                <a href={i.pdf} target="_blank" rel="noreferrer">
                  PDF
                </a>
              )}
            </article>
          ))
        ) : (
          <p>Aucune facture disponible.</p>
        )}
        {row("Historique complet sur Stripe", FileText, portal)}
      </div>
    );
    return (
      <section className="commerce-page">
        <header className="commerce-heading">
          <h1>
            {
              {
                plans: "Mon abonnement",
                wallet: "Mes crédits",
                payouts: "Ma rémunération",
                services: "Mes prestations",
              }[tab]
            }
          </h1>
          <p>
            {
              {
                plans: "Gère ton offre et ta facturation.",
                wallet:
                  "Utilise tes crédits pour réserver des prestations et des accompagnements.",
                payouts:
                  "Suis tes prestations réalisées et tes rémunérations dues.",
                services: "Gère les prestations que tu proposes aux membres.",
              }[tab]
            }
          </p>
        </header>
        <span className="commerce-test">TEST PRIVÉ · Aucun paiement réel</span>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {tab === "plans" && (
          <>
            <article className="commerce-card commerce-plan">
              <div className="commerce-plan-top">
                <Crown />
                <div>
                  <h2>Offre {current.name}</h2>
                  <p>{euro(annual ? annualPrice(current.cents) : current.cents)} / {annual ? "an" : "mois"}</p>
                </div>
                <span className="commerce-pill">
                  {data.account.cancel_at_end
                    ? "Fin programmée"
                    : data.account.status === "active"
                      ? "Actif"
                      : current.id === "free"
                        ? "Gratuit"
                        : "À vérifier"}
                </span>
              </div>
              <ul className="commerce-benefits">
                <li>
                  <Check />
                  {annual ? current.credits * 12 : current.credits} crédits par {annual ? "an" : "mois"}
                </li>
                {data.comparison
                  .filter((r) =>
                    [
                      "Accès à la communauté",
                      "Messagerie",
                      "Espaces d’accompagnement simultanés",
                    ].includes(r.label),
                  )
                  .map((r) => (
                    <li key={r.label}>
                      <Check />
                      {r.label} ·{" "}
                      {
                        r.values[
                          data.plans.findIndex((p) => p.id === current.id)
                        ]
                      }
                    </li>
                  ))}
              </ul>
              {billing?.renewal && (
                <small>
                  {data.account.cancel_at_end
                    ? "Fin le "
                    : "Renouvellement le "}
                  {new Date(billing.renewal * 1000).toLocaleDateString("fr-FR")}
                </small>
              )}
              {billing?.pendingPlan && (
                <p className="commerce-upcoming">
                  Prochaine offre : {billing.pendingPlan}
                </p>
              )}
            </article>
            <button
              className="commerce-primary"
              disabled={busy}
              onClick={() => toggle("offers")}
            >
              <Crown size={19} />
              Changer d’offre
            </button>
            {panel === "offers" && (
              <section className="commerce-offers">
                <h2>Choisis ton prochain cap</h2>
                <p>
                  Formules {annual ? "annuelles" : "mensuelles"} · changement au prochain renouvellement.
                </p>
                {data.plans.map((p) => (
                  <article
                    className={`commerce-card ${current.id === p.id ? "chosen" : ""}`}
                    key={p.id}
                  >
                    <div className="commerce-plan-top">
                      <Crown />
                      <h3>{p.name}</h3>
                      <strong>
                        {euro(annual ? annualPrice(p.cents) : p.cents)}
                        <small>/{annual ? "an" : "mois"}</small>
                      </strong>
                    </div>
                    <p>{annual ? p.credits * 12 : p.credits} crédits par {annual ? "an" : "mois"}</p>
                    <details>
                      <summary>Fonctionnalités incluses</summary>
                      <ul>
                        {data.comparison.map((r) => (
                          <li key={r.label}>
                            {r.label} :{" "}
                            {
                              r.values[
                                data.plans.findIndex((x) => x.id === p.id)
                              ]
                            }
                          </li>
                        ))}
                      </ul>
                    </details>
                    {p.id === current.id ? (
                      <span className="commerce-pill">Offre actuelle</span>
                    ) : p.cents > 0 ? (
                      <button
                        className="commerce-primary"
                        disabled={
                          busy ||
                          !data.configured ||
                          !!data.account.cancel_at_end
                        }
                        onClick={() => {
                          const active = ["active", "trialing"].includes(
                            data.account.status,
                          );
                          if (
                            !active ||
                            window.confirm(
                              `Passer à ${p.name} au prochain renouvellement pour ${euro(annual ? annualPrice(p.cents) : p.cents)} / ${annual ? "an" : "mois"} ?`,
                            )
                          )
                            void send(
                              active
                                ? { action: "change-plan", plan: p.id }
                                : {
                                    action: "checkout",
                                    offer: p.id,
                                    key: crypto.randomUUID(),
                                  },
                            );
                        }}
                      >
                        Choisir {p.name}
                      </button>
                    ) : (
                      <p>
                        Le retour à Free se fait en résiliant ton abonnement.
                      </p>
                    )}
                  </article>
                ))}
              </section>
            )}
            <div className="commerce-links">
              {row("Gérer ma carte", CreditCard, portal)}
              {billing?.card && (
                <small className="commerce-card-hint">
                  {billing.card.brand} •••• {billing.card.last4} ·{" "}
                  {billing.card.month}/{billing.card.year}
                </small>
              )}
              {row("Voir mes factures", FileText, () => toggle("invoices"))}
              {["active", "trialing"].includes(data.account.status) &&
                row(
                  data.account.cancel_at_end
                    ? "Reprendre mon abonnement"
                    : "Résilier mon abonnement",
                  CircleX,
                  () => {
                    if (
                      window.confirm(
                        data.account.cancel_at_end
                          ? "Reprendre le renouvellement test ?"
                          : "Résilier à la fin de la période et annuler tout changement programmé ?",
                      )
                    )
                      void send({
                        action: data.account.cancel_at_end
                          ? "resume-subscription"
                          : "cancel-subscription",
                      });
                  },
                  !data.account.cancel_at_end,
                )}
            </div>
            {panel === "invoices" && invoices}
          </>
        )}
        {tab === "wallet" && (
          <>
            <article className="commerce-card commerce-balance">
              <Coins size={38} />
              <strong>{data.balance} crédits</strong>
              <span>Solde disponible</span>
            </article>
            <button
              className="commerce-primary"
              onClick={() => {
                setError("");
                creditDialog.current?.showModal();
              }}
            >
              <Plus />
              Acheter des crédits
            </button>
            {row("Historique des crédits", FileText, () => toggle("credits"))}
            {panel === "credits" && (
              <div className="commerce-history">
                {data.ledger.length ? (
                  data.ledger.map((l, i) => (
                    <article key={i}>
                      <span>
                        {l.kind}
                        <small>
                          {new Date(l.created_at).toLocaleDateString("fr-FR")}
                        </small>
                      </span>
                      <strong>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </strong>
                    </article>
                  ))
                ) : (
                  <p>Aucun mouvement.</p>
                )}
              </div>
            )}
            <dialog ref={creditDialog} className="commerce-dialog" aria-labelledby="credit-dialog-title">
              <div className="commerce-plan-top">
                <h2 id="credit-dialog-title">Acheter des crédits</h2>
                <button className="commerce-icon" aria-label="Fermer" onClick={() => creditDialog.current?.close()}>
                  <CircleX />
                </button>
              </div>
              <p>Paiement Stripe en mode test</p>
              {!data.configured && <p>Stripe test est indisponible.</p>}
              {error && <p role="alert">{error}</p>}
              <div className="commerce-packs">
                {data.packs.map((p) => (
                  <button
                    key={p.id}
                    className="commerce-card commerce-pack"
                    disabled={busy || !data.configured}
                    onClick={() => void send({ action: "checkout", offer: p.id, key: crypto.randomUUID() })}
                  >
                    <Coins />
                    <strong>{p.credits} crédits</strong>
                    <span>{euro(p.cents)}</span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
              <form className="commerce-custom-credits" onSubmit={(event) => {
                event.preventDefault();
                if (customPrice !== null)
                  void send({ action: "checkout", credits: Number(customCredits), key: crypto.randomUUID() });
              }}>
                <label>
                  Quantité personnalisée
                  <input type="number" min={1} max={maxCustomCredits} step={1} required
                    value={customCredits} onChange={(event) => setCustomCredits(event.target.value)} />
                </label>
                <button className="commerce-primary" disabled={busy || !data.configured || customPrice === null}>
                  {customPrice === null ? "Choisir une quantité" : `Payer ${euro(customPrice)}`}
                </button>
              </form>
            </dialog>
            <small className="commerce-footnote">
              Les crédits restent personnels, sans transfert ni conversion en
              argent.
            </small>
          </>
        )}
        {tab === "payouts" && (
          <>
            <article className="commerce-card commerce-balance">
              <div className="commerce-plan-top">
                <Wallet />
                <span>Rémunération due</span>
              </div>
              <strong>{euro(due)}</strong>
              <button className="commerce-primary" disabled>
                <ArrowDownToLine />
                Retraits non activés
              </button>
              <small>Simulation · aucun versement réel</small>
            </article>
            <section className="commerce-card commerce-simulation">
              <h2>Simuler une rémunération</h2>
              <p>Exemple séparé de ton solde. Taux test de {euro(data.payoutRate)} par crédit.</p>
              <label>
                Prix de la prestation en crédits
                <input type="number" min={1} max={1000} step={1} value={simulatedCredits || ""}
                  disabled={simulationStep !== 0}
                  onChange={(event) => setSimulatedCredits(Number(event.target.value))} />
              </label>
              <p aria-live="polite">
                {simulationStep === 0 && `Montant prévu : ${euro(simulatedCredits * data.payoutRate)}.`}
                {simulationStep === 1 && "Prestation réservée. La rémunération sera due une fois la prestation terminée."}
                {simulationStep === 2 && `Prestation terminée. Rémunération simulée due : ${euro(simulatedCredits * data.payoutRate)}.`}
                {simulationStep === 3 && `Versement fictif de ${euro(simulatedCredits * data.payoutRate)} terminé.`}
              </p>
              {simulationStep < 3 && (
                <button className="commerce-primary"
                  disabled={!Number.isInteger(simulatedCredits) || simulatedCredits < 1 || simulatedCredits > 1000}
                  onClick={() => setSimulationStep(simulationStep + 1)}>
                  {["Simuler la réservation", "Terminer la prestation", "Simuler le versement"][simulationStep]}
                </button>
              )}
              {simulationStep > 0 && (
                <button className="commerce-row" onClick={() => setSimulationStep(0)}>Recommencer la simulation</button>
              )}
            </section>
            <div className="commerce-stat-grid">
              <article className="commerce-card">
                <Coins />
                <strong>{completed.reduce((n, b) => n + b.credits, 0)}</strong>
                <span>Crédits des prestations</span>
              </article>
              <article className="commerce-card">
                <Check />
                <strong>{completed.length}</strong>
                <span>Prestations réalisées</span>
              </article>
            </div>
            {row("Historique des rémunérations", BarChart3, () =>
              toggle("earnings"),
            )}
            {panel === "earnings" && (
              <div className="commerce-history">
                {completed.length ? (
                  completed.map((b) => (
                    <article key={b.id}>
                      <span>{b.snapshot.title}</span>
                      <strong>{euro(b.payout_cents)}</strong>
                    </article>
                  ))
                ) : (
                  <p>Aucune prestation terminée.</p>
                )}
              </div>
            )}
            {row("Historique des réservations", ClipboardList, () =>
              toggle("bookings"),
            )}
            {panel === "bookings" && (
              <div className="commerce-history">
                {data.bookings.length ? (
                  data.bookings.map((b) => (
                    <article key={b.id}>
                      <span>
                        {b.snapshot.title}
                        <small>{status[b.status] || b.status}</small>
                      </span>
                      <strong>{b.credits} crédits</strong>
                    </article>
                  ))
                ) : (
                  <p>Aucune réservation.</p>
                )}
              </div>
            )}
            {row("Mes retraits", Wallet, () => toggle("withdrawals"))}
            {panel === "withdrawals" && (
              <div className="commerce-card">
                <p>
                  Aucun retrait. Les virements seront proposés dans une étape
                  distincte après activation et validation du système de
                  rémunération.
                </p>
              </div>
            )}
          </>
        )}
        {tab === "services" && (
          <>
            <button
              className="commerce-primary"
              onClick={() => {
                setForm(blank);
                setEditId(undefined);
                setEditing(true);
              }}
            >
              <Plus />
              Ajouter une prestation
            </button>
            <div className="commerce-services">
              {data.services.length ? (
                data.services.map((s) => (
                  <article className="commerce-card" key={s.id}>
                    <div className="commerce-plan-top">
                      <Rocket />
                      <div>
                        <h2>{s.data.title}</h2>
                      </div>
                      <button
                        className="commerce-icon"
                        aria-label={`Options de ${s.data.title}`}
                        onClick={() =>
                          setServiceMenu(serviceMenu === s.id ? null : s.id)
                        }
                      >
                        <MoreHorizontal />
                      </button>
                    </div>
                    <div className="commerce-service-bottom">
                      <strong>{s.data.credits} crédits</strong>
                      <button
                        role="switch"
                        aria-checked={s.data.published}
                        aria-label={`Publier ${s.data.title}`}
                        className={`commerce-switch ${s.data.published ? "on" : ""}`}
                        disabled={busy}
                        onClick={() =>
                          void send({
                            action: "save",
                            id: s.id,
                            service: {
                              ...s.data,
                              published: !s.data.published,
                            },
                          })
                        }
                      >
                        <span />
                      </button>
                    </div>
                    {serviceMenu === s.id && (
                      <div className="commerce-service-menu">
                        <p>{s.data.description}</p>
                        <p>
                          Rémunération prévue :{" "}
                          {euro(s.data.credits * data.payoutRate)}
                        </p>
                        <button
                          className="commerce-row"
                          onClick={() => {
                            setForm(s.data);
                            setEditId(s.id);
                            setEditing(true);
                          }}
                        >
                          Modifier la prestation
                          <ChevronRight />
                        </button>
                        <button
                          className="commerce-row danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Supprimer cette prestation du catalogue ?",
                              )
                            )
                              void send({ action: "delete", id: s.id });
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <article className="commerce-card">
                  <ClipboardList />
                  <p>Partage ton expérience : crée ta première prestation.</p>
                </article>
              )}
            </div>
          </>
        )}
      </section>
    );
  }
  return (
    <section className="pricing-lab money-lab">
      {dedicated && editing && (
        <button className="commerce-row" onClick={() => setEditing(false)}>
          <ArrowLeft />
          Mes prestations
        </button>
      )}
      <div className="pricing-private">
        <strong>Monétisation · TEST · toi uniquement</strong>
        <span>Aucun encaissement ni versement réel</span>
      </div>
      {!dedicated && (
        <p>
          Tu joues les deux rôles dans cet espace isolé : parrain pour proposer
          et gérer, débutant pour acheter des crédits et réserver.
        </p>
      )}
      {!data.configured && (
        <p role="status">
          Stripe test ou son webhook n’est pas encore configuré. Les paiements
          restent bloqués.
        </p>
      )}
      {!dedicated && (
        <nav className="pricing-switch" aria-label="Monétisation privée">
          {[
            ["plans", "Abonnements"],
            ["wallet", "Portefeuille"],
            ["services", "Prestations · parrain"],
            ["discover", "Réserver · débutant"],
            ["bookings", "Réservations"],
            ["payouts", "Rémunérations"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="money-summary">
        <strong>{data.balance} crédits disponibles</strong>
        <span>
          Offre : {data.account.plan} · {data.account.status}
          {data.account.cancel_at_end ? " · résiliation en fin de période" : ""}
        </span>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Actualiser
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {tab === "plans" && (
        <>
          <h2>
            Mon abonnement ·{" "}
            {data.plans.find((p) => p.id === data.account.plan)?.name || "Free"}
          </h2>
          <section className="money-billing-details">
            <p>
              Moyen de paiement :{" "}
              {billing?.card
                ? `${billing.card.brand} •••• ${billing.card.last4} · ${billing.card.month}/${billing.card.year}`
                : "Aucune carte enregistrée"}
            </p>
            {billing?.renewal && (
              <p>
                {data.account.cancel_at_end
                  ? "Fin de l’abonnement"
                  : "Prochain renouvellement"}{" "}
                : {new Date(billing.renewal * 1000).toLocaleDateString("fr-FR")}
              </p>
            )}
            {billing?.pendingPlan && (
              <p>
                Prochaine formule : {billing.pendingPlan}, au renouvellement.
              </p>
            )}
            <button
              className="btn secondary"
              disabled={busy || !data.configured}
              onClick={() => void send({ action: "portal" })}
            >
              Changer de carte · portail Stripe test
            </button>
            {["active", "trialing"].includes(data.account.status) && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      data.account.cancel_at_end
                        ? "Reprendre le renouvellement de cet abonnement test ?"
                        : "Résilier à la fin de la période et annuler tout changement d’offre programmé ?",
                    )
                  )
                    void send({
                      action: data.account.cancel_at_end
                        ? "resume-subscription"
                        : "cancel-subscription",
                    });
                }}
              >
                {data.account.cancel_at_end
                  ? "Reprendre mon abonnement"
                  : "Résilier mon abonnement"}
              </button>
            )}
          </section>

          <div className="pricing-cards">
            {data.plans.map((p, i) => (
              <article className="pricing-card" key={p.id}>
                <h3>{p.name}</h3>
                <div className="pricing-amount">
                  {euro(annual ? annualPrice(p.cents) : p.cents)}
                  <small>/{annual ? "an" : "mois"}</small>
                </div>
                <p>{annual ? p.credits * 12 : p.credits} crédits par {annual ? "an" : "mois"}</p>
                <ul>
                  {data.comparison.map((row) => (
                    <li key={row.label}>
                      <span>
                        {row.label}
                        <small>{row.values[i]}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                {p.cents > 0 &&
                ["active", "trialing"].includes(data.account.status) ? (
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      !!data.account.cancel_at_end ||
                      data.account.plan === p.id
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          `Passer à ${p.name} (${euro(annual ? annualPrice(p.cents) : p.cents)} / ${annual ? "an" : "mois"}, ${annual ? p.credits * 12 : p.credits} crédits par période) au prochain renouvellement ?`,
                        )
                      )
                        void send({ action: "change-plan", plan: p.id });
                    }}
                  >
                    {data.account.plan === p.id
                      ? "Offre actuelle"
                      : `Passer à ${p.name} au renouvellement`}
                  </button>
                ) : p.cents > 0 ? (
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      !data.configured ||
                      !["free", "canceled", "incomplete_expired"].includes(
                        data.account.status,
                      )
                    }
                    onClick={() =>
                      void send({
                        action: "checkout",
                        offer: p.id,
                        key: crypto.randomUUID(),
                      })
                    }
                  >
                    Tester {p.name} avec Stripe
                  </button>
                ) : (
                  <p>Offre par défaut, sans paiement.</p>
                )}
              </article>
            ))}
          </div>
          <button
            className="btn secondary"
            disabled={busy || !data.configured}
            onClick={() => void send({ action: "portal" })}
          >
            Gérer l’abonnement et les factures test
          </button>
          <p className="pricing-detail">
            Crédits ajoutés uniquement après confirmation Stripe de chaque
            facture payée. Dans cet essai, les crédits se cumulent sans
            expiration. Le changement d’offre prend effet au prochain
            renouvellement, sans débit ni crédit supplémentaire immédiat. Les
            droits actuels des membres restent inchangés.
          </p>
          <h3>Historique des factures</h3>
          {billing?.invoices?.length ? (
            billing.invoices.map((i: any) => (
              <div className="money-row" key={i.id}>
                <span>
                  {i.number || "Facture"}
                  <small>
                    {new Date(i.date * 1000).toLocaleDateString("fr-FR")} ·{" "}
                    {i.status}
                  </small>
                </span>
                <strong>{euro(i.amount)}</strong>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    Consulter
                  </a>
                )}
                {i.pdf && (
                  <a href={i.pdf} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
              </div>
            ))
          ) : (
            <p>Aucune facture pour le moment.</p>
          )}
          <p>
            Les vingt dernières factures sont affichées. Retrouve l’historique
            complet dans le portail Stripe.
          </p>
        </>
      )}
      {tab === "wallet" && (
        <>
          <h3>Recharger avec Stripe test</h3>
          <div className="pricing-pack-grid">
            {data.packs.map((p) => (
              <article key={p.id}>
                <strong>{p.credits} crédits</strong>
                <b>{euro(p.cents)}</b>
                <button
                  className="btn"
                  disabled={busy || !data.configured}
                  onClick={() =>
                    void send({
                      action: "checkout",
                      offer: p.id,
                      key: crypto.randomUUID(),
                    })
                  }
                >
                  Tester la recharge
                </button>
              </article>
            ))}
          </div>
          <p>
            Les crédits restent personnels : aucun transfert ni conversion en
            argent. Un remboursement retire les crédits correspondants ; un
            solde négatif bloque les réservations.
          </p>
          <h3>Historique des crédits</h3>
          {data.ledger.length ? (
            data.ledger.map((l, i) => (
              <div className="money-row" key={i}>
                <span>
                  {l.kind}
                  <small>
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </small>
                </span>
                <strong>
                  {l.delta > 0 ? "+" : ""}
                  {l.delta}
                </strong>
              </div>
            ))
          ) : (
            <p>Aucun mouvement.</p>
          )}
          <h3>Paiements et factures test</h3>
          {data.payments.map((p) => (
            <article className="money-row" key={p.id}>
              <span>
                {euro(p.amount)} · {p.credits} crédits
                <small>Remboursé : {euro(p.refund_amount)}</small>
              </span>
              {p.invoice_url && (
                <a href={p.invoice_url} target="_blank" rel="noreferrer">
                  Facture Stripe
                </a>
              )}
              <button
                className="btn secondary"
                disabled={busy || p.refund_amount >= p.amount}
                onClick={() => {
                  if (
                    window.confirm(
                      "Rembourser entièrement ce paiement TEST et retirer ses crédits ?",
                    )
                  )
                    void send({ action: "refund", id: p.id });
                }}
              >
                Rembourser le paiement test
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "services" && (
        <>
          <h3>{editId ? "Modifier la prestation" : "Créer une prestation"}</h3>
          <form
            className="money-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "save", id: editId, service: form })) {
                setForm(blank);
                setEditId(undefined);
                setEditing(false);
              }
            }}
          >
            <label>
              Titre
              <input
                required
                minLength={4}
                maxLength={100}
                value={form.title}
                onChange={(e) => field("title", e.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                required
                minLength={20}
                maxLength={5000}
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </label>
            <div className="service-credit-fields">
              <label>
                Nombre de crédits
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  value={form.credits || ""}
                  onChange={(e) => field("credits", Number(e.target.value))}
                />
              </label>
              <label>
                Jauge du prix
                <input
                  type="range"
                  min={1}
                  max={200}
                  step={1}
                  value={form.credits <= 100 ? form.credits : 100 + Math.round((form.credits - 100) / 9)}
                  aria-valuetext={`${form.credits} crédits`}
                  onChange={(e) => {
                    const position = Number(e.target.value);
                    field("credits", position <= 100 ? position : 100 + (position - 100) * 9);
                  }}
                />
              </label>
              <small>Un crédit par cran jusqu’à 100. Saisis un montant exact jusqu’à 1 000.</small>
            </div>
            <button className="btn" disabled={busy}>
              Enregistrer
            </button>
            {editId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditId(undefined);
                  setForm(blank);
                }}
              >
                Annuler la modification
              </button>
            )}
          </form>
          {!dedicated && <>
          <h3>Mes prestations</h3>
          {data.services.map((s) => (
            <article className="money-row" key={s.id}>
              <span>
                {s.data.title}
                <small>
                  {s.data.credits} crédits ·{" "}
                  {s.data.published ? "Disponible" : "Brouillon"}
                </small>
              </span>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditId(s.id);
                  setForm(s.data);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Modifier
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => void send({
                  action: "save",
                  id: s.id,
                  service: { ...s.data, published: !s.data.published },
                })}
              >
                {s.data.published ? "Retirer du catalogue" : "Publier dans le catalogue test"}
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Retirer cette prestation du catalogue privé ? Les réservations seront conservées.",
                    )
                  )
                    void send({ action: "delete", id: s.id });
                }}
              >
                Supprimer
              </button>
            </article>
          ))}
          </>}
        </>
      )}
      {tab === "discover" && (
        <>
          <h3>Catalogue privé · parcours débutant</h3>
          {!data.services.some((s) => s.data.published) && (
            <p>Publie d’abord une prestation depuis la vue parrain.</p>
          )}
          <div className="pricing-use-grid">
            {data.services
              .filter((s) => s.data.published)
              .map((s) => (
                <article key={s.id}>
                  <h4>{s.data.title}</h4>
                  <strong>{s.data.credits} crédits</strong>
                  <p>{s.data.description}</p>
                  <p>
                    {s.data.category} · {s.data.duration} min · {s.data.calls}{" "}
                    appel(s)
                  </p>
                  <p>Suivi : {s.data.followup || "Non inclus"}</p>
                  <p>{s.data.availability}</p>
                  <button className="btn" onClick={() => setSelected(s.id)}>
                    Consulter et réserver
                  </button>
                </article>
              ))}
          </div>
          {selected && (
            <form
              className="money-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await send({
                    action: "book",
                    id: selected,
                    key: crypto.randomUUID(),
                    notes,
                    slot,
                  })
                ) {
                  setSelected(null);
                  setNotes("");
                  setSlot("");
                  setTab("bookings");
                }
              }}
            >
              <h3>
                {data.services.find((s) => s.id === selected)?.data.title}
              </h3>
              <label>
                Ton besoin
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label>
                Créneau souhaité (à confirmer par le parrain)
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                />
              </label>
              <p>
                Les crédits sont déduits à la réservation et restitués en cas de
                refus ou d’annulation avant réalisation.
              </p>
              <button className="btn" disabled={busy}>
                Confirmer la réservation test
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setSelected(null)}
              >
                Fermer
              </button>
            </form>
          )}
        </>
      )}
      {tab === "bookings" && (
        <>
          <h3>Réservations · les deux côtés du test</h3>
          {!data.bookings.length && <p>Aucune réservation.</p>}
          {data.bookings.map((b) => (
            <article className="money-booking" key={b.id}>
              <h4>{b.snapshot.title}</h4>
              <strong>
                {status[b.status] || b.status} · {b.credits} crédits
              </strong>
              <p>{b.notes}</p>
              <p>Créneau demandé : {b.slot}</p>
              <p>Rémunération prévue : {euro(b.payout_cents)}</p>
              <div className="money-actions">
                {(b.status === "reserved"
                  ? ["accept", "decline", "cancel"]
                  : b.status === "accepted"
                    ? ["complete", "cancel"]
                    : b.status === "completed"
                      ? ["refund"]
                      : []
                ).map((a) => (
                  <button
                    className="btn secondary"
                    key={a}
                    disabled={busy}
                    onClick={() =>
                      void send({ action: "booking", id: b.id, transition: a })
                    }
                  >
                    {
                      {
                        accept: "Accepter · parrain",
                        decline: "Refuser · parrain",
                        cancel: "Annuler · débutant",
                        complete: "Confirmer la réalisation",
                        refund: "Restituer les crédits · admin",
                      }[a]
                    }
                  </button>
                ))}
              </div>
            </article>
          ))}
        </>
      )}
      {tab === "payouts" && (
        <>
          <h3>Rémunérations dues · simulation</h3>
          <div className="pricing-results">
            <div>
              <strong>
                {euro(
                  data.bookings
                    .filter((b) => b.status === "completed")
                    .reduce((n, b) => n + b.payout_cents, 0),
                )}
              </strong>
              <span>Total dû pour les prestations terminées</span>
            </div>
            <div>
              <strong>
                {euro(
                  data.bookings
                    .filter((b) => ["reserved", "accepted"].includes(b.status))
                    .reduce((n, b) => n + b.payout_cents, 0),
                )}
              </strong>
              <span>Prévision pour les prestations à réaliser</span>
            </div>
          </div>
          <p>
            Ce registre suit la rémunération de prestations, pas une conversion
            de portefeuille. Aucun virement, compte bancaire ou Stripe Connect
            n’est activé.
          </p>
          {data.bookings
            .filter((b) => b.status === "completed")
            .map((b) => (
              <div className="money-row" key={b.id}>
                <span>{b.snapshot.title}</span>
                <strong>
                  {euro(b.payout_cents)} à régler après validation future
                </strong>
              </div>
            ))}
        </>
      )}
    </section>
  );
}
