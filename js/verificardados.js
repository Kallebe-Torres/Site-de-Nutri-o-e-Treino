document.addEventListener('DOMContentLoaded', function() {
    // Código para a página dieta.html
    const tipoDietaElement = document.getElementById('tipo-dieta');
    const objetivoDietaElement = document.getElementById('objetivo-dieta');
    const criarPlanoBtn = document.getElementById('criar-plano-btn');

    if (tipoDietaElement && objetivoDietaElement) {
        const planoDataString = localStorage.getItem('planoDeTreino');
        
        if (planoDataString) {
            const planoData = JSON.parse(planoDataString);
            
            tipoDietaElement.textContent = planoData.tipoDieta;
            objetivoDietaElement.textContent = planoData.objetivo;
        } else {
            // Caso não haja dados salvos, exibe um plano padrão
            tipoDietaElement.textContent = 'Padrão';
            objetivoDietaElement.textContent = 'Manter';
        }
    }

    // Código para a página criar_plano.html
    const form = document.getElementById('plan-form');
    if (form) {
        form.addEventListener('submit', function(event) {
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

            // Salva o objeto no localStorage como uma string JSON
            localStorage.setItem('planoDeTreino', JSON.stringify(data));

            // Redireciona para a página da dieta
            window.location.href = 'dieta.html';
        });
    }

    // Gerencia o clique no botão "Criar Plano" na página da dieta
    if (criarPlanoBtn) {
        criarPlanoBtn.addEventListener('click', function() {
            window.location.href = 'criar_plano.html';
        });
    }
});