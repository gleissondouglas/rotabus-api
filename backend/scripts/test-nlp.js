require('dotenv').config();
const nlpProvider = require('../src/shared/providers/nlp.provider');

async function runTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'sua-chave-api-do-google-gemini') {
    console.error("❌ ERRO: A variável GEMINI_API_KEY não foi configurada corretamente no seu arquivo .env.");
    console.error("Crie um arquivo .env na pasta backend e insira sua chave do Google AI Studio.");
    process.exit(1);
  }

  const text = "Quero ir pro posto de saúde amanhã bem cedinho umas 7 da manhã";
  const coords = { lat: -19.7460, lng: -47.9320 }; // Uberaba
  const timestamp = new Date().toISOString();

  console.log("=========================================");
  console.log("🧪 TESTANDO O PROVEDOR DE NLP (GEMINI)");
  console.log("=========================================\n");
  console.log(`🗣️ Texto de Entrada: "${text}"\n`);
  
  try {
    console.log("⏳ Enviando para o Gemini...");
    const result = await nlpProvider.parseUserIntent(text, coords, timestamp);
    
    console.log("✅ Sucesso! Resposta Estruturada:\n");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error("❌ Ocorreu um erro ao chamar o Gemini:");
    console.error(error.message);
  }
}

runTest();
