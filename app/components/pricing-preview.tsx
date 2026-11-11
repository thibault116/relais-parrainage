import { joinOffers } from "@/lib/join-offers";
import { JoinOffers } from "./join-offers";

const offers = joinOffers();

export function PricingPreview() {
  return (
    <div className="wrap pricing-preview">
      <JoinOffers previewOffers={offers} />
    </div>
  );
}
