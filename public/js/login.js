// js/login.js

 //Mostra uma mensagem de erro no formulário de login.
function showLoginError(message) {
  const errorDiv = document.getElementById("login-error-message");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove("hidden");
  } else {
    // Fallback caso o div não exista (embora não deva ser usado)
    console.error("Erro no login:", message);
  }
}

/**
 * Verifica o status de login assim que a página carrega.
 * Se o token for válido, redireciona para o index.html.
 */
async function checkLoginStatusOnLoad() {
  const token = localStorage.getItem("userToken");

  if (!token) {
    // Nenhum token, deixa o usuário fazer login
    document.body.classList.remove("opacity-0"); // Mostra a página
    return;
  }

  try {
    // Tenta verificar o token com o backend
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      // Token é válido! Redireciona para a home
      console.log("Usuário já logado. Redirecionando para /index.html...");
      window.location.href = "index.html";
    } else {
      // Token é inválido ou expirado
      localStorage.removeItem("userToken");
      document.body.classList.remove("opacity-0"); // Mostra a página
    }
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    document.body.classList.remove("opacity-0"); // Mostra a página em caso de erro de rede
  }
}

/**
 * Lida com a submissão do formulário de login
 */
async function handleLoginSubmit(event) {
  event.preventDefault(); // Impede o recarregamento da página

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorDiv = document.getElementById("login-error-message");
  const loginButton = document.getElementById("login-button"); // Assumindo que seu botão tem este ID

  // Feedback de carregamento
  if (loginButton) loginButton.disabled = true;
  if (errorDiv) errorDiv.classList.add("hidden");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Mostra a mensagem de erro vinda do backend (ex: "Credenciais inválidas")
      throw new Error(data.message || "Erro desconhecido no login.");
    }

    // SUCESSO!
    if (data.token) {
      localStorage.setItem("userToken", data.token);
      // Redireciona para a página principal
      window.location.href = "index.html";
    } else {
      throw new Error("Token não recebido do servidor.");
    }
  } catch (error) {
    showLoginError(error.message);
    if (loginButton) loginButton.disabled = false;
  }
}

// --- Inicialização ---

document.addEventListener("DOMContentLoaded", () => {
  // 1. Verifica o status de login ANTES de mostrar a página
  checkLoginStatusOnLoad();

  // 2. Adiciona o listener ao formulário de login
  const loginForm = document.getElementById("login-form"); // Assumindo que seu form tem este ID
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  // 3. Adiciona listeners aos inputs para limpar o erro
  document.getElementById("email")?.addEventListener("input", () => {
    document.getElementById("login-error-message")?.classList.add("hidden");
  });
  document.getElementById("password")?.addEventListener("input", () => {
    document.getElementById("login-error-message")?.classList.add("hidden");
  });
});
