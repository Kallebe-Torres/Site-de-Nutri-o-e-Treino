document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('login-form'); // O id do formulário de login
    const email = document.getElementById('email');
    const password = document.getElementById('password');

    // Adiciona o ouvinte de evento para limpar os erros ao digitar
    email.addEventListener('input', () => {
        clearError(email);
    });

    password.addEventListener('input', () => {
        clearError(password);
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault(); // Impede o envio do formulário

        // Limpa as mensagens de erro antes de validar novamente
        document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
        document.querySelectorAll('.input-box').forEach(box => box.classList.remove('error'));

        let formIsValid = true;

        if (email.value.trim() === '' || !isValidEmail(email.value)) {
            showError(email, 'Por favor, digite um e-mail válido.');
            formIsValid = false;
        }

        if (password.value.trim() === '') {
            showError(password, 'Por favor, digite sua senha.');
            formIsValid = false;
        }

        if (formIsValid) {
            // Se o formulário é válido, exibe o alerta
            alert('Login realizado com sucesso!');

            // Aqui você pode adicionar a lógica para redirecionar o usuário
            // Exemplo:
            // window.location.href = 'pagina-de-boas-vindas.html';
        }
    });

    function showError(input, message) {
        const inputBox = input.parentElement;
        const errorSpan = inputBox.querySelector('.error-message');
        errorSpan.textContent = message;
        inputBox.classList.add('error');
    }

    function clearError(input) {
        const inputBox = input.parentElement;
        const errorSpan = inputBox.querySelector('.error-message');
        errorSpan.textContent = '';
        inputBox.classList.remove('error');
    }

    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }
});