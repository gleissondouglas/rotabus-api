# O Projeto

Este documento descreve as características fundamentais do projeto Nuvem, detalhando suas motivações, escopo técnico, limitações estruturais e requisitos.

## 1. História e Motivação

O projeto nasceu sob o codinome `RotaBus-API` (ainda refletido em repositórios e pacotes). A motivação inicial era criar uma alternativa ao transporte público que resolvesse rotas de ônibus, mas logo a equipe identificou uma lacuna severa de UX em aplicativos de mercado: a exclusão digital de pessoas mais velhas ou com limitações.

Ao invés de criar mais um aplicativo de mapas complexo, a decisão arquitetural e de produto pivotou para o **Nuvem**: um assistente conversacional simplificado. O sistema evoluiu de ser apenas uma camada que repassava comandos para a API do Google (estado anterior) para possuir um motor de estado de diálogo (Dialog Manager) residente no backend.

## 2. Objetivos Principais

- Fornecer rotas seguras de transporte público e caminhada através de uma interface de voz.
- Isolar a complexidade dos provedores externos (Google) de forma que o frontend consuma apenas dados formatados e prontos para renderização e leitura.
- Garantir sustentabilidade financeira do projeto através de proteção de limites de API e camadas de cache.

## 3. Escopo

### O que ESTÁ no escopo (In Scope):
- **Aplicativo Mobile:** Frontend em React Native (Expo).
- **Backend Central:** Node.js (Express) provendo a orquestração e gerenciamento de estado conversacional.
- **Contas de Usuário:** Sistema próprio de autenticação (JWT) para gestão de usuários, limites e preferências.
- **Processamento de Voz:** Transcrição e normalização de comandos do usuário.
- **Geocodificação e Rotas:** Integração com APIs do Google (Places, Routes, Geocoding).
- **Navegação Voice-First:** FSM (Finite State Machine) no backend e no frontend coordenando as trocas de estado (Aguardando destino -> Confirmando -> Mostrando rota).

### O que NÃO ESTÁ no escopo (Out of Scope):
- Roteamento nativo offline.
- Chatbots genéricos ou bate-papo de domínio aberto (O sistema responde estritamente a questões de mobilidade).
- Microserviços: O projeto manter-se-á como um monólito modular enquanto o tráfego não justificar fragmentação (Evitando Overengineering).
- Obrigação de IA Generativa: O sistema deve funcionar prioritariamente de forma determinística; IA generativa é opcional (Fallback).

## 4. Limitações Conhecidas

- **Custo Externo:** As APIs de processamento natural do Google (Speech) e de rotas (Google Routes) possuem custo transacional. O sistema depende de controle de taxa (`dailyLimit`) e `RouteCache` na memória.
- **Transcrições de Voz:** A precisão da conversão Speech-to-Text em locais muito barulhentos pode falhar; o fallback em texto (toque/teclado) é obrigatório.
- **Sincronismo de Sessão:** Como a interação Voice-First requer múltiplas chamadas HTTP, se o usuário fechar o aplicativo no meio da interação, a sessão conversacional (guardada no Backend) irá expirar por TTL.

## 5. Requisitos e Premissas

### Requisitos Funcionais
- **RF-01:** O sistema deve autenticar usuários com E-mail e Senha.
- **RF-02:** O sistema deve receber entrada de texto (digitado ou transcrito de voz).
- **RF-03:** O sistema deve identificar a intenção do usuário (Buscar destino, Confirmar, Cancelar).
- **RF-04:** O sistema deve manter o contexto de um diálogo com múltiplos turnos (ex: "Qual hospital?" -> "O primeiro").
- **RF-05:** O sistema deve buscar e apresentar trajetos de transporte público e caminhada.
- **RF-06:** O sistema deve impor um limite diário de buscas para usuários para evitar custos abusivos (Proteção Financeira).

### Requisitos Não Funcionais
- **RNF-01 (Performance):** Respostas conversacionais devem retornar em menos de 1000ms (desconsiderando latência da rede e do provedor STT externo) para manter a fluidez do diálogo.
- **RNF-02 (Acessibilidade):** O aplicativo mobile deve suportar alto contraste, fontes grandes nativas e leitores de tela.
- **RNF-03 (Isolamento):** Módulos não podem interagir diretamente com o Prisma ou Axios fora da camada de Providers/Repositories.
- **RNF-04 (Segurança):** Senhas nunca são salvas em plain text; tokens são assinados e logs não expõem PII (Personal Identifiable Information).

### Premissas
- O usuário possui conexão constante à internet (3G/4G).
- O backend atua como autoridade suprema do estado; o frontend atua como um terminal de renderização e coleta de I/O.
