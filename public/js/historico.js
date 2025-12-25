// js/historico.js

// CONFIGURAÇÃO
const API_BASE_URL = "/api/planos";
const REDIRECT_PAGE = "visualizar_plano.html";

let planosContainer;
let statusMessage;

// FUNÇÕES DE FEEDBACK (Reutilizadas)

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

// FUNÇÕES DE AÇÃO (Globais - para o onclick)

async function selecionarAtivo(planoId, buttonElement) {
  const token = localStorage.getItem("userToken");
  if (!token) return showToast("❌ Faça login novamente.", true);

  const originalText = buttonElement.innerHTML;
  buttonElement.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Ativando...';
  buttonElement.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/selecionar/${planoId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.erro || "Falha ao ativar o plano.");
    }

    showToast(`✅ Plano ${planoId} agora é o seu plano ATIVO!`, false);
    fetchPlanos(); // Recarrega a lista para mostrar o novo status
  } catch (error) {
    showToast(`❌ Erro: ${error.message}`, true);
    buttonElement.innerHTML = originalText;
    buttonElement.disabled = false;
  }
}

async function excluirPlano(planoId) {
  if (
    !confirm(
      `Tem certeza que deseja excluir o plano ${planoId}? Esta ação não pode ser desfeita.`
    )
  ) {
    return; // Usuário cancelou
  }

  const token = localStorage.getItem("userToken");
  if (!token) return showToast("❌ Faça login novamente.", true);

  try {
    // Chama a rota DELETE que criamos no planRoutes.js
    const response = await fetch(`${API_BASE_URL}/${planoId}`, {
      // Rota: DELETE /api/planos/PL-XXX
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.erro || "Falha ao excluir o plano.");
    }

    // Sucesso!
    showToast(`✅ Plano ${planoId} foi excluído com sucesso.`, false);

    // Recarrega a lista para remover o card da tela
    fetchPlanos();
  } catch (error) {
    console.error("❌ Erro ao excluir plano:", error);
    showToast(`❌ Erro: ${error.message}`, true);
  }
}

function visualizarPlano(planoId) {
  if (!planoId) {
    showToast("Erro: ID do plano inválido.", true);
    return;
  }
  window.location.href = `${REDIRECT_PAGE}?id=${planoId}`;
}

// FUNÇÕES DE CRIAÇÃO E RENDERIZAÇÃO

