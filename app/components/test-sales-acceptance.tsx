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
        <span>J’accepte les <a href={live?"/juridique/cgv":"/juridique/conditions-test"} target="_blank" rel="noreferrer">{live?"conditions générales de vente":"conditions des paiements de test"}</a>.</span>
      </label>
      <p><a href="/juridique/cgv" target="_blank" rel="noreferrer">{live?"CGV":"Projet de CGV"}</a> · <a href="/juridique/contrats" target="_blank" rel="noreferrer">Rétractation et résiliation</a> · <a href="/juridique/confidentialite" target="_blank" rel="noreferrer">Confidentialité</a></p>
    </div>
  );
}
