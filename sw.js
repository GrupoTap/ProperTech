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
const CACHE_BASE = 'propertech-';
const CACHE = CACHE_BASE + 'v92';  // v92 (21/08/2026) — PCF_V91: em_execucao + trava de subsistema.
// 🔴 ATENÇÃO À NUMERAÇÃO — ELA NÃO BATE COM A DO PCF, E ISSO É PROPOSITAL.
//    Desde o conserto do desencontro de 16/08 o sw anda UM À FRENTE do arquivo:
//        PCF_V90  ↔  propertech-v91   (deploy de 19/08)
//        PCF_V91  ↔  propertech-v92   (este)
//    Quem "corrigir" isto para propertech-v91 achando que alinha as versões
//    reintroduz o pior modo de falha deste arquivo: a chave ficaria IGUAL à do
//    deploy anterior, o activate não apagaria nada, e o técnico continuaria
//    abrindo a V90 do cache com a V91 já publicada no GitHub — sem erro nenhum
//    na tela. A regra real é "chave NOVA a cada deploy", não "chave igual à do
//    arquivo".
// ⚠ O BUMP AQUI NÃO É OPCIONAL. Sem ele o service worker continua servindo o
//    index.html em cache e a correção do pdf_uid não chega ao aparelho do
//    técnico — o PWA seguiria duplicando PDF por dias, com o arquivo novo já
//    publicado no GitHub. É a mesma razão pela qual a chave legada da API só
//    pode ser aposentada DEPOIS que o Logger parar de acusá-la.
// 🔑 De quebra, fecha o desencontro registrado em 16/08: o index dizia PCF_V89
//    e o sw dizia v90. Agora index = PCF_V90 e sw = propertech-v91.

// ⚠ V90 (S2) — O FILTRO ANTIGO APAGAVA O CACHE DO BETA.
// Era `k.startsWith('propertech-')`, e 'propertech-beta-v90b2' casa com isso.
// Enquanto beta e producao estao em origens diferentes o Cache Storage nem
// enxerga um o do outro; no dia em que dividirem uma origem, o proximo bump
// daqui deixava o beta sem offline. O README do beta descrevia isto invertido.
const doAmbiente = (k) => k.startsWith(CACHE_BASE) && !k.startsWith(CACHE_BASE + 'beta-');
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
  // ⚠ V90 (S1) — NAO PONHA UM .catch(() => {}) AQUI DE NOVO.
  // cache.addAll e ATOMICO. Ate a V89 a falha era engolida, o skipWaiting
  // rodava mesmo assim e o activate apagava o cache anterior: um unico 404 no
  // deploy deixava TODO tecnico sem app offline, em silencio. Falhar alto
  // preserva o cache que ja funciona.
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch((e) => {
        console.error('[SW] install FALHOU — deploy incompleto? O cache anterior fica intacto.', e);
        throw e;
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => doAmbiente(k) && k !== CACHE)
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
