// js/relatorio.js

// Constantes da API
const API_RELA_PERIODO_URL = "/api/relatorio/periodo";
const API_AUTH_ME = "/api/auth/me";

// Conversor de Markdown (Usado para o insight automático)
const converter = new showdown.Converter();

// --- Cores ---
const PRIMARY_COLOR = "#00ccbe";
const PRIMARY_DARK_COLOR = "#009c99";
const TEXT_MEDIUM_COLOR = "#555";

// --- Variáveis globais ---
let weightChartInstance = null;
let macroChartInstance = null;
let currentScope = "weekly";
let customStartDate = null;
let customEndDate = null;
let userId = null;
let REPORT_DATA = {}; // Armazena dados do GET /periodo
let USER_DATA_FOR_PLAN = {}; // Armazena dados do usuário (objetivo, etc) para o display do plano

// --- Funções Utilitárias ---
function showToast(message, isError = false) {
  /* ... mantida ... */
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl transition-opacity duration-300 z-50 ${
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
function getAuthHeaders(includeJson = true) {
  const token = localStorage.getItem("userToken");
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}
function getMacroFeedback(reals, targets) {
  let feedback = [];
  const macroLabels = ["Proteína", "Carboidrato", "Gordura"];
  reals.forEach((real, index) => {
    const target = targets ? targets[index] : 0;
    const label = macroLabels[index];
    const diff = (real || 0) - (target || 0);
    if (target > 0 && Math.abs(diff) > target * 0.15) {
      if (diff > 0)
        feedback.push(
          `O consumo de <strong>${label}</strong> foi alto (+${Math.round(
            diff
          )}g).`
        );
      else
        feedback.push(
          `O consumo de <strong>${label}</strong> ficou abaixo (-${Math.abs(
            Math.round(diff)
          )}g).`
        );
    }
  });
  const allTargetsZero = targets ? targets.every((t) => !t || t === 0) : true;
  if (allTargetsZero && feedback.length === 0)
    return "Metas de macronutrientes não definidas para o período.";
  return feedback.length > 0
    ? feedback.join("<br>")
    : "Adesão excelente aos macronutrientes.";
}
function getPlainTextWeightTrend(weights) {
  const trendHtml = calculateWeightTrend(weights);
  return trendHtml.replace(/<\/?strong>/g, "");
}
function getPlainTextMacroFeedback(reals, targets) {
  const feedbackHtml = getMacroFeedback(reals, targets);
  if (feedbackHtml === "Metas de macronutrientes não definidas para o período.")
    return feedbackHtml;
  return feedbackHtml
    .replace(/<\/?strong>/g, "")
    .replace(/<br\s*\/?>/gi, "\n- ");
}
function getFormattedDate(date) {
  if (!date) return "Data Inválida";
  try {
    const dateObj = new Date(date + "T00:00:00");
    if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
    return dateObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Belem",
    });
  } catch (e) {
    console.error("Erro ao formatar data:", e);
    return "Data Inválida";
  }
}

