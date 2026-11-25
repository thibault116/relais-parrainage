// New features are beta by default. Promote to stable after validation.
// Existing functionality remains available; never use this to bypass role/admin checks.
export const featureReleases: Record<string, "beta" | "stable"> = {
  memberProfiles: "stable", // Explicit public release requested by the owner.
  mentorActivity: "stable", // Explicit public release requested by the owner.
  ambassadors: "beta",
  community: "stable",
  guides: "stable",
  commerce: "stable",
  mobileExtras: "beta",
  privateMessaging: "beta",
  communityChannels: "beta",
  communityReplies: "beta",
  communityEditing: "beta",
  onboardingV2: "stable",
  betaFeedback: "beta",
};
export function featureAvailable(feature: string, betaTester: boolean) {
  return featureReleases[feature] === "stable" || betaTester;
}
