export function CreditCoin({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`mentora-credit-coin ${small ? "small" : ""}`}
      role="img"
      aria-label="Crédits Mentora"
    >
      <span>M</span>
    </span>
  );
}
