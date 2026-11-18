export class DiscordFailure extends Error{constructor(public status:number){super(`Discord indisponible (${status}).`);}}
export type DiscordApi=<T=Record<string,unknown>>(path:string,method?:string,body?:unknown)=>Promise<T>;
export const discordApi:DiscordApi=async<T>(path:string,method="GET",body?:unknown)=>{
 if(!/^\/(guilds|channels|users|oauth2|invites)\/[a-zA-Z0-9/@_-]+(?:\?(?:limit=100(?:&before=\d{15,22})?|with_counts=true))?$/.test(path))throw Error("Chemin Discord refusé.");
 const token=process.env.DISCORD_TICKET_BOT_TOKEN;if(!token)throw Error("Token du bot manquant.");
 const r=await fetch(`https://discord.com/api/v10${path}`,{method,headers:{Authorization:`Bot ${token}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new DiscordFailure(r.status);return (r.status===204?null:await r.json()) as T;
};
export async function finishInteraction(application:string,token:string,content:string){
 if(!/^\d{15,22}$/.test(application)||!/^[\w.-]{10,300}$/.test(token))return;
 const r=await fetch(`https://discord.com/api/v10/webhooks/${application}/${token}/messages/@original`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,allowed_mentions:{parse:[]}}),redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Réponse Discord indisponible.");
}
