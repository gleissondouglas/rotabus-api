# Nuvem — Assistente de Mobilidade por Voz

O **Nuvem** é um aplicativo mobile de mobilidade urbana com foco em acessibilidade, simplicidade e orientação por voz.

A proposta do projeto é ajudar pessoas que têm dificuldade em usar aplicativos tradicionais de transporte público, oferecendo uma experiência mais simples, direta e guiada. O usuário informa para onde deseja ir, escolhe se quer sair agora, sair em outro horário ou chegar em determinado horário, e o app retorna uma rota de ônibus mais compreensível.

---

## Sobre o projeto

Muitos aplicativos de transporte mostram mapas, textos pequenos, várias cores, muitos detalhes técnicos e interfaces difíceis para pessoas com pouca familiaridade com tecnologia.

O Nuvem nasce com outro objetivo: conversar com o usuário de forma clara, simples e acessível.

A ideia principal é que o app funcione como uma assistente de mobilidade por voz, ajudando o usuário a entender:

- qual ônibus pegar;
- em qual ponto deve ir;
- que horário deve sair de casa;
- se a rota é para hoje, amanhã ou outra data;
- se precisa trocar de ônibus;
- quanto tempo vai levar até o destino.

---

## Público-alvo

O Nuvem foi pensado principalmente para:

- pessoas idosas;
- pessoas com baixa familiaridade com tecnologia;
- pessoas com dificuldade de leitura;
- pessoas com deficiência visual ou baixa visão;
- pessoas que se confundem com mapas e interfaces complexas;
- usuários que preferem receber instruções por voz;
- pessoas que precisam de uma orientação mais simples para usar o transporte público.

---

## Objetivo

O objetivo do projeto é tornar o uso do transporte público mais acessível, simples e inclusivo.

A proposta é transformar uma resposta técnica de rota em uma orientação fácil de entender, por exemplo:

> Saia amanhã às 05:27 da manhã. Pegue o ônibus 26. Depois pegue o ônibus 27.

Em vez de mostrar apenas dados complexos ou mapas difíceis de interpretar.

---

## Funcionalidades atuais

- Tela de boas-vindas;
- Login com e-mail e senha;
- Criação de conta;
- Sessão salva no dispositivo;
- Tela inicial com assistente por voz;
- Busca de destino por digitação;
- Fluxo preparado para busca por voz;
- Tela para escolher horário da viagem:
  - sair agora;
  - sair em outro horário;
  - chegar em determinado horário;
- Envio da localização atual do usuário;
- Integração com backend próprio;
- Consulta de rotas de transporte público;
- Exibição de rota encontrada;
- Exibição de:
  - primeiro ponto;
  - ônibus da rota;
  - trocas;
  - tempo até o ponto;
  - tempo total;
  - chegada prevista;
- Mensagens com data e período do dia:
  - hoje às 10:30 da manhã;
  - amanhã às 05:30 da manhã;
  - terça-feira, 12/05 às 11:47 da manhã;
- Tela de ajuda;
- Tela de acessibilidade;
- Tela de configurações;
- Botão para ouvir opções por voz;
- Controle para evitar repetição excessiva da voz ao voltar telas.

---

## Tecnologias utilizadas

### Mobile

- React Native
- Expo
- Expo Router
- TypeScript
- Expo Location
- Expo Speech
- Expo Secure Store

### Integração

- API própria em Node.js
- Autenticação com token JWT
- Integração com serviço de rotas de transporte público no backend

---

## Estrutura do projeto

```txt
nuvem-front
├── app
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── criar-conta.tsx
│   ├── permissoes.tsx
│   ├── inicio.tsx
│   ├── digitar-destino.tsx
│   ├── ouvindo.tsx
│   ├── escolher-horario.tsx
│   ├── processando.tsx
│   ├── melhor-rota.tsx
│   ├── navegando.tsx
│   ├── chegada.tsx
│   ├── ajuda.tsx
│   ├── acessibilidade.tsx
│   └── configuracoes.tsx
│
├── src
│   ├── components
│   ├── config
│   ├── hooks
│   ├── services
│   ├── theme
│   ├── types
│   └── utils
│
├── assets
├── package.json
├── tsconfig.json
└── README.md
```

---

## Principais telas

### Boas-vindas

Tela inicial de apresentação do aplicativo, explicando que o Nuvem é uma assistente de mobilidade por voz.

### Login

