// backend/server.js

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const { protect } = require("./middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const { Sequelize } = require("sequelize");
const sequelize = require("./config/database");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mysql = require("mysql2/promise");
const { GoogleGenAI } = require("@google/genai");

// --- Modelos ---
const defineUser = require("./models/User");
const defineAcomp = require("./models/Acomp");
const defineRelat = require("./models/Relat");

const User = defineUser(sequelize, Sequelize.DataTypes);
const Acomp = defineAcomp(sequelize, Sequelize.DataTypes);
const Relat = defineRelat(sequelize, Sequelize.DataTypes);

// --- Rotas (Do seu server principal) ---
const setupAuthRoutes = require("./routes/auth");
const setupPlanRoutes = require("./routes/planRoutes");
const setupAcompRoutes = require("./routes/acompRoutes");
const setupRelaRoutes = require("./routes/RelaRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração Gemini ---
const apiKey = process.env.GEMINI_API_KEY;
// Mantido o nome 'vertex_ai' para compatibilidade com RelaRoutes
let vertex_ai;

if (!apiKey) {
  console.error("❌ ERRO: GEMINI_API_KEY não foi lida do .env.");
  vertex_ai = null;
} else {
  try {
    // Inicialização com API Key (do server que funciona) ***
    vertex_ai = new GoogleGenAI({ apiKey: apiKey });
    console.log("✅ Instância GoogleGenAI (API Key) criada com sucesso.");
  } catch (error) {
    console.error(
      "❌ ERRO CRÍTICO ao inicializar GoogleGenAI (API Key):",
      error
    );
    vertex_ai = null;
  }
}

// MIDDLEWARES DE APLICAÇÃO
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// --- SERVIR ARQUIVOS ESTÁTICOS ---
const publicDir = path.join(__dirname, "..", "public");
console.log(`[SERVER LOG] Tentando servir arquivos estáticos de: ${publicDir}`);
if (!fs.existsSync(publicDir)) {
  console.error(
    `❌ ERRO CRÍTICO: Diretório estático NÃO ENCONTRADO em: ${publicDir}`
  );
} else {
  const indexHtmlPath = path.join(publicDir, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    console.error(`❌ ERRO: index.html NÃO ENCONTRADO em: ${indexHtmlPath}`);
  } else {
    console.log(
      `[SERVER LOG] index.html encontrado. Servindo arquivos de ${publicDir}`
    );
  }
  app.use(express.static(publicDir));
}

// --- Middlewares de Sessão e Passport (Mantidos) ---
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- Configuração Passport (Mantida) ---
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ ERRO: GOOGLE_CLIENT_ID ou SECRET não definidos!");
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const firstname = profile.displayName?.split(" ")[0];
          if (!email) {
            return done(new Error("Email não fornecido."), null);
          }
          let user = await User.findOne({ where: { google_id: googleId } });
          if (!user) {
            user = await User.findOne({ where: { email: email } });
            if (user) {
              user.google_id = googleId;
              await user.save();
            } else {
              user = await User.create({
                google_id: googleId,
                email: email,
                nome: firstname,
              });
            }
          }
          return done(null, user);
        } catch (err) {
          console.error("Erro Google Auth:", err);
          return done(err, null);
        }
      }
    )
  );
}

// --- Configuração DB Pool (Mantida) ---
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
let dbPool;

