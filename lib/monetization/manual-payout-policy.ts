// No provider or banking API is used, even in a future live manual workflow.
// These THREE deliberate deployment settings are required after legal review.
export function manualPayoutPolicy() {
  const liveEnabled=process.env.MENTORA_MANUAL_PAYOUTS_LIVE_ENABLED==="true"
    && process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATED==="true"
    && !!process.env.MENTORA_MANUAL_PAYOUTS_LEGAL_VALIDATION_REFERENCE?.trim();
  return {liveEnabled,mode:liveEnabled?"live" as const:"test" as const};
}
