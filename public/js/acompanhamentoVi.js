// js/acompanhamentoVi.js
// VERSÃO COMPLETA CORRIGIDA (SEM DUPLICAÇÃO)

const API_PLANOS_URL = "/api/planos"; // Rota de Planos
const API_ACOMP_URL = "/api/acompanhamento"; // Rota de Acompanhamento (Acomps)
const API_AUTH_ME = "/api/auth/me"; // Rota para buscar dados do usuário

// FUNÇÕES DE FEEDBACK (MOVIDO PARA INDEPENDÊNCIA)

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl transition-opacity duration-300 z-50
    ${
      isError
        ? "bg-red-600 text-white border border-red-700"
        : "bg-green-600 text-white border border-green-700"
    }`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Variáveis Globais de Estado
let userId = null; // Será pego do token
let currentSelectedDateKey = getFormattedDate(new Date());
let currentDisplayCenterDate = new Date();
let userRegistrationDate = null; // Guarda a data de cadastro

// Metas do plano ativo (serão preenchidas pela API)
const DAILY_GOALS = {
  calorias: 0,
  proteinas: 0,
  carboidratos: 0,
  gorduras: 0,
  initialWeight: 0,
};

// Estado atual do registro do dia (será preenchido pela API)
let STATE = {
  weight: "",
  observation: "",
  mealStatus: {},
  registeredMacros: {
    proteinas: 0,
    carboidratos: 0,
    gorduras: 0,
    calorias: 0,
  },
};

// Mapa de Refeições (será preenchido dinamicamente pelo plano)
let MEALS = {};

const MACRO_KEYS_INPUT = ["proteinas", "carboidratos", "gorduras"];
const MACRO_CALORIE_FACTORS = { proteinas: 4, carboidratos: 4, gorduras: 9 };

const STATUS_MAP = {
  Selecione: {
    dotClass: "dot-gray",
    buttonClasses: "status-button",
    textClass: "muted",
  },
  Consumido: {
    dotClass: "dot-green",
    buttonClasses: "status-button consumed",
    textClass: "",
  },
  Parcial: {
    dotClass: "dot-yellow",
    buttonClasses: "status-button parcial",
    textClass: "",
  },
  Ignorado: {
    dotClass: "dot-red",
    buttonClasses: "status-button ignored",
    textClass: "",
  },
};

/* ---------- Funções Utilitárias ---------- */
function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  const localDateString = dateKey.replace(/-/g, "/");
  const date = new Date(localDateString);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function calculateCalories(macros) {
  const proteinCal = (macros.proteinas || 0) * MACRO_CALORIE_FACTORS.proteinas;
  const carbCal =
    (macros.carboidratos || 0) * MACRO_CALORIE_FACTORS.carboidratos;
  const fatCal = (macros.gorduras || 0) * MACRO_CALORIE_FACTORS.gorduras;
  return Math.round(proteinCal + carbCal + fatCal);
}

// Pega o token de forma segura
function getAuthHeaders() {
  const token = localStorage.getItem("userToken");
  if (!token) {
    showToast("❌ Erro de Autenticação. Redirecionando para o login...", true);
    const dateParam = `?date=${currentSelectedDateKey}`;
    setTimeout(
      () =>
        (window.location.href = `login.html?redirect=acompanhamentoorigin.html${dateParam}`),
      2000
    );
    return null;
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/* ---------- Funções de Ação (Chamadas pelo HTML) ---------- */
window.updateCalories = () => {
  const macros = MACRO_KEYS_INPUT.reduce((acc, key) => {
    const input = document.getElementById(`macro-input-${key}`);
    let value = parseFloat(input.value) || 0;
    value = Math.max(0, value);
    input.value = value;
    acc[key] = value;
    return acc;
  }, {});

  const totalCalories = calculateCalories(macros);

  STATE.registeredMacros.proteinas = macros.proteinas;
  STATE.registeredMacros.carboidratos = macros.carboidratos;
  STATE.registeredMacros.gorduras = macros.gorduras;
  STATE.registeredMacros.calorias = totalCalories;

  const protDisplay = document.getElementById("proteinas-display");
  const carbDisplay = document.getElementById("carboidratos-display");
  const gordDisplay = document.getElementById("gorduras-display");
  const calDisplay = document.getElementById("calories-display");

  if (calDisplay)
    calDisplay.textContent = totalCalories.toLocaleString("pt-BR");
  if (protDisplay)
    protDisplay.textContent = macros.proteinas.toLocaleString("pt-BR");
  if (carbDisplay)
    carbDisplay.textContent = macros.carboidratos.toLocaleString("pt-BR");
  if (gordDisplay)
    gordDisplay.textContent = macros.gorduras.toLocaleString("pt-BR");
};

window.selectDate = (dateKey) => {
  const today = getFormattedDate(new Date());
  if (dateKey > today) {
    showToast(
      "Não é possível registrar um acompanhamento para uma data futura.",
      true
    );
    return;
  }
  if (currentSelectedDateKey === dateKey) return;

  currentSelectedDateKey = dateKey;
  currentDisplayCenterDate = new Date(dateKey.replace(/-/g, "/"));

  renderDayNavigation();
  loadDailyLog(dateKey);
};

window.toggleDropdown = (mealKey) => {
  const menu = document.getElementById(`dropdown-menu-${mealKey}`);
  const arrow = document.getElementById(`dropdown-arrow-${mealKey}`);
  const isOpen = menu && menu.style.display === "block";
  document
    .querySelectorAll(".dropdown-menu")
    .forEach((m) => (m.style.display = "none"));
  document
    .querySelectorAll("[id^='dropdown-arrow-']")
    .forEach((a) => (a.style.transform = ""));
  if (!isOpen && menu) {
    menu.style.display = "block";
    if (arrow) arrow.style.transform = "rotate(180deg)";
  }
};

window.handleStatusChange = (mealKey, newStatus) => {
  STATE.mealStatus[mealKey] = newStatus;

  document
    .querySelectorAll(".dropdown-menu")
    .forEach((m) => (m.style.display = "none"));
  document
    .querySelectorAll("[id^='dropdown-arrow-']")
    .forEach((a) => (a.style.transform = ""));

  const button = document.getElementById(`dropdown-button-${mealKey}`);
  const statusText = document.getElementById(`status-text-${mealKey}`);
  const dot = button ? button.querySelector(".status-dot") : null;

  const statusInfo = STATUS_MAP[newStatus] || STATUS_MAP["Selecione"];

  if (button && statusText && dot) {
    statusText.textContent = newStatus;
    button.classList.remove("consumido", "parcial", "ignorado");
    const specificClass = statusInfo.buttonClasses
      .split(" ")
      .find((cls) => cls !== "status-button");
    if (specificClass) {
      button.classList.add(specificClass);
    }
    dot.className = `status-dot ${statusInfo.dotClass}`;
  } else {
    console.warn(
      "Elementos de status não encontrados, forçando renderização completa."
    );
    renderMealStatus();
  }

  showToast(
    `Status do ${
      MEALS[mealKey]?.label || "Refeição"
    } atualizado para ${newStatus}.`,
    false
  );
};

/* ---------- Funções de API (REAIS) Antes Mockados ---------- */

async function loadDailyLog(dateKey) {
  const authHeaders = getAuthHeaders();
  if (!authHeaders) return;

  const saveBtn = document.getElementById("save-button");
  if (saveBtn) {
    saveBtn.textContent = "Carregando Log...";
    saveBtn.disabled = true;
  }

  resetStateToDefault();

  try {
    const response = await fetch(`${API_ACOMP_URL}/${dateKey}`, {
      method: "GET",
      headers: authHeaders,
    });

    if (response.status === 404) {
      console.log(
        `Nenhum log encontrado para ${dateKey}. Usando valores padrão.`
      );
      renderApp();
      return;
    }

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.erro || `Erro ao buscar log: ${response.status}`);
    }

    const data = await response.json();
    console.log("Dados recebidos da API:", data);

    STATE.weight = data.weight || DAILY_GOALS.initialWeight || "";
    STATE.observation = data.observation || "";
    STATE.mealStatus = data.mealStatus || STATE.mealStatus;
    STATE.registeredMacros.proteinas = data.registeredMacros?.proteinas || 0;
    STATE.registeredMacros.carboidratos =
      data.registeredMacros?.carboidratos || 0;
    STATE.registeredMacros.gorduras = data.registeredMacros?.gorduras || 0;
    STATE.registeredMacros.calorias = calculateCalories(STATE.registeredMacros);
  } catch (error) {
    console.error("Erro ao carregar dados do log diário:", error);
    showToast(`Falha ao carregar dados do dia ${dateKey}.`, true);
    renderApp();
  } finally {
    if (saveBtn) {
      saveBtn.textContent = "Salvar Registro Diário";
      saveBtn.disabled = false;
    }
    renderApp();
  }
}

window.saveDailyLog = async () => {
  const authHeaders = getAuthHeaders();
  if (!authHeaders) return;

  updateCalories();
  const dateKey = currentSelectedDateKey;

  const weightInput = document.getElementById("weight-input");
  const observationTextarea = document.getElementById("observation-textarea");

  if (!weightInput || !observationTextarea) {
    console.error(
      "Erro: Inputs de registro de peso ou observação não encontrados."
    );
    showToast("Erro: Inputs do formulário não encontrados.", true);
    return;
  }

  const dataToSave = {
    date: dateKey,
    weight: parseFloat(weightInput.value) || 0,
    observation: observationTextarea.value,
    mealStatus: STATE.mealStatus,
    registeredMacros: STATE.registeredMacros,
    dailyGoals: DAILY_GOALS,
  };

  const saveBtn = document.getElementById("save-button");
  if (saveBtn) {
    saveBtn.textContent = "Salvando...";
    saveBtn.disabled = true;
  }

  try {
    const response = await fetch(API_ACOMP_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(dataToSave),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.erro || "Falha ao salvar no servidor.");
    }
    alert("Registro diário salvo com sucesso!");
    showToast(`Registro diário salvo com sucesso para ${dateKey}!`, false);
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    showToast(`ERRO: Falha ao salvar os dados. ${error.message}`, true);
  } finally {
    if (saveBtn) {
      saveBtn.textContent = "Salvar Registro Diário";
      saveBtn.disabled = false;
    }
  }
};

/* ---------- Funções de Renderização da UI ---------- */

// <-- **** FUNÇÃO CORRIGIDA **** -->
function renderDayNavigation() {
  const navContainer = document.getElementById("days-navigation");
  if (!navContainer) return;

  navContainer.innerHTML = "";

  // Zera a hora das datas para comparação
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const centerDate = new Date(currentDisplayCenterDate);
  centerDate.setHours(0, 0, 0, 0);

  const todayKey = getFormattedDate(today);

  for (let i = -3; i <= 4; i++) {
    const date = new Date(centerDate);
    date.setDate(centerDate.getDate() + i);

    const dayKey = getFormattedDate(date);
    const label = date
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .toUpperCase()
      .replace(".", "");
    const datePart = date.getDate();
    const monthPart = date
      .toLocaleDateString("pt-BR", { month: "short" })
      .toLowerCase()
      .replace(".", "")
      .substring(0, 3);

    const isLocked = date > today;
    const isSelected = dayKey === currentSelectedDateKey;

    const btn = document.createElement("button");
    btn.className =
      "day-btn" + (isSelected ? " selected" : "") + (isLocked ? " locked" : "");
    btn.title = dayKey;
    btn.disabled = isLocked;
    btn.onclick = () => selectDate(dayKey);

    const spanWeek = document.createElement("span");
    spanWeek.className = "weekday";
    spanWeek.textContent = label;

    const spanDate = document.createElement("span");
    spanDate.className = "datepart";
    spanDate.textContent = `${datePart} de ${monthPart}`;

    btn.appendChild(spanWeek);
    btn.appendChild(spanDate);

    if (isLocked) {
      const lockSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      lockSvg.setAttribute("class", "small-lock");
      lockSvg.setAttribute("aria-hidden", "true");
      lockSvg.innerHTML = '<use href="#icon-lock"/>';
      btn.appendChild(lockSvg);
    }
    navContainer.appendChild(btn);
  } // Fim do loop for

  // --- LÓGICA DE HABILITAR/DESABILITAR SETAS (CORRIGIDA) ---
  const prevWeekBtn = document.getElementById("prev-week-btn");
  const nextWeekBtn = document.getElementById("next-week-btn");

  // Calcula a data central da PRÓXIMA semana
  const nextWeekCenter = new Date(centerDate);
  nextWeekCenter.setDate(centerDate.getDate() + 7);

  // Calcula a data central da SEMANA ANTERIOR
  const prevWeekCenter = new Date(centerDate);
  prevWeekCenter.setDate(centerDate.getDate() - 7);

  // Desabilita o botão "anterior" se a data central ANTERIOR for menor que a data de registro
  if (userRegistrationDate && prevWeekCenter < userRegistrationDate) {
    prevWeekBtn.disabled = true;
  } else {
    prevWeekBtn.disabled = false;
  }

  // Desabilita o botão "próximo" se a data central PRÓXIMA for maior que hoje
  if (nextWeekCenter > today) {
    nextWeekBtn.disabled = true;
  } else {
    nextWeekBtn.disabled = false;
  }
}

function renderGoalsSection() {
  const goalsContainer = document.getElementById("daily-goals-container");
  if (!goalsContainer) return;

  goalsContainer.innerHTML = "";
  const goals = [
    { label: "Calorias (KCal)", value: DAILY_GOALS.calorias },
    { label: "Carboidratos (g)", value: DAILY_GOALS.carboidratos },
    { label: "Proteínas (g)", value: DAILY_GOALS.proteinas },
    { label: "Gorduras (g)", value: DAILY_GOALS.gorduras },
  ];
  goals.forEach((goal) => {
    const el = document.createElement("div");
    el.className = "macro-box";
    el.innerHTML = `<div class="label">${
      goal.label
    }</div><div class="value">${goal.value.toLocaleString("pt-BR")}</div>`;
    goalsContainer.appendChild(el);
  });
}

function renderMealStatus() {
  const mealContainer = document.getElementById("meal-status-container");
  if (!mealContainer) return;

  mealContainer.innerHTML = "";

  if (Object.keys(MEALS).length === 0) {
    mealContainer.innerHTML =
      "<p class='muted small' style='padding: 10px 0;'>Plano de dieta não carregado ou sem refeições.</p>";
    return;
  }

  Object.keys(MEALS).forEach((key) => {
    const meal = MEALS[key];
    const currentStatus = STATE.mealStatus[key] || "Selecione";

    const statusInfo = STATUS_MAP[currentStatus] || STATUS_MAP["Selecione"];

    const row = document.createElement("div");
    row.className = "status-row";

    const label = document.createElement("span");
    label.textContent = `${meal.label} (${meal.time})`;
    label.style.fontSize = "15px";

    const rightWrap = document.createElement("div");
    rightWrap.style.position = "relative";

    const button = document.createElement("button");
    button.id = `dropdown-button-${key}`;
    button.className = statusInfo.buttonClasses;
    button.onclick = () => toggleDropdown(key);

    const dot = document.createElement("span");
    dot.className = `status-dot ${statusInfo.dotClass}`;
    button.appendChild(dot);

    const statusText = document.createElement("span");
    statusText.className = "status-text";
    statusText.id = `status-text-${key}`;
    statusText.textContent = currentStatus;
    button.appendChild(statusText);

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("id", `dropdown-arrow-${key}`);
    arrow.setAttribute("class", "icon");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    button.appendChild(arrow);

    const menu = document.createElement("div");
    menu.id = `dropdown-menu-${key}`;
    menu.className = "dropdown-menu";

    Object.keys(STATUS_MAP).forEach((status) => {
      const opt = document.createElement("div");
      opt.className = "option";
      opt.onclick = () => window.handleStatusChange(key, status);
      opt.innerHTML = `<span class="status-dot ${STATUS_MAP[status].dotClass}"></span><span class="muted">${status}</span>`;
      menu.appendChild(opt);
    });

    rightWrap.appendChild(button);
    rightWrap.appendChild(menu);
    row.appendChild(label);
    row.appendChild(rightWrap);
    mealContainer.appendChild(row);
  });
}

function renderMacroSection() {
  const caloriesDisplay = document.getElementById("calories-display");
  const proteinasDisplay = document.getElementById("proteinas-display");
  const carboidratosDisplay = document.getElementById("carboidratos-display");
  const gordurasDisplay = document.getElementById("gorduras-display");

  const macrosContainer = document.getElementById("registered-macros-inputs");

  if (caloriesDisplay) {
    caloriesDisplay.textContent =
      STATE.registeredMacros.calorias.toLocaleString("pt-BR");
  }
  if (proteinasDisplay) {
    proteinasDisplay.textContent =
      STATE.registeredMacros.proteinas.toLocaleString("pt-BR");
  }
  if (carboidratosDisplay) {
    carboidratosDisplay.textContent =
      STATE.registeredMacros.carboidratos.toLocaleString("pt-BR");
  }
  if (gordurasDisplay) {
    gordurasDisplay.textContent =
      STATE.registeredMacros.gorduras.toLocaleString("pt-BR");
  }

  if (!macrosContainer) return;

  macrosContainer.innerHTML = "";
  const inputMacros = ["proteinas", "carboidratos", "gorduras"];
  inputMacros.forEach((key) => {
    const wrapper = document.createElement("div");
    wrapper.className = "macro-card";
    const label = {
      proteinas: "Proteínas (g)",
      carboidratos: "Carboidratos (g)",
      gorduras: "Gorduras (g)",
    }[key];
    const placeholder = {
      proteinas: "Ex: 120",
      carboidratos: "Ex: 250",
      gorduras: "Ex: 60",
    };

    wrapper.innerHTML = `
            <label for="macro-input-${key}">${label}</label>
            <input id="macro-input-${key}" type="number" value="${
      STATE.registeredMacros[key] || 0
    }" placeholder="${placeholder[key]}" min="0" />
    `;
    wrapper.querySelector("input").oninput = () => window.updateCalories();
    macrosContainer.appendChild(wrapper);
  });
}

// Renderiza a UI completa com os dados do STATE
function renderApp() {
  const formattedDate = formatDisplayDate(currentSelectedDateKey);
  const dateDisplay = document.getElementById("current-date-display");
  const weightInput = document.getElementById("weight-input");
  const observationTextarea = document.getElementById("observation-textarea");
  const saveButton = document.getElementById("save-button");

  if (dateDisplay) {
    dateDisplay.textContent = `Data: ${formattedDate}`;
  }

  if (weightInput) weightInput.value = STATE.weight;
  if (observationTextarea) observationTextarea.value = STATE.observation;

  renderGoalsSection();
  renderMacroSection();
  renderMealStatus();

  if (saveButton) saveButton.disabled = false;
}

// Reseta o STATE para o padrão (usado ao trocar de dia)
function resetStateToDefault() {
  STATE.weight = DAILY_GOALS.initialWeight || "";
  STATE.observation = "";
  STATE.registeredMacros = {
    proteinas: 0,
    carboidratos: 0,
    gorduras: 0,
    calorias: 0,
  };

  STATE.mealStatus = {};
  Object.keys(MEALS).forEach((key) => {
    STATE.mealStatus[key] = "Selecione";
  });
}

async function loadAndRenderPlan() {
  const planCard = document.getElementById("plan-card");
  const planTitle = document.getElementById("plan-title");
  const authHeaders = getAuthHeaders();
  if (!authHeaders) return;

  if (planCard) {
    Array.from(planCard.children).forEach((child) => {
      if (!child.classList.contains("card-head")) {
        child.remove();
      }
    });
  }

  try {
    const response = await fetch(API_PLANOS_URL, {
      method: "GET",
      headers: authHeaders,
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 204) {
        throw new Error(
          "Nenhum plano de dieta ativo selecionado. Por favor, selecione um plano no seu Histórico."
        );
      }
      throw new Error(`Erro ao buscar plano ativo: ${response.status}`);
    }

    const planoAtivo = await response.json();
    if (!planoAtivo || !planoAtivo.plano_json) {
      throw new Error("Plano ativo encontrado, mas está vazio ou corrompido.");
    }

    const planData = {
      ...planoAtivo,
      plano_json: JSON.parse(planoAtivo.plano_json),
      dados_usuario_json: JSON.parse(planoAtivo.dados_usuario_json),
    };

    DAILY_GOALS.calorias = planoAtivo.calorias || planData.calorias || 0;
    DAILY_GOALS.proteinas = planoAtivo.proteinas || planData.proteinas || 0;
    DAILY_GOALS.carboidratos =
      planoAtivo.carboidratos || planData.carboidratos || 0;
    DAILY_GOALS.gorduras = planoAtivo.gorduras || planData.gorduras || 0;

    MEALS = {};
    STATE.mealStatus = {};

    if (
      planData.plano_json.planoDiario &&
      Array.isArray(planData.plano_json.planoDiario)
    ) {
      planData.plano_json.planoDiario.forEach((refeicao, index) => {
        const mealKey = `refeicao_${index}`;

        MEALS[mealKey] = {
          label: refeicao.refeicao || "Refeição",
          time: refeicao.horarioSugerido || "HH:MM",
        };
        STATE.mealStatus[mealKey] = "Selecione";

        if (planCard) {
          const bloco = document.createElement("div");
          bloco.className = "meal-block";
          if (index === planData.plano_json.planoDiario.length - 1) {
            bloco.classList.add("last");
          }
          bloco.innerHTML = `
                <h3>${MEALS[mealKey].label} (${MEALS[mealKey].time})</h3>
                <p class="muted">${(
                  refeicao.detalhe || "Sem detalhes."
                ).replace(/\n/g, "<br>")}</p>
              `;
          planCard.appendChild(bloco);
        }
      });
    }

    if (planTitle) {
      planTitle.textContent = planData.nome_plano || "Plano de Dieta (Ativo)";
    }

    renderApp();
    await loadDailyLog(currentSelectedDateKey);
  } catch (err) {
    console.error("Erro ao carregar o plano de dieta:", err);
    if (typeof showToast === "function") {
      showToast(err.message, true);
    }
    if (planCard) {
      planCard.insertAdjacentHTML(
        "beforeend",
        `<p style='color: red; padding: 10px;'>${err.message}</p>`
      );
    }

    await loadDailyLog(currentSelectedDateKey);
  }
}

/* ---------- Funções do Cabeçalho (Auth) ---------- */
function toggleMenu() {
  const navList = document.getElementById("nav_list");
  if (navList) {
    navList.classList.toggle("show");
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById("user-info-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
}

// Fecha dropdowns se clicar fora
document.addEventListener("click", (e) => {
  if (
    !e.target.closest("[id^='dropdown-button-']") &&
    !e.target.closest(".dropdown-menu")
  ) {
    document
      .querySelectorAll(".dropdown-menu")
      .forEach((m) => (m.style.display = "none"));
    document
      .querySelectorAll("[id^='dropdown-arrow-']")
      .forEach((a) => (a.style.transform = ""));
  }

  const dropdown = document.getElementById("user-info-dropdown");
  const icon = document.getElementById("user-profile-icon");
  if (
    dropdown &&
    icon &&
    !dropdown.contains(e.target) &&
    !icon.contains(e.target)
  ) {
    dropdown.classList.remove("active");
  }
});

function handleLogout() {
  localStorage.removeItem("userToken");
  window.location.href = "index.html";
}

async function checkAuthentication() {
  const token = localStorage.getItem("userToken");
  const userInfoDiv = document.getElementById("user-info");
  const loginLinkDiv = document.getElementById("login-link");
  const welcomeMessage = document.getElementById("welcome-message");
  const userDisplayName = document.getElementById("user-display-name");
  const connectionDateSpan = document.getElementById("connection-date");

  if (!token) {
    if (userInfoDiv) userInfoDiv.style.display = "none";
    if (loginLinkDiv) loginLinkDiv.style.display = "flex";
    return false;
  }

  try {
    const response = await fetch(API_AUTH_ME, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      localStorage.removeItem("userToken");
      if (userInfoDiv) userInfoDiv.style.display = "none";
      if (loginLinkDiv) loginLinkDiv.style.display = "flex";
      return false;
    }

    const user = await response.json();
    userId = user.id;

    // GUARDA A DATA DE REGISTRO
    userRegistrationDate = new Date(user.createdAt.replace(/-/g, "/"));
    userRegistrationDate.setHours(0, 0, 0, 0); // Zera a hora para comparações

    // Preenche o header
    if (userDisplayName) userDisplayName.textContent = user.nome || "Usuário";
    if (connectionDateSpan) {
      const dateObj = new Date(user.createdAt);
      connectionDateSpan.textContent = `Membro desde ${dateObj.toLocaleDateString(
        "pt-BR"
      )}`;
    }
    if (welcomeMessage) {
      welcomeMessage.textContent = `Olá, ${user.nome || "Usuário"}!`;
    }

    if (userInfoDiv) userInfoDiv.style.display = "flex";
    if (loginLinkDiv) loginLinkDiv.style.display = "none";

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) logoutButton.addEventListener("click", handleLogout);

    if (user.peso) {
      DAILY_GOALS.initialWeight = parseFloat(user.peso) || 0;
    }

    return true; // Autenticado com sucesso
  } catch (error) {
    console.error("Erro na verificação de autenticação:", error);
    if (userInfoDiv) userInfoDiv.style.display = "none";
    if (loginLinkDiv) loginLinkDiv.style.display = "flex";
    return false;
  }
}

/* ---------- Inicialização ---------- */
async function initAppAndLoadData() {
  try {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      if (typeof showToast === "function") {
        showToast("Você precisa estar logado para acessar esta página.", true);
      }
      window.location.href = "login.html?redirect=acompanhamentoorigin.html";
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get("date");
    if (dateFromUrl) {
      currentSelectedDateKey = dateFromUrl;
      currentDisplayCenterDate = new Date(dateFromUrl.replace(/-/g, "/"));
    }
    // Zera a hora da data central para garantir comparações corretas
    currentDisplayCenterDate.setHours(0, 0, 0, 0);

    // Renderiza a barra de dias (que agora vai checar os limites)
    renderDayNavigation();

    // Carrega o Plano Ativo
    await loadAndRenderPlan();

    // Adiciona listeners aos botões de salvar
    const saveButton = document.getElementById("save-button");
    if (saveButton) {
      saveButton.addEventListener("click", window.saveDailyLog);
    }
  } catch (err) {
    console.error("Erro na inicialização da Aplicação:", err);
    renderDayNavigation();
    renderApp();
  }
}

// --- Funções para controlar o Modal de Relatório ---

const modalRelatorio = document.getElementById("modalRelatorio");

function openRelatorioModal() {
  // Limpa as datas anteriores e o resultado ao abrir
  const dataInicioInput = document.getElementById("dataInicio");
  const dataFimInput = document.getElementById("dataFim");
  const resultadoDiv = document.getElementById("resultadoRelatorio");
  const loadingDiv = document.getElementById("loadingRelatorio");

  if (dataInicioInput) dataInicioInput.value = "";
  if (dataFimInput) dataFimInput.value = "";
  if (resultadoDiv) {
    resultadoDiv.style.display = "none";
    resultadoDiv.textContent = "";
    resultadoDiv.classList.remove("error", "success"); // Limpa classes de cor
  }
  if (loadingDiv) loadingDiv.style.display = "none"; // Esconde loading

  if (modalRelatorio) {
    modalRelatorio.style.display = "flex"; // <-- Aqui está a linha que MOSTRA o modal
  }
}

function closeRelatorioModal() {
  if (modalRelatorio) {
    modalRelatorio.style.display = "none"; // <-- Aqui está a linha que ESCONDE o modal
  }
}

// Função chamada pelo botão "Gerar Relatório" do modal
function handleRelatorioGeneration() {
  const dataInicioInput = document.getElementById("dataInicio");
  const dataFimInput = document.getElementById("dataFim");
  const resultadoDiv = document.getElementById("resultadoRelatorio");
  const loadingDiv = document.getElementById("loadingRelatorio");
  const btnGerar = document.getElementById("btnGerarRelatorio");

  if (
    !dataInicioInput ||
    !dataFimInput ||
    !resultadoDiv ||
    !loadingDiv ||
    !btnGerar
  ) {
    console.error("Elementos do modal não encontrados!");
    showToast("Erro interno no modal.", true);
    return;
  }

  const dataInicio = dataInicioInput.value; // Formato AAAA-MM-DD
  const dataFim = dataFimInput.value; // Formato AAAA-MM-DD

  // 1. Validação Simples
  if (!dataInicio || !dataFim) {
    resultadoDiv.textContent =
      "Por favor, selecione a data de início e a data final.";
    resultadoDiv.className = "error"; // Adiciona uma classe para estilizar como erro
    resultadoDiv.style.display = "block";
    return;
  }

  if (dataFim < dataInicio) {
    resultadoDiv.textContent =
      "A data final não pode ser anterior à data de início.";
    resultadoDiv.className = "error";
    resultadoDiv.style.display = "block";
    return;
  }

  // Esconde resultado anterior, mostra loading, desabilita botão
  resultadoDiv.style.display = "none";
  loadingDiv.style.display = "block";
  btnGerar.disabled = true;
  btnGerar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...'; // Feedback visual

  // 2. Construir a URL para a página de relatório
  const urlRelatorio = `relatorio.html?inicio=${dataInicio}&fim=${dataFim}`;

  // 3. Simula um pequeno atraso (opcional, para ver o loading) e redireciona
  setTimeout(() => {
    window.location.href = urlRelatorio;

    // Não precisa reabilitar o botão aqui, pois a página vai mudar
    // btnGerar.disabled = false;
    // btnGerar.innerHTML = '<i class="fas fa-file-alt"></i> Gerar Relatório';
    // loadingDiv.style.display = 'none';
  }, 500); // Meio segundo de delay
}

// Adiciona a função global para o HTML poder chamá-la
window.handleRelatorioGeneration = handleRelatorioGeneration;

// Listeners dos botões de semana (Já estão corretos)
document.getElementById("prev-week-btn").addEventListener("click", () => {
  currentDisplayCenterDate.setDate(currentDisplayCenterDate.getDate() - 7);
  renderDayNavigation();
});

document.getElementById("next-week-btn").addEventListener("click", () => {
  currentDisplayCenterDate.setDate(currentDisplayCenterDate.getDate() + 7);
  renderDayNavigation();
});

// Inicia tudo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", initAppAndLoadData);
