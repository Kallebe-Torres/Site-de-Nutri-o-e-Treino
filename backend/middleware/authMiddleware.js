const jwt = require("jsonwebtoken");
require("dotenv").config();

// Chave Secreta do JWT. Está sendo definida no arquivo .env
const JWT_SECRET =
  process.env.JWT_SECRET || "sua-chave-secreta-padrao-muito-segura";

// Middleware para proteger rotas
const protect = (req, res, next) => {
  let token; 

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1]; // 2. Verifica e decodifica o token (ASSUMIMOS que o token tem o 'id' do usuário)
      const decoded = jwt.verify(token, JWT_SECRET); // 3. ANEXA O ID DO USUÁRIO À REQUISIÇÃO (req.userId)

      req.userId = decoded.userId;

      console.log(`[Protect Middleware] Token válido. User ID anexado: ${req.userId}`);

      next();
    } catch (error) {
      console.error("❌ Erro na verificação do token:", error); // Erro no token (expirado, inválido, chave errada)
      return res
        .status(401)
        .json({ message: "Não autorizado. Token inválido ou expirado." });
    }
  } else {
    // Se nenhum token foi fornecido
    return res
      .status(401)
      .json({ message: "Não autorizado. Nenhum token fornecido." });
  }
};

module.exports = { protect };
