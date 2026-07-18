# Qualidade e Testes de Software

Este projeto baseia-se em práticas de Engenharia de Software robustas visando garantir que as refatorações arquiteturais não quebrem o comportamento em produção (Regression). O Jest atua como o test runner primário no Backend e Frontend.

## 1. Testes de Unidade (Unit Tests)

Foco total em arquivos que tomam decisão lógica sem depender do Banco ou APIs.
- **Alvos Backend:** Validators, Middlewares (Auth, Error), Utils (Mappers de data), e principalmente os Mappers de estrutura (`conversational.mapper.js`).
- **Alvos Frontend:** Parsers de Voz (`voiceIntentParser.ts`), Parsers de tempo, e testes isolados das lógicas visuais puras.

Mocks (`jest.fn()`) são amplamente utilizados para anular as injeções externas de repositórios ao testar os Services.

## 2. Testes de Integração (Integration Tests)

Os testes de integração acionam a pipeline inteira (`Supertest`), simulando requests HTTP que trafegam desde a Rota (Router) até atingir o banco ou serviço.
- O Banco de Dados de testes é separado do banco de Desenvolvimento e Produção (Normalmente contêiner PostgreSQL efêmero).
- Os requests de Providers externos (Google Routes) **devem** ser interceptados por bibliotecas como o `nock` ou abstrações de injeção que injetam `fixtures` (Json fake guardados, como em `tests/fixtures/google-routes/transit-simple.json`). NENHUM teste roda batendo nas APIs reais.

## 3. Cobertura Esperada (Coverage)

Não impomos metas irracionais de 100% de cobertura, pois o esforço excede o custo-benefício em camadas rasas, porém as camadas críticas da FSM `DialogManager` e dos Mappers requerem obrigatoriamente cobertura robusta.

## 4. Testes End-to-End (E2E) e Testes de Aceitação

E2E são geridos, por enquanto, através de roteiros rigorosos de testes manuais gravados, como descritos nos arquivos legados `CONVERSATIONAL_E2E_MANUAL_TEST.md`. O E2E deve simular e checar interações físicas no dispositivo.
- Validação se o microfone está mudo quando TTS toca.
- Fluxo simulado rejeitando opção.

Planeja-se migração futura para testes automatizados sistêmicos via Maestro ou Detox para testar a renderização visual e botões emulados.
