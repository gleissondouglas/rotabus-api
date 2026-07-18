# Segurança e Privacidade

Este documento define os pilares de segurança implementados no backend do Nuvem, abordando desde ataques automatizados até as regras de adequação à LGPD (Lei Geral de Proteção de Dados).

## 1. Autenticação e Autorização (JWT)

- **JWT (JSON Web Tokens):** O backend é Stateless para acesso. Após o login, é emitido um JWT assinado usando criptografia forte com a secret `JWT_SECRET`.
- **Duração:** Tokens possuem prazo curto de validade definido nas variáveis de ambiente.
- **Autorização (Role-based Access):** Todo JWT contém o atributo `role`. Usuários comuns (`USER`) possuem acesso a seu próprio escopo. Rotas administrativas, como listar outros usuários, requerem o middleware verificando a `role === 'ADMIN'`.

## 2. LGPD e Gerenciamento de Identidade

A premissa da LGPD é que o usuário é dono de seus próprios dados.
- **Deleção Conta (Direito ao Esquecimento):** O endpoint `DELETE /users/me` executa uma destruição completa da identidade. 
- **Preservação de Log Anonimizado:** Tabelas contábeis como `ApiUsage` (gastos de API do Google) não são deletadas pois a lei prevê proteção para cumprimento de obrigação regulatória/financeira, MAS a chave estrangeira sofre um `SetNull`, separando o log do usuário que o gerou.
- **Proteção de Senha:** A tabela `User` possui senhas transformadas irreversivelmente pela biblioteca genérica `bcrypt` (Salted Hash).

## 3. Segurança Periférica (Middlewares de Defesa)

1. **Helmet:** Injeta headers HTTPS rígidos bloqueando clickjacking, XSS e sniff de MIME Types.
2. **CORS:** Restringe de onde os requests podem ser emitidos.
3. **Rate Limiting:** O `express-rate-limit` foca em proteção contra Denial of Service (DoS/DDoS).
   - Rate limit global na aplicação (ex: 100 requisições / 15 min).
   - Limitadores específicos (ex: `loginLimiter`) são 10x mais estritos, prevenindo ataques de Força Bruta contra senhas.
4. **Sanitize & Validation:** Inputs passam pelo middleware de sanitização contra NoSQL/SQL Injections. Após sanear, a biblioteca Zod prova tipagem estrita rejeitando propriedades desconhecidas (Strip unknown).

## 4. Práticas de Registro (Logging e Monitoramento)

- Logs sensíveis não são emitidos em `stdout` na forma pura. Senhas, tokens e PII nunca devem constar nos logs do servidor nem serem repassados ao *Sentry*.
- O rastreamento de erros via Sentry captura exceções não tratadas (`500 Internal Server Error`) informando o Controller falho, stacktrace abstraída de infraestrutura (ocultando caminhos físicos da VM/Contêiner) e ambiente para ação rápida pela equipe de DevOps.
