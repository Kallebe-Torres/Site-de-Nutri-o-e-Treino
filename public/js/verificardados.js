document.addEventListener('DOMContentLoaded', function () {
    // Código para a página dieta.html
    const tipoAlimentacaoElement = document.getElementById('tipo-alimentacao-dieta');
    const objetivoDietaElement = document.getElementById('objetivo-dieta');
    const criarPlanoBtn = document.getElementById('criar-plano-btn');

    if (tipoAlimentacaoElement && objetivoDietaElement) {
        const planoDataString = localStorage.getItem('planoDeDieta');

        if (planoDataString) {
            const planoData = JSON.parse(planoDataString);

            // Agora exibe os dados nos IDs corrigidos
            tipoAlimentacaoElement.textContent = planoData.tipoDieta;
            objetivoDietaElement.textContent = planoData.objetivo;

        } else {
            // Caso não haja dados salvos, exibe um plano padrão
            tipoAlimentacaoElement.textContent = 'Padrão';
            objetivoDietaElement.textContent = 'Manter Peso';
        }
    }

    // Código para a página criarPlano.html
    const form = document.getElementById('plan-form');
    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault(); // Impede o envio padrão do formulário

            const data = {
                sexo: form.elements['sexo'].value,
                idade: form.elements['idade'].value,
                peso: form.elements['peso'].value,
                altura: form.elements['altura'].value,
                frequencia: form.elements['frequencia'].value,
                objetivo: form.elements['objetivo'].value,
                tipoDieta: form.elements['tipoDieta'].value,
            };

            // Salva o objeto no localStorage com o nome 'planoDeDieta'
            localStorage.setItem('planoDeDieta', JSON.stringify(data));

            // Redireciona para a página da dieta
            window.location.href = 'dieta.html';
        });
    }

    // Gerencia o clique no botão "Criar Plano" na página da dieta
    if (criarPlanoBtn) {
        criarPlanoBtn.addEventListener('click', function () {
            window.location.href = 'criarPlano.html';
        });
    }
});