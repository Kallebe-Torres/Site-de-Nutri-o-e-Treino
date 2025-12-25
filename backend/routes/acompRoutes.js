const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

// Função helper para calcular calorias
function calculateCalories(macros) {
  if (!macros) return 0;
  const MACRO_CALORIE_FACTORS = { proteinas: 4, carboidratos: 4, gorduras: 9 };
  const proteinCal = (macros.proteinas || 0) * MACRO_CALORIE_FACTORS.proteinas;
  const carbCal =
    (macros.carboidratos || 0) * MACRO_CALORIE_FACTORS.carboidratos;
  const fatCal = (macros.gorduras || 0) * MACRO_CALORIE_FACTORS.gorduras;
  return Math.round(proteinCal + carbCal + fatCal);
}

const setupAcompRoutes = (Acomp) => {

  // ROTA 1: GET /api/acompanhamento/:data
  // Busca o registro de acompanhamento de um dia específico para o usuário logado
  // js/backend/acompRoutes.js

  // --- FUNÇÃO HELPER ---
  function deepParseJson(jsonString, maxDepth = 10) {
    if (typeof jsonString !== "string" || !jsonString.trim()) {
      return {}; // Retorna objeto vazio se não for string ou for vazia
    }
    let currentData = jsonString;
    try {
      // Tenta fazer o parse direto primeiro (caso já seja um objeto ou JSON simples)
      if (typeof currentData === "object" && currentData !== null)
        return currentData;
      currentData = JSON.parse(currentData);
      // Se funcionou e virou objeto, retorna
      if (typeof currentData === "object" && currentData !== null)
        return currentData;
    } catch (e) {
      // Ignora erro inicial, continua para tentar desescapar
      currentData = jsonString; // Reseta para a string original
    }

    // Se o parse inicial falhou ou resultou em string, tenta desescapar
    for (let i = 0; i < maxDepth; i++) {
      if (typeof currentData !== "string") break; // Sai se não for mais string
      try {
        // Remove as aspas extras do início/fim, se houver
        if (currentData.startsWith('"') && currentData.endsWith('"')) {
          currentData = currentData.substring(1, currentData.length - 1);
        }
        // Tenta fazer o parse da string (potencialmente desescapada)
        currentData = JSON.parse(currentData);
      } catch (e) {
        // Se o parse falhar neste nível, assume que não há mais níveis para desescapar
        //console.warn(`deepParseJson: Falha no parse na profundidade ${i+1}. String atual: ${currentData.substring(0,100)}...`);
        break;
      }
    }

    // Se o resultado final for um objeto, retorna. Senão, retorna objeto vazio.
    return typeof currentData === "object" && currentData !== null
      ? currentData
      : {};
  }
  // --- FIM DA FUNÇÃO HELPER ---

  router.get("/:data", protect, async (req, res) => {
    const userId = req.userId;
    const dataRegistro = req.params.data;

    try {
      const registro = await Acomp.findOne({
        where: { user_id: userId, data_registro: dataRegistro },
      });

      if (!registro) {
        return res
          .status(404)
          .json({ message: "Nenhum registro encontrado para esta data." });
      }

      // ✅ USA A FUNÇÃO deepParseJson PARA TENTAR CORRIGIR OS DADOS
      const parsedMealStatus = deepParseJson(registro.status_refeicoes);
      const parsedRegisteredMacros = deepParseJson(registro.macros_consumidos);
      const parsedDailyGoals = deepParseJson(registro.metas_diarias);


      const responseData = {
        weight: registro.peso,
        observation: registro.observacao,
        mealStatus: parsedMealStatus, // <-- Usa o resultado do deepParse
        registeredMacros: parsedRegisteredMacros, // <-- Usa o resultado do deepParse
        dailyGoals: parsedDailyGoals, // <-- Usa o resultado do deepParse
      };


      res.status(200).json(responseData);
    } catch (error) {
      console.error("❌ Erro ao buscar acompanhamento:", error);
      res.status(500).json({ erro: "Erro interno do servidor." });
    }
  });

  // ROTA 2 (NOVA): POST /api/acompanhamento 
  // Cria ou Atualiza (Upsert) um registro de acompanhamento para o usuário logado
  router.post("/", protect, async (req, res) => {
    const userId = req.userId;
    const {
      date,
      weight,
      observation,
      mealStatus,
      registeredMacros,
      dailyGoals, // <- Vêm como OBJETOS do frontend
    } = req.body;

    if (!date) {
    }

    const calorias_consumidas = calculateCalories(registeredMacros);

    try {
      // TENTA SALVAR OS OBJETOS DIRETAMENTE
      // Se a coluna for JSON, o Sequelize deve lidar com isso.
      // Se a coluna for TEXT, o Sequelize pode converter para string JSON simples.
      console.log(
        "[BACKEND POST] Attempting to save mealStatus object:",
        mealStatus
      ); // Log para confirmar

      await Acomp.upsert({
        user_id: userId,
        data_registro: date,
        peso: weight,
        observacao: observation,
        status_refeicoes: mealStatus || {}, 
        macros_consumidos: registeredMacros || {},
        calorias_consumidas: calorias_consumidas,
        metas_diarias: dailyGoals || {},
      });

      res.status(200).json({ message: "Registro salvo com sucesso." });
    } catch (error) {
      console.error("❌ Erro ao salvar acompanhamento (upsert):", error);
      // Verifica se o erro é sobre tipo de dado (indicando que precisa ser string)
      if (
        error.message.includes("Invalid value") ||
        error.message.includes("data type")
      ) {
        console.warn(
          "WARN: Tentativa de salvar objeto falhou, tentando salvar como string JSON..."
        );
        try {
          // Tenta salvar como string JSON simples como fallback
          await Acomp.upsert({
            user_id: userId,
            data_registro: date,
            peso: weight,
            observacao: observation,
            status_refeicoes: JSON.stringify(mealStatus || {}),
            macros_consumidos: JSON.stringify(registeredMacros || {}),
            calorias_consumidas: calorias_consumidas,
            metas_diarias: JSON.stringify(dailyGoals || {}),
          });
          res
            .status(200)
            .json({ message: "Registro salvo com sucesso (como string)." });
        } catch (innerError) {
          console.error(
            "❌ Erro ao salvar acompanhamento (upsert como string):",
            innerError
          );
          res
            .status(500)
            .json({
              erro: "Erro interno ao salvar o registro (string fallback).",
            });
        }
      } else {
        res.status(500).json({ erro: "Erro interno ao salvar o registro." });
      }
    }
  });

  return router;
};

module.exports = setupAcompRoutes;
