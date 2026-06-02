/**
 * O server.js é o ponto de entrada real do processo Node.js.
 * Sua única responsabilidade é "subir" o servidor e ouvir em uma porta específica.
 */

const app = require('./app');
const env = require('./config/env');
const { initSentry } = require('./config/sentry');

// Inicializa o Sentry para capturar erros fatais do servidor
initSentry();

console.log('Iniciando servidor...');

/**
 * app.listen: Faz o servidor Express começar a aceitar conexões.
 * Usamos "0.0.0.0" para que ele seja acessível por outros aparelhos na mesma rede Wi-Fi.
 */
const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://0.0.0.0:${env.port}`);
});

// Tratamento de erros caso a porta esteja ocupada ou o servidor falhe ao iniciar
server.on('error', (error) => {
    console.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
});

/**
 * Handlers Globais do Node.js:
 * Capturam erros que não foram tratados em nenhum outro lugar do código (Promessas ou Exceções),
 * evitando que o processo caia silenciosamente.
 */
process.on('uncaughtException', (error) => {
    console.error('Exceção não tratada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada em:', promise, 'razão:', reason);
});