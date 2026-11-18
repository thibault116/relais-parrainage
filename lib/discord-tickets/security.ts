import {createPublicKey,verify} from "node:crypto";
export function verifyInteraction(body:string,signature:string|null,timestamp:string|null,publicKey:string,now=Date.now()){
 if(!/^[a-f0-9]{64}$/i.test(publicKey)||!signature||!/^[a-f0-9]{128}$/i.test(signature)||!timestamp||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 try{return verify(null,Buffer.from(timestamp+body),createPublicKey({key:Buffer.concat([Buffer.from("302a300506032b6570032100","hex"),Buffer.from(publicKey,"hex")]),format:"der",type:"spki"}),Buffer.from(signature,"hex"));}catch{return false;}
}
const VIEW=1024n,SEND=2048n,EMBED=16384n,ATTACH=32768n,HISTORY=65536n;
export function ticketPermissions(guild:string,owner:string,bot:string,user?:string,closed=false){
 const base=VIEW|SEND|EMBED|ATTACH|HISTORY;
 return [{id:guild,type:0,allow:"0",deny:VIEW.toString()},...Array.from(new Set([owner,bot,...(user?[user]:[])])).map(id=>({id,type:1,allow:(closed&&id===user&&id!==owner&&id!==bot?VIEW|HISTORY:base).toString(),deny:closed&&id===user&&id!==owner&&id!==bot?SEND.toString():"0"}))];
}