// FUNÇÃO DE INÍCIO E ROTAS
async function startServer() {
  try {
    // 1. CONEXÕES DB (Mantidas)
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log("✅ Conexão Sequelize OK.");
    dbPool = mysql.createPool(dbConfig);
    const connection = await dbPool.getConnection();
    connection.release();
    console.log("✅ Conexão MySQL2 Pool OK.");

    // --- REGISTRO DAS ROTAS DE API ---
    // 3. AUTENTICAÇÃO (/api/auth)
    const authRoutes = setupAuthRoutes(User);
    app.use("/api/auth", authRoutes);

    // 4. AUTENTICAÇÃO GOOGLE (/auth/google) (Mantida)
    app.get(
      "/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] })
    );
    app.get(
      "/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: "/login.html?error=google_auth_failed",
        session: false,
      }),
      (req, res) => {
        const payload = {
          userId: req.user.id,
          email: req.user.email,
          nome: req.user.nome,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
          expiresIn: "1d",
        });
        res.redirect(`/?token=${token}`);
      }
    );

    // 5. PLANOS (/api/planos) - Passa dbPool
    const planRouter = setupPlanRoutes(dbPool);
    app.use("/api/planos", planRouter);
    console.log("✅ Rotas /api/planos carregadas.");

    // 6. ACOMPANHAMENTO (/api/acompanhamento) - Passa Acomp
    const acompRoutes = setupAcompRoutes(Acomp);
    app.use("/api/acompanhamento", acompRoutes);
    console.log("✅ Rotas /api/acompanhamento carregadas.");

    // 7. RELATÓRIO (/api/relatorio) - Passa Acomp, Relat e **vertex_ai**
    // (Agora 'vertex_ai' é a instância do GoogleGenAI)
    if (vertex_ai) {
      const relaRoutes = setupRelaRoutes(Acomp, Relat, vertex_ai); // Passa a instância
      app.use("/api/relatorio", relaRoutes);
      console.log("✅ Rotas /api/relatorio carregadas.");
    } else {
      console.error(
        "❌ ERRO: Instância GoogleGenAI não disponível. Rotas /api/relatorio não carregadas."
      );
      app.use("/api/relatorio", (req, res) => {
        res.status(503).json({ erro: "Serviço de IA indisponível." });
      });
    }

    // --- *** MUDANÇA 3: ROTA /api/generate-plan (do server que funciona) *** ---
    app.post("/api/generate-plan", protect, async (req, res) => {
      // Adicionado 'protect'
      const { userData } = req.body;
      const userId = req.userId; // Pega o userId do 'protect'
      console.log(`[generate-plan] Recebido pedido para User ${userId}`);

      if (!userData) {
        return res.status(400).json({ error: "Dados do usuário ausentes." });
      }
      if (!vertex_ai) {
        // Verifica a instância da IA
        return res.status(503).json({ error: "Serviço de IA indisponível." });
      }

      const numRefeicoes = parseInt(userData.numRefeicoes) || 5;

      // Usando o prompt do seu "server que funciona"
      const prompt = `
            Você é um nutricionista virtual e um assistente de API. Crie um plano de dieta diário e detalhado 
            com um total de **${numRefeicoes} refeições** (ex: Café da Manhã, Almoço, etc.) 
            para uma pessoa com as seguintes informações:
            - Objetivo: ${userData.objetivo}
            - Sexo: ${userData.sexo}
            - Idade: ${userData.idade} anos
            - Peso: ${userData.peso} kg
            - Altura: ${userData.altura} cm
            - Tipo de Alimentação: ${userData.tipoDieta} 
            - Frequência de Atividade: ${userData.frequencia}
            - Restrições/Alergias: ${userData.restricoes || "Nenhuma"}
            - Rotina Diária/Horários: ${userData.descricao} 

            **INSTRUÇÕES CRÍTICAS E OBRIGATÓRIAS:**
            1. **CÁLCULOS:** Calcule as quantidades de **Calorias Totais (kcal)** e Macronutrientes (Proteínas, Carboidratos, Gorduras) 
            em **GRAMAS**. Use os valores numéricos para preencher as chaves \`calorias\`, \`proteinas\`, \`carboidratos\` e \`gorduras\`.
            2. Ajuste os horários e o número de refeições de acordo com a Rotina Diária.
            3. Retorne **APENAS** o objeto JSON estrito seguindo a ESTRUTURA JSON OBRIGATÓRIA abaixo, e nada mais.

            ESTRUTURA JSON OBRIGATÓRIA (Alinhada com as colunas do seu MySQL: \`calorias\`, \`proteinas\`, \`carboidratos\`, \`gorduras\`):
            {
            "calorias": XX, // Coluna 'calorias' (Número inteiro sem 'kcal/dia')
            "proteinas": Y, // Coluna 'proteinas' (Número inteiro de gramas)
            "carboidratos": Z, // Coluna 'carboidratos' (Número inteiro de gramas)
            "gorduras": W, // Coluna 'gorduras' (Número inteiro de gramas)
            "distribuicaoMacros": "Breve descrição da distribuição percentual (ex: 40% Carboidratos, 30% Proteínas, 30% Gorduras).",
            "observacoes": "Qualquer observação ou recomendação final, incluindo hidratação.",
            "planoDiario": [
                {
            "refeicao": "Nome da Refeição (ex: Café da Manhã, Almoço)",
            "horarioSugerido": "HH:MM",
            "detalhe": "Use quebras de linha (\\n) ou marcadores de lista (ex: - item 1\\n- item 2) para listar os alimentos e quantidades sugeridas."
            }
            ]
            }
            `;

      try {
        console.log(
          "[generate-plan] Enviando prompt para Google AI (API Key)..."
        );
        // *** CORREÇÃO: Usando a instância 'vertex_ai' (que agora é GoogleGenAI) ***
        const response = await vertex_ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
          },
        });

        const jsonText = response.text.trim();
        const rawPlan = JSON.parse(jsonText);

        // Mapeamento (do server que funciona)
        const plan = {
          metaCaloricaTotal: rawPlan.calorias,
          proteinaTotal: rawPlan.proteinas,
          carboidratosTotal: rawPlan.carboidratos,
          gorduraTotal: rawPlan.gorduras,
          distribuicaoMacros: rawPlan.distribuicaoMacros,
          observacoes: rawPlan.observacoes,
          planoDiario: rawPlan.planoDiario,
          calorias: rawPlan.calorias,
          proteinas: rawPlan.proteinas,
          carboidratos: rawPlan.carboidratos,
          gorduras: rawPlan.gorduras,
        };

        res.json(plan); // Envia o objeto mapeado
      } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        res.status(500).json({
          error:
            "Falha interna ao gerar o plano de dieta. Verifique a API Key ou o formato JSON da resposta.",
        });
      }
    });

    // --- *** MUDANÇA 4: ROTA /api/save-plan (a REAL, do server que funciona) *** ---
    app.post("/api/save-plan", protect, async (req, res) => {
      // Mantido 'protect'
      const { planData, userData } = req.body;
      const userId = req.userId; // *** CORREÇÃO: Pega o userId do token (via 'protect') ***

      if (!dbPool) {
        return res
          .status(500)
          .json({ error: "Conexão com o banco de dados indisponível." });
      }

      if (!planData || !userData) {
        return res
          .status(400)
          .json({ error: "Dados do plano ou usuário ausentes para salvar." });
      }

      if (!userId) {
        // Checagem extra
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      // Dados para o DB
      const plano_json = JSON.stringify(planData);
      const dados_usuario_json = JSON.stringify(userData);
      const objetivo = userData.objetivo || "Não informado";
      const calorias = planData.calorias || 0;
      const proteinas = planData.proteinas || 0;
      const carboidratos = planData.carboidratos || 0;
      const gorduras = planData.gorduras || 0;

      const sql = `
        INSERT INTO planos (user_id, objetivo, meta, data_criacao, calorias, proteinas, carboidratos, gorduras, ativo, plano_json, dados_usuario_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      try {
        const [result] = await dbPool.query(sql, [
          userId, // Usando o userId do token
          objetivo,
          objetivo, // <-- VALOR PARA 'meta'
          new Date().toISOString().slice(0, 10), // <-- VALOR PARA 'data_criacao'
          calorias,
          proteinas,
          carboidratos,
          gorduras,
          1, // Valor para 'ativo'
          plano_json,
          dados_usuario_json,
        ]);

        console.log(`Plano salvo com sucesso para o User ID: ${userId}`);
        return res.status(200).json({ message: "Plano salvo com sucesso." });
      } catch (error) {
        console.error("❌ Erro DETALHADO do MySQL:", error.message);
        return res.status(500).json({
          error:
            "Erro interno ao salvar o plano no banco de dados. Verifique se o MySQL está rodando e se a tabela `planos` existe e tem as colunas corretas.",
        });
      }
    });
    // --- FIM DAS ROTAS /api/generate-plan E /api/save-plan ---

    // --- TRATAMENTO DE 404 e ERROS ---
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        console.warn(`WARN: API não encontrada: ${req.method} ${req.path}.`);
        return res.status(404).json({ erro: "Endpoint não encontrado." });
      }
      if (!res.headersSent) {
        console.log(
          `WARN: Rota não-API/arquivo: ${req.method} ${req.path}. Servindo index.html.`
        );
        res.sendFile(path.join(publicDir, "index.html"), (err) => {
          if (err && !res.headersSent) {
            console.error("Erro ao servir index.html:", err);
            res.status(404).send("Recurso não encontrado.");
          }
        });
      } else {
        next();
      }
    });
    app.use((err, req, res, next) => {
      console.error("❌ ERRO INESPERADO:", err.stack || err);
      if (!res.headersSent) {
        res.status(500).json({ erro: "Erro interno no servidor." });
      }
    });

    // INICIA O SERVIDOR EXPRESS
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Falha CRÍTICA ao iniciar:", error);
    process.exit(1);
  }
}

// Chama a função para iniciar o servidor
startServer();
