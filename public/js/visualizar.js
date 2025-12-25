// js/visualizar.js

// ------------------------------------------------------------------
// VARIÁVEIS DE ESTADO GLOBAIS
// ------------------------------------------------------------------
let planoData = null; // Armazenará os dados completos do plano (parseados)
const API_URL_BASE = "/api/planos";

// ------------------------------------------------------------------
// FUNÇÕES DE AÇÃO (DOWNLOAD PDF)
// ------------------------------------------------------------------

/**
 * FUNÇÃO ATUALIZADA - CORRIGE O "NÃO ENCAIXANDO"
 */
const downloadPlanPDF = () => {
  // 1. Pega o elemento principal para imprimir
  const element = document.getElementById("planoDetalhes");
  // 2. Pega o container de botões para escondê-lo
  const actions = document.querySelector(".plan-actions");

  // --- INÍCIO DA CORREÇÃO PARA "NÃO ENCAIXANDO" ---

  // 3. Salva os estilos originais do card para restaurar depois
  const originalStyles = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    margin: element.style.margin,
    padding: element.style.padding,
    boxShadow: element.style.boxShadow,
    border: element.style.border,
  };

  // Esconde os botões ANTES de forçar os estilos
  if (actions) actions.style.display = "none";

  // 4. Força os estilos para caber no PDF (A4 = 210mm, margem = 10mm -> 190mm)
  // Usar '185mm' dá uma pequena folga de segurança
  element.style.width = "185mm";
  element.style.maxWidth = "185mm";
  element.style.margin = "0"; // Remove margens do card
  element.style.padding = "0"; // Remove paddings do card (a margem do PDF cuida disso)
  element.style.boxShadow = "none"; // Remove sombras
  element.style.border = "none"; // Remove bordas

  // --- FIM DA CORREÇÃO ---

  let nomeArquivo = "Plano_de_Dieta_Personalizado.pdf";

  // Tenta pegar o objetivo do usuário (que já foi parseado e salvo em planoData)
  if (
    planoData &&
    planoData.dados_usuario_json &&
    planoData.dados_usuario_json.objetivo
  ) {
    const tituloPlano = planoData.dados_usuario_json.objetivo
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    nomeArquivo = `Plano_${tituloPlano}.pdf`;
  }

  const opt = {
    margin: 10, // Margem de 10mm do PDF
    filename: nomeArquivo,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2, // Aumenta a escala para melhor qualidade
      logging: false,
      dpi: 192,
      letterRendering: true,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    },
  };

  // 5. Chama a biblioteca html2pdf
  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .finally(() => {
      // 6. Restaura TUDO ao original
      if (actions) {
        actions.style.display = "";
      }
      // Restaura os estilos que foram forçados
      element.style.width = originalStyles.width;
      element.style.maxWidth = originalStyles.maxWidth;
      element.style.margin = originalStyles.margin;
      element.style.padding = originalStyles.padding;
      element.style.boxShadow = originalStyles.boxShadow;
      element.style.border = originalStyles.border;
    });
};

// ------------------------------------------------------------------
// FUNÇÕES DE RENDERIZAÇÃO E BUSCA
// ------------------------------------------------------------------

/**
 * Função para renderizar os dados na tela.
 */
