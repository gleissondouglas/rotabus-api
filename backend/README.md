# 🚌 RotaBus API

API back-end para planejamento de rotas de ônibus, criada com foco em mobilidade urbana, autenticação de usuários e respostas simples para o usuário final.

O projeto recebe a localização atual do usuário, o destino desejado e uma preferência de horário, consulta a Google Routes API e devolve uma resposta mais amigável com instruções de transporte público.

---

## 📌 Sobre o projeto

O **RotaBus API** é um projeto desenvolvido para ajudar usuários a encontrarem rotas de ônibus de forma mais simples.

A ideia principal é transformar respostas técnicas da Google Routes API em mensagens mais fáceis de entender, como:

> Saia de casa às 08:12. Caminhe cerca de 5 minutos até o ponto. Pegue o ônibus 31, sentido Terminal Beija-Flor. Desça no ponto indicado e caminhe até o destino final.

O projeto também possui cadastro de usuários, login com JWT, rotas protegidas, permissões de administrador e recuperação de senha com token temporário.

---

## 🚀 Funcionalidades

- Cadastro de usuário
- Login com autenticação JWT
- Proteção de rotas privadas
- Perfil do usuário logado
- Listagem de usuários apenas para administradores
- Exclusão de usuários apenas para administradores
- Alteração de senha pelo usuário logado
- Recuperação de senha com token temporário
- Integração com Google Routes API
- Consulta de rotas de transporte público
- Suporte a horário de partida
- Suporte a horário de chegada
- Mapeamento da resposta do Google para uma resposta mais amigável
- Tratamento centralizado de erros
- Arquitetura modular por responsabilidade

---

## 🛠️ Tecnologias utilizadas

- Node.js
- Express
- PostgreSQL
- Prisma ORM
- JWT
- bcrypt
- Axios
- Google Routes API
- Dotenv
- Nodemon

---

## 🏗️ Arquitetura do projeto

O projeto segue uma arquitetura modular, separando responsabilidades por módulo e camada.

```text
src/
  config/
    env.js
    prisma.js

  modules/
    auth/
      providers/
        email.provider.js
      admin.middleware.js
      auth.controller.js
      auth.middleware.js
      auth.repository.js
      auth.routes.js
      auth.service.js
      auth.validator.js

    journeys/
      providers/
        googleRoutes.provider.js
      journeys.controller.js
      journeys.routes.js
      journeys.service.js
      journeys.validator.js
      journey.mapper.js

    users/
      users.controller.js
      users.repository.js
      users.routes.js
      users.service.js
      users.validator.js

  shared/
    middlewares/
      error.middleware.js

  app.js
  server.js

prisma/
  migrations/
  schema.prisma

prisma.config.ts
```

---

## 🧩 Responsabilidade de cada camada

### Routes

Define as rotas da aplicação e conecta cada endpoint ao controller correto.

### Controller

Recebe a requisição HTTP, pega os dados de `req.body`, `req.params` ou `req.user`, chama o service e retorna a resposta.

### Service

Contém a regra de negócio principal. Coordena validação, banco de dados, autenticação, chamadas externas e retorno dos dados.

### Validator

Valida e normaliza os dados recebidos antes de seguir para a regra de negócio.

### Repository

Responsável por acessar o banco de dados usando Prisma.

### Provider

Responsável por conversar com serviços externos, como Google Routes API ou simulação/envio de email.

### Mapper

Traduz a resposta técnica da API externa para um formato mais simples e amigável para o usuário.

### Middleware

Intercepta requisições antes do controller. No projeto, existem middlewares para autenticação, autorização de admin e tratamento de erros.

---

## 🔐 Autenticação e autorização

O projeto utiliza autenticação baseada em JWT.

Após o login, a API retorna um token. Esse token deve ser enviado nas rotas protegidas:

```http
Authorization: Bearer jwt_token_aqui
```

O sistema possui dois tipos de usuário:

```text
USER
ADMIN
```

### USER

Pode:

- ver o próprio perfil;
- alterar a própria senha;
- solicitar rotas de transporte público.

### ADMIN

Pode:

