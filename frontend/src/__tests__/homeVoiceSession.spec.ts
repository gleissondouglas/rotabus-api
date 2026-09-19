import { shouldAutoStartHomeVoice, markHomeVoiceAutoStarted, resetHomeVoiceSessionForTests } from "../state/homeVoiceSession";

describe("homeVoiceSession", () => {
  beforeEach(() => {
    resetHomeVoiceSessionForTests();
  });

  it("deve retornar true inicialmente para shouldAutoStartHomeVoice", () => {
    expect(shouldAutoStartHomeVoice()).toBe(true);
  });

  it("deve retornar false após chamar markHomeVoiceAutoStarted", () => {
    markHomeVoiceAutoStarted();
    expect(shouldAutoStartHomeVoice()).toBe(false);
  });

  it("deve resetar o estado corretamente ao chamar resetHomeVoiceSessionForTests", () => {
    markHomeVoiceAutoStarted();
    expect(shouldAutoStartHomeVoice()).toBe(false);
    
    resetHomeVoiceSessionForTests();
    expect(shouldAutoStartHomeVoice()).toBe(true);
  });
});