function createPlanCardHTML(plan, activePlanId) {
  const isActive = plan.id === activePlanId;
  const idNumerico = plan.id.replace("PL-", "");

  const cardClasses = isActive
    ? "bg-teal-50 border-teal-500"
    : "bg-white border-gray-200 hover:shadow-lg hover:border-gray-400";

  const activeText = isActive
    ? '<span class="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full"><i class="fas fa-check-circle mr-1"></i> ATIVO</span>'
    : "";

  return `
        <li class="plan-card-item p-5 mb-4 rounded-lg shadow-md border ${cardClasses} transition-all duration-300">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-xl font-bold text-[var(--color-secondary)]">${
                      plan.resumo || `Plano #${idNumerico}`
                    }</h4>
                    <p class="text-sm text-gray-500 mt-1">Criado em: ${
                      plan.dataCriacao || "N/A"
                    }</p>
                </div>
                <div>
                    ${activeText}
                </div>
            </div>
            
            <div class="meta-data text-sm grid grid-cols-2 md:grid-cols-4 gap-2 my-4 p-3 bg-gray-50 rounded-md border">
                <p><strong><i class="fas fa-bullseye text-gray-500"></i> Objetivo:</strong> ${
                  plan.objetivo || "N/A"
                }</p> 
                <p><strong><i class="fas fa-fire-alt text-red-500"></i> Calorias:</strong> ${
                  plan.metaCalorica || "N/A"
                } Kcal</p>
                <p><strong><i class="fas fa-drumstick-bite text-blue-500"></i> Proteína:</strong> ${
                  plan.proteinas || "N/A"
                }g</p>
                <p><strong><i class="fas fa-bread-slice text-yellow-500"></i> Carboidratos:</strong> ${
                  plan.carboidratos || "N/A"
                }g</p>
                <p><strong><i class="fas fa-cheese text-yellow-600 mr-1"></i> Gorduras:</strong> ${
                  plan.gorduras || "N/A"
                }g</p>
                
            </div>

            <div class="plan-actions flex justify-end space-x-3 mt-4 pt-3 border-t border-gray-200">
                
                ${
                  isActive
                    ? `<button class="px-3 py-1.5 bg-gray-400 text-white rounded-full text-sm cursor-default" disabled>
                            <i class="fas fa-lock mr-1"></i> Já é Ativo
                          </button>`
                    : `<button onclick="selecionarAtivo('${plan.id}', this)" class="px-3 py-1.5 bg-[var(--color-secondary)] text-white rounded-full text-sm transition-all duration-200 hover:bg-[var(--color-primary)] hover:shadow-md">
                            <i class="fas fa-star mr-1"></i> Ativar
                          </button>`
                }
                <button onclick="visualizarPlano('${plan.id}')"
                    class="px-3 py-1.5 bg-blue-500 text-white rounded-full text-sm no-underline transition-all duration-200 hover:bg-blue-600 hover:shadow-md">
                    <i class="fas fa-eye mr-1"></i> Visualizar
                </button>
                <button onclick="excluirPlano('${
                  plan.id
                }')" class="px-3 py-1.5 bg-red-500 text-white rounded-full text-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md">
                    <i class="fas fa-trash mr-1"></i> Excluir
                </button>
            </div>
        </li>
    `;
}

/**
 * A FUNÇÃO PRINCIPAL: Busca e renderiza os planos.
 */
async function fetchPlanos() {
  planosContainer = document.getElementById("planos-container");
  statusMessage = document.getElementById("status-message");

  const token = localStorage.getItem("userToken");
  if (!token) {
    planosContainer.innerHTML =
      '<p class="text-red-500 font-bold mt-4">Erro: Você não está logado. Faça login para ver seu histórico.</p>';
    statusMessage.style.display = "none";
    return;
  }
  const authHeader = { Authorization: `Bearer ${token}` };

  if (statusMessage) {
    statusMessage.style.display = "block";
    statusMessage.textContent = "Carregando seus planos...";
  }
  planosContainer.innerHTML = "";

  try {
    // 1. Busca o plano ATIVO primeiro (para saber qual destacar)
    let activePlanId = null;
    try {
      const activePlanResponse = await fetch(API_BASE_URL, {
        method: "GET",
        headers: authHeader,
      });
      if (activePlanResponse.ok) {
        const activePlan = await activePlanResponse.json();
        if (activePlan && activePlan.id) {
          activePlanId = activePlan.id;
        }
      }
    } catch (e) {
      console.warn(
        "Não foi possível buscar o plano ativo. A lista pode não destacar o plano ativo.",
        e
      );
    } 
    
    // 2. Busca o HISTÓRICO de todos os planos

    const response = await fetch(`${API_BASE_URL}/historico`, {
      method: "GET",
      headers: authHeader,
    });

    if (response.status === 401) {
      localStorage.removeItem("userToken");
      window.location.href = "login.html";
      return;
    }
    if (!response.ok) {
      throw new Error(
        `Falha na requisição do histórico: ${response.status}. Verifique se a rota existe em planRoutes.js.`
      );
    }

    const planos = await response.json();

    if (planos.length === 0) {
      planosContainer.innerHTML =
        '<p class="text-gray-500 text-center mt-4">Nenhum plano salvo encontrado. Crie um novo plano!</p>';
      statusMessage.style.display = "none";
      return;
    }

    planosContainer.innerHTML = "";

    planos.forEach((plan) => {
      planosContainer.innerHTML += createPlanCardHTML(plan, activePlanId);
    });

    statusMessage.textContent = `Exibindo ${planos.length} planos salvos.`;
  } catch (error) {
    console.error("ERRO CRÍTICO: Falha na conexão com a API.", error);
    if (planosContainer) {
      planosContainer.innerHTML = `
                <p class="text-red-500 font-bold text-center mt-4 p-5 bg-red-100 rounded-lg">
                    ❌ <strong>Erro de Conexão:</strong> Não foi possível carregar os planos. 
                    <br>Verifique se o backend está rodando. (Erro: ${error.message})
                </p>`;
    }
  }
}

// INÍCIO DA EXECUÇÃO

document.addEventListener("DOMContentLoaded", () => {
  // Só inicia a busca de planos se estiver na página de histórico
  if (document.getElementById("planos-container")) {
    fetchPlanos();
  }
});
