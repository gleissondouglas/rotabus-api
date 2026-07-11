import * as SecureStore from "expo-secure-store";

import {
  completeOnboarding,
  hasSeenOnboarding,
  ONBOARDING_STORAGE_KEY,
  resetOnboarding,
} from "./onboardingStorage";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("onboardingStorage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("identifica quando o onboarding já foi concluído", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("true");

    await expect(hasSeenOnboarding()).resolves.toBe(true);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY);
  });

  it("considera primeiro acesso quando não há valor salvo", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(hasSeenOnboarding()).resolves.toBe(false);
  });

  it("salva a conclusão do onboarding", async () => {
    await completeOnboarding();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, "true");
  });

  it("permite resetar o onboarding", async () => {
    await resetOnboarding();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY);
  });
});
