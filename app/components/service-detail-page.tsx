"use client";
import {serviceCreditLabel} from "@/lib/monetization/catalog";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { profileExperienceLabel, type PublicProfile } from "@/lib/profile";
import type { Service } from "./private-services";

export function ServiceDetailPage({service,stage,busy,onBack,onRequest,children}:{
  service: Service;
  stage: "detail" | "request" | "sent";
  busy: boolean;
  onBack: () => void;
  onRequest: () => void;
  children: ReactNode;
}) {
  const [mentor,setMentor] = useState<PublicProfile|null>(null);
  const profileId = service.profile?.id;
  useEffect(()=> {
    setMentor(null);
    if (!profileId) return;
    const controller = new AbortController();
    void fetch(`/api/profiles?profile=${encodeURIComponent(profileId)}`,{signal:controller.signal,cache:"no-store"})
      .then(async r=>r.ok ? r.json() : null)
      .then(d=> { if (!controller.signal.aborted) setMentor(d?.profile || null); })
      .catch(()=>{});
    return ()=>controller.abort();
  },[profileId]);
  const offer = service.data;
  const author = service.profile;
  const authorUrl = author ? `/?mobile=home&member=${encodeURIComponent(author.id)}#directory` : "";
  return <div className="service-page-shell">
    <header className="service-page-navigation">
      <button type="button" disabled={busy} aria-label={stage === "request" ? "Retour à la prestation" : "Fermer la prestation"} onClick={onBack}>
        <ArrowLeft size={21}/><span>{stage === "sent" ? "Demande envoyée" : stage === "request" ? "Ta demande" : "Prestations"}</span>
      </button>
      <span className="service-page-brand">Mentora<span>.</span></span>
    </header>
    <div className="service-page-scroll">
      <div className="service-page-content">
        {stage === "detail" && offer.image && <img className="service-page-cover" src={`/api/admin/prestations?image=${offer.image}`} alt={offer.title}/>}
        <div className="service-page-tags">
          {offer.category && offer.category !== "Autre" && <span>{offer.category}</span>}
          {!!offer.duration && <span><Clock size={14}/>{offer.duration} minutes</span>}
        </div>
        <h1>{offer.title}</h1>
        {stage === "detail" ? <>
          <p className="service-page-description">{offer.description}</p>
          {(offer.followup || !!offer.calls) && <section className="service-page-section">
            <h2>Ce qui est inclus</h2>
            {offer.followup && <p className="service-page-description">{offer.followup}</p>}
            {!!offer.calls && <p><CheckCircle2 size={19}/>{offer.calls} appel{offer.calls>1?"s":""} prévu{offer.calls>1?"s":""}</p>}
          </section>}
          {author && <section className="service-page-section service-page-mentor">
            <h2>Ton parrain</h2>
            <a className="service-page-author" href={authorUrl}>
              <span className="service-author-avatar">{author.name.slice(0,1).toUpperCase()}<img src={`/api/profile-photo?id=${author.id}`} alt="" onError={e=>{e.currentTarget.hidden=true;}}/></span>
              <span><strong>{author.name}</strong><small>Parrain{mentor ? ` · ${profileExperienceLabel(mentor)}` : ""}</small></span>
            </a>
            {mentor?.bio && <blockquote>{mentor.bio}</blockquote>}
            <a className="service-page-profile" href={authorUrl}>Voir son profil <ArrowRight size={19}/></a>
          </section>}
          <section className="service-page-section service-booking-steps">
            <h2>Comment se passe la réservation ?</h2>
            <ol>
              <li><span>1</span><p>Envoie ta demande. Tu peux préciser ton besoin si tu le souhaites.</p></li>
              <li><span>2</span><p>{offer.credits===0?"Cette prestation est gratuite : aucun crédit n’est débité.":"Les crédits sont réservés en attendant la réponse du parrain."}</p></li>
              <li><span>3</span><p>Après acceptation, échangez en message privé pour organiser la prestation.</p></li>
            </ol>
          </section>
        </> : <div className="service-page-request"><span className="service-price">{serviceCreditLabel(offer.credits)}</span>{children}</div>}
      </div>
    </div>
    {stage === "detail" && <footer className="service-page-booking">
      <div><span>Prix de la prestation</span><strong>{serviceCreditLabel(offer.credits)}</strong></div>
      <div className="service-page-payment"><span>{offer.duration ? <><Clock size={16}/>{offer.duration} minutes</> : <><MessageCircle size={16}/>À organiser ensemble</>}</span><small>{offer.credits===0?"Aucun crédit nécessaire":"Paiement en crédits"}</small></div>
      <button className="commerce-primary" type="button" disabled={busy} onClick={onRequest}>Demander cette prestation <ArrowRight size={20}/></button>
    </footer>}
  </div>;
}
