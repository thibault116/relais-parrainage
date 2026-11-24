import {z} from "zod";
export const resaleCategories=[['secondhand','Vêtements de seconde main'],['new','Vêtements neufs avec étiquette'],['shoes','Sneakers / Chaussures'],['games','Jeux vidéo / Consoles'],['books','Livres / Mangas'],['electronics','Électronique'],['other','Autre']] as const;
export const resaleSpecializations=[['niche','Niche'],['mainstream','Mainstream'],['luxury','Luxe'],['other','Autre']] as const;
export const purchaseMethods=[['manual','Achat à la main (Vinted et Leboncoin)'],['bot','Achat avec un bot (Vinted et Leboncoin)'],['wholesale','Grossistes / Fournisseurs'],['flea','Brocantes'],['thrift','Friperies'],['other','Autre']] as const;
const choices=<T extends readonly (readonly [string,string])[]>(list:T)=>z.array(z.enum(list.map(x=>x[0]) as [T[number][0],...T[number][0][]])).max(list.length).refine(v=>new Set(v).size===v.length,"Choix répété.");
export const mentorActivitySchema=z.object({
 version:z.literal(1),categories:choices(resaleCategories),specializations:choices(resaleSpecializations),methods:choices(purchaseMethods),
 categoryOther:z.string().trim().max(160),specializationOther:z.string().trim().max(160),methodOther:z.string().trim().max(160),
}).strict().transform(v=>({...v,specializations:v.categories.includes('secondhand')?v.specializations:[],specializationOther:v.categories.includes('secondhand')&&v.specializations.includes('other')?v.specializationOther:'',categoryOther:v.categories.includes('other')?v.categoryOther:'',methodOther:v.methods.includes('other')?v.methodOther:''})).superRefine((v,ctx)=>{
 for(const [selected,value,path] of [[v.categories.includes('other'),v.categoryOther,'categoryOther'],[v.specializations.includes('other'),v.specializationOther,'specializationOther'],[v.methods.includes('other'),v.methodOther,'methodOther']] as const)if(selected&&value.length<2)ctx.addIssue({code:'custom',path:[path],message:'Précise ton choix en quelques mots.'});
});
export type MentorActivity=z.infer<typeof mentorActivitySchema>;
export const emptyMentorActivity=():MentorActivity=>({version:1,categories:[],specializations:[],methods:[],categoryOther:'',specializationOther:'',methodOther:''});
export const mentorActivityInput=z.object({activity:mentorActivitySchema,bio:z.string().trim().max(1000)}).strict();
export function activityLabels(ids:readonly string[],choices:readonly (readonly [string,string])[],other:string){return ids.map(id=>id==='other'?other:choices.find(c=>c[0]===id)?.[1]||'').filter(Boolean);}
export const mentorProfileSQL=`(SELECT a.answers FROM mentor_activities a WHERE a.user_id=p.user_id) AS mentor_activity,(SELECT m.bio FROM mentor_portfolios m WHERE m.user_id=p.user_id) AS portfolio_bio,(SELECT COUNT(*) FROM mentor_portfolio_images mi WHERE mi.user_id=p.user_id) AS portfolio_image_count`;
