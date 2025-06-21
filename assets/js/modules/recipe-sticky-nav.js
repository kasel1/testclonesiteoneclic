// assets/js/recipe-sticky-nav.js

export function initStickyNav() {
  const nav = document.getElementById('stickyNav');
  if (!nav) return;

  // —— Highlight au scroll ——
  const sections = ['ingredients', 'steps', 'faq'];
  function highlightNav() {
    let active = 'ingredients';
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 120) {
        active = id;
      }
    }
    document.querySelectorAll('#stickyNav .navLink').forEach(a => {
      a.classList.toggle(
        'text-[var(--clr-primary)]',
        a.dataset.target === active
      );
    });
  }

  document.addEventListener('scroll', () => requestAnimationFrame(highlightNav));
  highlightNav();

  // —— Toggle Save (icone inline, pas besoin de changer l'icône visuellement) ——  
  const saveBtn = document.getElementById('navSaveBtn');
  const key = location.pathname;

  function updateSave() {
    const favs = JSON.parse(localStorage.getItem('favs') || '[]');
    const saved = favs.includes(key);
    saveBtn.classList.toggle('opacity-60', saved); // ou autre effet visuel
  }

  function toggleSave() {
    const favs = JSON.parse(localStorage.getItem('favs') || '[]');
    const idx = favs.indexOf(key);
    if (idx > -1) favs.splice(idx, 1);
    else favs.push(key);
    localStorage.setItem('favs', JSON.stringify(favs));
    updateSave();
  }

  saveBtn?.addEventListener('click', toggleSave);
  document.addEventListener('DOMContentLoaded', updateSave);
}
