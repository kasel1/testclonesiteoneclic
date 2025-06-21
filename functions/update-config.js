/**
 * Cloudflare Worker Multi-Sites - Version Template API Corrigée
 * 
 * ✅ Template API GitHub (1 requête)
 * ✅ Configuration simple
 * ✅ Registry des sites
 * ✅ Workers + GitHub Actions
 */

// ===================================================================
// CONFIGURATION
// ===================================================================

const CONFIG = {
  BRANCH: 'main',
  SOURCE_REPO: 'recettes-blog_test',
  
  ALLOWED_ORIGINS: [
    'https://recettes-blog-test.pages.dev',
    'http://localhost:1313'
  ],
  
  USER_AGENT: 'Multi-Site-Worker/2.0'
};

// ===================================================================
// POINT D'ENTRÉE PRINCIPAL
// ===================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await routeRequest(url, request, env, corsHeaders);
      return response;
    } catch (error) {
      console.error('Erreur générale:', error);
      return jsonResponse(
        { error: 'Erreur serveur interne', details: error.message }, 
        500, 
        corsHeaders
      );
    }
  }
};

// ===================================================================
// ROUTAGE
// ===================================================================

async function routeRequest(url, request, env, corsHeaders) {
  switch (url.pathname) {
    case '/api/health':
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        method: 'template-api',
        version: '2.0'
      }, 200, corsHeaders);
      
    case '/api/clone-site':
      return handleCloneSite(request, env, corsHeaders);
      
    case '/api/list-sites':
      return handleListSites(request, env, corsHeaders);
      
    default:
      return jsonResponse({ error: 'Route non trouvée' }, 404, corsHeaders);
  }
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': CONFIG.ALLOWED_ORIGINS.includes(origin) ? origin : CONFIG.ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

// ===================================================================
// GESTION DU CLONAGE (SIMPLIFIÉ)
// ===================================================================

async function handleCloneSite(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée' }, 405, corsHeaders);
  }

  try {
    const data = await request.json();
    
    // Validation simple
    if (!data.site_name || !data.repo_name) {
      return jsonResponse({ error: 'site_name et repo_name requis' }, 400, corsHeaders);
    }

    if (!/^[a-z0-9-]+$/.test(data.repo_name)) {
      return jsonResponse({ error: 'repo_name: lettres minuscules, chiffres et tirets uniquement' }, 400, corsHeaders);
    }

    // Vérification des variables d'environnement
    const required = ['GITHUB_TOKEN', 'REPO_OWNER', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
    for (const variable of required) {
      if (!env[variable]) {
        return jsonResponse({ error: `Variable manquante: ${variable}` }, 500, corsHeaders);
      }
    }

    // Processus de clonage simplifié
    const result = await cloneSiteTemplate(data, env);
    
    return jsonResponse({
      success: true,
      message: `Site "${data.site_name}" créé avec succès !`,
      ...result
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Erreur clonage:', error);
    return jsonResponse({ 
      error: 'Erreur lors du clonage',
      details: error.message 
    }, 500, corsHeaders);
  }
}

// ===================================================================
// CLONAGE VIA TEMPLATE API
// ===================================================================

async function cloneSiteTemplate(data, env) {
  const { GITHUB_TOKEN, REPO_OWNER, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;
  
  try {
    console.log(`🚀 Début du clonage pour: ${data.site_name}`);
    
    // Étape 1: Duplication via Template API (1 requête !)
    console.log('📄 Duplication du template...');
    const templateResponse = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${CONFIG.SOURCE_REPO}/generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
          name: data.repo_name,
          description: `Site ${data.site_name} - Généré automatiquement`,
          private: false,
          include_all_branches: false
        })
      }
    );

    if (!templateResponse.ok) {
      const error = await templateResponse.json();
      throw new Error(`Template API failed: ${error.message}`);
    }

    const repoResult = await templateResponse.json();
    console.log('✅ Template dupliqué avec succès');
    
    // Étape 2: Pause pour que GitHub finalise
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Étape 3: Configuration optionnelle du site (2 requêtes max)
    if (data.hero_line1 || data.hero_line2) {
      console.log('⚙️ Configuration personnalisée...');
      await configureSiteTemplate(data, GITHUB_TOKEN, REPO_OWNER);
    }
    
    // Étape 4: Déploiement automatique (Workers + GitHub Actions)
    console.log('🚀 Déploiement automatique complet...');
    const deploymentResult = await createCloudflareWorker(data.repo_name, REPO_OWNER, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_TOKEN);
    
    // Étape 5: Enregistrement dans le registry
    console.log('💾 Enregistrement dans le registry...');
    const siteData = {
      id: data.repo_name,
      name: data.site_name,
      repo: `${REPO_OWNER}/${data.repo_name}`,
      domain: deploymentResult.url.replace('https://', ''),
      admin_url: `${deploymentResult.url}/admin/`,
      created_at: new Date().toISOString(),
      status: 'active',
      github_url: repoResult.html_url,
      deployment_type: deploymentResult.type,
      deployment_url: deploymentResult.url
    };
    
    await saveSiteToRegistry(data.repo_name, siteData, env);
    
    console.log('✅ Clonage terminé avec succès (Template API)');
    
    return {
      site_id: data.repo_name,
      primary_url: deploymentResult.url,
      admin_url: `${deploymentResult.url}/admin/`,
      github_url: repoResult.html_url,
      deployment_type: deploymentResult.type,
      deployment_note: deploymentResult.note || null
    };
    
  } catch (error) {
    console.error('❌ Erreur durant le clonage:', error);
    throw new Error(`Échec du clonage: ${error.message}`);
  }
}

