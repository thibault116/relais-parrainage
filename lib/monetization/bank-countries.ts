// Beneficiary country is chosen once when the connected account is created.
// The bank's country and IBAN are collected separately by Stripe's secure UI.
export const defaultPayoutCountry="FR";
export const payoutCountries={FR:"France",BE:"Belgique",LU:"Luxembourg",DE:"Allemagne",ES:"Espagne",IT:"Italie",CH:"Suisse",GB:"Royaume-Uni",US:"États-Unis",CA:"Canada"} as const;
export const euroPayoutCountries=new Set<string>(["FR","BE","LU","DE","ES","IT"]);
export function payoutCountryLabel(country?:string|null) {
  return country ? payoutCountries[country as keyof typeof payoutCountries] || country : "";
}
