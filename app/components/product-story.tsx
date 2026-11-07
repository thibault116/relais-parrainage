"use client";
import { useEffect, useRef, useState } from "react";
const chapters = [
  ["Découvrir", "La bonne personne pour ton prochain cap.", "Des profils, des spécialités et une demande pour commencer à échanger.", "discover"],
  ["Communauté", "Une question. Des expériences à partager.", "Retrouve les conversations de ta communauté et participe à ton rythme.", "community"],
  ["Messages", "Le conseil devient une conversation.", "Garde tes échanges et leur contexte à portée de main, dans ton espace membre.", "messages"],
  ["Accompagnements", "Avancer, une étape après l’autre.", "Retrouve tes binômes, tes tâches et leur progression au même endroit.", "pairs"],
];
export function ProductStory({onJoin}:{onJoin:()=>void}) {
  const [active,setActive]=useState(0);
  const root=useRef<HTMLElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      frame=0;
      const sections=Array.from(root.current?.querySelectorAll<HTMLElement>("[data-chapter]") ?? []);
      let nearest=0, distance=Infinity;
      sections.forEach((section,i)=>{
        const rect=section.getBoundingClientRect();
        const next=Math.abs((rect.top+rect.bottom)/2-window.innerHeight/2);
        if(next<distance){distance=next;nearest=i;}
      });
      setActive(nearest);
    };
    const schedule=()=>{if(!frame) frame=requestAnimationFrame(update);};
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule);
    update();
    return ()=>{window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);cancelAnimationFrame(frame);};
  },[]);
  return <section className="refonte-story" ref={root} aria-label="Mentora en quatre écrans">
    <div className="refonte-story-intro"><span className="eyebrow">DANS TON ESPACE MENTORA</span><h2>De la rencontre aux premières avancées.</h2><p>Un espace pour trouver ton binôme, échanger et progresser dans l’achat-revente.</p><button className="btn" onClick={onJoin}>Créer mon profil</button></div>
    <div className="refonte-story-body"><div className="refonte-phone-stage" aria-hidden="true"><div className="refonte-phone"><img src={`/product-tour/${chapters[active][3]}.png`} alt="" width={390} height={844}/></div></div>
      <div>{chapters.map(([name,title,text,file],i)=><article className="refonte-chapter" data-chapter={i} key={file}><small>0{i+1} / {name.toUpperCase()}</small><h3>{title}</h3><p>{text}</p><img className="refonte-inline-shot" src={`/product-tour/${file}.png`} alt={`Écran ${name} de Mentora, aperçu de démonstration`} width={390} height={844} loading="lazy"/><small>Aperçu avec un compte de démonstration</small></article>)}</div></div>
  </section>;
}
