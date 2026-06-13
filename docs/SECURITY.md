# Políticas de Segurança e Proteção de Custo: Nuvem

Este documento registra as diretrizes, práticas e mecanismos de segurança implementados no ecossistema Nuvem (RotaBus-API), com foco na proteção de dados dos usuários e na sustentabilidade financeira do projeto.

---

## 1. Princípios de Segurança

O desenvolvimento do Nuvem é guiado pelos seguintes princípios:

*   **Isolamento de Credenciais:** Chaves de API sensíveis (Google Routes, Places, Speech, Geocoding) e segredos (JWT_SECRET) devem residir apenas no backend ou ambiente seguro.
*   **Armazenamento Seguro:** Senhas nunca devem ser armazenadas em texto puro.
*   **Tráfego Criptografado:** Em produção, todo tráfego entre frontend e backend deve ocorrer obrigatoriamente via HTTPS.
*   **Segurança Financeira:** A proteção contra o consumo excessivo de APIs pagas é um requisito arquitetural estratégico (**ADR-005**).
*   **Menor Privilégio:** O acesso é restrito com base na identidade e no papel (`role`) do usuário.
*   **Defesa em Camadas:** Uso de validação, sanitização, rate limits e autenticação de forma combinada.

---

## 2. Autenticação e Gestão de Acesso

### 2.1 JSON Web Token (JWT)
*   **Implementação:** Autenticação baseada em tokens JWT assinados pelo backend.
*   **Expiração:** Tokens configurados para expirar em **7 dias**.
*   **Proteção:** O `jwtSecret` deve ser uma string longa e aleatória configurada via variável de ambiente.

### 2.2 Senhas e Recuperação
*   **Hashes de Senha:** Uso de `bcrypt` com **salt de 10 rounds**.
*   **Tokens de Recuperação:**
    *   Gerados com 32 bytes de entropia (`crypto.randomBytes`).
    *   Armazenados no banco de dados como **hash SHA-256**.
    *   Validade estrita de **30 minutos**.
*   **Segurança de Fluxo:** Invalidação de tokens antigos ao solicitar uma nova recuperação.

### 2.3 Autorização
*   **Usuário Comum (`USER`):** Acesso às funcionalidades de jornada e perfil próprio.
*   **Administrador (`ADMIN`):** Acesso a rotas de gestão de usuários e isenção de limites diários de jornada.
*   **Middlewares:** Uso de `authMiddleware` para proteção de rotas e `adminMiddleware` para restrição de privilégios.

---

## 3. Proteção contra Abuso e Custos

A proteção financeira é implementada através de camadas complementares:

*   **Rate Limit Global:** Limite de 150 requisições a cada 15 minutos por IP (evita DoS e spam).
*   **Login Limiter (`loginLimiter`):** Limite de 10 tentativas a cada 15 minutos por IP (proteção contra força bruta).
*   **Daily Journey Limit:** Limite estrito de **10 jornadas por dia** por usuário ou IP nas rotas de planejamento (Isenta usuários `ADMIN`).
*   **Route Cache:** Persistência de respostas do Google na tabela `RouteCache` para evitar cobranças duplicadas em requisições idênticas.
*   **ApiUsage:** Registro de cada acesso crítico para auditoria e controle de limites.

---

## 4. Segurança em Integrações Externas

*   **Backend como Proxy:** O frontend nunca chama as APIs do Google diretamente. O backend atua como um portão seguro, adicionando as chaves de API e tratando os dados.
*   **Abstração:** Uso de `Providers/Adapters` para que o sistema não dependa do formato bruto de provedores externos.

---

## 5. Proteção de Infraestrutura e Entrada

*   **Helmet:** Middleware para configurar headers HTTP de segurança (proteção contra XSS, Clickjacking, etc.).
*   **CORS (Cross-Origin Resource Sharing):**
    *   **Desenvolvimento:** Pode ser configurado de forma mais permissiva para testes locais.
    *   **Produção:** Deve ser restrito ao `APP_URL` oficial do sistema.
    *   *Nota: CORS não substitui autenticação ou validação.*
*   **Sanitização:** O `sanitizeMiddleware` remove tags HTML/Script e espaços extras de todas as entradas (`body`, `query`, `params`), protegendo contra injeções básicas.

---

## 6. Dados Sensíveis e Privacidade (LGPD)

O Nuvem coleta e armazena os seguintes dados sensíveis sob proteções específicas:

*   **E-mail:** Identificador único armazenado em texto puro para comunicação e login.
*   **Senha:** Armazenada estritamente como hash.
*   **Endereço IP:** Registrado na tabela `ApiUsage` para fins de segurança financeira e auditoria de abuso.
*   **Deleção de Conta:** Implementação de `DELETE /users/me`.
    *   Remoção física de dados do `User`.
    *   Preservação anonimizada (`SetNull`) dos registros de `ApiUsage` para manter a integridade dos relatórios financeiros.

---

## 7. Segurança no Frontend

*   **Chaves de API:** O frontend deve possuir apenas chaves públicas estritamente necessárias (ex: Mapas). Chaves de Routes, Places e Speech devem ficar apenas no backend.
*   **Armazenamento de Token:** O JWT deve ser armazenado em locais seguros (ex: `SecureStore` em dispositivos móveis).
*   **Permissões:** Uso de permissões granulares para Microfone e Localização, solicitadas apenas quando necessário.

---

## 8. Melhorias Futuras

*   **Limites de Payload:** Implementação de validação rigorosa para o tamanho máximo do `audioBase64`.
*   **Cleanup Jobs:** Automatização da limpeza de tokens de reset e caches de rotas expirados.
*   **Auditoria Estruturada:** Criação de logs de auditoria para mudanças de privilégios e acessos administrativos.
*   **Armazenamento Seguro:** Formalização da política de persistência do JWT no aplicativo móvel para evitar vazamentos em aparelhos desbloqueados (root/jailbreak).

---

## 9. Pendências de Confirmação

*   [ ] **Tamanho de Áudio:** Qual o limite máximo (em MB) que o backend suporta atualmente para transcrição?
*   [ ] **JWT Storage:** Confirmar qual biblioteca de persistência o frontend está utilizando para o token.
*   [ ] **CORS Produção:** Validar se a lista de origens permitidas em produção já inclui todos os subdomínios necessários.

---
*Documento gerado como base de segurança do ecossistema Nuvem.*
