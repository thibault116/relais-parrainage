"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, FileText, ArrowLeft, Check, MessageCircle } from "lucide-react";
import { ManualBankForm, ManualBankHistory } from "./manual-bank";
import { TestSalesAcceptance } from "./test-sales-acceptance";
import {CreditPromotion} from "./credit-promotion";
import { CreditCoin } from "./credit-coin";
import { openServiceChat } from "./service-conversations";
import {
  creditSeasons,
  adminCreditOffer,
  defaultCreditSeason,
  rechargeOffers,
  creditsSlider,
  sliderCredits,
  maxServiceCredits,
  servicePriceCents,
  type CreditSeason,
} from "@/lib/monetization/catalog";
import type { serviceSchema } from "@/lib/monetization/store";
import type { z } from "zod";
type Service = z.infer<typeof serviceSchema>;
type Booking = {
  id: string;
  snapshot: Service;
  credits: number;
  payout_cents: number;
  test_booking?:number;
  status: string;
};
type Data = {
  mode: "test" | "live";
  owner:boolean;
  salesVersion: string;
  configured: boolean;
  provider?:{ready:boolean;message:string;canRepairWebhook?:boolean}|null;
  balance: number;
  payoutRate: number;
  needsCreditTransition: boolean;
  services: { id: string; data: Service }[];
  bookings: Booking[];
  ledger: { delta: number; kind: string; created_at: string }[];
  payments: {
    id: string;
    amount: number;
    credits: number;
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
  credits: 500,
  capacity: 5,
  published: false,
};
const statuses: Record<string, string> = {
  reserved: "En attente",
  accepted: "En cours",
  completion_pending: "Confirmation du débutant attendue",
  completed: "Terminée",
  refunded: "Remboursée",
  declined: "Refusée",
  cancelled: "Annulée",
};
export function AdminMonetization({
  initialTab = "wallet",
  dedicated = false,
}: {
  initialTab?: string;
  dedicated?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [season, setSeason] = useState<CreditSeason>(defaultCreditSeason),
    [accepted, setAccepted] = useState(false),
    [panel, setPanel] = useState(""),
    [editing, setEditing] = useState(false),
    [form, setForm] = useState<Service>(blank),
    [editId, setEditId] = useState<string | undefined>(),
    [uploading, setUploading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const view = ["plans", "billing", "pricing"].includes(tab) ? "wallet" : tab;
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/monetization", { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
  }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(()=>{
    if(!data?.owner||view!=="wallet")return;
    const url=new URL(window.location.href);
    if(url.searchParams.get("creditOffer")!==adminCreditOffer.id)return;
    setPanel(adminCreditOffer.id);setAccepted(false);dialog.current?.showModal();
    url.searchParams.delete("creditOffer");window.history.replaceState(window.history.state,"",url);
  },[data,view]);

  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    const refresh = () => void load().catch(() => {});
    window.addEventListener("focus", refresh);
    window.addEventListener("mentora-bank-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("mentora-bank-changed", refresh);
    };
  }, [load]);
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
            returnTo: "credits",
            ...(body.action === "checkout"
              ? { acceptedTermsVersion: data?.salesVersion }
              : {}),
          }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.url) {
        window.location.assign(d.url);
        return true;
      }
      await load();
      window.dispatchEvent(new Event("mentora-billing-updated"));
      window.dispatchEvent(new Event("mentora-bank-changed"));
      setMessage(d.message || "Enregistré.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const f = new FormData();
      f.set("file", file);
      const r = await fetch("/api/admin/prestations", {
          method: "POST",
          body: f,
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setForm((v) => ({ ...v, image: d.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const toggle = (p: string) => setPanel((v) => (v === p ? "" : p));
  const field = <K extends keyof Service>(key: K, value: Service[K]) =>
    setForm((v) => ({ ...v, [key]: value }));
  async function decision(id: string, transition: string) {
    if(busy)return;
    setBusy(true);setError("");
    try {
      const r=await fetch("/api/admin/prestations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"decision",id,transition})});
      const d=await r.json();
      if(!r.ok)throw Error(d.error);
      openServiceChat(id);
    } catch(e) { setError((e as Error).message); }
    finally {setBusy(false);}
  }
  if (!data)
    return <p role="status">{error || "Chargement…"}</p>;
  const completed = data.bookings.filter((b) => b.status === "completed"&&!b.test_booking),
    ongoing = data.bookings.filter((b) =>
      ["accepted", "completion_pending"].includes(b.status),
    );
  const purchaseOffers=data.owner?[...rechargeOffers,adminCreditOffer]:rechargeOffers.filter(p=>p.season==="launch");
  const offers = rechargeOffers.filter((p) => p.season === (data.owner?season:"launch"));
  return (
    <section className="commerce-screen private-credit-system">
      {!dedicated && (
        <nav className="service-request-tabs">
          {[
            ["wallet", "Crédits"],
            ["services", "Prestations"],
            ["payouts", "Rémunération"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setEditing(false);
              }}
              className={view === id ? "selected" : ""}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <header>
        <h1>
          {editing
            ? editId
              ? "Modifier la prestation"
              : "Créer une prestation"
            : view === "services"
              ? "Mes prestations"
              : view === "payouts"
                ? "Ma rémunération"
                : "Mes crédits"}
        </h1>
        <small>
          {data.mode === "test"
            ? "TEST PRIVÉ · Aucun paiement réel"
            : data.owner?"PAIEMENTS RÉELS · Compte admin":"Paiement sécurisé"}
        </small>
      </header>
      {data.mode==="live"&&data.provider&&!data.provider.ready&&<p role="status">{data.provider.message}</p>}
      {data.owner&&data.mode==="live"&&data.provider?.canRepairWebhook&&<button className="commerce-row" disabled={busy} onClick={()=>void send({action:"configure-live-webhook"})}>Compléter le webhook Stripe réel</button>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {view === "wallet" && (
        <>
          {data.needsCreditTransition && (
            <button
              className="commerce-row"
              disabled={busy}
              onClick={() => void send({ action: "credits-only" })}
            >
              Appliquer le fonctionnement par crédits
            </button>
          )}
          <article className="commerce-card commerce-balance">
            <CreditCoin />
            <strong>{data.balance.toLocaleString("fr-FR")} crédits</strong>
            <span>{data.mode==="live"?"Solde réel":"Solde disponible"}</span>
          </article>
          {data.owner&&<article className="commerce-card admin-credit-control"><h2>Crédits pour tes essais privés</h2><p>10 000 crédits · 1,00 € par achat</p><small>Paiement réel, réservé à ton compte administrateur.</small><button className="commerce-primary" onClick={()=>{setPanel(adminCreditOffer.id);setAccepted(false);setError("");dialog.current?.showModal();}}>Acheter 10 000 crédits · 1,00 €</button></article>}
          {data.owner&&<nav className="credit-seasons" aria-label="Grille tarifaire privée">
            {creditSeasons.map((s) => (
              <button
                key={s.id}
                className={season === s.id ? "selected" : ""}
                aria-pressed={season === s.id}
                onClick={() => {
                  setSeason(s.id);
                  setAccepted(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>}
          <CreditPromotion season={data.owner?season:"launch"}/>
          <div className={`credit-offers ${season}`}>
            {offers.map((p) => (
              <button
                key={p.id}
                className="credit-offer"
                onClick={() => {
                  setPanel(p.id);
                  setAccepted(false);
                  setError("");
                  dialog.current?.showModal();
                }}
              >
                <CreditCoin small />
                <span>
                  <strong>Pack {p.name}</strong>
                  {season!=="black-friday"&&<small className="credit-offer-tag">{p.tag}</small>}
                  <span className="credit-amount-row"><b>{p.credits.toLocaleString("fr-FR")} crédits</b>{p.bonusCredits>0&&<small className="credit-bonus-pill">+{p.bonusCredits} bonus</small>}</span>
                  <small>
                    {euro((p.cents * 100) / p.credits)} / 100 crédits
                  </small>
                </span>
                <span className="credit-price-stack">{season!=="standard"&&<del aria-label={`Prix de référence ${euro(p.referenceCents)}`}>{euro(p.referenceCents)}</del>}<b className="credit-offer-price">{euro(p.cents)}</b></span>
              </button>
            ))}
          </div>
          <button className="commerce-row" onClick={() => toggle("history")}>
            <FileText size={20} />
            Historique des crédits
          </button>
          {panel === "history" && (
            <div className="commerce-history">
              {data.ledger.map((l, i) => (
                <article key={i}>
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
                </article>
              ))}
            </div>
          )}
          <button className="commerce-row" onClick={() => toggle("payments")}>
            <FileText size={20} />
            Mes paiements
          </button>
          {panel === "payments" && (
            <div className="commerce-history">
              {data.payments.map((p) => (
                <article key={p.id}>
                  <span>
                    {p.credits} crédits · {euro(p.amount)}
                    <small>
                      {new Date(p.created_at).toLocaleDateString("fr-FR")}
                    </small>
                  </span>
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer">
                      Reçu
                    </a>
                  )}
                  {data.owner&&<button
                    className="commerce-row"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Demander le remboursement de ce paiement ?",
                        )
                      )
                        void send({ action: "refund", id: p.id });
                    }}
                  >
                    Demander un remboursement
                  </button>}
                </article>
              ))}
            </div>
          )}
          <dialog
            className="credit-purchase-dialog"
            ref={dialog}
            aria-labelledby="credit-purchase-title"
          >
            <header>
              <h2 id="credit-purchase-title">Acheter des crédits</h2>
              <button
                className="commerce-icon"
                aria-label="Fermer"
                onClick={() => dialog.current?.close()}
              >
                ×
              </button>
            </header>
            {(() => {
              const p = purchaseOffers.find((o) => o.id === panel);
              return p ? (
                <>
                  <CreditCoin />
                  <h3>Pack {p.name}</h3>
                  <p>
                    {p.credits.toLocaleString("fr-FR")} crédits ·{" "}
                    {euro(p.cents)}
                  </p>
                  <p>
                    {data.mode === "test"
                      ? "Paiement Stripe en mode test"
                      : "Paiement réel sécurisé"}
                  </p>
                  <TestSalesAcceptance
                    live={data.mode === "live"}
                    checked={accepted}
                    onChange={setAccepted}
                  />
                  {error && <p role="alert">{error}</p>}
                  <button
                    className="commerce-primary"
                    disabled={busy || !accepted || !data.configured}
                    onClick={() =>
                      void send({
                        action: "checkout",
                        offer: p.id,
                        key: crypto.randomUUID(),
                      })
                    }
                  >
                    Payer {euro(p.cents)}
                  </button>
                  {!data.configured && <p>Le paiement est indisponible.</p>}
                </>
              ) : null;
            })()}
          </dialog>
        </>
      )}
      {view === "services" && (
        <>
          {editing ? (
            <>
              <button
                className="commerce-row"
                onClick={() => setEditing(false)}
              >
                <ArrowLeft size={18} />
                Mes prestations
              </button>
              <form
                className="commerce-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await send({ action: "save", id: editId, service: form }))
                    setEditing(false);
                }}
              >
                <label>
                  Titre
                  <input
                    minLength={4}
                    maxLength={100}
                    required
                    value={form.title}
                    onChange={(e) => field("title", e.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    minLength={20}
                    maxLength={5000}
                    required
                    rows={5}
                    value={form.description}
                    onChange={(e) => field("description", e.target.value)}
                  />
                </label>
                <label>
                  Image (facultatif)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                {form.image && (
                  <>
                    <img
                      className="service-editor-image"
                      src={`/api/admin/prestations?image=${form.image}`}
                      alt="Image de la prestation"
                    />
                    <button
                      type="button"
                      className="commerce-row"
                      onClick={() => field("image", "")}
                    >
                      Retirer l’image
                    </button>
                  </>
                )}
                <label>
                  Nombre de crédits
                  <input
                    type="number"
                    required
                    min={1}
                    max={maxServiceCredits}
                    value={form.credits || ""}
                    onChange={(e) => field("credits", Number(e.target.value))}
                  />
                </label>
                <label>
                  Jauge du prix
                  <input
                    type="range"
                    min={1}
                    max={1000}
                    step={1}
                    value={creditsSlider(form.credits)}
                    onChange={(e) =>
                      field("credits", sliderCredits(Number(e.target.value)))
                    }
                  />
                </label>
                <p className="service-euro-preview">Ta rémunération prévue : {euro(Math.round(form.credits*data.payoutRate))}.</p>
                <label className="commerce-check">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => field("published", e.target.checked)}
                  />
                  Visible sur mon profil
                </label>
                <button
                  className="commerce-primary"
                  disabled={busy || uploading}
                >
                  Enregistrer
                </button>
              </form>
            </>
          ) : (
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
              {data.services.map((s) => (
                <article className="commerce-card" key={s.id}>
                  {s.data.image && (
                    <img
                      className="service-editor-image"
                      src={`/api/admin/prestations?image=${s.data.image}`}
                      alt=""
                    />
                  )}
                  <h2>{s.data.title}</h2>
                  <p>
                    {s.data.credits.toLocaleString("fr-FR")} crédits ·{" "}
                    {euro(Math.round(s.data.credits * data.payoutRate))} pour
                    toi
                  </p>
                  <label className="commerce-check">
                    <input
                      type="checkbox"
                      checked={s.data.published}
                      disabled={busy}
                      onChange={(e) =>
                        void send({
                          action: "save",
                          id: s.id,
                          service: { ...s.data, published: e.target.checked },
                        })
                      }
                    />
                    Visible sur mon profil
                  </label>
                  <button
                    className="commerce-row"
                    onClick={() => {
                      setForm(s.data);
                      setEditId(s.id);
                      setEditing(true);
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    className="commerce-row danger"
                    disabled={busy}
                    onClick={() => void send({ action: "delete", id: s.id })}
                  >
                    Supprimer
                  </button>
                </article>
              ))}
              <h2>Prestations en cours</h2>
              {ongoing.length ? (
                ongoing.map((b) => (
                  <article className="commerce-card" key={b.id}>
                    <h3>{b.snapshot.title}</h3>
                    <p>{statuses[b.status]}</p>
                    <button
                      className="commerce-row"
                      onClick={() => openServiceChat(b.id)}
                    >
                      <MessageCircle size={18} />
                      Ouvrir la conversation
                    </button>
                    {b.status === "accepted" && (
                      <button
                        className="commerce-primary"
                        disabled={busy}
                        onClick={() => void decision(b.id, "complete")}
                      >
                        Prestation terminée
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <p>Aucune prestation en cours.</p>
              )}
            </>
          )}
        </>
      )}
      {view === "payouts" && (
        <>
          <ManualBankForm />
          <button className="commerce-row" onClick={() => toggle("earnings")}>
            Historique des rémunérations
          </button>
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
          <button className="commerce-row" onClick={() => toggle("bookings")}>
            Historique des réservations
          </button>
          {panel === "bookings" && (
            <div className="commerce-history">
              {data.bookings.map((b) => (
                <article key={b.id}>
                  <span>
                    {b.snapshot.title}
                    <small>{statuses[b.status] || b.status}</small>
                  </span>
                  <strong>{b.credits} crédits</strong>{data.mode==="test"&&b.status==="completed"&&<button className="commerce-row" disabled={busy} onClick={()=>void send({action:"booking",id:b.id,transition:"refund"})}>Restituer les crédits de test</button>}
                </article>
              ))}
            </div>
          )}
          <button
            className="commerce-row"
            onClick={() => toggle("withdrawals")}
          >
            Mes retraits
          </button>
          {panel === "withdrawals" && <ManualBankHistory />}
        </>
      )}
    </section>
  );
}
