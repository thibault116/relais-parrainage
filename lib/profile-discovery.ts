import type { PublicProfile } from "./profile";
import { methods, platforms, mentorExperience, levels } from "./intake";

export const discoveryFilters = [
  { key: "platform", label: "Plateforme", options: platforms },
  { key: "method", label: "Méthode d’achat", options: methods },
  { key: "expertise", label: "Compétences et besoins", options: [
    {id:"sourcing",label:"Sourcing / fournisseurs"}, {id:"pricing",label:"Prix et estimations"},
    {id:"photos",label:"Photos et annonces"}, {id:"stock",label:"Gestion du stock"},
    {id:"growth",label:"Développement des ventes"}, {id:"strategy",label:"Stratégies de vente"},
  ] },
  { key: "availability", label: "Disponibilités", options: [
    {id:"weekdays",label:"En semaine"},{id:"weekend",label:"Le week-end"},
    {id:"morning",label:"Le matin"},{id:"afternoon",label:"L’après-midi"},{id:"evening",label:"Le soir"},
    {id:"variable",label:"Horaires variables"},
  ] },
  { key: "experience", label: "Expérience", options: [
    ...mentorExperience, ...levels,
  ] },
] as const;
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function discoveryValues(p: PublicProfile, key: string): string[] {
  if (p.resell?.version === 2) {
    const field = key === "platform" ? "platforms" : key === "method" ? "methods" : key === "expertise" ? "help" : key === "experience" && p.role === "beginner" ? "level" : key;
    return p.resell.selections[field] || [];
  }
  // Legacy responses remain usable without guessing unrecorded member attributes.
  if (key === "method") return Object.entries({bot:"Bot",flea:"Brocante",luxury:"Luxe",mainstream:"Fournisseur"}).filter(([,label])=>p.specialty.includes(label as typeof p.specialty[number])).map(([id])=>id);
  if (key === "expertise") return Object.entries({sourcing:"Fournisseur",photos:"Expert en photo"}).filter(([,label])=>p.specialty.includes(label as typeof p.specialty[number])).map(([id])=>id);
  if (key === "availability") return ({"En journée":["morning","afternoon"],"En soirée":["evening"],"Le week-end":["weekend"],"Flexible":["variable"]} as Record<string,string[]>)[p.availability] || [];
  const legacy = p.resell;
  if (key === "platform" && legacy?.version === 1 && legacy.role === "mentor") {
    return platforms
      .filter(v => v.id !== "other" && normalize(legacy.platforms).includes(normalize(v.label)))
      .map(v => v.id);
  }
  if (key === "experience") return [p.experience < 6 ? "under6" : p.experience < 12 ? "6to12" : p.experience < 24 ? "1to2" : p.experience <= 60 ? "2to5" : "over5"];
  return [];
}
export function matchesDiscovery(p: PublicProfile, params: URLSearchParams) {
  return discoveryFilters.every(({key}) => !params.get(key) || discoveryValues(p,key).includes(params.get(key)!));
}
export function discoveryTags(p: PublicProfile) {
  return [...new Set(["method","platform"].flatMap(key=> {
    const options = discoveryFilters.find(f=>f.key===key)!.options;
    return discoveryValues(p,key).map(id=>options.find(o=>o.id===id)?.label).filter((s):s is string=>!!s && s!=="Autre");
  }).concat(p.resell?.version===2 ? [] : p.specialty.filter(s=>s!=="Autre")))].slice(0,3);
}
