/* assets/js/modules/cta-buttons.js - Boutons CTA unifiés */

export function initCTAButtons() { 
  const shareButton = document.getElementById('shareButton');
  const shareMenu = document.getElementById('shareMenu');
  const printButton = document.getElementById('printButton');
  const pinterestPinButton = document.getElementById('pinterestPinButton');

  if (!shareButton || !shareMenu) return;

  // État du menu
  let menuOpen = false;

  // Gestionnaire du menu de partage
  function toggleShareMenu() {
    menuOpen = !menuOpen;
    shareMenu.classList.toggle('is-active', menuOpen);
    shareButton.setAttribute('aria-expanded', menuOpen);
  }

  function closeShareMenu() {
    menuOpen = false;
    shareMenu.classList.remove('is-active');
    shareButton.setAttribute('aria-expanded', 'false');
  }

  // Events
  shareButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleShareMenu();
  });

  // Fermer en cliquant ailleurs
  document.addEventListener('click', closeShareMenu);
  shareMenu.addEventListener('click', (e) => e.stopPropagation());

  // Fermer quand on utilise les autres boutons
  printButton?.addEventListener('click', closeShareMenu);
  pinterestPinButton?.addEventListener('click', closeShareMenu);

  // Actions de partage
  const shareActions = {
    copyLink: () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showNotification('Lien copié !'))
        .catch(() => fallbackCopyLink());
    },
    
    email: () => {
      const subject = encodeURIComponent(document.title);
      const body = encodeURIComponent(`Découvrez cette recette : ${window.location.href}`);
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    },
    
    pinterest: () => {
      const url = encodeURIComponent(window.location.href);
      const description = encodeURIComponent(document.title);
      const image = document.querySelector('meta[property="og:image"]')?.content || '';
      const imageUrl = encodeURIComponent(image);
      window.open(`https://pinterest.com/pin/create/button/?url=${url}&description=${description}&media=${imageUrl}`, '_blank');
    },
    
    facebook: () => {
      const url = encodeURIComponent(window.location.href);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    },
    
    twitter: () => {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(document.title);
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
    },
    
    whatsapp: () => {
      const text = encodeURIComponent(`${document.title} - ${window.location.href}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    },
    
    reddit: () => {
      const url = encodeURIComponent(window.location.href);
      const title = encodeURIComponent(document.title);
      window.open(`https://reddit.com/submit?url=${url}&title=${title}`, '_blank');
    },
    
    print: () => window.print()
  };

  // Attacher les événements
  Object.entries(shareActions).forEach(([action, handler]) => {
    const button = document.getElementById(`${action}Button`);
    if (button) {
      button.addEventListener('click', () => {
        handler();
        closeShareMenu();
      });
    }
  });

  // Pinterest Pin direct
  pinterestPinButton?.addEventListener('click', shareActions.pinterest);
}

// Notification
function showNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-toast animate-slide-in-right';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('animate-slide-out-right');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Fallback pour copier le lien
function fallbackCopyLink() {
  const input = document.createElement('input');
  input.value = window.location.href;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  showNotification('Lien copié !');
}
