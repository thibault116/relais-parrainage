import {user,json,guard} from "@/lib/http";
import {isCrmOwner} from "@/lib/crm";
import {testWalletPreview,repriceTestWallet} from "@/lib/monetization/test-wallet";
export const runtime="nodejs";
export async function GET(r:Request){const actor=await user(r);if(!await isCrmOwner(actor))return json({error:"Accès refusé."},403);try{return json(await testWalletPreview(actor!));}catch{return json({error:"Calcul indisponible."},503);}}
export async function POST(r:Request){const actor=await user(r);if(!await isCrmOwner(actor))return json({error:"Accès refusé."},403);const denied=await guard(r);if(denied)return denied;try{const body=await r.json();if(body.action!=="reprice"||Object.keys(body).length!==1)return json({error:"Action invalide."},400);return json(await repriceTestWallet(actor!));}catch{return json({error:"Actualisation non confirmée."},409);}}
