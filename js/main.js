document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     OBSERVERS DE SEÇÕES
  ========================= */
  const sections = document.querySelectorAll("#home, #funcionalidades, #planos, #contato");

  const sectionObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        obs.unobserve(entry.target); // anima só uma vez
      }
    });
  }, { threshold: 0.2 });

  sections.forEach(section => sectionObserver.observe(section));

  /* =========================
     OBSERVERS DE FEATURES E PLANOS
  ========================= */
  const groupObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const items = entry.target.querySelectorAll(".card, .plan");
        items.forEach((el, index) => {
          setTimeout(() => el.classList.add("show"), index * 100); // anima em cascata
        });
        entry.target.classList.add("animated");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll(".features, .plans").forEach(group => {
    groupObserver.observe(group);
  });

  /* =========================
  DESTAQUE DOS CARDS (NOVA LÓGICA)
========================= */
  const cards = document.querySelectorAll(".features .card");

  cards.forEach(card => {
    card.addEventListener("mouseenter", () => {
      // Adiciona a classe de destaque no card atual
      card.classList.add("destaque");
    });

    card.addEventListener("mouseleave", () => {
      // Remove a classe de destaque quando o mouse sai
      card.classList.remove("destaque");
    });
  })
});

document.addEventListener("DOMContentLoaded", () => {
  const plans = document.querySelectorAll(".plans .plan");

  plans.forEach(plan => {
    plan.addEventListener("mouseenter", () => {
      plan.classList.add("destaque");
    });

    plan.addEventListener("mouseleave", () => {
      plan.classList.remove("destaque");
    });
  });
});