// --- Funções de Gráficos ---
function renderWeightChart(data) {
  const canvas = document.getElementById("weightChart");
  if (!canvas) return;
  if (weightChartInstance) weightChartInstance.destroy();
  const weights = data?.weights || [];
  const labels = data?.weightLabels || [];
  const trendText = calculateWeightTrend(weights);
  const trendElement = document.getElementById("weight-trend-text");
  if (trendElement) trendElement.innerHTML = "Tendência: " + trendText;
  const ctx = canvas.getContext("2d");
  weightChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Peso (kg)",
          data: weights,
          borderColor: PRIMARY_COLOR,
          backgroundColor: "rgba(0, 204, 190, 0.15)",
          tension: 0.4,
          pointBackgroundColor: PRIMARY_DARK_COLOR,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "Peso (kg)", color: TEXT_MEDIUM_COLOR },
          ticks: {
            callback: (value) =>
              typeof value === "number" ? value.toFixed(1) + " kg" : value,
            color: TEXT_MEDIUM_COLOR,
          },
          grid: { color: "rgba(0, 0, 0, 0.05)" },
        },
        x: { ticks: { color: TEXT_MEDIUM_COLOR }, grid: { display: false } },
      },
      plugins: { legend: { display: false }, title: { display: false } },
    },
  });
}
function renderMacroChart(data) {
  const canvas = document.getElementById("macroChart");
  if (!canvas) return;
  if (macroChartInstance) macroChartInstance.destroy();
  const ctx = canvas.getContext("2d");
  const macroLabels = ["Proteína", "Carboidrato", "Gordura"];
  const targets = [
    data?.prot_target ?? 0,
    data?.carb_target ?? 0,
    data?.fat_target ?? 0,
  ];
  const reals = [
    data?.prot_real ?? 0,
    data?.carb_real ?? 0,
    data?.fat_real ?? 0,
  ];
  const colors = ["#2980b9", "#f39c12", "#27ae60"];
  const feedbackText = getMacroFeedback(reals, targets);
  const feedbackElement = document.getElementById("macro-feedback-text");
  if (feedbackElement) feedbackElement.innerHTML = feedbackText;
  macroChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: macroLabels,
      datasets: [
        {
          label: "Meta (g)",
          data: targets,
          backgroundColor: colors.map((c) => c + "30"),
          borderColor: colors.map((c) => c + "AA"),
          borderWidth: 1,
          borderRadius: 5,
        },
        {
          label: "Real (g)",
          data: reals,
          backgroundColor: colors.map((c) => c + "A0"),
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: "Gramas (g)",
            color: TEXT_MEDIUM_COLOR,
          },
          ticks: { color: TEXT_MEDIUM_COLOR },
          grid: { color: "rgba(0, 0, 0, 0.05)" },
        },
        y: {
          stacked: false,
          ticks: { color: TEXT_MEDIUM_COLOR },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: "top", labels: { color: PRIMARY_DARK_COLOR } },
        title: { display: false },
      },
    },
  });
}
function calculateWeightTrend(weights) {
  if (!weights || weights.length < 2) return "Insuficiente para tendência";
  const validWeights = weights.filter(
    (w) => typeof w === "number" && !isNaN(w)
  );
  if (validWeights.length < 2) return "Insuficiente para tendência";
  const start = validWeights[0];
  const end = validWeights[validWeights.length - 1];
  const diff = start - end;
  const diffRounded = Math.abs(diff).toFixed(1);
  if (diff > 0.1) return `Perda de <strong>${diffRounded} kg</strong>`;
  if (diff < -0.1) return `Ganho de <strong>${diffRounded} kg</strong>`;
  return `Estável (Variação de <strong>${diffRounded} kg</strong>)`;
}

// --- Funções de UI (KPIs) ---
function updateKPIs(kpiData) {
  const metaEl = document.getElementById("kpi-meta");
  const realEl = document.getElementById("kpi-real");
  const desvioEl = document.getElementById("kpi-desvio");
  const desvioCardEl = document.getElementById("kpi-desvio-card");
  if (!metaEl || !realEl || !desvioEl || !desvioCardEl) return;
  const meta = kpiData?.meta || 0;
  const real = kpiData?.real || 0;
  let desvio = kpiData?.desvio;
  if (
    typeof desvio === "undefined" &&
    typeof meta === "number" &&
    typeof real === "number"
  )
    desvio = real - meta;
  else if (typeof desvio !== "number") desvio = 0;
  metaEl.textContent = `${meta} kcal`;
  realEl.textContent = `${real} kcal`;
  desvioEl.textContent = `${desvio >= 0 ? "+" : ""}${desvio} kcal`;
  desvioCardEl.classList.remove("success", "error", "warning", "neutral");
  if (meta === 0 && real === 0) {
    desvioCardEl.classList.add("neutral");
    desvioEl.textContent = "...";
  } else if (meta > 0 && desvio > meta * 0.1) {
    desvioCardEl.classList.add("error");
  } else if (meta > 0 && desvio < -(meta * 0.15)) {
    desvioCardEl.classList.add("warning");
  } else {
    desvioCardEl.classList.add("success");
  }
}

// --- Funções de Lógica ---

