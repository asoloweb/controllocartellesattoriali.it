document.addEventListener('DOMContentLoaded', () => {
  if (!window.AOS) return;
  window.AOS.init({
    once: false,
    duration: 600,
    offset: 80,
    mirror: true,
  });
});
