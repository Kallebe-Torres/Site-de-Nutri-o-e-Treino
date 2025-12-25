const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { Op } = require("sequelize");

module.exports = (Acomp, Relat, genAI) => {
  // Função utilitária para pausar a execução (necessária para Exponential Backoff)
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Rota GET /periodo

  router.get("/periodo", protect, async (req, res) => {
    const userId = req.userId;
    let { inicio, fim } = req.query;
    try {
      let dataInicio, dataFim;
      let isPeriodoPadrao = false;
      if (inicio && fim && isValidDate(inicio) && isValidDate(fim)) {
        dataInicio = new Date(inicio.replace(/-/g, "/"));
        dataFim = new Date(fim.replace(/-/g, "/"));
        dataFim.setHours(23, 59, 59, 999);
      } else {
        isPeriodoPadrao = true;
        dataFim = new Date();
        dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - 6);
        dataInicio.setHours(0, 0, 0, 0);
        inicio = dataInicio.toISOString().split("T")[0];
        fim = dataFim.toISOString().split("T")[0];
      }
      const hoje = new Date();
      if (dataFim > hoje) {
        dataFim = hoje;
        fim = hoje.toISOString().split("T")[0];
      }
      if (dataInicio > dataFim) {
        return res.status(400).json({ erro: "Data início > fim." });
      }
      const dataInicioFormatada = dataInicio.toISOString().split("T")[0];
      const dataFimFormatada = dataFim.toISOString().split("T")[0];

      const registros = await Acomp.findAll({
        where: {
          user_id: userId,
          data_registro: {
            [Op.between]: [dataInicioFormatada, dataFimFormatada],
          },
        },
        order: [["data_registro", "ASC"]],
        raw: true,
      });
      if (registros.length === 0) {
        return res.status(404).json({ erro: "Nenhum dado encontrado." });
      }

      let somaCalsM = 0,
        somaCalsR = 0;
      let somaMacM = { p: 0, c: 0, g: 0 };
      let somaMacR = { p: 0, c: 0, g: 0 };
      const pesos = [],
        labelsP = [];
      registros.forEach((reg) => {
        let metas = {},
          reais = {};
        try {
          metas =
            reg.metas_diarias && typeof reg.metas_diarias === "string"
              ? JSON.parse(reg.metas_diarias)
              : reg.metas_diarias || {};
        } catch (e) {}
        try {
          reais =
            reg.macros_consumidos && typeof reg.macros_consumidos === "string"
              ? JSON.parse(reg.macros_consumidos)
              : reg.macros_consumidos || {};
        } catch (e) {}
        somaCalsM += metas.calorias || 0;
        somaMacM.p += metas.proteinas || 0;
        somaMacM.c += metas.carboidratos || 0;
        somaMacM.g += metas.gorduras || 0;
        somaCalsR += reg.calorias_consumidas || calculateCalories(reais) || 0;
        somaMacR.p += reais.proteinas || 0;
        somaMacR.c += reais.carboidratos || 0;
        somaMacR.g += reais.gorduras || 0;
        pesos.push(reg.peso);
        labelsP.push(
          new Date(reg.data_registro.replace(/-/g, "/")).toLocaleDateString(
            "pt-BR",
            { day: "numeric", month: "short" }
          )
        );
      });

      const totalReg = registros.length;
      const kpiM = totalReg > 0 ? Math.round(somaCalsM / totalReg) : 0;
      const kpiR = totalReg > 0 ? Math.round(somaCalsR / totalReg) : 0;
      let pTexto;
      if (isPeriodoPadrao) {
        pTexto =
          totalReg > 0
            ? `Últimos 7 dias (${labelsP[0]} - ${labelsP[totalReg - 1]})`
            : "Últimos 7 dias";
      } else {
        const iFmt = new Date(inicio.replace(/-/g, "/")).toLocaleDateString(
          "pt-BR"
        );
        const fFmt = new Date(fim.replace(/-/g, "/")).toLocaleDateString(
          "pt-BR"
        );
        pTexto = `${iFmt} - ${fFmt}`;
      }

      const avgProtM = totalReg > 0 ? Math.round(somaMacM.p / totalReg) : 0;
      const avgProtR = totalReg > 0 ? Math.round(somaMacR.p / totalReg) : 0;
      const avgCarbM = totalReg > 0 ? Math.round(somaMacM.c / totalReg) : 0;
      const avgCarbR = totalReg > 0 ? Math.round(somaMacR.c / totalReg) : 0;
      const avgFatM = totalReg > 0 ? Math.round(somaMacM.g / totalReg) : 0;
      const avgFatR = totalReg > 0 ? Math.round(somaMacR.g / totalReg) : 0;
      const weightTrendText = getWeightTrendText(pesos);

      const insightPrompt = `
      Você é um nutricionista e analista de desempenho. Analise os seguintes dados de um usuário no período de ${pTexto}.
      Seja conciso, profissional e use formatação Markdown (negrito e listas).

      **Dados do Período:**
      - **Calorias:** Meta Média (${kpiM} kcal), Consumo Médio (${kpiR} kcal)
      - **Proteínas:** Meta Média (${avgProtM}g), Consumo Médio (${avgProtR}g)
      - **Carboidratos:** Meta Média (${avgCarbM}g), Consumo Médio (${avgCarbR}g)
      - **Gorduras:** Meta Média (${avgFatM}g), Consumo Médio (${avgFatR}g)
      - **Tendência de Peso:** ${weightTrendText}

      **Sua Tarefa:**
      Analise os dados e gere os seguintes tópicos. 
      **NÃO** inclua um título principal (o usuário já vê o título "Análise de Observações").
      Apenas gere os seguintes tópicos em Markdown:
      - **Ponto Positivo:** [Destaque o principal ponto positivo]
      - **Ponto de Dificuldade:** [Destaque o principal ponto de dificuldade]
      - **Recomendação-chave:** [Dê UMA recomendação-chave]
      `;

      let insightText;

      if (genAI) {
        const MAX_RETRIES = 3;
        let response;
        let lastError = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            console.log(
              `[periodo] Gerando insight automático da IA (Tentativa ${
                attempt + 1
              }/${MAX_RETRIES})...`
            );

            response = await genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: insightPrompt }] }],
            });

            insightText = response.text.trim();
            break; // Sucesso, sai do loop
          } catch (aiError) {
            lastError = aiError;
            if (aiError.status === 503) {
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(
                `⚠️ Erro 503 (Servidor sobrecarregado) na rota /periodo. Tentando novamente em ${
                  delay / 1000
                }s...`
              );
              if (attempt < MAX_RETRIES - 1) {
                await sleep(delay);
                continue; // Vai para a próxima tentativa
              }
            } // Para outros erros ou última tentativa, registra e usa fallback
            console.error(
              "❌ Erro ao gerar insight da IA (periodo):",
              aiError.message
            );
            insightText = "Erro ao gerar análise da IA.";
            break;
          }
        }

        if (!insightText && lastError) {
          insightText = "Erro ao gerar análise da IA.";
        }
      } else {
        insightText = "Serviço de IA indisponível.";
      }

      const relatorio = {
        period: pTexto,
        kpi: { meta: kpiM, real: kpiR, desvio: kpiR - kpiM },
        weights: pesos,
        weightLabels: labelsP,
        macros: {
          prot_target: avgProtM,
          prot_real: avgProtR,
          carb_target: avgCarbM,
          carb_real: avgCarbR,
          fat_target: avgFatM,
          fat_real: avgFatR,
        },
        insight: insightText,
      };
      res.status(200).json(relatorio);
    } catch (error) {
      console.error("❌ Erro GET /periodo:", error);
      res.status(500).json({ erro: "Erro interno relatório." });
    }
  }); // ROTA POST /adaptativo

  router.post("/adaptativo", protect, async (req, res) => {
    // A variável 'prompt' aqui contém a análise de desempenho gerada no frontend
    const { prompt: analysisPrompt } = req.body;

    if (!analysisPrompt) {
      return res.status(400).json({ erro: "Análise de desempenho vazia." });
    }
    if (!genAI) {
      return res.status(503).json({ erro: "Serviço de IA indisponível." });
    }

    const systemPrompt = `Você é um nutricionista virtual e um assistente de API focado em adaptar planos alimentares. 
Com base na análise de desempenho fornecida, gere um **NOVO plano de dieta completo** em formato JSON.

**Análise de Desempenho Recebida:**
${analysisPrompt} 
// A análise já contém o período, metas, consumo real, desvio, tendência de peso e feedback.

**Sua Tarefa:**
1.  **Interprete a Análise:** Identifique os pontos de dificuldade e a recomendação principal (geralmente no fim do texto da análise).
2.  **Ajuste Metas:** Recalcule as metas diárias de calorias e macronutrientes (proteínas, carboidratos, gorduras em GRAMAS) para corrigir os desvios apontados na análise. Por exemplo, se o consumo de carboidratos está baixo, aumente a meta. Se as calorias estão altas, reduza a meta.
3.  **Adapte Refeições:** Modifique a composição das refeições no \`planoDiario\` para refletir as novas metas de macronutrientes. Mantenha o número de refeições sugerido na análise (se houver) ou use 5 como padrão.
4.  **Gere JSON:** Retorne **APENAS** o objeto JSON estrito com a estrutura abaixo, preenchido com os valores recalculados e refeições adaptadas. NÃO inclua qualquer outro texto antes ou depois do objeto JSON.

**ESTRUTURA JSON OBRIGATÓRIA:**
{
  "nome": "Plano Alimentar Adaptado",
  "objetivo": "[Manter o objetivo original ou inferir da análise]", 
  "calorias": [Nova Meta Numérica de Calorias], 
  "proteinas": [Nova Meta Numérica de Proteínas (g)],
  "carboidratos": [Nova Meta Numérica de Carboidratos (g)],
  "gorduras": [Nova Meta Numérica de Gorduras (g)],
  "distribuicaoMacros": "[Nova String %P/%C/%G calculada]",
  "planoDiario": [ 
    { 
      "refeicao": "[Nome da Refeição]", 
      "horarioSugerido": "[HH:MM]", 
      "detalhe": "[Descrição detalhada da refeição ADAPTADA com alimentos e quantidades. Use \\n para novas linhas.]" 
    },
    { /* ... Outras refeições adaptadas ... */ } 
  ],
  "observacoes": "[Novas recomendações ADAPTADAS com base na análise. Use \\n para novas linhas.]"
}`;

    const MAX_RETRIES = 3;
    let response;
    let lastError = null;

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          console.log(
            `[adaptativo] Enviando prompt para gerar JSON de plano adaptado (Tentativa ${
              attempt + 1
            }/${MAX_RETRIES})...`
          );

          response = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            config: { responseMimeType: "application/json" },
            contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          }); // Sucesso, sai do loop

          break;
        } catch (error) {
          lastError = error; // Verifica se é um erro 503 (transitório)
          if (error.status === 503) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
            console.warn(
              `⚠️ Erro 503 (Servidor sobrecarregado) na rota /adaptativo. Tentando novamente em ${
                delay / 1000
              }s...`
            );
            if (attempt < MAX_RETRIES - 1) {
              await sleep(delay);
              continue; // Próxima tentativa
            }
          } // Para erros não-503 ou na última tentativa, lança o erro para ser tratado fora do loop
          throw error;
        }
      } // Se a resposta ainda for indefinida após todas as tentativas, lança o último erro.

      if (!response) {
        throw (
          lastError ||
          new Error("Falha ao receber resposta da IA após várias tentativas.")
        );
      }

      const planJsonText = response.text.trim();

      if (!planJsonText) {
        throw new Error("Resposta da IA vazia.");
      }

      console.log("[adaptativo] Resposta JSON (bruta) da IA recebida.");

      let planData;
      try {
        // Tenta parsear a resposta como JSON
        planData = JSON.parse(planJsonText);
        console.log("[adaptativo] Resposta parseada como JSON com sucesso."); // Retorna o objeto JSON completo para o frontend
        res.json(planData);
      } catch (parseError) {
        console.error(
          "❌ Erro ao parsear JSON da IA (adaptativo):",
          parseError
        );
        console.error("Texto recebido:", planJsonText); // Loga o que a IA enviou
        throw new Error(
          "A IA não retornou um JSON válido para o plano adaptado."
        );
      }
    } catch (error) {
      console.error("❌ Erro ao chamar a API Google AI (adaptativo):", error);
      let errMsg = error.message || "Falha interna ao gerar plano adaptativo.";

      const statusCode = error.status || 500;

      if (error.statusText) {
        errMsg = `Erro da API: ${error.statusText}`;
      } else if (error.message.includes("API key not valid")) {
        errMsg = "Chave da API Gemini inválida.";
      } else if (error.message.includes("404")) {
        errMsg = "Erro 404: Modelo não encontrado.";
      } else if (error.message.includes("JSON válido")) {
        errMsg = error.message;
      } else if (statusCode === 503) {
        errMsg =
          "A IA está sobrecarregada. Tente novamente em alguns segundos.";
      } // Usa o statusCode dinâmico

      res.status(statusCode).json({ erro: errMsg });
    }
  }); // --- Funções helper ---

  function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regex)) return false;
    const date = new Date(dateString.replace(/-/g, "/"));
    const ts = date.getTime();
    if (typeof ts !== "number" || isNaN(ts)) return false;
    try {
      return date.toISOString().startsWith(dateString);
    } catch (e) {
      return false;
    }
  }
  function calculateCalories(macros) {
    const p = (macros?.proteinas || 0) * 4;
    const c = (macros?.carboidratos || 0) * 4;
    const g = (macros?.gorduras || 0) * 9;
    return Math.round(p + c + g);
  }
  function getWeightTrendText(weights) {
    if (!weights || weights.length < 2) return "Insuficiente para tendência";
    const validWeights = weights.filter(
      (w) => typeof w === "number" && !isNaN(w)
    );
    if (validWeights.length < 2) return "Insuficiente para tendência";
    const start = validWeights[0];
    const end = validWeights[validWeights.length - 1];
    const diff = start - end;
    const diffRounded = Math.abs(diff).toFixed(1);
    if (diff > 0.1) return `Perda de ${diffRounded} kg`;
    if (diff < -0.1) return `Ganho de ${diffRounded} kg`;
    return `Estável (Variação de ${diffRounded} kg)`;
  }

  return router;
};
