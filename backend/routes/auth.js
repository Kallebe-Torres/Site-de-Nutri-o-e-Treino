const express = require("express");
const router = express.Router();

// --- ADIÇÃO 1: Importar o middleware 'protect' ---

const { protect } = require("../middleware/authMiddleware");

module.exports = (User) => {
  const authController = require("../controllers/authController")(User);

  // Mapeamento das rotas existentes
  router.post("/register", authController.registerUser);
  router.post("/login", authController.loginUser);

  // Rotas de Redefinição de Senha
  // A rota request era só forgot-password antes, ajustei para ser mais claro
  router.post("/forgot-password/request", authController.requestPasswordReset);
  router.post(
    "/forgot-password/verify-code",
    authController.verifyPasswordCode
  );
  router.post("/forgot-password/reset", authController.resetPassword);

  router.get("/me", protect, async (req, res) => {
    try {
      const userId = req.userId;
      console.log("Tentando buscar userId:", userId);

      // Se userId for undefined, findByPk falhará ou retornará null
      const user = await User.findByPk(userId, {
        attributes: {
          exclude: [
            "password",
            "resetPasswordToken",
            "resetPasswordExpires",
            "tempResetToken",
            "google_id",
            "updatedAt",
          ],
        },
      });

      if (!user) {
        // Provavelmente cairá aqui agora
        console.log("Usuário não encontrado (userId era undefined?)");
        return res
          .status(404)
          .json({ message: "Usuário não encontrado (sem token válido)." });
      }

      console.log("Usuário encontrado:", user.toJSON()); // Ver dados do usuário
      res.status(200).json(user);
    } catch (error) {
      console.error("❌ Erro na rota /api/auth/me (SEM PROTECT):", error);
      // O erro esperado aqui é algo como "Cannot read property 'id' of undefined" se req.userId não existir
      res.status(500).json({
        message:
          "Erro interno do servidor ao buscar dados do usuário (verificar token).",
      });
    }
  });

  return router;
};