- listar todos os usuários;
- deletar usuários;
- acessar rotas administrativas.

---

## 🔄 Fluxo principal da aplicação

```text
Usuário cria conta
↓
Usuário faz login
↓
API devolve token JWT
↓
Usuário envia token nas rotas protegidas
↓
Usuário solicita rota de ônibus
↓
API valida os dados
↓
API consulta Google Routes API
↓
Mapper transforma a resposta
↓
API devolve uma mensagem simples
```

---

## 👤 Fluxo de usuários

### Criar usuário

```http
POST /users
```

Body:

```json
{
  "name": "Douglas Oliveira",
  "email": "douglas@email.com",
  "password": "abc123"
}
```

Resposta esperada:

```json
{
  "message": "Usuário criado com sucesso.",
  "user": {
    "id": 1,
    "name": "Douglas Oliveira",
    "email": "douglas@email.com",
    "role": "USER",
    "createdAt": "2026-05-09T00:00:00.000Z",
    "updatedAt": "2026-05-09T00:00:00.000Z"
  }
}
```

---

### Ver perfil do usuário logado

```http
GET /users/me
```

Header:

```http
Authorization: Bearer jwt_token_aqui
```

Resposta esperada:

```json
{
  "message": "Perfil encontrado com sucesso.",
  "user": {
    "id": 1,
    "name": "Douglas Oliveira",
    "email": "douglas@email.com",
    "role": "USER",
    "createdAt": "2026-05-09T00:00:00.000Z",
    "updatedAt": "2026-05-09T00:00:00.000Z"
  }
}
```

---

### Alterar senha do usuário logado

```http
PATCH /users/me/password
```

Header:

```http
Authorization: Bearer jwt_token_aqui
```

Body:

```json
{
  "currentPassword": "senhaAtual123",
  "newPassword": "novaSenha123"
}
```

Resposta esperada:

```json
{
  "message": "Senha alterada com sucesso.",
  "user": {
    "id": 1,
    "name": "Douglas Oliveira",
    "email": "douglas@email.com",
    "role": "USER",
    "updatedAt": "2026-05-09T00:00:00.000Z"
  }
}
```

---

### Listar todos os usuários

```http
GET /users
```

Rota permitida apenas para usuários com `role = ADMIN`.

Header:

```http
Authorization: Bearer jwt_token_admin
```

Resposta esperada:

```json
{
  "message": "Usuários encontrados com sucesso.",
  "users": [
    {
      "id": 1,
      "name": "Douglas Oliveira",
      "email": "douglas@email.com",
      "role": "ADMIN",
      "createdAt": "2026-05-09T00:00:00.000Z",
      "updatedAt": "2026-05-09T00:00:00.000Z"
    }
  ]
}
```

---

### Deletar usuário

```http
DELETE /users/:id
```

Rota permitida apenas para usuários com `role = ADMIN`.

Header:

```http
Authorization: Bearer jwt_token_admin
```

Exemplo:

```http
DELETE /users/3
```

Resposta esperada:

```json
{
  "message": "Usuário deletado com sucesso.",
  "user": {
    "id": 3,
    "name": "Gleisson",
    "email": "gleisson@email.com",
    "role": "USER",
    "createdAt": "2026-05-09T00:00:00.000Z",
    "updatedAt": "2026-05-09T00:00:00.000Z"
  }
}
```

---

## 🔑 Fluxo de autenticação

### Login

```http
POST /auth/login
```

Body:

```json
{
  "email": "douglas@email.com",
  "password": "abc123"
}
```

Resposta esperada:

```json
{
  "message": "Login realizado com sucesso.",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "name": "Douglas Oliveira",
    "email": "douglas@email.com",
    "role": "USER"
  }
}
```

---

## 🔁 Recuperação de senha

O projeto possui um fluxo de recuperação de senha usando token temporário.

Esse fluxo é usado quando o usuário não sabe a senha antiga.

---

### Solicitar recuperação de senha

```http
POST /auth/forgot-password
```

Body:

```json
{
  "email": "douglas@email.com"
}
```

Resposta esperada:

```json
{
  "message": "Se esse email estiver cadastrado, enviaremos instruções para recuperar a senha."
}
```

