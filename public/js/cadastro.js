const API_BASE_URL = 'http://localhost:3001';

// 1. FUNÇÕES DE SUPORTE

function showError(input, message) {
    // Busca o elemento pai que pode ser .input-box ou .terms-checkbox-group
    const parentElement = input.closest('.input-box, .terms-checkbox-group');
    if (!parentElement) return;

    const errorSpan = parentElement.querySelector('.error-message');
    if (errorSpan) {
        errorSpan.textContent = message;
    }
    parentElement.classList.add('error');
}

function clearError(input) {
    const parentElement = input.closest('.input-box, .terms-checkbox-group');
    if (!parentElement) return;

    const errorSpan = parentElement.querySelector('.error-message');
    if (errorSpan) {
        errorSpan.textContent = '';
    }
    parentElement.classList.remove('error');
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function formatPhoneNumber(phone) {
    phone = phone.replace(/\D/g, '');
    if (phone.length > 11) {
        phone = phone.substring(0, 11);
    }
    if (phone.length > 2 && phone.length <= 7) {
        phone = `(${phone.substring(0, 2)}) ${phone.substring(2)}`;
    } else if (phone.length > 7) {
        phone = `(${phone.substring(0, 2)}) ${phone.substring(2, 7)}-${phone.substring(7)}`;
    } else if (phone.length > 0) {
        phone = `(${phone.substring(0, 2)}`;
    }
    return phone;
}

function isValidPhoneNumber(phone) {
    const re = /^\(\d{2}\) \d{5}-\d{4}$/;
    return re.test(phone);
}

function isValidPassword(password) {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@&%])[A-Za-z\d@&%]{8,}$/;
    return re.test(password);
}


// 2. LÓGICA PRINCIPAL DE CADASTRO
async function handleRegistration(event) {
    event.preventDefault();

    // Referências dos elementos
    const firstname = document.getElementById('firstname');
    const lastname = document.getElementById('lastname');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const number = document.getElementById('number');
    const termsCheckbox = document.getElementById('terms');

    // Limpa erros antes de validar
    document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
    document.querySelectorAll('.input-box, .terms-checkbox-group').forEach(box => box.classList.remove('error'));

    let formIsValid = true;

    // --- Validações Detalhadas de Frontend ---

    // Validação do Nome
    if (firstname.value.trim() === '') {
        showError(firstname, 'Primeiro nome é obrigatório.');
        formIsValid = false;
    }
    if (lastname.value.trim() === '') {
        showError(lastname, 'Sobrenome é obrigatório.');
        formIsValid = false;
    }

    // Validação do Email (Apenas formato, sem checar duplicidade aqui)
    if (!isValidEmail(email.value)) {
        showError(email, 'Email inválido ou obrigatório.');
        formIsValid = false;
    }

    // Validação da Senha
    if (!isValidPassword(password.value)) {
        showError(password, 'Mínimo 8 caracteres, com letras maiúsculas, minúsculas, números e símbolos (@, &, %).');
        formIsValid = false;
    }

    // Confirmação de Senha
    if (password.value !== confirmPassword.value) {
        showError(confirmPassword, 'As senhas não coincidem.');
        formIsValid = false;
    }

    // Validação do Telefone
    if (number.value.trim() !== '' && !isValidPhoneNumber(number.value)) {
        showError(number, 'Número de telefone inválido. Formato (XX) XXXXX-XXXX.');
        formIsValid = false;
    }

    // Validação dos Termos
    if (!termsCheckbox.checked) {
        showError(termsCheckbox, 'Você deve aceitar os termos.');
        formIsValid = false;
    }

    if (!formIsValid) {
        return; // Interrompe se a validação frontend falhar
    }

    // --- Comunicação com o Backend ---

    // Limpa o número de telefone para enviar APENAS dígitos
    const cleanedPhoneNumber = number.value.replace(/\D/g, '');

    const userData = {
        firstname: firstname.value.trim(),
        lastname: lastname.value.trim(),
        email: email.value,
        password: password.value,
        number: cleanedPhoneNumber
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (response.ok) {
            // SUCESSO
            alert('Cadastro concluído com sucesso!');
            localStorage.setItem('userEmail', email.value);
            window.location.href = 'login.html';

        } else {
            // FALHA DO BACKEND (TRATAMENTO DE E-MAIL DUPLICADO AQUI)
            const errorMessage = data.message || data.error || 'Erro ao tentar cadastrar. Verifique o console.';
            alert(errorMessage);

            // Se o backend retornar que o EMAIL JÁ ESTÁ CADASTRADO, 
            // exibe o erro no campo email e na mensagem geral.
            if (errorMessage.includes('email') || errorMessage.includes('Email') || errorMessage.includes('E-mail já cadastrado')) {
                showError(email, errorMessage);
            }
        }

    } catch (error) {
        console.error('Erro de conexão/servidor:', error);
        alert('Falha na comunicação com o servidor. Verifique se o backend está rodando.');
    }
}

// 3. INICIALIZAÇÃO E LISTENERS (Mantidos)

document.addEventListener('DOMContentLoaded', function () {
    // Referências dos elementos para listeners de input
    const form = document.getElementById('registration-form');
    const firstname = document.getElementById('firstname');
    const lastname = document.getElementById('lastname');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const number = document.getElementById('number');
    const termsCheckbox = document.getElementById('terms');

    // Liga a função principal ao evento de submissão do formulário
    if (form) {
        form.addEventListener('submit', handleRegistration);
    }

    // Liga os listeners para limpar erros e formatar
    firstname?.addEventListener('input', () => clearError(firstname));
    lastname?.addEventListener('input', () => clearError(lastname));
    email?.addEventListener('input', () => clearError(email));
    password?.addEventListener('input', () => clearError(password));

    // Listener para a Confirmação de Senha
    confirmPassword?.addEventListener('input', () => {
        clearError(confirmPassword);
        // Limpa o erro da senha original se o usuário começar a corrigir a confirmação
        clearError(password);
    });

    termsCheckbox?.addEventListener('change', () => clearError(termsCheckbox));

    number?.addEventListener('input', (event) => {
        // Mantém a formatação na UI
        event.target.value = formatPhoneNumber(event.target.value);
        clearError(number);
    });
});