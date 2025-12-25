
// plano.js (Fluxo Síncrono)

// FUNÇÕES DE FEEDBACK VISUAL (Global)
function showError(input) {
  input.classList.add("input-error");
  const parent = input.closest(".form-row") || input.parentNode;
  const errorDiv = parent.querySelector(".error-message-block");
  if (errorDiv) {
    errorDiv.remove();
  }
  const newErrorDiv = document.createElement("div");
  newErrorDiv.classList.add(
    "error-message-block",
    "text-red-500",
    "text-xs",
    "mt-1",
    "font-medium"
  );
  newErrorDiv.textContent = "Este campo é obrigatório.";
  parent.appendChild(newErrorDiv);
}

function clearError(input) {
  input.classList.remove("input-error");
  const parent = input.closest(".form-row") || input.parentNode;
  const errorDiv = parent.querySelector(".error-message-block");
  if (errorDiv) {
    errorDiv.remove();
  }
}

// FUNÇÃO DE FEEDBACK (TOAST SIMPLES)
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

/**
 * FUNÇÃO: Lógica para Selecionar o Plano Ativo via Backend
 */
async function selectPlanAsActive(planoId, buttonElement) {
  const token = localStorage.getItem("userToken");
  if (!token) {
    showToast("❌ Erro: Usuário não autenticado.", true);
    return;
  }
  const authHeader = { Authorization: `Bearer ${token}` };

  const originalText = buttonElement.innerHTML;
  buttonElement.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Selecionando...';
  buttonElement.disabled = true;

  try {
    const API_URL = `/api/planos/selecionar/${planoId}`;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || "Erro ao selecionar plano como ativo no servidor."
      );
    }

    showToast(`Plano ${planoId} agora é o seu plano ativo!`, false);
    buttonElement.innerHTML = '<i class="fas fa-check"></i> Plano Ativo!';
    buttonElement.classList.remove(
      "btn-success",
      "bg-green-600",
      "hover:bg-green-700"
    );
    buttonElement.classList.add("bg-gray-500", "cursor-default");
    buttonElement.disabled = true;
  } catch (error) {
    console.error("❌ Erro ao selecionar plano:", error);
    showToast(`❌ Falha ao selecionar plano. ${error.message}`, true);
    buttonElement.innerHTML = originalText;
    buttonElement.disabled = false;
    buttonElement.classList.remove("bg-gray-500", "cursor-default");
    buttonElement.classList.add(
      "btn-success",
      "bg-green-600",
      "hover:bg-green-700"
    );
  }
}

/**
 * FUNÇÃO: Lógica para Gerar o PDF
 */