Em ambiente de desenvolvimento, o projeto pode retornar também:

```json
{
  "message": "Se esse email estiver cadastrado, enviaremos instruções para recuperar a senha.",
  "resetToken": "token_temporario",
  "resetLink": "http://localhost:3000/reset-password?token=token_temporario"
}
```

> O `resetToken` aparece na resposta apenas para facilitar testes locais. Em produção, o token deve ser enviado somente por email.

---

### Redefinir senha

```http
POST /auth/reset-password
```

Body:

```json
{
  "token": "token_temporario_recebido",
  "newPassword": "novaSenha123"
}
```

Resposta esperada:

```json
{
  "message": "Senha redefinida com sucesso."
}
```

Depois disso, a senha antiga deixa de funcionar e o usuário deve fazer login com a nova senha.

---

## 🚌 Fluxo de jornada de ônibus

### Planejar jornada

```http
POST /journeys/plan
```

Rota protegida por JWT.

Header:

```http
Authorization: Bearer jwt_token_aqui
```

---

### Buscar rota saindo em um horário específico

```json
{
  "origin": {
    "lat": -19.7647,
    "lng": -48.0038
  },
  "destination": {
    "text": "Mário Palmério Hospital Universitário, Uberaba - MG"
  },
  "timePreference": {
    "type": "DEPARTURE",
    "dateTime": "2026-05-09T08:00:00-03:00"
  }
}
```

Nesse caso, a API entende:

```text
Quero sair às 08:00.
```

---

### Buscar rota para chegar em um horário específico

```json
{
  "origin": {
    "lat": -19.7647,
    "lng": -48.0038
  },
  "destination": {
    "text": "Mário Palmério Hospital Universitário, Uberaba - MG"
  },
  "timePreference": {
    "type": "ARRIVAL",
    "dateTime": "2026-05-09T09:00:00-03:00"
  }
}
```

Nesse caso, a API entende:

```text
Preciso chegar próximo das 09:00.
```

---

## ✅ Exemplo de resposta de jornada

```json
{
  "summary": {
    "timeType": "ARRIVAL",
    "requestedTime": "09:00",
    "leaveHomeAt": "08:12",
    "beAtStopAt": "08:18",
    "arrivalAtDestination": "08:56",
    "totalDurationMin": 44,
    "busLines": ["31", "25"],
    "transfers": 1,
    "initialWalkTimeMin": 6,
    "finalWalkTimeMin": 4,
    "totalWalkTimeMin": 10,
    "busTimeMin": 34
  },
  "message": "Para chegar perto das 09:00, saia de casa por volta das 08:12. Caminhe cerca de 6 minutos até o ponto. Pegue o ônibus 31. Depois, pegue o ônibus 25. Você deve chegar por volta das 08:56.",
  "alerts": [
    "Chegue ao ponto alguns minutos antes do horário indicado.",
    "Confira o número e o sentido do ônibus antes de embarcar.",
    "Os horários podem variar conforme o trânsito e a operação do transporte.",
    "Essa rota tem troca de ônibus. Preste atenção no ponto onde deve descer."
  ],
  "steps": []
}
```

---

## 🔄 Fluxo interno da rota de jornada

```text
POST /journeys/plan
↓
journeys.routes.js
↓
auth.middleware.js
↓
journeys.controller.js
↓
journeys.service.js
↓
journeys.validator.js
↓
googleRoutes.provider.js
↓
Google Routes API
↓
journey.mapper.js
↓
journeys.service.js
↓
journeys.controller.js
↓
resposta para o usuário
```

---

## 🔄 Fluxo interno de recuperação de senha

```text
POST /auth/forgot-password
↓
auth.routes.js
↓
auth.controller.js
↓
auth.service.js
↓
auth.validator.js
↓
users.repository.js
↓
auth.repository.js
↓
email.provider.js
↓
resposta genérica
```

```text
POST /auth/reset-password
↓
auth.routes.js
↓
auth.controller.js
↓
auth.service.js
↓
auth.validator.js
↓
auth.repository.js
↓
users.repository.js
↓
bcrypt.hash()
↓
atualiza passwordHash
↓
marca token como usado
↓
resposta de sucesso
```