Permite que o usuário acesse sua conta usando e-mail e senha.

### Início

Tela principal do app. O usuário pode manter o botão pressionado para falar o destino ou tocar em digitar.

### Digitar destino

Permite informar manualmente o local desejado.

### Escolher horário

Permite escolher se o usuário quer:

- sair agora;
- sair em outro horário;
- chegar em certo horário.

### Processando

Tela exibida enquanto o app busca a melhor rota no backend.

### Rota encontrada

Mostra uma resposta simples com o ônibus, ponto inicial, trocas e horário.

### Navegando

Tela preparada para guiar o usuário até o ponto de ônibus.

### Ajuda

Explica como usar o aplicativo.

### Acessibilidade

Tela preparada para recursos de acessibilidade.

### Configurações

Tela para futuras configurações de conta e preferências do usuário.

---

## Como rodar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU-USUARIO/nuvem-front.git
```

### 2. Entrar na pasta do projeto

```bash
cd nuvem-front
```

### 3. Instalar dependências

```bash
npm install
```

### 4. Configurar a URL da API

Crie ou edite o arquivo:

```txt
src/config/api.config.ts
```

Exemplo:

```ts
export const API_BASE_URL = "http://SEU_IP_DA_MAQUINA:3000";
```

Exemplo em rede local:

```ts
export const API_BASE_URL = "http://192.168.0.204:3000";
```

> Observação: ao testar no celular físico, não use `localhost`, porque no celular `localhost` aponta para o próprio celular, não para o computador.

### 5. Rodar o app

```bash
npx expo start
```

Ou limpando o cache:

```bash
npx expo start -c
```

---

## Integração com backend

O aplicativo se comunica com uma API própria para:

- autenticação;
- cadastro de usuários;
- login;
- planejamento de rotas;
- envio de origem, destino e preferência de horário.

Exemplo de requisição enviada para o backend:

```json
{
  "origin": {
    "lat": -19.764881363933064,
    "lng": -48.00376578267596
  },
  "destination": {
    "text": "Hospital Mário Palmério"
  },
  "timePreference": {
    "type": "DEPARTURE",
    "dateTime": "2026-05-10T23:33:27-03:00"
  }
}
```

Exemplo de resposta esperada:

```json
{
  "summary": {
    "timeType": "DEPARTURE",
    "leaveHomeText": "amanhã às 05:27 da manhã",
    "beAtStopText": "amanhã às 05:30 da manhã",
    "arrivalAtDestinationText": "amanhã às 06:07 da manhã",
    "totalDurationMin": 44,
    "busLines": ["26", "27"],
    "transfers": 1,
    "initialWalkTimeMin": 3
  },
  "message": "Saia de casa amanhã às 05:27 da manhã...",
  "alerts": [],
  "steps": []
}
```

---

## Status do projeto

O projeto está em desenvolvimento.

Atualmente, o app já possui o fluxo principal de mobilidade funcionando com:

- login;
- sessão salva;
- busca de destino;
- escolha de horário;
- envio de localização;
- integração com backend;
- exibição de rota;
- mensagens acessíveis com data e horário;
- suporte inicial a voz e acessibilidade.

---

## Próximas melhorias

- Implementar mapa real na tela de navegação;
- Mostrar a localização atual do usuário no mapa;
- Mostrar o ponto de ônibus mais próximo;
- Atualizar a posição do usuário em tempo real;
- Guiar o usuário até o ponto;
- Melhorar o reconhecimento real de voz;
- Melhorar a tela de navegação;
- Salvar preferências de acessibilidade;
- Criar fluxo real de recuperação de senha no app;
- Melhorar edição de dados da conta;
- Refinar mensagens para usuários idosos e com baixa familiaridade digital;
- Melhorar tratamento de rotas longas ou pouco acessíveis.

---

## Motivação

O Nuvem foi criado a partir da ideia de que a tecnologia deve incluir pessoas, não afastá-las.

Muitas pessoas não conseguem usar bem aplicativos convencionais por causa de telas complexas, textos pequenos, excesso de informação e dificuldade em interpretar mapas.

O Nuvem busca resolver esse problema com uma interface mais simples, acessível e guiada por voz.

> Tecnologia boa é tecnologia que aproxima, orienta e inclui.

---

## Autor

Desenvolvido por **Gleisson**.

Projeto acadêmico e pessoal com foco em acessibilidade, mobilidade urbana, inclusão digital e transporte público.
