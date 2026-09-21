export type OnboardingVisualType = "assistant" | "input" | "route";

export type OnboardingSlideData = {
  id: string;
  title: string;
  description: string;
  example?: string;
  visual: OnboardingVisualType;
};

export const onboardingSlides: OnboardingSlideData[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao RotaBus",
    description: "Seu assistente para encontrar rotas de ônibus de forma simples.",
    visual: "assistant",
  },
  {
    id: "destination",
    title: "Fale ou digite seu destino",
    description: "Diga para onde quer ir ou escreva o nome do lugar.",
    example: "Quero ir para a Uniube",
    visual: "input",
  },
  {
    id: "route",
    title: "Sua rota começa aqui.",
    description: "Encontre ônibus em tempo real e chegue a qualquer lugar com apenas um toque.",
    visual: "assistant",
  },
];
