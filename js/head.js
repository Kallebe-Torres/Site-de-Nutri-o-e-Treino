document.addEventListener("DOMContentLoaded", () => {
  /* =======================
     HEADER (efeito cascata)
  ======================= */
  const headerElements = document.querySelectorAll(
    "header .logo-container, header #nav_list .nav-item, header #auth-buttons-container a"
  );

  headerElements.forEach((el, index) => {
    setTimeout(() => {
      el.classList.add("show");
    }, index * 200);
  });

  /* =======================
     HOME (entra suave)
  ======================= */
  const home = document.querySelector("#home");
  if (home) {
    const homeObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          home.classList.add("animated");
          obs.unobserve(home);
        }
      });
    }, { threshold: 0.3 });

    homeObserver.observe(home);
  }

  /* =======================
     FUNCIONALIDADES e PLANOS
     (efeito cascata nos cards)
  ======================= */
  const groupObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const items = entry.target.querySelectorAll(".card, .plan");
        items.forEach((el, index) => {
          setTimeout(() => {
            el.classList.add("show");
          }, index * 200); // cascata
        });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll(".features, .plans").forEach(section => {
    groupObserver.observe(section);
  });

  /* =======================
     CONTATO (entra suave)
  ======================= */
  const contato = document.querySelector("#contato");
  if (contato) {
    const contatoObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          contato.classList.add("show");
          obs.unobserve(contato);
        }
      });
    }, { threshold: 0.2 });

    contatoObserver.observe(contato);
  }
});
