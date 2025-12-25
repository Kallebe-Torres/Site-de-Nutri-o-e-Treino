// js/main.js

document.addEventListener("DOMContentLoaded", () => {
  
  //ANIMAÇÃO DA SEÇÃO HOME
  // Este bloco anima o conteúdo principal (CTA e Banner)

  const cta = document.getElementById("cta");
  const banner = document.getElementById("banner");

  if (cta) {
    cta.classList.add("animate-fadeInDown");
    cta.classList.remove("opacity-0");
  }
  if (banner) {
    banner.classList.add("animate-fadeInUp");
    banner.classList.remove("opacity-0");
  }

  //OBSERVERS DE GRUPOS (Animação em Cascata)
  //Usamos os IDs #funcionalidades e #planos do seu HTML
  const animatedGroups = document.querySelectorAll("#funcionalidades, #planos");

  if (animatedGroups.length > 0) {
    const groupObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = entry.target.querySelectorAll(".card, .plan");

            items.forEach((el, index) => {
              setTimeout(() => {
                el.classList.add("animate-fadeInUp");
                el.classList.remove("opacity-0");
              }, index * 100); // Anima em cascata
            });

            // Para de observar a seção após a animação
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 } // Inicia a animação quando 15% da seção estiver visível
    );

    // Observa os grupos corretos
    animatedGroups.forEach((group) => groupObserver.observe(group));
  }

    //DESTAQUE (HOVER) DOS CARDS E PLANOS

  // Usando os IDs corretos das seções
  const highlightItems = document.querySelectorAll(
    "#funcionalidades .card, #planos .plan"
  );

  if (highlightItems.length > 0) {
    highlightItems.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        item.classList.add("destaque");
      });
      item.addEventListener("mouseleave", () => {
        item.classList.remove("destaque");
      });
    });
  }


    //LÓGICA DO MENU
  

  // Menu hambúrguer
  function toggleMenu() {
    const navList = document.getElementById("nav_list");
    navList.classList.toggle("hidden");
    navList.classList.toggle("flex");
  }

  // Disponibiliza a função globalmente para o onclick="toggleMenu()" do HTML
  window.toggleMenu = toggleMenu;

  // Dropdown do perfil
  const userProfileIcon = document.getElementById("user-profile-icon");
  if (userProfileIcon) {
    userProfileIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById("user-info-dropdown");
      const icon = document.getElementById("user-profile-icon");
      dropdown.classList.toggle("hidden");
      dropdown.classList.toggle("flex");
      icon.setAttribute("aria-expanded", dropdown.classList.contains("flex"));
    });
  }

  // Fechar dropdown ao clicar fora
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("user-info-dropdown");
    const icon = document.getElementById("user-profile-icon");

    // Garante que os elementos existem antes de checar
    if (
      dropdown &&
      icon &&
      !dropdown.contains(e.target) &&
      !icon.contains(e.target)
    ) {
      dropdown.classList.add("hidden");
      dropdown.classList.remove("flex");
      icon.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("DOMContentLoaded", () => {

    /* =================================
    //LÓGICA DO LINK ATIVO NO HEADER
   ================================= */
    const headerLinks = document.querySelectorAll("#nav_list a[href^='#']"); // Pega só links internos
    const sectionsToObserve = document.querySelectorAll("section[id]"); // Pega todas as seções com ID

    if (headerLinks.length > 0 && sectionsToObserve.length > 0) {
      const observerOptions = {
        root: null, // Observa em relação ao viewport
        rootMargin: "-40% 0px -60% 0px", // Define uma "linha" no meio da tela para ativar
        threshold: 0, // Ativa assim que cruzar a linha
      };

      const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          // Pega o ID da seção que cruzou a linha (ex: "funcionalidades")
          const id = entry.target.getAttribute("id");
          // Monta o seletor do link correspondente (ex: #nav_list a[href="#funcionalidades"])
          const correspondingLink = document.querySelector(
            `#nav_list a[href="#${id}"]`
          );

          if (entry.isIntersecting) {
            // Seção entrou na área de ativação:
            // 1. Remove 'active-link' de TODOS os links
            headerLinks.forEach((link) => link.classList.remove("active-link"));
            // 2. Adiciona 'active-link' APENAS no link correspondente
            if (correspondingLink) {
              correspondingLink.classList.add("active-link");
            }
          }
          // Não removemos explicitamente ao sair, pois outro link será ativado logo em seguida
        });
      }, observerOptions);

      // Coloca o observer para "vigiar" cada seção
      sectionsToObserve.forEach((section) => {
        sectionObserver.observe(section);
      });
    }
  });
});
