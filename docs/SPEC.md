# Especificação do Produto: Nuvem (RotaBus-API)

Este documento define a visão, as funcionalidades e os critérios de sucesso do produto Nuvem. Ele serve como a fonte principal de verdade (Single Source of Truth) para o desenvolvimento e evolução do sistema.

---

## 1. Visão do Produto

O Nuvem é uma plataforma de mobilidade urbana assistida que visa democratizar o acesso ao transporte público através da tecnologia de voz e interfaces simplificadas. 

*   **Problema:** Apps de navegação tradicionais são visualmente poluídos, cognitivamente pesados e muitas vezes inacessíveis para quem possui limitações visuais ou baixa familiaridade tecnológica.
*   **Proposta de Valor:** Transformar a complexidade do planejamento de rotas em uma interação simples e conversacional (**Voice-First, não Voice-Only**).

---

## 2. Público-Alvo

1.  **Prioridade Máxima:** Idosos e Pessoas com Deficiência (PCDs).
2.  **Foco Secundário:** Pessoas com baixa literacia digital ou que necessitam de auxílio na mobilidade urbana.
3.  **Uso Geral:** Usuários que buscam uma interface mãos-livres e objetiva.

---

## 3. Estados do Produto

### 3.1 Estado Atual (As-Is)
*   Sistema reativo baseado em comandos isolados.
*   Voz usada para entrada de destino (transcrição simples).
*   Fluxo fragmentado que exige interações visuais e toques constantes para avançar.
*   Backend atua como um provedor de dados brutos (rotas e geocodificação).

### 3.2 MVP (Minimum Viable Product)
*   **Objetivo:** Validar a proposta de valor principal: ajudar o usuário a planejar uma rota com baixa complexidade.
*   **Foco:** Fluxo funcional simplificado usando voz ou texto, apresentação de opções claras e instruções acessíveis.
*   **Diferencial:** Redução drástica da carga cognitiva em relação a apps tradicionais.

### 3.3 Visão Futura (To-Be)
*   Assistente de mobilidade conversacional completo.
*   Sistema conduz o usuário por voz, mantendo o contexto da interação.
*   Backend retornando respostas estruturadas para orientar o fluxo (Fala + Tela + Opções + Próxima Ação).
*   Inteligência local refinada para entender referências regionais.

---

## 4. Jornada Principal do Usuário (Ideal)

1.  **Abertura:** O usuário abre o app e é recebido com uma pergunta: "Para onde você quer ir hoje?".
2.  **Entrada:** O usuário fala ou digita o destino (ex: "Quero ir no hospital").
3.  **Processamento:** O sistema interpreta o destino e busca localizações próximas.
4.  **Resolução:** Caso haja múltiplas opções, o sistema apresenta: "Encontrei dois hospitais próximos. Você quer o primeiro ou o segundo?".
5.  **Seleção:** O usuário escolhe por voz ou toque na tela.
6.  **Planejamento:** O sistema calcula a melhor rota de ônibus e caminhada.
7.  **Orientação:** O app orienta o usuário com linguagem simples (ex: "Ande até o ponto da Praça Rui Barbosa e pegue o ônibus linha 10").

---

## 5. Requisitos

### 5.1 Requisitos Funcionais (RF)
*   **RF-01 (Auth):** Cadastro e login de usuários.
*   **RF-02 (Input):** Informar destino por voz ou texto.
*   **RF-03 (Discovery):** Resolver destinos genéricos ou informais.
*   **RF-04 (Selection):** Listar e permitir a escolha entre opções de destino.
*   **RF-05 (Routing):** Calcular rotas de transporte público e caminhada.
*   **RF-06 (Instruction):** Exibir/falar instruções de navegação simples e acessíveis.
*   **RF-07 (Evolution):** Suporte a respostas estruturadas para o modelo voice-first.

### 5.2 Requisitos Não Funcionais (RNF)
*   **RNF-01 (Acessibilidade):** Interface compatível com leitores de tela e padrões de alto contraste.
*   **RNF-02 (Cognição):** Baixa carga cognitiva e linguagem extremamente simples.
*   **RNF-03 (Custo):** Proteção financeira através de Cache e Rate Limits.
*   **RNF-04 (Desempenho):** Baixa latência nas respostas de voz e planejamento.
*   **RNF-05 (Segurança):** Autenticação robusta e proteção de dados sensíveis.
*   **RNF-06 (Arquitetura):** Evolução gradual para Clean Architecture/Hexagonal.

---

## 6. Fora de Escopo (Out of Scope)

*   Migração para Microsserviços neste momento.
*   Uso obrigatório de LLMs (IA Generativa) como dependência central.
*   Conversa livre de domínio aberto (Chatterbot sem foco em mobilidade).
*   Expansão automática e imediata para todas as cidades.
*   Substituição completa da interação por toque (Toque é Fallback vital).

---

## 7. Critérios de Sucesso

*   **Navegação Simplificada:** O usuário planeja rotas sem precisar interpretar mapas complexos.
*   **Clareza Conversacional:** O sistema retorna opções inequívocas para termos genéricos.
*   **Acessibilidade de Conteúdo:** O usuário recebe instruções curtas, diretas e fáceis de memorizar.
*   **Eficiência de Infra:** O backend protege o orçamento do projeto com cache e limites de uso.
*   **Resiliência Técnica:** A arquitetura permite evoluções para a visão conversacional sem exigir reescritas totais do sistema.

---
*Este documento reflete o compromisso com a acessibilidade e a inovação tecnológica no transporte público.*
