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
const CACHE = 'propertech-v77'; // 31/07/2026 (v77): par do index PCF_V77 — OFFLINE-FIRST HONESTO. (F1) MODO OFFLINE DELIBERADO: botão 📴 no header + barra fixa no rodapé; com ele ligado nenhuma requisição sai do aparelho (o gate está em _pgpFetchComRetry_, choke point de pfGet e pgpPostJson), o ping e o poll de notificações param de acordar o rádio, e a volta para online acompanha o esvaziamento REAL da fila em vez de dar um '✅ pronto' instantâneo. Escape '🔓 Buscar mesmo assim' libera a rede por 1 min sem desligar o modo. (G1) as 3 ações do pipeline (assumir/liberar/confirmar) + resolverDecisao passam a enfileirar em QUALQUER falha — antes só com navigator.onLine===false, ou seja, só em modo avião: em galpão/portal cativo a ação sumia num alert. (G2) falha de rede agora DERRUBA o status (era um 'Sheets ✓' preso) e o timer de 90s virou heartbeat da fila. (G3/G4) o base64 dos anexos sai do localStorage de 5MB e vai para o IndexedDB (store 'photos' já existente, chave 'dq::', SEM bump de schema); teto 30→300; nada mais é descartado em silêncio — o que não couber vira lista visível no painel da fila. (G5) botão '📥 Preparar o dia'. (G8) registrarAbertura da tarefa manual enfileira. (G9) catálogo envelhece em 24h + selo de data. (G10) jsPDF não espera 15s pelo CDN offline. Anterior: PCF_V76 (fluidez). Bump junto com cada deploy
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