// ===================================================================
// CONFIGURATION OPTIONNELLE
// ===================================================================

async function configureSiteTemplate(data, token, owner) {
  const configUrl = `https://api.github.com/repos/${owner}/${data.repo_name}/contents/data/config.yaml`;
  
  try {
    // Récupération de la configuration
    const [contentResponse, metaResponse] = await Promise.all([
      fetch(configUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': 'application/vnd.github.v3.raw'
        }
      }),
      fetch(configUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': CONFIG.USER_AGENT
        }
      })
    ]);
    
    if (!contentResponse.ok) return; // Pas critique si ça échoue
    
    let content = await contentResponse.text();
    const fileMeta = await metaResponse.json();
    
    // Modifications simples
    content = content.replace(/name:\s*"?Test"?/g, `name: "${data.site_name}"`);
    content = content.replace(/logo_text:\s*"?T"?/g, `logo_text: "${data.site_name.charAt(0).toUpperCase()}"`);
    
    if (data.hero_line1) {
      content = content.replace(/hero_title_line1:\s*.*/g, `hero_title_line1: "${data.hero_line1}"`);
    }
    
    if (data.hero_line2) {
      content = content.replace(/hero_title_line2:\s*.*/g, `hero_title_line2: "${data.hero_line2}"`);
    }
    
    // Sauvegarde
    await fetch(configUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': CONFIG.USER_AGENT
      },
      body: JSON.stringify({
        message: `⚙️ Configuration du site "${data.site_name}"`,
        content: btoa(unescape(encodeURIComponent(content))),
        sha: fileMeta.sha
      })
    });
    
    console.log('✅ Configuration appliquée');
    
  } catch (error) {
    console.warn('⚠️ Erreur configuration (non critique):', error.message);
  }
}

// ===================================================================
// DÉPLOIEMENT AUTOMATIQUE VIA GITHUB ACTIONS + WORKERS
// ===================================================================

async function createCloudflareWorker(repoName, repoOwner, apiToken, accountId, githubToken) {
  console.log('⚡ Déploiement automatique via GitHub Actions + Workers');
  
  try {
    // 1. Créer le Worker d'abord
    console.log('🔨 Création du Worker...');
    
    const workerScript = generateWorkerScript(repoName, repoOwner);
    
    const createWorkerResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${repoName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/javascript'
        },
        body: workerScript
      }
    );

    if (!createWorkerResponse.ok) {
      const error = await createWorkerResponse.json();
      console.error('Erreur Worker:', error);
      throw new Error(`Erreur création Worker: ${error.errors?.[0]?.message || 'Erreur inconnue'}`);
    }

    console.log('✅ Worker créé');

    // 2. Configurer la route custom domain
    console.log('🌐 Configuration du domaine...');
    
    const routeResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${repoName}/routes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pattern: `${repoName}.${repoOwner.toLowerCase()}.workers.dev/*`,
          script: repoName
        })
      }
    );

    console.log('✅ Route configurée');

    // 3. Ajouter GitHub Action pour auto-déploiement
    console.log('🤖 Ajout GitHub Actions...');
    await addGitHubAction(repoName, repoOwner, githubToken, accountId, apiToken);

    // 4. Déclencher le premier build
    console.log('🚀 Déclenchement du premier build...');
    await triggerGitHubAction(repoName, repoOwner, githubToken);

    return {
      id: repoName,
      name: repoName,
      url: `https://${repoName}.${repoOwner.toLowerCase()}.workers.dev`,
      type: 'worker-auto'
    };

  } catch (error) {
    console.error('❌ Erreur déploiement automatique:', error);
    throw error;
  }
}

