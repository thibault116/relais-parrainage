import type Stripe from "stripe";
import { stripeTest } from "./stripe";
export type PayoutDiagnostic = {
  testMode: true; ready: boolean; accountId?: string; availableCents?: number;
  destination?: { id: string; bankName: string; last4: string; currency: string };
  checks: string[]; code?: string; requestId?: string;
};
export function safeStripeFailure(failure: unknown) {
  const error = failure as { code?: string; type?: string; message?: string; requestId?: string; statusCode?: number };
  return {
    code: String(error.code || error.type || "stripe_error").slice(0,100),
    requestId: typeof error.requestId === "string" && /^req_[a-zA-Z0-9]+$/.test(error.requestId) ? error.requestId : undefined,
    message: String(error.message || "Stripe n’a pas confirmé cette opération.")
      .replace(/(?:sk|rk|pk)_(?:test|live)_[a-zA-Z0-9]+/g,"[clé masquée]").slice(0,700),
    statusCode:error.statusCode,
  };
}
export async function diagnosePayoutTest(client: () => Stripe = stripeTest): Promise<PayoutDiagnostic> {
  try {
    const stripe=client();
    const [account,balance]=await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve()]);
    if(balance.livemode !== false) throw Error("Mode réel refusé.");
    const banks=account.external_accounts?.data || [];
    const bank=banks.find(item=>item.object==="bank_account" && item.currency==="eur" && item.default_for_currency) as Stripe.BankAccount | undefined;
    const available=balance.available.find(item=>item.currency==="eur")?.amount || 0;
    const checks:string[]=[];
    if(!bank) checks.push("Aucun compte bancaire EUR par défaut n’est configuré dans ce bac à sable Stripe. Aucun destinataire ne peut recevoir le test.");
    if(!account.payouts_enabled) checks.push("Les versements ne sont pas activés sur ce compte Stripe test.");
    if(available<1) checks.push("Le solde EUR disponible de Stripe est inférieur à 0,01 €. Des crédits Mentora ne constituent pas un solde Stripe.");
    return {testMode:true,ready:!!bank && !!account.payouts_enabled && available>=1,accountId:account.id,availableCents:available,
      ...(bank?{destination:{id:bank.id,bankName:bank.bank_name || "Banque de test",last4:bank.last4 || "",currency:bank.currency}}:{}),checks};
  } catch(failure) {
    const error=safeStripeFailure(failure);
    return {testMode:true,ready:false,checks:[`Stripe : ${error.message}`],code:error.code,requestId:error.requestId};
  }
}
