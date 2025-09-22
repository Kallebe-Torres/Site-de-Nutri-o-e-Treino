document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll("#funcionalidades, #planos, #contato, .cta, #banner");

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        obs.unobserve(entry.target); // anima só uma vez
      }
    });
  }, { threshold: 0.2 });

  sections.forEach(sec => observer.observe(sec));
});
