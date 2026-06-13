# Análise Técnica do Projeto: Nuvem (RotaBus-API)

Este documento apresenta um diagnóstico técnico detalhado do sistema Nuvem, mapeando o estado atual da aplicação, os pontos identificados na auditoria e a visão estratégica para a evolução do produto.

---

## 1. Visão Geral do Sistema

O Nuvem é uma plataforma de mobilidade urbana voltada para acessibilidade, focada em simplificar a navegação para usuários com deficiência visual ou baixa literacia digital através de interfaces limpas e comandos de voz.

*   **Problema Resolvido:** Complexidade e sobrecarga cognitiva de aplicativos de navegação tradicionais.
*   **Público-alvo:** Pessoas com deficiência visual, idosos e usuários que necessitam de auxílio na mobilidade urbana.
*   **Fluxo Principal Atual:** O usuário informa um destino (via voz ou texto), o sistema resolve a localização, sugere opções e calcula a rota de transporte público/caminhada.

---

## 2. Diagnóstico da Arquitetura Atual

Atualmente, o projeto está estruturado como um **Monólito Modular em Camadas**.

### 2.1 Organização de Pastas
A separação de responsabilidades é clara e segue o padrão:
*   **Routes:** Definição de endpoints.
*   **Controllers:** Orquestração de entrada e saída HTTP.
*   **Services:** Lógica de negócio e orquestração de fluxos.
*   **Repositories:** Abstração de persistência (Prisma).
*   **Providers:** Integração com APIs externas (Google).

### 2.2 Estado das Tecnologias
*   **Backend:** Node.js com Express 5.x.
*   **Banco de Dados:** PostgreSQL via Prisma ORM.
*   **Integrações:** Google Routes, Places, Geocoding e Speech-to-Text.
*   **Segurança:** Implementada via JWT, Bcrypt, Rate Limiting e Sanitização básica.

---

## 3. Análise Crítica (Auditoria)

### Pontos Fortes
*   **Limpeza de Código:** Comentários explicativos de alta qualidade e estrutura semântica.
*   **Prevenção de Custos:** Sistema de `RouteCache` robusto que evita chamadas repetitivas e caras às APIs do Google.
*   **Segurança de Negócio:** Middleware `dailyLimit` que protege o orçamento das APIs externas por usuário.
*   **Tratamento de Erros:** Middleware de erro global e uso de `AppError` para respostas padronizadas.

### Pontos de Atenção (Débito Técnico)
*   **Acúmulo de Lógica (God Object):** O arquivo `journey.mapper.js` concentra responsabilidades demais (tradução de dados, formatação de fala, cálculos de tempo), dificultando a manutenção.
*   **Lógica Hardcoded:** Regras de "aliases locais" (ex: nomes de locais em Uberaba) estão dentro dos serviços, dificultando a expansão para outras cidades.
*   **Acoplamento com Provedores:** Embora existam pastas de `providers`, os serviços ainda possuem conhecimento direto das respostas estruturadas do Google.

---

## 4. Visão Estratégica: Nuvem Voice-First

O projeto encontra-se em uma fase de transição entre um sistema reativo a comandos e um assistente proativo.

### 4.1 Estado Atual vs. Visão Futura

| Característica | Estado Atual (Comando de Voz) | Visão Futura (Assistente Conversacional) |
| :--- | :--- | :--- |
| **Interação Principal** | Voz focada na informação de destino. | Interação fluida (conversa de ida e volta). |
| **Entrada do Usuário** | Toque na tela é necessário em várias etapas. | Voz como interface primária (voice-first). |
| **Condução do Fluxo** | O usuário decide o próximo passo. | O assistente conduz o usuário pelo fluxo. |
| **Gerenciamento de Estado** | Estados simples e efêmeros. | Dialog Manager mantendo contexto e histórico. |
| **Respostas do Backend** | Dados puros para renderização de rotas. | Respostas estruturadas (Fala + Tela + Opções). |

### 4.2 Papel das Camadas na Visão Futura

*   **Backend:** Deve atuar como o "Cérebro" do sistema, concentrando a detecção de intenção, gerenciamento de estado da conversa e orquestração de todos os providers externos.
*   **Frontend:** Atuará como a "Interface de Renderização de Estados", responsável pela captura de áudio, reprodução de fala, acessibilidade (Haptics, Screen Readers) e experiência visual, mas seguindo as diretrizes de fluxo enviadas pelo backend.

---

## 5. Riscos e Recomendações

### Riscos Técnicos
1.  **Latência de Voz:** O processamento em cascata (STT -> Intenção -> Rotas -> Resposta) pode gerar atrasos que prejudicam a experiência conversacional.
2.  **Dependência de Provedores:** Mudanças nos termos ou preços das APIs do Google podem impactar severamente o projeto.
3.  **Complexidade de Estado:** Gerenciar diálogos que podem ser interrompidos ou alterados a qualquer momento exige um design de software robusto.

### Recomendações Imediatas
1.  **Extração de Utilidades:** Decompor o `journey.mapper.js` em utilitários menores e testáveis.
2.  **Preparação de Contratos:** Definir um contrato de resposta padrão que já preveja `speechText` e `displayData`.
3.  **Abstração de Provedores:** Evoluir os `providers` para que o Core do sistema não conheça os schemas do Google, facilitando a migração para Clean Architecture.

---

## 6. Pendente de Confirmação

*   [ ] Existe alguma estratégia de persistência para o histórico de conversas em banco de dados ou será apenas em memória (sessão)?
*   [ ] O suporte a outras cidades além de Uberaba deve ser automatizado ou mantido via arquivos de configuração manuais?
*   [ ] A detecção de intenção (Intent Detection) inicial será via processamento de texto (Regex/NLP) ou já se planeja o uso de LLMs?

---
*Documento gerado como base para o plano de evolução arquitetural do projeto Nuvem.*
