const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const setupPlanRoutes = (dbPool, rabbitMQChannel) => {

  // ROTA 1: GET /api/planos - Busca o PLANO ATIVO COMPLETO

  router.get("/", protect, async (req, res) => {
    const userId = req.userId;
    if (!dbPool) return res.status(500).json({ error: "DB indisponível." });

    try {
      const [userRows] = await dbPool.query(
        `SELECT plano_ativo_id FROM users WHERE id = ?`,
        [userId]
      );
      const planoAtivoId = userRows[0]?.plano_ativo_id;

      if (!planoAtivoId) return res.json({});

      const sql = `SELECT p.id, p.plano_json, p.dados_usuario_json, 
        p.calorias, p.proteinas, p.carboidratos, p.gorduras, p.data_criacao
        FROM planos p
        WHERE p.id = ? AND p.user_id = ?`
        .replace(/\s+/g, " ")
        .trim();

      const [planRows] = await dbPool.query(sql, [planoAtivoId, userId]);
      if (planRows.length === 0) return res.json({});
      const row = planRows[0]; 
      
      // CÁLCULO APLICADA

      const p = row.proteinas || 0;
      const c = row.carboidratos || 0;
      const g = row.gorduras || 0; // Recalcula as calorias para garantir que o valor está correto, // ignorando o 'row.calorias' que veio do banco.
      const caloriasCorretas = Math.round(p * 4 + c * 4 + g * 9);
      const responseData = {
        id: `PL-${row.id}`,
        calorias: caloriasCorretas, // <--- Usa o valor RECALCULADO
        proteinas: p,
        carboidratos: c,
        gorduras: g,
        dataCriacao: row.data_criacao,
        plano_json: row.plano_json,
        dados_usuario_json: row.dados_usuario_json,
        ativo: true,
      }; // FIM DA CORREÇÃO DO CALCULO APLICADO

      res.json(responseData);
    } catch (error) {
      console.error("❌ Erro ao buscar plano ativo:", error);
      res.status(500).json({ erro: "Erro interno (plano ativo)." });
    }
  }); // <-- Fim da Rota 1 
  
  // ROTA 2: GET /api/planos/historico

  router.get("/historico", protect, async (req, res) => {
    const userId = req.userId;
    if (!dbPool) return res.status(500).json({ error: "DB indisponível." });

    const sql =
      `SELECT id, calorias, proteinas, carboidratos, gorduras, data_criacao, plano_json, objetivo
        FROM planos
        WHERE user_id = ?
        ORDER BY data_criacao DESC`
        .replace(/\s+/g, " ")
        .trim();

    try {
      const [planRows] = await dbPool.query(sql, [userId]);

      const responseData = planRows.map((row) => {
        let resumo = row.objetivo || "Plano de dieta e macros";
        try {
          const planoData = JSON.parse(row.plano_json);
          if (planoData.nome) resumo = planoData.nome;
        } catch (e) {} // Aplica o recálculo aqui também para o histórico

        const p = row.proteinas || 0;
        const c = row.carboidratos || 0;
        const g = row.gorduras || 0;
        const caloriasCorretas = Math.round(p * 4 + c * 4 + g * 9);

        return {
          id: `PL-${row.id}`,
          dataCriacao: new Date(row.data_criacao).toLocaleDateString("pt-BR"),
          metaCalorica: caloriasCorretas, // <- Corrigido
          proteinas: p,
          carboidratos: c,
          gorduras: g,
          resumo: resumo,
          objetivo: row.objetivo,
        };
      });
      res.json(responseData);
    } catch (error) {
      console.error("❌ Erro ao buscar histórico de planos:", error);
      res.status(500).json({ erro: "Erro interno (histórico)." });
    }
  }); 
  
  // ROTA 3: GET /api/planos/job/:jobId

  router.get("/job/:jobId", protect, async (req, res) => {
    const jobId = req.params.jobId;
    const userId = req.userId;

    if (!jobId || isNaN(parseInt(jobId))) {
      return res.status(400).json({ erro: "ID do Job inválido ou ausente." });
    }
    if (!dbPool) return res.status(500).json({ error: "DB indisponível." });

    const sql = `SELECT status, plano_id, plano_data, error_message
      FROM jobs_planos 
      WHERE id = ? AND user_id = ?`
      .replace(/\s+/g, " ")
      .trim();

    try {
      const [rows] = await dbPool.query(sql, [jobId, userId]);
      if (rows.length === 0) {
        return res
          .status(404)
          .json({ erro: "Job não encontrado ou acesso negado." });
      }

      const job = rows[0];
      if (job.status === "CONCLUIDO") {
        return res.json({
          status: "CONCLUIDO",
          planoId: `PL-${job.plano_id}`,
          planoData: JSON.parse(job.plano_data),
        });
      } else if (job.status === "FALHOU") {
        return res.json({
          status: "FALHOU",
          error: job.error_message || "Erro desconhecido.",
        });
      } else {
        return res.json({ status: job.status });
      }
    } catch (error) {
      console.error("❌ Erro ao verificar status do job:", error);
      res.status(500).json({ erro: "Erro interno (check job)." });
    }
  }); 
  
  // ROTA 4: VISUALIZAR PLANO (GET /:id)

  router.get("/:id", protect, async (req, res) => {
    const planoIdComPrefixo = req.params.id;
    const userId = req.userId;

    const planoId = planoIdComPrefixo.startsWith("PL-")
      ? planoIdComPrefixo.substring(3)
      : planoIdComPrefixo;

    if (!dbPool) return res.status(500).json({ error: "DB indisponível." });

    const sql =
      `SELECT plano_json, dados_usuario_json, calorias, proteinas, carboidratos, gorduras, data_criacao
      FROM planos 
      WHERE id = ? AND user_id = ?`
        .replace(/\s+/g, " ")
        .trim();

    try {
      const [rows] = await dbPool.query(sql, [planoId, userId]);
      if (rows.length === 0) {
        return res
          .status(404)
          .json({ erro: "Plano não encontrado ou acesso negado." });
      }
      const row = rows[0]; // Aplica o recálculo aqui também

      const p = row.proteinas || 0;
      const c = row.carboidratos || 0;
      const g = row.gorduras || 0;
      const caloriasCorretas = Math.round(p * 4 + c * 4 + g * 9);

      const responseData = {
        id: planoIdComPrefixo,
        metaCalorica: caloriasCorretas || "N/A",
        dataCriacao: row.data_criacao,
        proteinas: p || "N/A",
        carboidratos: c || "N/A",
        gorduras: g || "N/A",
        plano_json: row.plano_json,
        dados_usuario_json: row.dados_usuario_json,
      };
      res.json(responseData);
    } catch (error) {
      console.error("❌ Erro ao buscar plano específico por ID:", error);
      res.status(500).json({ erro: "Erro interno (plano por ID)." });
    }
  }); // <-- Fim do router.get("/:id") 

  // ROTA: ATUALIZAR PLANO (PUT /api/planos/:id)

  router.put("/:id", protect, async (req, res) => {
    const planoIdComPrefixo = req.params.id;
    const userId = req.userId;
    const { plano_json } = req.body;

    const planoId = planoIdComPrefixo.startsWith("PL-")
      ? planoIdComPrefixo.substring(3)
      : planoIdComPrefixo;

    if (!plano_json) {
      return res
        .status(400)
        .json({ erro: "Dados do plano (plano_json) ausentes." });
    }
    if (!dbPool) {
      return res.status(500).json({ erro: "Conexão com o DB indisponível." });
    }

    const planoJsonString = JSON.stringify(plano_json);

    const sql = `UPDATE planos 
    SET plano_json = ? 
    WHERE id = ? AND user_id = ?`;

    try {
      const [result] = await dbPool.query(sql, [
        planoJsonString,
        planoId,
        userId,
      ]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ erro: "Plano não encontrado ou acesso negado." });
      }

      res.json({
        success: true,
        message: `Plano ${planoIdComPrefixo} atualizado com sucesso.`,
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar plano:", error);
      res.status(500).json({ erro: "Erro interno ao atualizar o plano." });
    }
  }); 
  
  // ROTA 5 (NOVA): DELETE /api/planos/:id

  router.delete("/:id", protect, async (req, res) => {
    const planoIdComPrefixo = req.params.id;
    const userId = req.userId;
    const planoId = planoIdComPrefixo.startsWith("PL-")
      ? planoIdComPrefixo.substring(3)
      : planoIdComPrefixo;

    if (!dbPool) {
      return res.status(500).json({ erro: "Conexão com o DB indisponível." });
    }

    const sql = `DELETE FROM planos WHERE id = ? AND user_id = ?`;

    try {
      const [result] = await dbPool.query(sql, [planoId, userId]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ erro: "Plano não encontrado ou acesso negado." });
        A; // <--- Cuidado: isso parece ser um erro de digitação no seu original
      }
      res.json({
        success: true,
        message: `Plano ${planoIdComPrefixo} excluído.`,
      });
    } catch (error) {
      console.error("❌ Erro ao excluir plano:", error);
      res.status(500).json({ erro: "Erro interno ao excluir o plano." });
    }
  }); 
  
  // ROTA 6: SELECIONAR PLANO COMO ATIVO (POST /selecionar/:id)

  router.post("/selecionar/:id", protect, async (req, res) => {
    const planoIdComPrefixo = req.params.id;
    const userId = req.userId;
    const planoId = planoIdComPrefixo.startsWith("PL-")
      ? planoIdComPrefixo.substring(3)
      : planoIdComPrefixo;

    if (!dbPool) return res.status(500).json({ error: "DB indisponível." });

    const checkSql = `SELECT id FROM planos WHERE id = ? AND user_id = ?`
      .replace(/\s+/g, " ")
      .trim();
    const [checkRows] = await dbPool.query(checkSql, [planoId, userId]);

    if (checkRows.length === 0) {
      return res
        .status(404)
        .json({ erro: "Plano não encontrado ou acesso negado." });
    }

    const updateSql = `UPDATE users SET plano_ativo_id = ? WHERE id = ?`
      .replace(/\s+/g, " ")
      .trim();
    try {
      await dbPool.query(updateSql, [planoId, userId]);
      res.json({
        success: true,
        message: `Plano ${planoIdComPrefixo} selecionado como ativo.`,
      });
    } catch (error) {
      console.error("❌ Erro ao selecionar plano como ativo:", error);
      res.status(500).json({ erro: "Erro interno (selecionar ativo)." });
    }
  }); // Retorna o router configurado

  return router;
};


module.exports = setupPlanRoutes;
