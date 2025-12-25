// AVONUTRI - VERIFICADOR DE AUTENTICAÇÃO
// (auth-check.js)

async function fetchUserDetails() {
  const token = localStorage.getItem("userToken");
  if (!token) return null;

  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      console.warn("Token inválido ou expirado. Deslogando.");
      localStorage.removeItem("userToken");
      return null;
    }
    if (!response.ok) {
      console.error("Erro ao buscar dados do usuário:", response.statusText);
      return null;
    }

    const user = await response.json();

    let registrationDate = "Data indisponível";
    if (user.createdAt) {
      const dateObj = new Date(user.createdAt);
      registrationDate = dateObj.toLocaleDateString("pt-BR");
    }

    return {
      name: user.nome || "Usuário",
      registrationDate: registrationDate,
    };
  } catch (error) {
    console.error("Erro na requisição fetchUserDetails:", error);
    return null;
  }
}

/**
 * FUNÇÃO 2: LIDAR COM LOGOUT
 Redireciona para login.html em vez de recarregar
 */
function handleLogout() {
  localStorage.removeItem("userToken");
  window.location.href = "login.html"; 
}

/**
 * FUNÇÃO 3: PROTEGER LINKS
 */
function setupAuthRequiredListeners(isLoggedIn) {
  const authLinks = document.querySelectorAll(".auth-required");
  authLinks.forEach((link) => {
    if (isLoggedIn) {
      link.style.opacity = "1";
      link.style.pointerEvents = "auto";
      link.style.cursor = "pointer";
      link.onclick = null;
    } else {
      link.style.opacity = "0.6";
      link.style.pointerEvents = "auto";
      link.style.cursor = "pointer";
      link.onclick = (e) => {
        e.preventDefault();
        console.warn("Acesso bloqueado. Redirecionando para login.");
        window.location.href = "login.html";
      };
    }
  });
}

/*
 * LÓGICA PRINCIPAL DE INICIALIZAÇÃO
 */

document.addEventListener("DOMContentLoaded", async () => {
  // --- ETAPA 1: CAPTURA DE TOKEN DA URL (Google Login) ---
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token");

  if (tokenFromUrl) {
    localStorage.setItem("userToken", tokenFromUrl);
    window.history.replaceState(null, "", window.location.pathname);
    console.log("Token (do Google) capturado da URL e salvo.");
  } // --- ETAPA 2: LÓGICA DE VERIFICAÇÃO DE LOGIN ---
  const userToken = localStorage.getItem("userToken");
  const userInfoDiv = document.getElementById("user-info");
  const loginLinkDiv = document.getElementById("login-link");
  const logoutButton = document.getElementById("logout-button");

  const userDisplayName = document.getElementById("user-display-name");
  const connectionDateSpan = document.getElementById("connection-date");
  const welcomeMessageElement = document.getElementById("welcome-message");

  let isLoggedIn = false;

  if (userToken) {
    const userData = await fetchUserDetails();

    if (userData) {
      isLoggedIn = true;

      if (userDisplayName) {
        userDisplayName.textContent = userData.name.split(" ")[0];
      }
      if (connectionDateSpan) {
        connectionDateSpan.innerHTML = `<span class="text-green-600 font-bold">Conectado</span>
        <span class="block text-gray-500 text-xs mt-1">Membro desde ${userData.registrationDate}</span>`;
      }

      if (welcomeMessageElement) {
        welcomeMessageElement.textContent = `Seja Bem-vindo(a), ${userData.name}!`;
        welcomeMessageElement.classList.remove("hidden"); // Garante que está visível
      }

      if (userInfoDiv) userInfoDiv.classList.remove("hidden");
      if (loginLinkDiv) loginLinkDiv.classList.add("hidden");
    } else {
      isLoggedIn = false;
      if (userInfoDiv) userInfoDiv.classList.add("hidden");
      if (loginLinkDiv) loginLinkDiv.classList.remove("hidden");
    }
  } else {
    isLoggedIn = false;
    if (userInfoDiv) userInfoDiv.classList.add("hidden");
    if (loginLinkDiv) loginLinkDiv.classList.remove("hidden");
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  setupAuthRequiredListeners(isLoggedIn);
});