function setupPdfGeneration() {
  const pdfButton = document.getElementById("generate-pdf-top-btn");
  if (pdfButton) {
    pdfButton.addEventListener("click", () => {
      if (typeof html2pdf === "undefined") {
        showToast("❌ Erro: A biblioteca html2pdf.js não foi carregada.", true);
        return;
      }
      const element = document.querySelector('.form-step[data-step="6"]');

      const buttonsToHide = element.querySelectorAll(
        ".plan-actions-top, #form-navigation button"
      );
      buttonsToHide.forEach((btn) => (btn.style.display = "none"));

      const opt = {
        margin: 10,
        filename: "Plano_Dieta_Personalizado.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          logging: false,
          dpi: 160,
          letterRendering: true,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .finally(() => {
          buttonsToHide.forEach((btn) => (btn.style.display = ""));
        });
    });
  }
}

// GERA O HTML DO PLANO DE DIETA
function generatePlanHtml(planData, userData) {
  // VERIFICAÇÃO DE SEGURANÇA CONTRA NULL
  if (
    !planData ||
    !planData.planoDiario ||
    !Array.isArray(planData.planoDiario)
  ) {
    return '<p class="text-red-600 text-center p-5 bg-red-100 rounded-lg font-medium shadow-md">O plano gerado está incompleto ou vazio. A API da IA não retornou o formato JSON esperado.</p>';
  }

  // Alias para legibilidade
  const plan = planData;
  const user = userData;

  let html = `
        <div class="plan-actions-top flex justify-end mb-5 print:hidden">
            <button id="generate-pdf-top-btn" 
                    class="px-4 py-2 bg-white text-blue-600 border border-blue-400 rounded-xl 
                          hover:bg-blue-50 transition duration-150 shadow-lg font-semibold text-sm" 
                    type="button">
                <i class="fas fa-file-pdf mr-2"></i> Gerar PDF
            </button>
        </div>
        
        <div class="plan-summary p-4 bg-white rounded-2xl shadow-2xl">
            <h3 class="text-3xl font-extrabold text-blue-700 mb-2 border-b-4 border-blue-100 pb-3">
                Seu Plano de Dieta Personalizado
            </h3>
            
            <p class="text-center text-xl mb-10 text-gray-700 font-medium">
                Sua Meta Principal: 
                <span class="font-extrabold text-white bg-blue-600 px-4 py-1.5 rounded-full shadow-xl inline-block mt-2 tracking-wide uppercase text-base">
                    ${user.objetivo || "Não Especificada"}
                </span>
            </p>

            <div class="macro-grid 
                        grid grid-cols-2 md:grid-cols-4 
                        gap-5 my-8 p-3 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">

                <div class="macro-card p-5 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl text-center border border-gray-300 shadow-lg transition transform hover:scale-[1.03]">
                    <p class="macro-label text-xs m-0 text-gray-600 font-bold uppercase tracking-wider">CALORIAS DIÁRIAS</p>
                    <p class="macro-value text-4xl mt-1 mb-0 font-extrabold text-gray-900">${
                      plan.calorias || plan.metaCaloricaTotal || "N/A"
                    }</p>
                </div>

                <div class="macro-card p-5 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl text-center border border-blue-300 shadow-lg transition transform hover:scale-[1.03]">
                    <p class="macro-label text-xs m-0 text-blue-700 font-bold uppercase tracking-wider">PROTEÍNA</p>
                    <p class="macro-value text-4xl mt-1 mb-0 font-extrabold text-blue-800">${
                      plan.proteinas || plan.proteinaTotal || "N/A"
                    }</p>
                </div>

                <div class="macro-card p-5 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl text-center border border-amber-300 shadow-lg transition transform hover:scale-[1.03]">
                    <p class="macro-label text-xs m-0 text-amber-700 font-bold uppercase tracking-wider">CARBOIDRATOS</p>
                    <p class="macro-value text-4xl mt-1 mb-0 font-extrabold text-amber-800">${
                      plan.carboidratos || plan.carboidratosTotal || "N/A"
                    }</p>
                </div>

                <div class="macro-card p-5 bg-gradient-to-br from-green-100 to-green-200 rounded-xl text-center border border-green-300 shadow-lg transition transform hover:scale-[1.03]">
                    <p class="macro-label text-xs m-0 text-green-700 font-bold uppercase tracking-wider">GORDURA</p>
                    <p class="macro-value text-4xl mt-1 mb-0 font-extrabold text-green-800">${
                      plan.gorduras || plan.gorduraTotal || "N/A"
                    }</p>
                </div>
            </div>
            <p class="text-md text-gray-500 text-center mt-3 font-semibold border-t pt-4 border-gray-100">
                <i class="fas fa-chart-pie text-blue-500 mr-1"></i> Distribuição Macro: <strong class="text-gray-700">${
                  plan.distribuicaoMacros || "N/A"
                }</strong> | 
                <i class="fas fa-utensils text-green-500 ml-4 mr-1"></i> Nº de Refeições: <strong class="text-gray-700">${
                  user.numRefeicoes || "N/A"
                }</strong>
            </p>
        </div>

        <div class="disclaimer-box mt-8 p-5 border-l-4 border-amber-500 bg-amber-100 text-amber-800 rounded-lg shadow-md">
            <p class="m-0 text-sm font-medium">
                <i class="fas fa-exclamation-triangle mr-2"></i><strong>Aviso:</strong> Este plano é uma sugestão de IA. 
                <br class="hidden md:inline">
                <strong>Consulte sempre um nutricionista.</strong>
            </p>
        </div>
        <hr class="my-10 border-gray-200"/>
        
        <h4 class="text-2xl text-gray-800 font-bold mb-6 text-center">Seu Plano Diário de Refeições:</h4>
    `; // Detalhes das Refeições

  // Itera sobre o planoDiario
  if (planData.planoDiario && Array.isArray(planData.planoDiario)) {
    html += '<ul class="meal-list list-none p-0 space-y-6">';
    planData.planoDiario.forEach((refeicao, index) => {
      html += `
                <li class="meal-item border border-gray-100 p-5 rounded-lg bg-white shadow-md transition duration-300 hover:shadow-lg hover:-translate-y-0.5">
                    <div class="meal-header flex justify-between items-start md:items-center border-b border-dashed border-teal-300 pb-2 mb-3">
                        <span class="meal-name font-extrabold text-xl text-teal-700 leading-tight">
                            ${index + 1}. ${refeicao.refeicao || "Refeição"}
                        </span>
                        <span class="meal-time text-base text-gray-500 flex-shrink-0 ml-4 font-semibold">
                            <i class="far fa-clock mr-1 text-teal-500"></i> ${
                              refeicao.horarioSugerido || "HH:MM"
                            }
                        </span>
                    </div>
                    <p class="meal-detail m-0 text-gray-700 whitespace-pre-line leading-relaxed text-base">${
                      refeicao.detalhe || "Descrição indisponível."
                    }</p>
                </li>
            `;
    });
    html += "</ul>";
  } else {
    html +=
      '<p class="text-red-600 text-center p-5 bg-red-100 rounded-lg font-medium shadow-md">O plano não pôde ser gerado corretamente. A IA não retornou o formato JSON esperado.</p>';
  }
  html += `
        <div class="mt-10 p-5 rounded-lg bg-teal-50 border-2 border-teal-200 shadow-lg">
            <h4 class="text-xl font-bold text-teal-800 mb-3 flex items-center">
                <i class="fas fa-lightbulb mr-2 text-teal-600"></i> Observações e Recomendações:
            </h4>
            <p class="plan-notes m-0 leading-relaxed text-gray-700 whitespace-pre-line">${
              plan.observacoes || "Nenhuma observação fornecida."
            }</p>
        </div>
    `;

  return html;
}

/**
 * Adiciona botões de ação final à interface (para a Etapa 6 - Resultado Final).
 */
const addResultActions = (form, navContainer, planData, userData, planoId) => {
  // 1. Limpa o contêiner de navegação
  navContainer.innerHTML = ""; // Estilo de contêiner para os botões

  navContainer.style.cssText =
    "display: flex; justify-content: space-around; gap: 20px; width: 100%; max-width: 550px; margin: 0 auto; padding-top: 20px;"; // 2. Cria os botões de ação final

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.classList.add(
    "btn-secondary",
    "bg-gray-600",
    "hover:bg-gray-700",
    "text-white"
  );
  backButton.innerHTML = '<i class="fas fa-redo"></i> Novo Plano';
  backButton.style.cssText =
    "padding: 10px 15px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background-color 0.3s, transform 0.2s; flex-grow: 1;";
  backButton.onmouseover = () => (backButton.style.backgroundColor = "#5a6268");
  backButton.onmouseout = () => (backButton.style.backgroundColor = "#6c757d");

  backButton.addEventListener("click", () => {
    form.reset();
    updateFormVisibility(1);
    document.getElementById("diet-plan-output").innerHTML =
      '<p style="text-align: center; color: #555">Clique em "Gerar Plano de Dieta" para receber sua sugestão personalizada.</p>';
  });

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.id = "select-plan-btn";
  selectButton.classList.add(
    "btn-success",
    "bg-green-600",
    "hover:bg-green-700",
    "text-white"
  );
  selectButton.innerHTML = planoId
    ? '<i class="fas fa-check-circle"></i> Selecionar como Ativo'
    : '<i class="fas fa-save"></i> Salvar e Selecionar';
  selectButton.style.cssText =
    "padding: 10px 15px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background-color 0.3s, transform 0.2s; flex-grow: 1;";
  selectButton.onmouseover = () =>
    (selectButton.style.backgroundColor = "#218838");
  selectButton.onmouseout = () =>
    (selectButton.style.backgroundColor = "#28a745");

  selectButton.addEventListener("click", async () => {
    // Agora chama a função de selecionar como ativo
    await selectPlanAsActive(planoId, selectButton);
  }); // 3. Adiciona os botões ao contêiner de navegação
  navContainer.appendChild(backButton);
  navContainer.appendChild(selectButton);
};

// INÍCIO DA LÓGICA PRINCIPAL DO FORMULÁRIO

document.addEventListener("DOMContentLoaded", () => {
  const dietPlanOutputFinal = document.getElementById("diet-plan-output-final");
  const form = document.getElementById("plan-form");
  const steps = form.querySelectorAll(".form-step");

  const navContainer = document.getElementById("form-navigation");
  const prevBtn = navContainer.querySelector(".prev-btn");
  const nextBtn = navContainer.querySelector(".next-btn");
  const submitBtn = document.getElementById("submit-plan-btn");
  const indicators = document.querySelectorAll(".step-indicator");
  const dietPlanOutput = document.getElementById("diet-plan-output");

  let currentStep = 1;
  const totalSteps = 6;
  const pollingStep = 5; // ESSA É A ETAPA DE "GERAÇÃO"
  const resultStep = 6;

  let currentPlanData = null;
  let currentUserData = null;
  let currentPlanoId = null; // Armazena o ID do plano gerado (PL-XX)

  form.setAttribute("novalidate", true);

  // 1. FUNÇÕES DE NAVEGAÇÃO E VALIDAÇÃO

  function updateFormVisibility(stepNumber = currentStep) {
    currentStep = stepNumber;

    steps.forEach((step) => {
      step.classList.remove("active");
      if (parseInt(step.dataset.step) === currentStep) {
        step.classList.add("active");
      }
    });

    indicators.forEach((indicator) => {
      const stepNum = parseInt(indicator.dataset.step);
      indicator.classList.remove("active", "completed");

      if (stepNum === currentStep) {
        indicator.classList.add("active");
      } else if (stepNum < currentStep) {
        indicator.classList.add("completed");
      }
    }); // Controle dos botões de navegação

    if (currentStep === resultStep) {
      // Etapa 6 (Resultado)
      navContainer.classList.add("result-nav-flex");
      addResultActions(
        form,
        navContainer,
        currentPlanData,
        currentUserData,
        currentPlanoId
      );
      setupPdfGeneration();
    } else {
      navContainer.classList.remove("result-nav-flex"); // Reconstroi os botões de navegação padrão

      navContainer.innerHTML = "";
      const clonedPrevBtn = prevBtn.cloneNode(true);
      const clonedNextBtn = nextBtn.cloneNode(true);
      const clonedSubmitBtn = submitBtn.cloneNode(true);

      navContainer.appendChild(clonedPrevBtn);
      navContainer.appendChild(clonedNextBtn);
      navContainer.appendChild(clonedSubmitBtn); // Reatribui os listeners de eventos aos clones

      clonedNextBtn.addEventListener("click", handleNextClick);
      clonedPrevBtn.addEventListener("click", handlePrevClick);
      clonedSubmitBtn.addEventListener("click", handleSubmitClick); // Esconde botões na etapa de Polling

      if (currentStep === pollingStep) {
        clonedPrevBtn.style.display = "none";
        clonedNextBtn.style.display = "none";
        clonedSubmitBtn.style.display = "none";
      } else {
        // Lógica de exibição padrão
        clonedPrevBtn.style.display = currentStep === 1 ? "none" : "flex";
        clonedNextBtn.style.display =
          currentStep < pollingStep - 1 ? "flex" : "none"; // Step 4 (5-1)
        clonedSubmitBtn.style.display =
          currentStep === pollingStep - 1 ? "flex" : "none"; // Step 4 (5-1)
      }
    }

    window.scrollTo(0, 0);
  }

  function validateCurrentStep() {
    const currentStepElement = form.querySelector(
      `.form-step[data-step="${currentStep}"]`
    );
    const requiredInputs = currentStepElement.querySelectorAll(
      "[required]:not(textarea):not(select), textarea[required], select[required]"
    );

    let isValid = true;
    let missingFields = [];

    requiredInputs.forEach((input) => {
      clearError(input); // Checa se o valor está vazio ou é um placeholder padrão de select

      const isMissing =
        input.value.trim() === "" ||
        input.value === "Selecione" ||
        input.value === "Frequência de atividade";

      let isInvalidNumber = false;
      if (input.type === "number" && !isMissing) {
        const numValue = parseFloat(input.value);
        if (isNaN(numValue) || numValue <= 0) {
          isInvalidNumber = true;
        }
      }

      if (isMissing || isInvalidNumber) {
        isValid = false;
        showError(input);

        let fieldName = input.name || input.id || "Campo Desconhecido";
        const parentRow = input.closest(".form-row");
        if (parentRow) {
          const labelElement = parentRow.querySelector("label");
          if (labelElement) {
            fieldName = labelElement.textContent.replace(/[.:]/g, "").trim();
          }
        }

        if (!missingFields.includes(fieldName)) {
          missingFields.push(fieldName);
        }
      }
    });

    return { isValid, missingFields };
  }
  // 2. FUNÇÃO DE CRIAÇÃO SINCRONA
  const handleSubmitClick = async (event) => {
    event.preventDefault();

    const validationResult = validateCurrentStep();

    if (!validationResult.isValid) {
      const fieldList = validationResult.missingFields.join(", ");
      showToast(
        `Atenção! Por favor, preencha as seguintes informações: ${fieldList}.`,
        true
      );
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    currentUserData = data;

    const submitButton = document.getElementById("submit-plan-btn");
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML =
      '<i class="fas fa-robot fa-spin"></i> Gerando Plano (Aguarde)...';
    submitButton.disabled = true;

    const token = localStorage.getItem("userToken");
    if (!token) {
      showToast(
        "❌ Erro: Usuário não autenticado. Faça login novamente.",
        true
      );
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
      return;
    }
    const authHeader = { Authorization: `Bearer ${token}` };

    // Volta para Step 5 para mostrar o carregamento
    updateFormVisibility(pollingStep);

    // HTML DE CARREGAMENTO (ETAPA 5)
    dietPlanOutput.innerHTML = `
      <div class="flex flex-col items-center justify-center p-12 min-h-[300px] bg-white rounded-2xl shadow-xl border border-gray-100">
                
        <h3 class="text-3xl font-bold text-green-700 mb-3 text-center">
            Gerando seu plano...
        </h3>
        <p class="text-xl text-gray-600 text-center max-w-md mb-8">
            Nossa IA está calculando suas metas e montando sua dieta.
        </p>
        
        <p class="text-sm text-gray-500 mt-6 animate-pulse">
            Aguarde, isso pode levar até 30 segundos.
        </p>
      </div>
    `;
    // FIM DO HTML DE CARREGAMENTO

    try {
      // Rota Síncrona de Geração
      const API_URL = "/api/generate-plan";
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ userData: data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Falha do servidor: Status ${response.status}.`
        );
      }

      const planData = await response.json(); // Recebe o plano COMPLETO

      // ETAPA 2: SALVAR O PLANO NO BANCO (Protegido por JWT)
      const saveUrl = "/api/save-plan";
      const saveResponse = await fetch(saveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ planData: planData, userData: data }),
      });

      if (!saveResponse.ok) {
        throw new Error("Erro ao salvar o plano no banco de dados.");
      }

      // Sucesso na Geração e Salvamento: Exibe o plano e avança para o Step 6
      currentPlanData = planData;
      currentPlanoId = (await saveResponse.json()).planoId;

      dietPlanOutputFinal.innerHTML = generatePlanHtml(
        currentPlanData,
        currentUserData
      );

      updateFormVisibility(resultStep);
      showToast("✅ Plano gerado e salvo com sucesso!", false);
    } catch (error) {
      console.error("❌ Erro no Processo Síncrono:", error);
      // Volta para o Step 4 (Input Final)
      updateFormVisibility(pollingStep - 1);
      dietPlanOutput.innerHTML = `<p style="text-align: center; color: red; padding: 30px;">
        ❌ Falha na Geração: ${error.message}.
        <br>Verifique o log do servidor e tente novamente.
        </p>`;
    } finally {
      // Restaura o botão original
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
    }
  };

  // 3. HANDLERS DE EVENTOS DE NAVEGAÇÃO

  const handleNextClick = () => {
    const validationResult = validateCurrentStep();

    if (validationResult.isValid) {
      // Limite de navegação é pollingStep (Step 5)
      if (currentStep < pollingStep) {
        updateFormVisibility(currentStep + 1);
      }
    } else {
      const fieldList = validationResult.missingFields.join(", ");
      showToast(
        `Atenção! Por favor, preencha as seguintes informações: ${fieldList}.`,
        true
      );
    }
  };

  const handlePrevClick = () => {
    if (currentStep > 1) {
      updateFormVisibility(currentStep - 1);
    }
  };

  // 4. INICIALIZAÇÃO

  updateFormVisibility(1);
});
