/* ProperTech (PCF) — Service Worker
 * Estratégia:
 *   - Navegação/HTML  -> network-first (sempre busca a versão nova; cai no cache só offline)
 *   - Estáticos same-origin (GET) -> stale-while-revalidate (rápido + atualiza em 2º plano)
 *   - Cross-origin (ex.: GAS /exec em script.google.com) -> NUNCA intercepta: passa direto pra rede
 *   - Requisições não-GET (POST do pipeline/GAS) -> passam direto, nunca são cacheadas
 *
 * DISCIPLINA DE VERSÃO: bump em CACHE a cada deploy do app (v43 -> v44 ...).
 * O activate abaixo apaga qualquer cache antigo com prefixo 'propertech-'.
 */
const CACHE = 'propertech-v76'; // 31/07/2026 (v76): par do index PCF_V76 — FLUIDEZ (F1a: navegação com corrida rede×3s→cache). Anterior: par do index PCF_V74 + GAS v82 + PCM V102 — CADASTRO DE CLIENTE VIRA ATO DE ADMIN DENTRO DA OS: a seção "1. Dados do Cliente" fica somente-leitura quando a coleta acontece dentro de uma OS (era por ali que "Herculano Mineradora" nasceu — todo envio de visita disparava saveClient e o GAS inseria cliente novo ao não achar o nome); o payload passa a mandar origem=campo_os SEM campos cadastrais (o GAS v82 recusa o INSERT); botão "Solicitar correção" manda o pedido para o admin aprovar no PCM (com fila offline); e no fluxo AVULSO, cliente com nome parecido passa a exigir confirmação bloqueante antes de virar cadastro novo. Anterior: PCF_V73 (nada coletado se perde + PDF). Bump junto com cada deploy
const SCOPE_PREFIX = '/ProperTech/';
const APP_SHELL = [
  '/ProperTech/',
  '/ProperTech/index.html',
  '/ProperTech/manifest.webmanifest',
  '/ProperTech/jspdf.umd.min.js', // O1.4 (V61): jsPDF local no shell → gerar PDF offline
  '/ProperTech/icon-192.png',
  '/ProperTech/icon-512.png',
  '/ProperTech/icon-maskable-512.png',
  '/ProperTech/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => { /* algum asset pode não existir ainda; não bloquear a instalação */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('propertech-') && k !== CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só cuida do mesmo origin e da própria pasta; o resto (GAS, fontes, etc.) segue pra rede
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;
  if (!url.pathname.startsWith(SCOPE_PREFIX)) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    // V76 (F1a) — network-first COM CORRIDA de 3s contra o cache.
    // Antes: abrir o app esperava o index de ~750KB vir INTEIRO do GitHub Pages
    // antes de pintar qualquer coisa — em 3G de galpão, segundos de tela branca
    // (no pior caso o browser segura dezenas de segundos antes de "falhar").
    // Agora: se a rede não respondeu em 3s e HÁ cache, serve o cache na hora; a
    // rede CONTINUA em background e atualiza o cache para a PRÓXIMA abertura.
    // Sem cache ainda (1ª instalação), espera a rede normalmente.
    // ⚠ Isso NÃO muda a disciplina de versão: o bump do CACHE a cada deploy
    // continua obrigatório — a versão nova entra na abertura seguinte.
    event.respondWith((async () => {
      const cachedPromise = caches.match(req)
        .then((hit) => hit || caches.match('/ProperTech/index.html'))
        .catch(() => null);

      // rede: sempre atualiza o cache quando responder, mesmo que perca a corrida
      const networkPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        });

      const timer = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3000));
      const first = await Promise.race([networkPromise.catch(() => 'NETFAIL'), timer]);

      if (first !== 'TIMEOUT' && first !== 'NETFAIL') return first;  // rede chegou a tempo

      const cached = await cachedPromise;
      if (cached) {
        networkPromise.catch(() => {}); // segue atualizando em background, sem unhandled
        return cached;
      }
      // sem cache: só resta esperar a rede de verdade (1ª visita)
      return networkPromise.catch(() =>
        caches.match('/ProperTech/index.html').then((hit) => hit || Response.error())
      );
    })());
    return;
  }

  // estáticos: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Permite que a página force a ativação imediata de uma versão nova do SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
