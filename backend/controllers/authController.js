// IMPORTAÇÕES ESSENCIAIS
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Chave Secreta do JWT
const JWT_SECRET =
  process.env.JWT_SECRET || "sua-chave-secreta-padrao-muito-segura";

// FUNÇÃO PRINCIPAL
module.exports = (User) => {
  // 1. CONFIGURAÇÃO DO TRANSPORTER (Nodemailer)
  let transporter;
  if (process.env.NODE_ENV === "production" || process.env.EMAIL_HOST) {
    // Modo Real/Produção
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log("[Nodemailer] Usando configuração SMTP real.");
  } else {
    // Modo de Teste
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  } // 2. ROTAS DE AUTENTICAÇÃO PADRÃO (REGISTRO E LOGIN) // ROTA: POST /api/auth/register

  const registerUser = async (req, res) => {
    try {
      let { email, password, nome, sobrenome, celular } = req.body; // Limpar espaços em branco (Boa prática no registro)

      email = email ? email.trim() : null;
      password = password ? password.trim() : null;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email e senha são obrigatórios." });
      }

      let user = await User.findOne({ where: { email } });
      if (user) {
        return res.status(400).json({ message: "E-mail já cadastrado." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await User.create({
        email,
        password: hashedPassword,
        nome,
        sobrenome,
        celular,
      });

      res.status(201).json({
        message: "Usuário registrado com sucesso.",
        userId: user.id,
      });
    } catch (error) {
      console.error("❌ Erro no Registro de Usuário:", error);
      res
        .status(500)
        .json({ message: "Erro interno do servidor ao registrar." });
    }
  }; // ROTA: POST /api/auth/login

  const loginUser = async (req, res) => {
    try {
      // <<<--- INÍCIO DA CORREÇÃO ---<<<
      // 1. Pegamos os dados "crus" (raw) do body. Não usamos 'let'.
      const { email, password } = req.body; // 2. Verificamos se eles existem

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email e senha são obrigatórios." });
      } // 3. Limpamos APENAS o email para a busca.

      const trimmedEmail = email.trim(); // 4. Buscamos o usuário pelo email limpo

      const user = await User.findOne({ where: { email: trimmedEmail } }); // <<<--- FIM DA CORREÇÃO ---<<<
      if (!user || !user.password) {
        return res.status(400).json({ message: "Credenciais inválidas." });
      }

      console.log("--- DEBUG DE LOGIN ---");
      console.log(`[DB Hash]: ${user.password}`);
      console.log("----------------------"); // 5. Comparamos a SENHA CRUA (raw 'password') com o hash.

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        // Se não bater, agora sim as credenciais estão erradas.
        return res.status(400).json({ message: "Credenciais inválidas." });
      } // Geração do Token JWT após o sucesso

      const payload = {
        userId: user.id,
        email: user.email,
        nome: user.nome,
      };

      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: "1d",
      });

      res.status(200).json({
        message: "Login bem-sucedido!",
        token: token,
        user: { id: user.id, email: user.email, nome: user.nome },
      });
    } catch (error) {
      console.error("❌ Erro no Login de Usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  }; // 3. ROTAS DE REDEFINIÇÃO DE SENHA (FORGOT PASSWORD)

  const requestPasswordReset = async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(200).json({
          message: "Se o e-mail estiver cadastrado, um código foi enviado.",
        });
      }

      const code = crypto.randomInt(100000, 999999).toString();
      const expires = new Date(Date.now() + 3600000); // 1 hora
      user.resetPasswordToken = code;
      user.resetPasswordExpires = expires;
      await user.save();

      console.log(`Código Gerado para ${user.email}: ${code}`);

      const mailOptions = {
        from: '"AvoNutri" <naoresponda@avonutri.com>',
        to: user.email,
        subject: "Recuperação de Senha - Código de Acesso",
        text: `Seu código de recuperação de senha é: ${code}. Ele expira em 1 hora.`,
        html: `<p>Olá,</p><p>Seu código de recuperação de senha é: <strong>${code}</strong>. Ele expira em 1 hora.</p>`,
      };

      const info = await transporter.sendMail(mailOptions);

      if (info.response) {
        console.log("--- E-MAIL (JSON) ---");
        console.log(info.response);
        console.log("------------------------------");
      }

      return res
        .status(200)
        .json({ message: "Código de recuperação enviado com sucesso." });
    } catch (error) {
      console.error("Erro ao solicitar redefinição:", error);
      return res.status(500).json({ message: "Erro interno do servidor." });
    }
  };

  const verifyPasswordCode = async (req, res) => {
    try {
      const { email, code } = req.body;

      const user = await User.findOne({
        where: {
          email,
          resetPasswordToken: code,
          resetPasswordExpires: {
            [Op.gt]: new Date(),
          },
        },
      });

      if (!user) {
        return res
          .status(400)
          .json({ message: "Código inválido ou expirado. Tente novamente." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");

      user.resetPasswordToken = null;
      user.tempResetToken = resetToken;
      user.resetPasswordExpires = null;
      await user.save();

      return res
        .status(200)
        .json({ message: "Código verificado.", resetToken });
    } catch (error) {
      console.error("Erro ao verificar código:", error);
      return res.status(500).json({ message: "Erro interno do servidor." });
    }
  };

  const resetPassword = async (req, res) => {
    try {
      let { email, token, newPassword } = req.body; // Mantemos o trim() aqui, pois é uma NOVA senha.

      newPassword = newPassword ? newPassword.trim() : null;

      if (!newPassword) {
        return res.status(400).json({ message: "A nova senha é obrigatória." });
      }

      const user = await User.findOne({
        where: { email, tempResetToken: token },
      });

      if (!user) {
        return res
          .status(400)
          .json({ message: "Usuário ou token de redefinição inválido." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      console.log("--- DEBUG NO RESET ---");
      console.log(`[New Hashed Password]: ${hashedPassword}`);
      console.log("----------------------");

      await User.update(
        {
          password: hashedPassword,
          resetPasswordToken: null,
          tempResetToken: null,
          resetPasswordExpires: null,
        },
        { where: { id: user.id } }
      );

      return res.status(200).json({ message: "Senha redefinida com sucesso!" });
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      return res.status(500).json({ message: "Erro interno do servidor." });
    }
  }; // Retorna todas as funções do controller

  return {
    registerUser,
    loginUser,
    requestPasswordReset,
    verifyPasswordCode,
    resetPassword,
  };
};
