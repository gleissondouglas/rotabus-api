import { appStorage } from "./storage.service";

export const ONBOARDING_STORAGE_KEY = "nuvem_has_seen_onboarding";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await appStorage.getItem(ONBOARDING_STORAGE_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function completeOnboarding(): Promise<void> {
  await appStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
}

/** Útil para desenvolvimento e testes manuais do primeiro acesso. */
export async function resetOnboarding(): Promise<void> {
  await appStorage.deleteItem(ONBOARDING_STORAGE_KEY);
}
