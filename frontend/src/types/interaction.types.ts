export type InteractionMode = "voice" | "text";

export function getInteractionMode(value: string | string[] | undefined): InteractionMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "voice" ? "voice" : "text";
}
