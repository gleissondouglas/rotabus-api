const googleSpeechProvider = require("../../../../src/modules/journeys/providers/googleSpeech.provider");
const { transcribe } = require("../../../../src/modules/journeys/providers/speech.provider");

jest.mock("../../../../src/modules/journeys/providers/googleSpeech.provider", () => ({
  transcribe: jest.fn(),
}));

describe("speech.provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve repassar a chamada transcribe para o googleSpeechProvider", async () => {
    const audioBase64 = "base64String";
    const mimeType = "audio/webm";
    googleSpeechProvider.transcribe.mockResolvedValue("transcription text");

    const result = await transcribe(audioBase64, mimeType);

    expect(result).toBe("transcription text");
    expect(googleSpeechProvider.transcribe).toHaveBeenCalledWith(audioBase64, mimeType);
  });
});