function renderPlano(data) {
  try {
    // 1. Parseia os JSONs que vêm do banco
    const plano = JSON.parse(data.plano_json);
    const usuario = JSON.parse(data.dados_usuario_json);

    // 1.5 Salva os dados parseados na variável global
    // para que a função de PDF possa usá-los (para o nome do arquivo)
    planoData = {
      ...data,
      plano_json: plano,
      dados_usuario_json: usuario,
    }; // 2. Preenche os títulos e o cabeçalho

    const planoNome = plano.nome || `Plano de ${usuario.objetivo || "Dieta"}`;
    document.getElementById("pageTitle").textContent = planoNome;
    document.getElementById(
      "planoHeaderTitle"
    ).textContent = `Plano: ${planoNome}`; // 3. Preenche as Metas

    document.getElementById("metaCalorica").textContent = `${
      data.metaCalorica || "N/A"
    } Kcal`;
    document.getElementById("dataCriacao").textContent = new Date(
      data.dataCriacao
    ).toLocaleDateString("pt-BR");
    document.getElementById("distribuicaoMacros").textContent =
      plano.distribuicaoMacros || "N/A"; // 4. Preenche os Dados do Usuário

    document.getElementById("userObjetivo").textContent =
      usuario.objetivo || "N/A";
    document.getElementById("userInfo").textContent = `${
      usuario.idade || "?"
    } anos, ${usuario.peso || "?"} kg, ${usuario.altura || "?"} cm`; // 5. Preenche as Observações
    document.getElementById("observacoesTexto").textContent =
      plano.observacoes || "Nenhuma observação fornecida."; // 6. Constrói a lista de Refeições

    const refeicoesContainer = document.getElementById("refeicoesContainer");
    refeicoesContainer.innerHTML = "<h3>Plano Diário de Refeições</h3>";

    const refeicoes = plano.planoDiario || plano.plano_de_dieta?.refeicoes; // Compatibilidade

    if (Array.isArray(refeicoes) && refeicoes.length > 0) {
      const listaRefeicoes = document.createElement("ul");
      listaRefeicoes.className = "refeicoes-lista";
      refeicoes.forEach((refeicao, index) => {
        const item = document.createElement("li");
        item.className = "refeicao-item";
        item.innerHTML = `
                        <div class="refeicao-header">
                            <strong>${index + 1}. ${
          refeicao.refeicao || "Refeição"
        }</strong>
                            <span><i class="fas fa-clock"></i> ${
                              refeicao.horarioSugerido || "HH:MM"
                            }</span>
                        </div>
                        <p class="meal-detail">${(
                          refeicao.detalhe || "Sem detalhes."
                        ).replace(/\n/g, "<br>")}</p>
                    `;
        listaRefeicoes.appendChild(item);
      });
      refeicoesContainer.appendChild(listaRefeicoes);
    } else {
      refeicoesContainer.innerHTML +=
        "<p>Nenhuma refeição detalhada encontrada no plano.</p>";
    } // 7. Mostra o card principal

    document.getElementById("planoDetalhes").classList.remove("hidden");
  } catch (e) {
    console.error("Erro ao parsear o JSON do plano:", e);
    document.getElementById("loadingError").textContent =
      "Erro ao ler os dados do plano. O formato JSON pode estar corrompido.";
    document.getElementById("loadingError").classList.remove("hidden");
  }
}

/**
 * Função Principal: Busca os dados do plano no backend
 */
async function fetchPlanoDetalhes(planoId, token) {
  const loadingError = document.getElementById("loadingError");
  try {
    const response = await fetch(`${API_URL_BASE}/${planoId}`, {
      // Rota: GET /api/planos/PL-XXX
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("userToken");
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(
        errData.erro || `Falha na requisição: ${response.status}`
      );
    }

    const data = await response.json();
    if (data && data.plano_json) {
      renderPlano(data);
    } else {
      throw new Error("Resposta da API incompleta. Faltando 'plano_json'.");
    }
  } catch (error) {
    console.error("Erro ao buscar detalhes do plano:", error);
    loadingError.textContent = `Erro ao carregar o plano: ${error.message}`;
    loadingError.classList.remove("hidden");
  }
}

// ------------------------------------------
// INÍCIO DA EXECUÇÃO
// ------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // 1. Pega o ID da URL
  const urlParams = new URLSearchParams(window.location.search);
  const planoId = urlParams.get("id"); // Pega o ?id=PL-XXX // 2. Pega o Token

  const token = localStorage.getItem("userToken");

  const loadingError = document.getElementById("loadingError"); // Validação do Token

  if (!token) {
    const redirectUrl = `visualizar_plano.html?id=${planoId}`;
    window.location.href = `login.html?redirect=${encodeURIComponent(
      redirectUrl
    )}`;
    return;
  } // Validação do ID

  if (!planoId || !planoId.startsWith("PL-")) {
    if (loadingError) {
      loadingError.textContent =
        "Erro Crítico: ID do plano inválido ou ausente na URL (esperado ?id=PL-XXX).";
      loadingError.classList.remove("hidden");
    }
    return;
  } // 🚨 MUDANÇA AQUI: Remove o 'editPlanBtn' e adiciona o 'downloadPdfBtn'

  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", downloadPlanPDF);
  } else {
    console.warn("Botão 'downloadPdfBtn' não encontrado no HTML.");
  } // 3. Busca os dados

  fetchPlanoDetalhes(planoId, token);
});
