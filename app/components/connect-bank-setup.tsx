"use client";

import { useEffect, useState } from "react";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";

type Props = {mode:"onboarding"|"management";onDone:()=>void};
const collectionOptions = {fields:"currently_due" as const, futureRequirements:"omit" as const};

export default function ConnectBankSetup({mode,onDone}:Props) {
  const [instance,setInstance]=useState<StripeConnectInstance|null>(null);
  const [error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);

  useEffect(()=>{
    let canceled=false,connect:StripeConnectInstance|undefined;
    const abort=new AbortController();
    async function session() {
      const response=await fetch("/api/admin/monetization/connect",{
        method:"POST",cache:"no-store",signal:abort.signal,
        headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"session",mode}),
      });
      const result=await response.json();
      if(!response.ok)throw Error(result.error || "Le formulaire bancaire est indisponible.");
      return result as {publishableKey:string;clientSecret:string};
    }
    async function initialize() {
      const [initial,{loadConnectAndInitialize}]=await Promise.all([session(),import("@stripe/connect-js/pure")]);
      if(canceled)return;
      let firstSecret:string|undefined=initial.clientSecret;
      connect=loadConnectAndInitialize({
        publishableKey:initial.publishableKey,locale:"fr-FR",
        fetchClientSecret:async()=>{
          if(canceled)throw Error("Formulaire fermé.");
          if(firstSecret){const secret=firstSecret;firstSecret=undefined;return secret;}
          try {return (await session()).clientSecret;}
          catch(failure){if(!canceled)setError("La session bancaire a expiré. Réessaie pour continuer.");throw failure;}
        },
        appearance:{overlays:"dialog",variables:{}},
      });
      const updateAppearance=()=>{
        const styles=getComputedStyle(document.documentElement);
        const dark=document.documentElement.dataset.theme!=="light";
        connect?.update({appearance:{variables:{
          colorPrimary:styles.getPropertyValue("--purple-fill").trim() || "#883af5",
          colorBackground:dark?"#121019":"#ffffff",colorText:dark?"#f8f5ff":"#21182b",
          buttonPrimaryColorText:"#ffffff",borderRadius:"12px",fontSizeBase:"16px",
          fontFamily:getComputedStyle(document.body).fontFamily,
        }}});
      };
      updateAppearance();
      observer=new MutationObserver(updateAppearance);
      observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme","data-neon"]});
      setInstance(connect);
    }
    let observer:MutationObserver|undefined;
    void initialize().catch(failure=>{if(!canceled)setError(failure.message || "Le formulaire bancaire est indisponible.");});
    return ()=>{canceled=true;abort.abort();observer?.disconnect();void connect?.logout().catch(()=>{});};
  },[mode,attempt]);

  return <div className="connect-embedded" aria-label={mode==="onboarding"?"Configurer mes retraits dans Mentora":"Modifier mes informations bancaires"}>
    <div className="connect-heading"><h4>{mode==="onboarding"?"Configurer mes retraits":"Mes informations bancaires"}</h4><button type="button" className="commerce-row connect-refresh" onClick={onDone}>Fermer</button></div>
    <p className="connect-embedded-note">Formulaire sécurisé par Stripe. Utilise uniquement les données de test proposées. Ton IBAN et tes justificatifs restent chez Stripe.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="commerce-row" onClick={()=>{setError("");setInstance(null);setAttempt(n=>n+1);}}>Réessayer</button></div>
      : instance ? <ConnectComponentsProvider connectInstance={instance}>
        {mode==="onboarding" ? <ConnectAccountOnboarding collectionOptions={collectionOptions} onExit={onDone} onLoadError={()=>setError("Le formulaire Stripe n’a pas pu se charger. Vérifie ta connexion puis réessaie.")}/>
          : <ConnectAccountManagement collectionOptions={collectionOptions} onLoadError={()=>setError("Les informations bancaires n’ont pas pu se charger. Réessaie dans un instant.")}/>}
      </ConnectComponentsProvider>
      : <p role="status">Ouverture du formulaire sécurisé…</p>}
    {instance && !error && mode==="management" && <button type="button" className="commerce-primary" onClick={onDone}>Terminé · actualiser mes informations</button>}
  </div>;
}
