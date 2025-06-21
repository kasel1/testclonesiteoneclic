/* assets/js/modules/search.js - Version corrigée */

export function initSearch() {
  // Vérifier que Fuse est disponible
  if (typeof window.Fuse === 'undefined') {
    console.warn('⚠️ Fuse.js non disponible');
    return;
  }

  // Charger l'index de recherche
  loadSearchIndex()
    .then(data => setupSearch(data))
    .catch(error => {
      console.error('❌ Erreur chargement index:', error);
    });
}

// Charger l'index JSON
async function loadSearchIndex() {
  try {
    const response = await fetch('/index.json');
    if (!response.ok) throw new Error('Index non trouvé');
    return await response.json();
  } catch (error) {
    console.error('Erreur fetch:', error);
    return [];
  }
}

// Configurer la recherche
function setupSearch(recipes) {
  // Configuration Fuse
  const fuseOptions = {
    keys: ['title', 'tags', 'categories'],
    threshold: 0.3,
    includeMatches: true,
    minMatchCharLength: 2
  };

  const fuse = new window.Fuse(recipes, fuseOptions);

  // Gérer desktop et mobile
  const searchers = [
    {
      input: document.getElementById('search-input'),
      clear: document.getElementById('search-clear-input'),
      results: document.getElementById('search-results-input'),
      type: 'desktop'
    },
    {
      input: document.getElementById('search-mobile-input'),
      clear: document.getElementById('search-clear-mobile-input'),
      results: document.getElementById('search-results-mobile-input'),
      type: 'mobile'
    }
  ];

  // Configurer chaque searcher Fuse
  searchers.forEach(({ input, clear, results, type }) => {
    if (!input || !results) {
      console.warn(`⚠️ Éléments manquants pour ${type}`);
      return;
    }

    let debounceTimer = null;
    let selectedIndex = -1;

    // ✅ FIX : Handler Enter différent desktop/mobile
    function handleEnterKey(e) {
      if (e.key !== 'Enter') return;
      
      // Empêcher complètement le comportement par défaut
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (type === 'mobile') {
        // 🚫 Sur mobile : TOUJOURS bloquer Enter, ne JAMAIS naviguer
        e.target.blur(); // Fermer le clavier
        // C'est tout ! L'utilisateur clique manuellement sur la recette
        return false;
      }
      
      // 🖥️ Desktop : logique de navigation automatique
      if (!input.value.trim()) {
        return false;
      }
      
      // Si un élément est sélectionné avec les flèches
      const items = results.querySelectorAll('.search-result-item');
      if (selectedIndex >= 0 && items[selectedIndex]) {
        const link = items[selectedIndex].querySelector('a');
        if (link) {
          window.location.href = link.href;
          return false;
        }
      }
      
      // Si aucun élément sélectionné mais qu'il y a des résultats, prendre le premier
      if (items.length > 0) {
        const firstLink = items[0].querySelector('a');
        if (firstLink) {
          window.location.href = firstLink.href;
          return false;
        }
      }
      
      return false;
    }

    // Attacher le handler Enter
    input.addEventListener('keydown', handleEnterKey, true);
    input.addEventListener('keypress', handleEnterKey, true);

    // Fonction de rendu des résultats
    function renderResults(searchResults) {
      results.innerHTML = '';
      const hasResults = searchResults.length > 0;
      
      results.classList.toggle('hidden', !hasResults);
      input.setAttribute('aria-expanded', hasResults);
      
      if (!hasResults) {
        selectedIndex = -1;
        return;
      }

      searchResults.forEach((result, index) => {
        const li = document.createElement('li');
        li.className = 'search-result-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', index === selectedIndex);
        
        // Titre avec mise en évidence
        const title = highlightMatches(result.item.title, result.matches);
        li.innerHTML = `
          <a href="${result.item.url}" class="block">
            <div class="search-result-title">${title}</div>
            ${result.item.categories ? `
              <div class="search-result-category">
                ${result.item.categories.join(', ')}
              </div>
            ` : ''}
            ${result.item.excerpt ? `
              <div class="search-result-excerpt">${result.item.excerpt}</div>
            ` : ''}
          </a>
        `;
        
        results.appendChild(li);
      });
    }

    // Mise en évidence des correspondances
    function highlightMatches(text, matches) {
      if (!matches || !matches.length) return text;
      
      let highlighted = text;
      matches.forEach(match => {
        if (match.key === 'title') {
          match.indices.forEach(([start, end]) => {
            const substr = text.substring(start, end + 1);
            highlighted = highlighted.replace(
              substr, 
              `<mark style="background-color: #EA580C; color: white; padding: 1px 3px; border-radius: 3px;">${substr}</mark>`
            );
          });
        }
      });
      
      return highlighted;
    }

    // Recherche avec debounce
    function performSearch(query) {
      clearTimeout(debounceTimer);
      
      if (!query.trim()) {
        renderResults([]);
        if (clear) clear.classList.add('hidden');
        return;
      }

      if (clear) clear.classList.remove('hidden');
      
      debounceTimer = setTimeout(() => {
        const results = fuse.search(query);
        renderResults(results);
      }, 300);
    }

    // Événements
    input.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });

    // Bouton clear
    if (clear) {
      clear.addEventListener('click', () => {
        input.value = '';
        renderResults([]);
        clear.classList.add('hidden');
        input.focus();
      });
    }

    // Navigation clavier (flèches, escape) - handler séparé
    input.addEventListener('keydown', (e) => {
      // Skip Enter (déjà géré par handleEnterKey)
      if (e.key === 'Enter') return;
      
      const items = results.querySelectorAll('.search-result-item');
      if (!items.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          updateSelection(items);
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
          updateSelection(items);
          break;
          
        case 'Escape':
          e.preventDefault();
          input.value = '';
          renderResults([]);
          if (clear) clear.classList.add('hidden');
          input.blur();
          break;
      }
    });

    // Mettre à jour la sélection visuelle
    function updateSelection(items) {
      items.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        item.setAttribute('aria-selected', isSelected);
        
        if (isSelected) {
          item.style.backgroundColor = 'var(--color-bg-alt)';
          item.style.borderLeft = '3px solid var(--primary)';
          item.style.paddingLeft = 'calc(var(--space-5) - 3px)';
        } else {
          item.style.backgroundColor = '';
          item.style.borderLeft = '';
          item.style.paddingLeft = '';
        }
      });
      
      // Scroll into view si nécessaire
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }

    // Focus/blur pour afficher/cacher les résultats
    input.addEventListener('focus', () => {
      if (results.children.length > 0) {
        results.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
      }
    });

    input.addEventListener('blur', () => {
      // Délai pour permettre le clic sur les résultats
      setTimeout(() => {
        results.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
        selectedIndex = -1;
      }, 200);
    });
  });

  console.log('✅ Recherche initialisée avec', recipes.length, 'recettes');
}
