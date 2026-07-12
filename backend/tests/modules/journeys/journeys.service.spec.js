jest.mock("../../../src/modules/journeys/providers/speech.provider", () => ({
  transcribe: jest.fn(),
}));

const speechProvider = require("../../../src/modules/journeys/providers/speech.provider");
const { transcribeAudioService } = require("../../../src/modules/journeys/journeys.service");

describe("transcribeAudioService security", () => {
  const validAudio = Buffer.from("audio de teste").toString("base64");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("aceita áudio base64 e MIME suportado", async () => {
    speechProvider.transcribe.mockResolvedValue("destino reconhecido");

    await expect(transcribeAudioService({
      audioBase64: validAudio,
      mimeType: "audio/webm;codecs=opus",
    })).resolves.toEqual({ text: "destino reconhecido" });

    expect(speechProvider.transcribe).toHaveBeenCalledWith(validAudio, "audio/webm");
  });

  test("rejeita MIME não permitido antes de chamar o provedor", async () => {
    await expect(transcribeAudioService({
      audioBase64: validAudio,
      mimeType: "text/html",
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(speechProvider.transcribe).not.toHaveBeenCalled();
  });

  test("rejeita base64 inválido antes de chamar o provedor", async () => {
    await expect(transcribeAudioService({
      audioBase64: "<script>alert(1)</script>",
      mimeType: "audio/webm",
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(speechProvider.transcribe).not.toHaveBeenCalled();
  });
});
