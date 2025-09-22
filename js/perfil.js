document.addEventListener('DOMContentLoaded', function() {
    // Tenta pegar os dados do usuário do localStorage
    const userProfile = localStorage.getItem('userProfile');

    // Se os dados existirem...
    if (userProfile) {
        // Converte a string de volta para um objeto JavaScript
        const userData = JSON.parse(userProfile);

        // Pega o elemento onde o nome será exibido
        const userNameElement = document.getElementById('user-name');
        const userProfileInfo = document.getElementById('user-profile-info');

        // Atualiza o texto com o nome do usuário
        if (userNameElement && userProfileInfo) {
            userNameElement.textContent = userData.firstname;
            userProfileInfo.style.display = 'block'; // Mostra o perfil
        }
    }
});