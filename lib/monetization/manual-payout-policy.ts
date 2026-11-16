import {billingLive,liveReadiness,moneyMode} from "./mode";
// No provider or banking API is used, even in a future live manual workflow.
// These THREE deliberate deployment settings are required after legal review.
export function manualPayoutPolicy() {
  const liveEnabled=billingLive() && liveReadiness().ready && process.env.MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED==="true"
    && process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED==="true"
    && !!process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE?.trim();
  return {liveEnabled,mode:moneyMode()};
}
