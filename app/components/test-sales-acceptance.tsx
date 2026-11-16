"use client";

export function TestSalesAcceptance({ checked, onChange, live=false }: {
  live?:boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="test-sales-acceptance">
      <label className="legal-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>J’accepte les <a href={live?"/juridique/cgv#paiement-confidentialite":"/juridique/conditions-test#paiement-confidentialite"} target="_blank" rel="noreferrer">conditions de paiement et de confidentialité</a>.</span>
      </label>
    </div>
  );
}