async function fetchReportData(scope, startDate = null, endDate = null) {
  const headers = getAuthHeaders();
  if (!headers) return null;
  let endpoint = API_RELA_PERIODO_URL;
  if (startDate && endDate) {
    endpoint = `${API_RELA_PERIODO_URL}?inicio=${startDate}&fim=${endDate}`;
    console.log("Chamando API de período:", endpoint);
  } else {
    console.log("Chamando API de período (padrão semanal):", endpoint);
  }
  try {
    const response = await fetch(endpoint, { method: "GET", headers: headers });
    if (response.status === 404) {
      showToast(
        "Nenhum dado de acompanhamento encontrado para o período selecionado.",
        true
      );
      return null;
    }
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(
        errData.erro || `Falha na requisição: ${response.status}`
      );
    }
    REPORT_DATA = await response.json();
    console.log("Dados recebidos do backend:", REPORT_DATA);

    // *** IMPORTANTE: Guarda dados básicos do usuário para usar no display do plano adaptativo ***
    // Tenta pegar do localStorage ou de uma variável global se já tivermos
    const storedUser = localStorage.getItem("tempUserData"); // Assume que salvamos em 'tempUserData' na geração inicial
    if (storedUser) {
      try {
        USER_DATA_FOR_PLAN = JSON.parse(storedUser);
      } catch (e) {
        console.warn(
          "Não foi possível carregar dados do usuário do localStorage"
        );
      }
    } else {
      console.warn(
        "Dados do usuário (objetivo, etc) não encontrados para exibir no plano adaptativo."
      );
      USER_DATA_FOR_PLAN = {
        objetivo: REPORT_DATA.objetivo || "Não especificado",
        numRefeicoes: 5,
      };
    }

    return REPORT_DATA;
  } catch (error) {
    showToast(`Erro ao carregar relatório: ${error.message}`, true);
    console.error("Erro ao carregar relatório:", error);
    return null;
  }
}

async function renderReport(scope, startDate = null, endDate = null) {
  document.getElementById("loading-weight")?.classList.remove("hidden");
  document.getElementById("loading-macros")?.classList.remove("hidden");
  document.getElementById("loading-insights")?.classList.remove("hidden");
  const btnMensal = document.getElementById("btn-mensal");
  const btnSemanal = document.getElementById("btn-semanal");
  const periodDisplay = document.getElementById("selected-period-display");
  if (startDate && endDate) {
    if (btnMensal) btnMensal.classList.remove("active");
    if (btnSemanal) btnSemanal.classList.remove("active");
    if (periodDisplay)
      periodDisplay.textContent = `Visualização: ${getFormattedDate(
        startDate
      )} - ${getFormattedDate(endDate)}`;
  } else {
    if (btnMensal) btnMensal.classList.toggle("active", scope === "monthly");
    if (btnSemanal) btnSemanal.classList.toggle("active", scope === "weekly");
    if (periodDisplay)
      periodDisplay.textContent = `Visualização: ${
        scope === "monthly" ? "Últimos 30 dias" : "Últimos 7 dias"
      }`;
  }
  const data = await fetchReportData(scope, startDate, endDate);
  const promptEl = document.getElementById("ai-prompt");
  const insightEl = document.getElementById("insight-text");
  if (!data) {
    if (insightEl)
      insightEl.innerHTML =
        "Não foi possível carregar dados para análise. Verifique se há registros salvos no período.";
    updateKPIs({});
    renderWeightChart(null);
    renderMacroChart(null);
    if (promptEl)
      promptEl.value =
        "Não há dados suficientes para gerar um plano adaptativo.";
  } else {
    updateKPIs(data.kpi);
    if (periodDisplay && data.period)
      periodDisplay.textContent = `Visualização: ${data.period}`;
    renderWeightChart(data);
    renderMacroChart(data.macros);

    // --- Renderiza Insight Automático ---
    if (insightEl) {
      const insightHtml = converter.makeHtml(
        data.insight || "Nenhuma observação gerada."
      );
      insightEl.innerHTML = insightHtml;
    }

    if (promptEl) {
      const kpi = data.kpi || { meta: 0, real: 0, desvio: 0 };
      const macros = data.macros;
      const weights = data.weights || [];
      const macroReals = [
        macros?.prot_real ?? 0,
        macros?.carb_real ?? 0,
        macros?.fat_real ?? 0,
      ];
      const macroTargets = [
        macros?.prot_target ?? 0,
        macros?.carb_target ?? 0,
        macros?.fat_target ?? 0,
      ];
      const plainMacroFeedback = getPlainTextMacroFeedback(
        macroReals,
        macroTargets
      );
      const plainWeightTrend = getPlainTextWeightTrend(weights);
      promptEl.value = `Análise de Desempenho:\n- Período: ${
        data.period || "N/A"
      }\n- Meta Calórica Média: ${kpi.meta} kcal\n- Consumo Real Médio: ${
        kpi.real
      } kcal\n- Desvio: ${kpi.desvio >= 0 ? "+" : ""}${
        kpi.desvio
      } kcal\n- Tendência de Peso: ${plainWeightTrend}\n- Feedback de Macros:\n- ${plainMacroFeedback}. \n\nCom base nesses dados, gere um plano adaptativo focado em [ajustar metas calóricas e macros].`;
    }
  }
  document.getElementById("loading-weight")?.classList.add("hidden");
  document.getElementById("loading-macros")?.classList.add("hidden");
  document.getElementById("loading-insights")?.classList.add("hidden");
}