---

## 🗄️ Banco de dados

O projeto usa PostgreSQL com Prisma ORM.

Modelos principais:

```text
User
PasswordResetToken
```

### User

Armazena os usuários do sistema.

Campos principais:

```text
id
name
email
passwordHash
role
createdAt
updatedAt
```

### PasswordResetToken

Armazena tokens temporários de recuperação de senha.

Campos principais:

```text
id
tokenHash
userId
expiresAt
usedAt
createdAt
```

O token puro não é salvo no banco. Apenas o hash do token é armazenado.

---

## ⚙️ Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000

DATABASE_URL="postgresql://usuario:senha@127.0.0.1:5432/rotabus_api?schema=public"

GOOGLE_MAPS_API_KEY=sua_chave_google

JWT_SECRET=sua_chave_jwt

NODE_ENV=development
```

> O arquivo `.env` não deve ser enviado para o GitHub.

---

## ▶️ Como rodar o projeto

### 1. Clone o repositório

```bash
git clone https://github.com/gleissondouglas/RotaBus-API.git
```

### 2. Entre na pasta do projeto

```bash
cd RotaBus-API
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Configure o `.env`

Crie o arquivo `.env` com as variáveis necessárias.

### 5. Rode as migrations do Prisma

```bash
npx prisma migrate dev
```

### 6. Gere o Prisma Client

```bash
npx prisma generate
```

### 7. Inicie o servidor

```bash
npm run dev
```

Servidor rodando em:

```text
http://localhost:3000
```

---

## 📌 Endpoints principais

### Users

```http
POST   /users
GET    /users/me
PATCH  /users/me/password
GET    /users
DELETE /users/:id
```

### Auth

```http
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
```

### Journeys

```http
POST /journeys/plan
```

---

## 🔐 Permissões das rotas

```text
POST /users
→ público

POST /auth/login
→ público

POST /auth/forgot-password
→ público

POST /auth/reset-password
→ público com token temporário válido

GET /users/me
→ usuário logado

PATCH /users/me/password
→ usuário logado

GET /users
→ somente ADMIN

DELETE /users/:id
→ somente ADMIN

POST /journeys/plan
→ usuário logado
```

---

## 🧪 Testes manuais

O projeto pode ser testado usando:

- Thunder Client
- Insomnia
- Postman

Fluxos importantes para testar:

```text
1. Criar usuário
2. Fazer login
3. Acessar /users/me com token
4. Alterar senha logado
5. Solicitar recuperação de senha
6. Redefinir senha com token
7. Tentar reutilizar token de reset
8. Consultar rota de ônibus
9. Listar usuários com admin
10. Tentar listar usuários com user comum
```

---

## 📚 Aprendizados do projeto

Este projeto foi desenvolvido com foco em praticar:

- Estruturação de API REST
- Separação de responsabilidades
- Arquitetura modular
- Autenticação com JWT
- Autorização com `role`
- Controle de acesso para admin
- Criptografia de senha com bcrypt
- Recuperação de senha com token temporário
- Armazenamento seguro de hash de token
- Uso de Prisma com PostgreSQL
- Integração com API externa
- Provider pattern
- Mapper pattern
- Tratamento centralizado de erros

---

## 🚧 Próximas melhorias

- Enviar email real usando provider externo
- Remover retorno de `resetToken` em produção
- Adicionar rate limit nas rotas de recuperação de senha
- Criar testes automatizados
- Melhorar o retorno das jornadas para múltiplas opções de rota
- Criar documentação com exemplos completos
- Desenvolver front-end mobile futuramente
- Implementar fluxo guiado por voz no futuro

---

## 👨‍💻 Autor

Desenvolvido por **Gleisson Douglas**.

GitHub: [github.com/gleissondouglas](https://github.com/gleissondouglas)

---

## 📄 Status do projeto

Em desenvolvimento.

A API já possui cadastro, login, autenticação JWT, autorização por perfil, alteração de senha, recuperação de senha com token temporário, proteção de rotas e consulta de rotas de transporte público usando Google Routes API.
