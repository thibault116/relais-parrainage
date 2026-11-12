import type Stripe from "stripe";
import { stripeTest } from "./stripe";
import { testPayoutCents } from "./payout-config";
export type PayoutDiagnostic = {
  testMode: true; ready: boolean; minimumCents: number; accountId?: string; availableCents?: number;
  destination?: { id: string; bankName: string; last4: string; currency: string };
  usesDefaultDestination?: boolean;
  checks: string[]; code?: string; requestId?: string;
};
export function safeStripeFailure(failure: unknown) {
  const error = failure as { code?: string; type?: string; message?: string; requestId?: string; statusCode?: number };
  return {
    code: String(error.code || error.type || "stripe_error").slice(0,100),
    requestId: typeof error.requestId === "string" && /^req_[a-zA-Z0-9]+$/.test(error.requestId) ? error.requestId : undefined,
    message: String(error.message || "Stripe n’a pas confirmé cette opération.")
      .replace(/(?:sk|rk|pk)_(?:test|live)_[a-zA-Z0-9*]+/g,"[clé masquée]").slice(0,700),
    statusCode:error.statusCode,
  };
}
export async function diagnosePayoutTest(client: () => Stripe = stripeTest): Promise<PayoutDiagnostic> {
  try {
    const stripe=client();
    const [account,balance]=await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve()]);
    if(balance.livemode !== false) throw Error("Mode réel refusé.");
    // /v1/account returns this platform's bank destinations. The separate
    // /accounts/:id/external_accounts endpoint is intended for Connect accounts
    // and can reject even a full-access key on the platform itself.
    const banks=account.external_accounts?.data || [];
    const bank=banks.find(item=>item.object==="bank_account" && item.currency==="eur" && item.default_for_currency) as Stripe.BankAccount | undefined;
    const available=balance.available.find(item=>item.currency==="eur")?.amount || 0;
    // Some own-account responses omit bank details. The documented Payout API
    // can select the authenticated account's default EUR destination itself.
    // Do not call a Connect endpoint or invent a destination in that case.
    const usesDefaultDestination=!bank && (!account.external_accounts || account.external_accounts.has_more);
    const checks:string[]=[];
    if(!bank && !usesDefaultDestination) checks.push("Aucun compte bancaire EUR par défaut n’est configuré dans ce bac à sable Stripe. Aucun destinataire ne peut recevoir le test.");
    if(usesDefaultDestination) checks.push("Les coordonnées bancaires ne sont pas exposées par cette API. Stripe sélectionnera sa destination EUR par défaut et refusera le test si aucune banque n’est configurée.");
    if(available<testPayoutCents) checks.push("Le solde EUR disponible de Stripe est inférieur au montant du test de 1 €. Des crédits Mentora ne constituent pas un solde Stripe.");
    return {testMode:true,ready:(!!bank || !!usesDefaultDestination) && available>=testPayoutCents,usesDefaultDestination:!!usesDefaultDestination,minimumCents:testPayoutCents,accountId:account.id,availableCents:available,
      ...(bank?{destination:{id:bank.id,bankName:bank.bank_name || "Banque de test",last4:bank.last4 || "",currency:bank.currency}}:{}),checks};
  } catch(failure) {
    const error=safeStripeFailure(failure);
    return {testMode:true,ready:false,minimumCents:testPayoutCents,checks:[`Stripe : ${error.message}`],code:error.code,requestId:error.requestId};
  }
}
