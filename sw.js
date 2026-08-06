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
const CACHE = 'propertech-v83'; // 06/08/2026 (V83): par do PCF V83 — L-2 e L-7 do teste hard. (L-2) a supressão do os_id por incoerência OS×cliente deixa de ser MUDA: pgpOsIdSeguro passa a avisar na tela nomeando os dois clientes (dedup por par OS×cliente, porque a função tem 9 call sites e alguns rodam em laço de render), e o envio de preventiva E de inspeção ganha tripwire — entrando por tarefa de OS e saindo sem os_id, o técnico precisa confirmar que aceita salvar AVULSA. Sem isso a coleta gravava como avulsa, o autoCompletarTarefa do GAS retornava cedo e a tarefa do pipeline ficava aberta para sempre, com toast de sucesso e só um console.warn. (L-7) o agrupamento por fase do pfLoadPipeline passa a ter a CAMADA como primeira chave: o GAS v89 já devolve ordenado por Camada_Ordem, mas o front REFAZIA a ordem olhando só Fase_Ordem e a camada 2 (que recomeça a numeração de fase em 1) era desenhada NO MEIO da camada 1. A chave do grupo virou camada+fase porque duas camadas podem ter fase de mesmo nome e antes se fundiam num grupo só. OS de camada única renderiza IDÊNTICO à V82. Anterior: propertech-v82. // 05/08/2026 (V82): timeout nas ESCRITAS (_pgpFetchComRetry_ chamava fetch sem signal), fila crítica deixa de RECUSAR dado do técnico (as 3 guardas dos callers descartavam o payload; agora só o teto de BYTES barra) e tratador global de erro. Anterior: propertech-v81. // 04/08/2026 (v80): par do PCF V80 — P1 CORREÇÕES + P2 VISUALIZAÇÃO + P3 PRAZOS + INSPEÇÃO AVULSA. (C1) _pfOsCliente canônico separado do rótulo _pfOsNome: o PCF usava "Cliente · TIPO_OS" como se fosse o nome do cliente nos 3 caminhos de escrita, criando cliente e pasta duplicados e — pior — fazendo pgpOsIdSeguro nunca casar e SUPRIMIR o os_id. (A1) novaColeta passa a zerar _pgpOSInspecaoPromise: ESTA era a lacuna G6 — da 2ª coleta em diante, na mesma sessão, TODA foto/PDF ia para _SEM_OS. (A2) pgpEnviarGS garante a OS de inspeção ANTES de montar o payload (coleta sem foto e sem PDF saía órfã; o GAS só tinha fallback no savePreventiva). (A3) categoria do PDF por tipo de visita. (A4) os 9 call sites de pgpOsIdSeguro passam o cliente do PAINEL — o parâmetro era código morto e a guarda comparava sempre o painel 0. (A5) recarimbo do os_id no flush da fila de Drive, com data_ref = dia da COLETA: o vazio ficava gravado para sempre e partia a mesma inspeção em duas pastas. (A6) numero_os da INS- no PDF. (C2) textos honestos de fechar_pipeline + selo 🏁 de etapa encerrada + a tela nomeia as tarefas que seguram a OS. (ADM) gate único em pfBuildCard: tarefa de adm aparece TRAVADA, nunca escondida (esconder faria "X de Y" divergir entre PCF e PCM). (K2) tela de OS compacta com busca, ordenação Fila/Prazo/Minhas persistida e card com prioridade, posição na fila, dias, estágio e progresso. ─── v81 (04/08 noite, RODADA CORRETIVA sobre os 8 achados de campo): tarefa de INSPEÇÃO deixa de abrir marcada como PREVENTIVA (o ramo de inspeção do pfAbrirForm DECLARAVA o tipo e nunca o APLICAVA, e como _pgpTipoVisita é global bastava a sessão ter passado por uma preventiva); histórico deixa de dizer 'offline' quando o servidor só está lento (2 tentativas, 15s, e o motivo REAL na tela); histerese no indicador de conexão (uma miniatura decorativa que falhava apagava o chip do app inteiro, e conectar disparava a rajada que desconectava); rodapé e chip passam a ler a MESMA fonte no MESMO instante e a fila diz o que existe em vez de 'N/40'; poda das 4 filas + painel com idade, ação por item e blobs órfãos removidos; topo com ícones em posição FIXA, contador clicável e painel 'Faltando preencher' que leva até o campo; thumbs trazem a foto da visita anterior DO MESMO ITEM (getFotosItensMaquina, base64 por LGPD, cache 30d). Anterior: PCF_V80. Bump junto com cada deploy
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
