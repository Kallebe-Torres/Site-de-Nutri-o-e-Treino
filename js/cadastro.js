document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registration-form');
    const firstname = document.getElementById('firstname');
    const lastname = document.getElementById('lastname');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const number = document.getElementById('number');
    const termsCheckbox = document.getElementById('terms'); // Adicionado o checkbox

    // Adiciona o ouvinte de evento para limpar os erros ao digitar
    password.addEventListener('input', () => {
        clearError(password);
    });
    confirmPassword.addEventListener('input', () => {
        clearError(confirmPassword);
    });
    email.addEventListener('input', () => {
        clearError(email);
    });
    firstname.addEventListener('input', () => {
        clearError(firstname);
    });
    lastname.addEventListener('input', () => {
        clearError(lastname);
    });
    number.addEventListener('input', (event) => {
        event.target.value = formatPhoneNumber(event.target.value);
        clearError(number);
    });
    termsCheckbox.addEventListener('change', () => {
        clearError(termsCheckbox);
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Impede o envio do formulário

        // Limpa as mensagens de erro antes de validar novamente
        document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
        document.querySelectorAll('.input-box, .terms-checkbox-group').forEach(box => box.classList.remove('error'));

        let formIsValid = true;

        if (firstname.value.trim() === '') {
            showError(firstname, 'Por favor, digite seu primeiro nome.');
            formIsValid = false;
        }

        if (lastname.value.trim() === '') {
            showError(lastname, 'Por favor, digite seu sobrenome.');
            formIsValid = false;
        }

        if (email.value.trim() === '' || !isValidEmail(email.value)) {
            showError(email, 'O e-mail inserido é inválido. Por favor, verifique-o.');
            formIsValid = false;
        }

        if (number.value.trim() === '' || !isValidPhoneNumber(number.value)) {
            showError(number, 'O celular inserido é inválido. Digite no formato (XX) XXXXX-XXXX.');
            formIsValid = false;
        }

        if (password.value.trim() === '' || !isValidPassword(password.value)) {
            showError(password, 'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo (@, &, %).');
            formIsValid = false;
        }

        if (confirmPassword.value.trim() === '' || password.value !== confirmPassword.value) {
            showError(confirmPassword, 'As senhas não correspondem. Por favor, verifique a confirmação.');
            formIsValid = false;
        }
        
        if (!termsCheckbox.checked) {
            showError(termsCheckbox, 'Você deve concordar com os termos para continuar.');
            formIsValid = false;
        }

        if (formIsValid) {
            // Cria um objeto com os dados do usuário
            const userData = {
                firstname: firstname.value.trim(),
                lastname: lastname.value.trim(),
                email: email.value,
                number: number.value
            };

            // Salva o objeto de dados do usuário no localStorage
            localStorage.setItem('userProfile', JSON.stringify(userData));

            // Alerta personalizado com texto melhor
            alert('Cadastro realizado com sucesso! Sua conta está em análise e você será notificado em breve.');

            // Redireciona para a página inicial após o alerta
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500); // 500ms de delay para o usuário ver o alerta
        }
    });

    function showError(input, message) {
        const parentElement = input.closest('.input-box, .terms-checkbox-group');
        const errorSpan = parentElement.querySelector('.error-message');
        errorSpan.textContent = message;
        parentElement.classList.add('error');
    }

    function clearError(input) {
        const parentElement = input.closest('.input-box, .terms-checkbox-group');
        const errorSpan = parentElement.querySelector('.error-message');
        errorSpan.textContent = '';
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
            phone = `(${phone.substring(0, 2)})`;
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
});