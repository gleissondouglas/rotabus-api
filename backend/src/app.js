/**
 * O app.js define a arquitetura da aplicação Express.
 * Aqui configuramos middlewares (segurança, parser, CORS) e registramos as rotas.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const journeysRoutes = require("./modules/journeys/journeys.routes");
const usersRoutes = require("./modules/users/users.routes");
const authRoutes = require("./modules/auth/auth.routes");
const errorMiddleware = require("./shared/middlewares/error.middleware");
const { globalLimiter } = require("./shared/middlewares/rateLimiter.middleware");
const { sanitizeMiddleware } = require("./shared/middlewares/sanitize.middleware");

const { nodeEnv, appUrl } = require("./config/env");

const app = express();

// Helmet: Adiciona cabeçalhos de segurança para proteger contra ataques web comuns
app.use(helmet());

// Limite global de requisições para evitar ataques de força bruta ou excesso de carga
app.use(globalLimiter);

/**
 * CORS (Cross-Origin Resource Sharing):
 * Define quais domínios podem acessar esta API.
 * Em desenvolvimento permite qualquer origem (*), em produção apenas o domínio oficial.
 */
const corsOptions = {
  origin: nodeEnv === "production" ? [appUrl] : "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

/**
 * Parsers de JSON:
 * Configuramos um limite alto (50mb) porque recebemos transcrições e áudios
 * grandes via Base64 do aplicativo.
 */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/**
 * Sanitização Global:
 * Remove tags HTML e espaços extras de todos os inputs (body, query, params).
 */
app.use(sanitizeMiddleware);

// Rota de Health Check (Verificar se a API está viva)
app.get("/", (req, res) => {
  return res.status(200).json({
    project: "RotaBus API",
    status: "ok",
    message: "Tá rodando baby!",
  });
});

/**
 * Registro de Rotas:
 * Dividimos a API em módulos (Jornadas, Usuários e Autenticação).
 */
app.use("/journeys", journeysRoutes);
app.use("/users", usersRoutes);
app.use("/auth", authRoutes);

// Mantém o contrato JSON da API também para endpoints inexistentes.
app.use((req, res) => {
  return res.status(404).json({
    error: true,
    message: "Rota não encontrada.",
  });
});

/**
 * Middleware de Erro Global:
 * Deve ser o ÚLTIMO a ser registrado. Ele captura erros jogados (throw)
 * em qualquer lugar da API e retorna um JSON padronizado para o frontend.
 */
app.use(errorMiddleware);

module.exports = app;
