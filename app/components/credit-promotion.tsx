"use client";
import {useId} from "react";
import {Rocket,Tag} from "lucide-react";
import type {CreditSeason} from "@/lib/monetization/catalog";
function GiftBow(){
 const id=useId().replace(/:/g,"");
 return <svg className="credit-gift-bow" viewBox="0 0 160 150" fill="none" aria-hidden="true"><defs><linearGradient id={`${id}-silk`} x1="20" y1="10" x2="130" y2="135" gradientUnits="userSpaceOnUse"><stop stopColor="#f8c0ff"/><stop offset=".22" stopColor="#d452f8"/><stop offset=".48" stopColor="#7606a9"/><stop offset=".68" stopColor="#c23bea"/><stop offset="1" stopColor="#46045f"/></linearGradient><linearGradient id={`${id}-fold`} x1="50" y1="20" x2="110" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#44035c"/><stop offset=".45" stopColor="#f9b9ff"/><stop offset=".7" stopColor="#bd28e6"/><stop offset="1" stopColor="#65068e"/></linearGradient></defs><g fill={`url(#${id}-silk)`}><path d="M75 66C49 42 32 29 9 17L39 8C53 17 70 37 82 57L75 66Z"/><path d="M87 74C111 86 130 109 150 148L121 132L106 143C100 113 89 98 76 85L87 74Z"/><path d="M74 75C61 93 56 111 56 135L40 119L18 124C30 101 41 80 65 65L74 75Z"/><path d="M74 66C48 32 27 12 25 35C24 51 23 68 11 75C30 90 62 81 74 66Z"/><path d="M85 65C101 32 126 18 144 34C156 44 142 66 136 78C121 97 99 82 85 65Z"/></g><path d="M13 75C28 66 32 48 25 35C38 39 56 55 70 68C49 77 28 83 13 75Z" fill={`url(#${id}-fold)`}/><path d="M88 67C106 56 123 47 145 35C150 53 136 71 131 77C118 87 101 76 88 67Z" fill={`url(#${id}-fold)`}/><path d="M69 55C73 51 90 57 94 64L86 85C82 89 66 80 64 73L69 55Z" fill={`url(#${id}-fold)`}/><path d="M28 34C36 39 52 49 64 61M100 53C114 43 128 36 140 35" stroke="#f7b2ff" strokeOpacity=".6" strokeWidth="1.5"/></svg>;
}
export function CreditPromotion({season}:{season:CreditSeason}){
 if(season==="black-friday")return <header className="credit-promotion black-friday" aria-label="Offres Black Friday"><GiftBow/><span className="credit-neon-rays left" aria-hidden="true"/><h2><span>Black</span><span>Friday</span></h2><Tag className="credit-promo-tag" aria-hidden="true"/><span className="credit-neon-rays right" aria-hidden="true"/><p>Nos offres les plus avantageuses<br/>de l’année !</p></header>;
 if(season==="launch")return <header className="credit-promotion launch"><h2><Rocket size={25} aria-hidden="true"/>Offre de lancement</h2><p>Profite de nos tarifs exclusifs<br/>pour le début de l’aventure Mentora !</p></header>;
 return <header className="credit-promotion standard"><h2>Les crédits Mentora</h2><p>Choisis le pack adapté à tes besoins.</p></header>;
}