// Générer le script Worker pour servir le site Hugo
function generateWorkerScript(repoName, repoOwner) {
  return `
// Worker auto-généré pour ${repoName}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Servir depuis GitHub Pages (auto-déployé par Actions)
    const githubUrl = 'https://${repoOwner.toLowerCase()}.github.io/${repoName}' + url.pathname;
    
    try {
      const response = await fetch(githubUrl, {
        headers: {
          'User-Agent': 'Cloudflare-Worker'
        }
      });
      
      if (response.ok) {
        // Créer une nouvelle réponse avec les bons headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...response.headers,
            'X-Powered-By': 'Cloudflare Workers + GitHub Actions',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }
      
      // Fallback vers index.html pour les SPA routes
      const indexResponse = await fetch('https://${repoOwner.toLowerCase()}.github.io/${repoName}/');
      return new Response(indexResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Powered-By': 'Cloudflare Workers + GitHub Actions'
        }
      });
      
    } catch (error) {
      return new Response('Site en cours de déploiement...', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '60'
        }
      });
    }
  }
};`;
}

// Ajouter GitHub Action pour le déploiement automatique
async function addGitHubAction(repoName, repoOwner, githubToken, accountId, apiToken) {
  const actionYml = `name: Deploy to GitHub Pages + Cloudflare

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: 'latest'
          extended: true
          
      - name: Build site
        run: |
          npm run build:css
          npm run build:js
          hugo --gc --minify
          
      - name: Setup Pages
        uses: actions/configure-pages@v3
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: './public'
          
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
`;

  // Créer le fichier workflow
  const workflowContent = btoa(unescape(encodeURIComponent(actionYml)));
  
  const createWorkflowResponse = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/.github/workflows/deploy.yml`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': CONFIG.USER_AGENT
      },
      body: JSON.stringify({
        message: '🤖 Auto-déploiement GitHub Actions + Cloudflare',
        content: workflowContent
      })
    }
  );

  if (!createWorkflowResponse.ok) {
    const error = await createWorkflowResponse.json();
    throw new Error(`Erreur création workflow: ${error.message}`);
  }

  console.log('✅ GitHub Action ajoutée');
}

// Déclencher GitHub Action manuellement
async function triggerGitHubAction(repoName, repoOwner, githubToken) {
  try {
    const triggerResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/deploy.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
          'User-Agent': CONFIG.USER_AGENT
        },
        body: JSON.stringify({
          ref: 'main'
        })
      }
    );

    console.log('✅ Premier build déclenché');
  } catch (error) {
    console.warn('⚠️ Trigger manuel échoué (le push va déclencher automatiquement)');
  }
}

// ===================================================================
// REGISTRY
// ===================================================================

async function handleListSites(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Méthode non autorisée' }, 405, corsHeaders);
  }

  try {
    const sites = await getSitesFromRegistry(env);
    return jsonResponse({ 
      success: true, 
      sites,
      count: Object.keys(sites).length 
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Erreur récupération sites:', error);
    return jsonResponse({ 
      error: 'Erreur récupération des sites' 
    }, 500, corsHeaders);
  }
}

async function saveSiteToRegistry(siteId, siteData, env) {
  try {
    const currentSites = await getSitesFromRegistry(env);
    currentSites[siteId] = siteData;
    
    await env.SITES_REGISTRY.put('sites', JSON.stringify(currentSites));
    console.log(`💾 Site ${siteId} enregistré dans le registry`);
  } catch (error) {
    console.error('⚠️ Erreur sauvegarde registry:', error.message);
    throw error;
  }
}

async function getSitesFromRegistry(env) {
  try {
    const sitesData = await env.SITES_REGISTRY.get('sites');
    return sitesData ? JSON.parse(sitesData) : {};
  } catch (error) {
    console.error('⚠️ Erreur lecture registry:', error.message);
    return {};
  }
}

// ===================================================================
// UTILITAIRES
// ===================================================================

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 
      'Content-Type': 'application/json', 
      ...headers 
    }
  });
}
