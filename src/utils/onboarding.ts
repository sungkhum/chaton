/**
 * Check if onboarding has been completed for this user.
 */
export function isOnboardingComplete(publicKey: string): boolean {
  try {
    return localStorage.getItem(`chaton:onboarded:${publicKey}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as complete for this user.
 */
export function markOnboardingComplete(publicKey: string) {
  try {
    localStorage.setItem(`chaton:onboarded:${publicKey}`, "1");
  } catch {
    // localStorage may be unavailable
  }
}
