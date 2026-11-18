export const memberGuides = [
 {slug:'se-lancer-achat-revente',number:'01',title:'Se lancer dans l’achat-revente',description:'Commencer avec un capital de départ ou sans budget.',file:'01_se_lancer_achat_revente.html'},
 {slug:'materiel-indispensable',number:'02',title:'Le matériel indispensable',description:'Le matériel pour préparer tes articles, organiser ton stock et expédier tes ventes.',file:'materiel-reader.html',pdf:'02_materiel_indispensable_corrige.pdf'},
 {slug:'photos-et-annonces',number:'03',title:'Photos et annonces',description:'Soigner tes photos et présenter tes articles avec des exemples concrets.',file:'03_photos_et_annonces.html'},
 {slug:'comment-se-sourcer',number:'04',title:'Comment se sourcer',description:'Trouver des articles et choisir les sources adaptées à ton activité.',file:'04_comment_se_sourcer.html'},
] as const;
export function guideLink(origin:string,slug:string){const url=new URL('/',origin);url.searchParams.set('mobile','guides');url.searchParams.set('guide',slug);url.hash='workspace';return url.toString();}
