# RotaBus RotaBus

![Badge](https://img.shields.io/badge/Status-Em_Desenvolvimento-blue)
![Architecture](https://img.shields.io/badge/Arquitetura-Monorepo-orange)
![Mobile](https://img.shields.io/badge/Frontend-React_Native_%2F_Expo-black)
![Backend](https://img.shields.io/badge/Backend-Node.js_%2F_Express-green)

> ⚠️ **Nota Legal e Uso:** Este repositório é uma vitrine técnica para fins de portfólio e demonstração de arquitetura. O uso comercial, cópia ou distribuição do código para lançamento de apps de terceiros é expressamente **proibido** (veja o arquivo `LICENSE`). Além disso, tentar executar este projeto localmente exige configurações avançadas de infraestrutura (Banco de Dados, Redis, Chaves Privadas do Google Cloud, Sentry, Expo/EAS), que **não** estão incluídas publicamente no código.

O **RotaBus** é um ecossistema de mobilidade urbana construído com foco absoluto em **Acessibilidade, Simplicidade e Desempenho**.

### O Problema (Por que criei este projeto?)
A maioria dos aplicativos de transporte atuais (como Google Maps ou Moovit) foi desenhada para usuários com alta alfabetização digital. Eles oferecem interfaces repletas de botões, letreiros minúsculos e mapas confusos que, na prática, **excluem** idosos, pessoas com baixa visão ou usuários pouco habituados à tecnologia. Para esse público, descobrir "como ir ao hospital" torna-se uma barreira cognitiva frustrante.

### A Solução
O RotaBus quebra esse paradigma ao oferecer uma **Assistente de Mobilidade Híbrida (Voz + Toque)**. 
- Em vez de ler um mapa difícil, o app **fala** de forma resumida e humana: *"A rota mais rápida é pegar o ônibus 10 na esquina, ele chega em 5 minutos"*.
- O design abandona os jargões confusos ("Opção 1, Opção 2") por nomes inteligentes dinâmicos ("Mais rápida", "Menos trocas").
- Foi arquitetado do zero para não conflitar com leitores de tela nativos (TalkBack/VoiceOver), sendo uma ferramenta verdadeiramente inclusiva para Pessoas Com Deficiência (PCDs).

---

## Estrutura do Monorepo

Este repositório principal orquestra todo o projeto e é dividido em duas grandes partes:

1. **[Frontend (App Mobile)](./frontend)**: Desenvolvido em React Native / Expo. Um aplicativo focado em acessibilidade e toques guiados, interface imersiva e limpa. Suporta navegação baseada em escolhas objetivas, abandonando a antiga navegação de IA Generativa por interações rápidas na tela.
2. **[Backend (API)](./backend)**: Desenvolvido em Node.js (Express), conectando-se a bancos Postgres (via Prisma) e cluster Redis (`ioredis`) para cache massivo. Responsável por traduzir requisições rápidas para a **Google Routes/Places API**, processando regras locais (**Local Intelligence** e **Crowdsourcing**) de forma determinística e com latência mínima. Agora fortemente tipado/testado com **Jest** para segurança da arquitetura. Zero custo com Inteligências Artificiais Generativas.

---

## Documentação e Decisões Arquiteturais

Todo o ecossistema é extensamente documentado para fins de portfólio e histórico de desenvolvimento. Para explorar a arquitetura e as soluções técnicas adotadas, leia a pasta [`/docs`](./docs):

- **[00 - Visão Geral](./docs/00-VISAO-GERAL.md)**
- **[08 - A Abordagem Sem-IA e Inteligência Local](./docs/08-IA.md)**
- **[14 - Design System](./docs/14-DESIGN-SYSTEM.md)**
- **[18 - ROADMAP Atual e Futuro](./docs/18-ROADMAP.md)**

---

## Ambiente de Execução (Local)

*Nota: Este é um projeto pessoal/fechado e as instruções abaixo servem apenas como documentação do ambiente de engenharia estabelecido.*

Cada diretório possui suas dependências e variáveis de ambiente independentes (`.env`). O sistema funciona sob dois servidores simultâneos:

1. **Backend (`/backend`)**:
   - Requer Redis (cache) e PostgreSQL em execução local.
   - Inicializado via `npm run dev`.

2. **Frontend (`/frontend`)**:
   - Inicializado via `npx expo start` (iOS/Android).

*(Veja os arquivos README específicos dentro de `/backend` e `/frontend` para mais detalhes de testes e execução).*
