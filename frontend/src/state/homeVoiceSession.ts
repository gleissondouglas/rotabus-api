let hasAutoStartedHomeVoice = false;

export function shouldAutoStartHomeVoice() {
  return !hasAutoStartedHomeVoice;
}

export function markHomeVoiceAutoStarted() {
  hasAutoStartedHomeVoice = true;
}

export function resetHomeVoiceSessionForTests() {
  hasAutoStartedHomeVoice = false;
}
