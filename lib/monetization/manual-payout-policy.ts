import {billingLive,liveReadiness,moneyMode,memberCommerceAuthorized} from "./mode";
// No provider or banking API is used, even in a future live manual workflow.
// The explicit member release authorizes manual requests; legacy private switches remain supported.
// No transfer is ever executed here.
export function manualPayoutPolicy() {
  const liveEnabled=billingLive() && liveReadiness().ready && (memberCommerceAuthorized() || process.env.MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED==="true"
    && process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED==="true"
    && !!process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE?.trim());
  return {liveEnabled,mode:moneyMode()};
}
