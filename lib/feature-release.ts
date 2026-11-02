// New features are beta by default. Promote to stable after validation.
// Existing functionality remains available; never use this to bypass role/admin checks.
export const featureReleases: Record<string, "beta" | "stable"> = {
  community: "stable",
  onboardingV2: "beta",
  betaFeedback: "beta",
};
export function featureAvailable(feature: string, betaTester: boolean) {
  return featureReleases[feature] === "stable" || betaTester;
}