// Funções de UI do Header
window.toggleProfileDropdownReport = function () {
  const dropdown = document.getElementById("user-info-dropdown");
  dropdown?.classList.toggle("active");
};
window.changeReportScope = function (scope) {
  if (scope === "monthly")
    console.warn(
      "Escopo 'monthly' selecionado, mas a rota backend pode não estar pronta."
    );
  currentScope = scope;
  customStartDate = null;
  customEndDate = null;
  renderReport(scope);
};

// --- *** FUNÇÃO PARA DISPLAY DO PLANO ADAPTATIVO *** ---

function displayAdaptivePlanDetails(planData, userData) {
  // Se planData for null ou não tiver planoDiario, mostra erro
  if (
    !planData ||
    !planData.planoDiario ||
    !Array.isArray(planData.planoDiario)
  ) {
    return '<p class="text-red-600 text-center p-5 bg-red-100 rounded-lg font-medium shadow-md">O plano adaptativo não pôde ser gerado corretamente pela IA.</p>';
  } // Usando userData global que buscamos no fetchReportData

  const user = userData ||
    USER_DATA_FOR_PLAN || { objetivo: "N/A", numRefeicoes: "N/A" };
  const plan = planData; // Renomeia para clareza

  let html = `
<h3 class="text-xl font-bold text-gray-800 mb-3 text-center">Plano Adaptativo Gerado:</h3> <!-- mb-3 -->

<div class="plan-summary p-4 bg-white rounded-lg shadow-md mb-4 border border-gray-100"> <!-- PADDING E MARGIN REDUZIDOS -->
<p class="text-center text-md mb-3 text-gray-700 font-medium"> <!-- TEXTO MENOR E mb-3 -->
Meta Principal Adaptada: 
<span class="font-bold text-blue-600 text-lg">
${plan.objetivo || user.objetivo || "Não Especificada"}
</span>
</p>

<div class="macro-grid grid grid-cols-4 gap-2"> <!-- GAP REDUZIDO -->
<div class="macro-card p-2 bg-gray-100 rounded text-center border border-gray-200"> <!-- PADDING REDUZIDO -->
<p class="macro-label text-xs m-0 text-gray-600 font-bold uppercase">KCAL</p>
<p class="macro-value text-xl mt-0.5 mb-0 font-bold text-gray-800">${
    plan.calorias || "N/A"
  }</p>
</div>
<div class="macro-card p-2 bg-blue-50 rounded text-center border border-blue-200">
<p class="macro-label text-xs m-0 text-blue-700 font-bold uppercase">PROT.</p>
<p class="macro-value text-xl mt-0.5 mb-0 font-bold text-blue-800">${
    plan.proteinas || "N/A"
  }g</p>
</div>
<div class="macro-card p-2 bg-amber-50 rounded text-center border border-amber-200">
<p class="macro-label text-xs m-0 text-amber-700 font-bold uppercase">CARBOS</p>
<p class="macro-value text-xl mt-0.5 mb-0 font-bold text-amber-800">${
    plan.carboidratos || "N/A"
  }g</p>
</div>
<div class="macro-card p-2 bg-green-50 rounded text-center border border-green-200">
<p class="macro-label text-xs m-0 text-green-700 font-bold uppercase">GORD.</p>
<p class="macro-value text-xl mt-0.5 mb-0 font-bold text-green-800">${
    plan.gorduras || "N/A"
  }g</p>
</div>
</div>
<p class="text-xs text-gray-500 text-center mt-3"> <!-- TEXTO MENOR E mt-3 -->
Distribuição: <strong class="text-gray-700">${
    plan.distribuicaoMacros || "N/A"
  }</strong> | 
Nº Refeições: <strong class="text-gray-700">${
    user.numRefeicoes || "N/A"
  }</strong>
</p>
</div>

<h4 class="text-md text-gray-800 font-semibold mb-3 text-center">Plano Diário Adaptado:</h4> <!-- TEXTO MENOR E mb-3 -->
<ul class="meal-list list-none p-0 space-y-3"> <!-- space-y-3 -->
`;

  plan.planoDiario.forEach((refeicao, index) => {
    html += `
<li class="meal-item border border-gray-100 p-3 rounded-md bg-white shadow-sm"> <!-- PADDING REDUZIDO -->
<div class="meal-header flex justify-between items-center border-b border-dashed border-teal-300 pb-1 mb-1"> <!-- BORDER E MARGIN REDUZIDOS -->
<span class="meal-name font-bold text-sm text-teal-700 leading-tight"> <!-- TEXTO MENOR -->
${index + 1}. ${refeicao.refeicao || "Refeição"}
</span>
<span class="meal-time text-xs text-gray-500 font-semibold flex-shrink-0 ml-2"> <!-- TEXTO MENOR -->
<i class="far fa-clock mr-1 text-teal-500"></i> ${
      refeicao.horarioSugerido || "HH:MM"
    }
</span>
</div>
<p class="meal-detail m-0 text-gray-700 whitespace-pre-line text-xs">${
      refeicao.detalhe || "Descrição indisponível."
    }</p>
</li>
`;
  });
  html += "</ul>";

  html += `
<div class="mt-4 p-3 rounded-md bg-teal-50 border border-teal-200 shadow-sm"> <!-- MARGIN E PADDING REDUZIDOS -->
<h4 class="text-sm font-bold text-teal-800 mb-1">
<i class="fas fa-lightbulb mr-1 text-teal-600"></i> Observações Adaptadas:
</h4>
<p class="plan-notes m-0 text-xs text-gray-700 whitespace-pre-line">${
    plan.observacoes || "Nenhuma observação fornecida."
  }</p>
</div>

<div class="disclaimer-box mt-3 p-2 border-l-4 border-amber-500 bg-amber-100 text-amber-800 rounded-md text-xs"> <!-- MARGIN E PADDING REDUZIDOS -->
<p class="m-0 font-medium">
<i class="fas fa-exclamation-triangle mr-1"></i><strong>Aviso:</strong> Este plano adaptado é uma sugestão de IA. Consulte sempre um nutricionista.
</p>
</div>
`;

  return html;
}

