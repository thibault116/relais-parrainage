import {query as rawQuery,inTransaction as rawTransaction,database} from "../db";
import {billingLive} from "./mode";
export {database};
// Keep profiles/services shared; isolate ALL money, bank and payment records.
// Rewriting static SQL identifiers only; values always remain bound parameters.
export function moneySQL(sql:string){return billingLive()?sql.replace(/\bmoney_(\w+)\b/g,(name,suffix)=>["services","service_images"].includes(suffix)?name:`money_live_${suffix}`):sql;}
export const query:typeof rawQuery=(sql,params)=>rawQuery(moneySQL(sql),params);
export function inTransaction<T>(fn:(q:typeof rawQuery)=>Promise<T>){return rawTransaction(q=>fn((sql,params)=>q(moneySQL(sql),params)));}
