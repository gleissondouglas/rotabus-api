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
    title: "Bem-vindo ao Nuvem",
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
    title: "Escolha e siga sua rota",
    description: "Confirme o destino, escolha o horário e veja a melhor rota para chegar.",
    visual: "route",
  },
];
