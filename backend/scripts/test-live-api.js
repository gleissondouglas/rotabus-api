require('dotenv').config();
const axios = require('axios');
const tokenProvider = require('../src/shared/providers/token.provider');

const prisma = require('../src/config/prisma');

async function testLiveApi() {
  console.log("Gerando Token JWT válido...");
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({ data: { name: 'Test', email: 'test@test.com', passwordHash: '123' }});
  }
  const token = tokenProvider.generateToken({ sub: user.id });

  console.log("Disparando requisição para http://localhost:3000/journeys/resolve-destination");
  try {
    const response = await axios.post(
      'http://localhost:3000/journeys/resolve-destination',
      {
        text: "Quero ir pra UFTM amanhã às 2 da tarde",
        origin: { lat: -19.7450, lng: -47.9310 },
        sessionId: "test-session-123",
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log("\n✅ RESPOSTA DA API COMPLETA:");
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error("\n❌ ERRO NA REQUISIÇÃO:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testLiveApi();