// *** FUNÇÃO generateAdaptivePlan ***
async function generateAdaptivePlan() {
  const prompt = document.getElementById("ai-prompt")?.value; // Este é o prompt com a ANÁLISE
  const btn = document.getElementById("btn-adaptar");
  const loadingDiv = document.getElementById("loading-ai");
  const responseContainer = document.getElementById("ai-response-container");
  const responseTextElement = document.getElementById("ai-response-text");

  if (
    !prompt ||
    !btn ||
    !loadingDiv ||
    !responseContainer ||
    !responseTextElement
  ) {
    console.error("Elementos da IA não encontrados no DOM.");
    showToast("Erro: Elementos da página não encontrados.", true);
    return;
  }
  if (prompt.includes("Não há dados suficientes")) {
    showToast("Não há dados suficientes para gerar um plano adaptativo.", true);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Gerando Plano Adaptado..."; // Texto do botão atualizado
  loadingDiv?.classList.remove("hidden");
  responseContainer?.classList.add("hidden");
  responseTextElement.innerHTML = "";

  try {
    const headers = getAuthHeaders();
    if (!headers) {
      // Se não tem header, não está logado, para a função
      showToast("Erro de autenticação. Faça login novamente.", true);
      btn.disabled = false; // Reabilita botão
      btn.textContent = "Gerar Novo Plano Adaptativo";
      loadingDiv?.classList.add("hidden");
      return;
    }

    const response = await fetch(`/api/relatorio/adaptativo`, {
      method: "POST",
      headers: headers,
      // Envia o prompt (que contém a análise) para o backend
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.erro || `Falha HTTP: ${response.status}`);
    }

    // AGORA esperamos um objeto JSON completo do plano
    const planDataResult = await response.json();

    // Chama a função displayAdaptivePlanDetails para gerar o HTML
    // Passa o JSON do plano (planDataResult) e os dados do usuário (USER_DATA_FOR_PLAN)
    const htmlPlanoAdaptado = displayAdaptivePlanDetails(
      planDataResult,
      USER_DATA_FOR_PLAN
    );

    // Insere o HTML gerado no container
    responseTextElement.innerHTML = htmlPlanoAdaptado;
    responseContainer?.classList.remove("hidden");
  } catch (error) {
    // Exibe o erro de forma mais clara
    responseTextElement.innerHTML = `<p class="text-red-600 font-semibold p-4 bg-red-100 rounded-md">Falha ao gerar plano adaptativo: ${error.message}</p>`;
    responseContainer?.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Gerar Novo Plano Adaptativo";
    loadingDiv?.classList.add("hidden");
  }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  customStartDate = urlParams.get("inicio");
  customEndDate = urlParams.get("fim");
  const token = localStorage.getItem("userToken");
  let isAuthenticated = false;
  if (token) {
    try {
      const response = await fetch(API_AUTH_ME, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const user = await response.json();
        userId = user.id;
        isAuthenticated = true;
        console.log("Autenticação verificada com sucesso via /api/auth/me.");
        const userIdDisplay = document.getElementById("user-id-display");
        if (userIdDisplay) userIdDisplay.textContent = `UserID: ${userId}`;
        // Guarda dados do usuário para o plano
        // Tenta pegar do localStorage primeiro (pode ter sido salvo na geração inicial)
        const storedUser = localStorage.getItem("tempUserData");
        if (storedUser) {
          try {
            USER_DATA_FOR_PLAN = JSON.parse(storedUser);
          } catch (e) {}
        }

        if (!USER_DATA_FOR_PLAN.objetivo) {
          USER_DATA_FOR_PLAN = {
            ...USER_DATA_FOR_PLAN,
            objetivo: user.objetivo || "Não definido",
            numRefeicoes: user.numRefeicoes || 5,
          };
        }
      } else {
        console.warn("Token inválido ou expirado.");
        localStorage.removeItem("userToken");
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
    }
  } else {
    console.log("Nenhum token encontrado.");
  }

  if (isAuthenticated) {
    if (customStartDate && customEndDate) {
      renderReport("custom", customStartDate, customEndDate);
    } else {
      renderReport(currentScope);
    }
  } else {
    const insightEl = document.getElementById("insight-text");
    if (insightEl)
      insightEl.innerHTML =
        "Por favor, faça <a href='login.html' style='color: var(--color-primary); text-decoration: underline;'>login</a> para visualizar o relatório.";
    updateKPIs({});
    renderWeightChart(null);
    renderMacroChart(null);
    const promptEl = document.getElementById("ai-prompt");
    if (promptEl) promptEl.value = "Faça login para gerar um plano.";
    document.getElementById("loading-weight")?.classList.add("hidden");
    document.getElementById("loading-macros")?.classList.add("hidden");
    document.getElementById("loading-insights")?.classList.add("hidden");
  }
  const btnAdaptar = document.getElementById("btn-adaptar");
  if (btnAdaptar) btnAdaptar.addEventListener("click", generateAdaptivePlan);
  else console.error("Botão 'btn-adaptar' não encontrado.");
});
