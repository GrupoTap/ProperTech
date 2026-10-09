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
const CACHE = CACHE_BASE + 'v136';  // 09/10/2026 — par do PCF_V134 (câmera dentro do PCF: o Android não fecha mais o app ao fotografar). Sem bump, o celular serve o V131 do cache.
// antes: 'v133'  // 08/10/2026 — par do PCF_V131 (peças da OS: as peças da proposta aceita chegam marcadas). Sem bump, o celular serve o V130 do cache.
// antes: 'v132'  // 08/10/2026 — par do PCF_V130 (hub de cartões da coleta, atrás do Visual novo). Sem bump, o celular serve o V129 do cache.
// antes: 'v131'  // 08/10/2026 — par do PCF_V129 (visual novo por aparelho: Minhas OS, cartões, tema claro). Sem bump, o celular serve o V128 do cache.
// antes: 'v130'  // 07/10/2026 — par do PCF_V128 (base do Hub de Cartões: exportar/importar, trava do horímetro, histórico pelo Postgres). Sem bump, o celular serve o V127 do cache.
// antes: 'v129'  // 07/10/2026 — par do PCF_V127 (estabilidade do campo: foto/coleta/abertura do cache). Sem bump, o celular serve o V126 do cache.
// antes: 'v128'  // 07/10/2026 — par do PCF_V126 (botão 🏠 Menu → ProperHub no pipeline).
// antes: 'v124'  // 05/10/2026 — par do PCF_V122 (coleta segura, 1ª entrega).
// antes: 'v123'  // 02/10/2026 — par do PCF_V121 (campo 11 pontos).
// antes: 'v121'  // 30/09/2026 — par do PCF_V119 (crachá renovável). Sem bump, o celular serve o V118 do cache.
// antes: 'v119' — par do PCF_V117 (＋ Adicionar item)
// antes: 'v118'  // 29/09/2026 — par do PCF_V116 (campo simples). Sem bump, o celular serve o V115 do cache.
// antes: 'v117' (28/09 — par do PCF_V115, TURBO)
// antes: 'v116'  // 27/09/2026 — par do PCF_V114 (PWAIT v4: a guarda só protege o que o usuário vê).
// antes: 'v115'  // 26/09/2026 — par do PCF_V113 (PCF estável: splash, fila persist-first, Background Sync, mapa com satélite). Sem bump, o celular serve o V112 do cache.
// (nota anterior: v114 — 21/09/2026 — par do PCF_V112)  // 21/09/2026 — par do PCF_V112 (documento volta a começar no DOCTYPE). Sem bump, o celular do técnico serve o V111 quebrado do cache.  // 21/09/2026 — par do PCF_V111 (guarda de botão v2). Sem bump, o celular do técnico serve o V110 do cache. // v111 (11/09/2026) — PCF_V109, o PDF da preventiva que nao chegava (compress:true + PDF na fila do IndexedDB).
// (nota anterior:  // v110 (11/09/2026) — PCF_V108, a rodada Campo e Documentos (Externas/Oficina, Ir ate o cliente, presenca, carga do dia).
// (nota anterior:  // v108 (09/09/2026) — PCF_V106, a rodada do horímetro (C1/C5–C10).
// (nota herdada do v101, 28/08/2026 — PCF_V100: as portas que nasciam sem OS. ⚠ AQUELE BUMP É O QUE
//  ENTREGOU o `manifest.webmanifest` NOVO: ele está no APP_SHELL abaixo, e sem chave nova o start_url
//  velho (`?source=pwa`, sem modo) fica no cache do aparelho.)
// 🔴 ATENÇÃO À NUMERAÇÃO — ELA NÃO BATE COM A DO PCF, E ISSO É PROPOSITAL.
//    Desde o conserto do desencontro de 16/08 o sw anda UM À FRENTE do arquivo:
//        PCF_V90  ↔  propertech-v91   (deploy de 19/08)
//        PCF_V91  ↔  propertech-v92   (deploy de 21/08)
//        PCF_V92  ↔  propertech-v93   (deploy de 22/08)
//        PCF_V93  ↔  propertech-v94   (deploy de 24/08)
//        PCF_V94  ↔  propertech-v95   (deploy de 25/08)
//        PCF_V95  ↔  propertech-v96   (deploy de 25/08)
//        PCF_V96  ↔  propertech-v97   (deploy de 26/08)
//        PCF_V97  ↔  propertech-v98   (deploy de 27/08)
//        PCF_V98  ↔  propertech-v99   (deploy de 27/08)
//        PCF_V99  ↔  propertech-v100  (deploy de 27/08)
//        PCF_V100 ↔  propertech-v101  (deploy de 28/08)
//        PCF_V102 ↔  propertech-v103  (deploy de 01/09)
//        PCF_V103 ↔  propertech-v104  (este — salvamento, restauração de coleta, registro e OS)
//        PCF_V103 ↔  propertech-v105  (05/09 — 🔴 O MESMO app, um deploy NOVO: o C2 trocou a chave
//                                      da API DENTRO do index.html. O carimbo do app continua
//                                      PCF_V103 de propósito — rotação de chave não é versão nova
//                                      (foi assim nos 19 arquivos de 29/08). Por isso o sw fica
//                                      DOIS à frente do PCF, e não um: a regra é 'chave NOVA a cada
//                                      DEPLOY', nunca 'um à frente do arquivo'. Reusar 'v104' aqui
//                                      seria o pior modo de falha descrito logo abaixo — o activate
//                                      não apagaria nada e o técnico seguiria abrindo, do cache, o
//                                      index com a CHAVE VELHA, que morre no C4.)
//        PCF_V104 ↔  propertech-v106  (06/09 — os quatro consertos do laudo: pgpDoSearch,
//                                      pgpEnsureClientsCache, _pipeConferirPdfs, openModalOS)
//        PCF_V106 ↔  propertech-v108  (este — o horímetro: leitura real nasce vazia,
//                                        peça trocada ancora na visita, datas em dd/mm/aaaa)
//        PCF_V105 ↔  propertech-v107  (a vista "Meu dia": as MINHAS OS agrupadas
//                                      por Hoje/Amanhã/7 dias/Depois/Sem data. Zero GAS.)
//        PCF_V108 ↔  propertech-v110  (11/09 — a rodada Campo e Documentos)
//        PCF_V110 ↔  propertech-v112  (17/09 — os motores CFX + PWAIT, front puro)
//        PCF_V109 ↔  propertech-v111  (11/09 — o PDF da preventiva: compress:true + PDF na fila do IndexedDB)
//        PCF_V134 ↔  propertech-v136  (09/10 — câmera dentro do PCF; V132/V133 eram de rodadas paralelas)
//        PCF_V131 ↔  propertech-v133  (08/10 — peças da OS: proposta aceita → marcadas Trocar)
//        PCF_V130 ↔  propertech-v132  (08/10 — hub de cartões da coleta)
//        PCF_V129 ↔  propertech-v131  (08/10 — visual novo por aparelho)
//        PCF_V128 ↔  propertech-v130  (07/10 — base do Hub de Cartões; o V127 da pcf_estabilidade vai antes)
//        PCF_V112 ↔  propertech-v114  (21/09 — o documento volta a começar no DOCTYPE)
//        PCF_V113 ↔  propertech-v115  (26/09 — PCF estável + Background Sync + Leaflet no shell)
//        PCF_V114 ↔  propertech-v116  (27/09 — PWAIT v4: botão de janela fechada não fica preso)
//        PCF_V115 ↔  propertech-v117  (28/09 — TURBO: as leituras vêm do Postgres)
//        PCF_V116 ↔  propertech-v118  (29/09 — campo simples: rodapé único, marca de troca de peça)
//        PCF_V117 ↔  propertech-v119  (29/09 — ＋ Adicionar item na inspeção e na preventiva)
//        PCF_V118 ↔  propertech-v120  (29/09 — reabertura robusta: tstatus no formulário, linha do envio no card)
//        PCF_V119 ↔  propertech-v121  (30/09 — crachá renovável: o modo rápido não desliga sozinho em 12 h)
//        PCF_V121 ↔  propertech-v123  (02/10 — campo 11 pontos: a fila de DADOS também sobe com o app fechado)
//        PCF_V122 ↔  propertech-v124  (05/10 — coleta segura: 💾 Salvar com prova, selo único, Reenviar no card)
//        PCF_V123 ↔  propertech-v125  (06/10 — coleta segura 2a: 💾 Salvar também no servidor, selo ☁️)
//        PCF_V126 ↔  propertech-v128  (07/10 — botão 🏠 Menu no pipeline: volta ao menu do ProperHub; V124/V125 reservados e não construídos)
//        PCF_V127 ↔  propertech-v129  (07/10 — estabilidade: card/coleta não se perdem na câmera; a página abre do cache — PF127)
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
  '/ProperTech/apple-touch-icon.png',
  // V113 (M) — o mapa de marcar o ponto (Leaflet) mora no repo e no cache:
  // abre sem depender de CDN e, sem sinal, pelo menos o mapa-base carrega.
  '/ProperTech/vendor/leaflet/leaflet.js',
  '/ProperTech/vendor/leaflet/leaflet.css'
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
      .then(() => caches.open(CACHE).then((c) => c.put('/ProperTech/__pf127_nav_ts', new Response(String(Date.now())))).catch(() => {})) // PCF_V127 (PF127 D)
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

// PCF_V127 (PF127 D) — navegação servida do cache (uma chave, sem a query) + revalidação de no máximo 6 h.
const _PF127_NAV = '/ProperTech/index.html';
const _PF127_NAV_TS = '/ProperTech/__pf127_nav_ts';
const _PF127_NAV_IDADE = 6 * 3600 * 1000;
function _pf127NavRevalidar() {
  return caches.open(CACHE).then((c) => c.match(_PF127_NAV_TS).then((m) => (m ? m.text() : '0')).then((t) => {
    if (Date.now() - Number(t || 0) < _PF127_NAV_IDADE) return null;
    return fetch(_PF127_NAV, { cache: 'no-cache' }).then((res) => {
      // só uma resposta boa, do próprio site e sem redirecionamento entra no lugar da página (e só então a hora anda)
      if (res && res.ok && res.type === 'basic' && !res.redirected) return c.put(_PF127_NAV, res.clone()).then(() => c.put(_PF127_NAV_TS, new Response(String(Date.now()))));
      return null;
    });
  })).catch(() => null);
}
function _pf127NavDoCache(event) {
  // só decide servir do cache se HÁ cópia; sem ela, devolve false e o caminho antigo segue
  event.respondWith((async () => {
    let hit = null;
    try { const c = await caches.open(CACHE); hit = await c.match(_PF127_NAV); } catch (e) { hit = null; }
    if (hit) { event.waitUntil(_pf127NavRevalidar()); return hit; }
    return _pf127NavRede(event.request);
  })());
  return true;
}
// sem cópia no cache: o caminho de antes (corrida de 3 s), mas gravando na chave única
async function _pf127NavRede(req) {
  const networkPromise = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic' && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(_PF127_NAV, copy)).catch(() => {}); }
    return res;
  });
  const timer = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3000));
  const first = await Promise.race([networkPromise.catch(() => 'NETFAIL'), timer]);
  if (first !== 'TIMEOUT' && first !== 'NETFAIL') return first;
  const cached = await caches.match(_PF127_NAV, { ignoreSearch: true }).catch(() => null);
  if (cached) { networkPromise.catch(() => {}); return cached; }
  return networkPromise.catch(() => caches.match(_PF127_NAV, { ignoreSearch: true }).then((hit) => hit || Response.error()));
}
// PCF_V127 (PF127 D) — arquivos do APP_SHELL (jsPDF, Leaflet, ícones) saem do cache sem baixar de novo a cada
// abertura: o install de cada versão já os traz com cache:'reload'. O resto segue stale-while-revalidate.
const _PF127_SHELL = new Set(APP_SHELL.filter((u) => u !== _PF127_NAV));

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
    // ══════════════════════════════════════════════════════════════════════════════════════════
    // PCF_V127 (PF127 D) — A PÁGINA ABRE DO CACHE, COM UMA CHAVE SÓ.
    // 🕳 Medido: a corrida de 3 s abaixo para quando chegam os PRIMEIROS bytes, não o arquivo; com
    //    4G fraco mas vivo a rede sempre 'ganhava' e os 2,1 MB (639 KB comprimidos) desciam a CADA
    //    abertura e a cada volta de formulário. E cada URL com ?os_id=… virava uma cópia de 2,1 MB.
    // 🔑 Versão nova chega pelo bump deste arquivo (install pré-carrega o index com cache:'reload',
    //    o activate apaga o cache velho e a faixa 'Versão nova' do proper-pwa.js oferece recarregar).
    //    Sem bump, a página se revalida sozinha em 2º plano no máximo a cada 6 h.
    // ⚠ Sem cache (1ª visita / cache apagado) cai no caminho de antes, intacto, logo abaixo.
    // ══════════════════════════════════════════════════════════════════════════════════════════
    if (_pf127NavDoCache(event)) return;
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

  // PCF_V127 (PF127 D): arquivo do APP_SHELL = cache primeiro, sem revalidar (o bump traz o novo)
  if (_PF127_SHELL.has(url.pathname)) {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    })));
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


// ════════════════════════════════════════════════════════════════════════════
// V113 (F3) — BACKGROUND SYNC: o que ficou guardado no aparelho sobe mesmo com
// o app FECHADO ou congelado no 2º plano (Chrome/Samsung no Android).
// 🕳 O caso (Fernando, 24/09): "os relatórios não estão sendo enviados se o
//    app fica em segundo plano". Toda fila deste ecossistema só andava com a
//    PÁGINA viva e na frente. O service worker é o único contexto que o
//    navegador acorda sozinho quando a rede volta.
// O que ele drena (tudo já estava no IndexedDB, nada muda de lugar):
//   1. a fila dos FORMULÁRIOS (banco `properSafe`, store `outbox`);
//   2. o ESPELHO da fila de anexos do PCF (`proper_pcf_idb` → chaves `dqi::`),
//      com o corpo em `dq::` (foto/PDF em base64). Ao enviar, deixa `dqd::`
//      para a página tirar o item do índice dela sem chamar de "perdido".
// ⚠ A URL e a chave vêm de `cfg::gas`, gravado pela página. Nenhum literal aqui.
// ⚠ Quem está enviando é dito por um "arrendamento" (lease) no próprio registro,
//   lido e escrito na MESMA transação; e o lock `proper-*` evita dois drenos.
//   Mesmo se escapar, o servidor deduplica (form_uid, foto_uid, pdf_uid).
// ⚠ iPhone não tem Background Sync: lá a página segura a tela acesa e diz ao
//   técnico para manter o app aberto até o ✓.
// ════════════════════════════════════════════════════════════════════════════
const SYNC_TAG = 'proper-outbox';
const LEASE_MS = 150000;
const ORCAMENTO_MS = 150000;   // o navegador corta o evento em poucos minutos

function idbAbrir(nome, exigirStore) {
  return new Promise((res) => {
    try {
      let criou = false;
      const rq = indexedDB.open(nome);
      rq.onupgradeneeded = (e) => { criou = true; try { e.target.transaction.abort(); } catch (x) {} };
      rq.onsuccess = (e) => {
        const db = e.target.result;
        if (criou || (exigirStore && !db.objectStoreNames.contains(exigirStore))) { try { db.close(); } catch (x) {} return res(null); }
        res(db);
      };
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function rq(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
// (auditoria 26/09) ESPERA a trava por até 45 s em vez de desistir na hora: o
// sync é disparado justamente quando a página acabou de enfileirar e está
// enviando (com a trava). Desistir consumia o sync e ninguém tentava de novo.
// fn(true) = com a trava; fn(false) = sem Web Locks. Não conseguiu? {pulou:true}.
function comLock(nome, fn) {
  try {
    if (self.navigator && self.navigator.locks && self.navigator.locks.request) {
      const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const tmo = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) {} }, 45000);
      return self.navigator.locks.request(nome, ctl ? { signal: ctl.signal } : {}, (lk) => { clearTimeout(tmo); return fn(true); })
        .catch((e) => { clearTimeout(tmo); if (e && e.name === 'AbortError') return { pulou: true }; throw e; });
    }
  } catch (e) {}
  return fn(false);
}
let _v117SemEspelho = false;   // PCF_V115 (TURBO): alguma escrita drenada voltou sem espelho.ok
async function postarGas(url, corpo, tetoMs) {
  const ctl = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(tetoMs) : undefined;
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(corpo), signal: ctl });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch (e) {}
  if (d && d.status === 'ok' && !(d.espelho && d.espelho.ok === true)) {
    _v117SemEspelho = true;
    // o worker morre ocioso em ~30 s: o aviso também fica guardado (a página lê ao abrir)
    try { await (await caches.open('pc-turbo-sinal')).put('/__pc_janela__', new Response(String(Date.now() + 20 * 60000))); } catch (e) {}
  }
  return { ok: !!(d && (d.status === 'ok' || d.ok === true)), d, http: r.status };
}

async function drenarPcf(cfg, t0, placar) {
  const db = await idbAbrir('proper_pcf_idb', 'photos');
  if (!db) return;
  try {
    const chaves = await rq(db.transaction('photos', 'readonly').objectStore('photos')
      .getAllKeys(IDBKeyRange.bound('dqi::', 'dqi::￿')));
    for (const k of chaves) {
      if (Date.now() - t0 > ORCAMENTO_MS) { placar.sobrou = true; break; }
      // arrenda
      let st = db.transaction('photos', 'readwrite').objectStore('photos');
      const rec = await rq(st.get(k));
      if (!rec) continue;
      if (rec.lease_ate && rec.lease_ate > Date.now()) { placar.adiado = true; continue; }   // a página está enviando: tenta mais tarde
      if ((rec.sw_tentativas || 0) >= 6) continue;                                        // recusado 6×: a página decide (revisão)
      rec.lease_por = 'sw'; rec.lease_ate = Date.now() + LEASE_MS;
      await rq(st.put(rec, k));
      const body = Object.assign({}, rec.body || {});
      if (rec.blobKey) {
        const b64 = await rq(db.transaction('photos', 'readonly').objectStore('photos').get(rec.blobKey));
        if (!b64) {                                     // a página decide (pode ter ido por ela) — devolve o lease
          st = db.transaction('photos', 'readwrite').objectStore('photos');
          const r0 = await rq(st.get(k)); if (r0) { delete r0.lease_por; delete r0.lease_ate; await rq(st.put(r0, k)); }
          continue;
        }
        body[rec.b64Campo === 'base64' ? 'base64' : 'dataBase64'] = b64;
      }
      const tipo = String(body.tipo_visita || body.tipoVisita || rec.tipoVisita || '').toLowerCase();
      if (!body.os_id && (!tipo || tipo.indexOf('insp') >= 0) && (body.clientName || body.cliente)) {
        // precisa abrir a OS de inspeção antes (V78/A5): isso é com a página
        st = db.transaction('photos', 'readwrite').objectStore('photos');
        delete rec.lease_por; delete rec.lease_ate; await rq(st.put(rec, k));
        continue;
      }
      let res = null;
      try { res = await postarGas(cfg.url, Object.assign({ action: rec.action, key: cfg.key }, body), rec.b64Campo === 'base64' ? 120000 : 60000); }
      catch (e) { placar.falhaRede = true; }
      st = db.transaction('photos', 'readwrite').objectStore('photos');
      if (res && res.ok) {
        await rq(st.put({ ts: Date.now() }, 'dqd::' + rec.qid));
        await rq(st.delete(k));
        if (rec.blobKey) await rq(st.delete(rec.blobKey));
        placar.n++;
      } else {
        const atual = await rq(st.get(k));
        if (atual) { delete atual.lease_por; delete atual.lease_ate; atual.sw_erro = res ? String((res.d && (res.d.error || res.d.message)) || ('HTTP ' + res.http)).slice(0, 160) : 'rede';
                     if (res) atual.sw_tentativas = (atual.sw_tentativas || 0) + 1; await rq(st.put(atual, k)); }
        if (!res) break;                                // sem rede: para e deixa o navegador tentar de novo
      }
    }
  } finally { try { db.close(); } catch (e) {} }
}

async function fotosJson(db, job) {
  const congelado = (job.body && job.body.fotos_json) || [];
  try {
    if (!db.objectStoreNames.contains('photos')) return congelado;
    let ps = await rq(db.transaction('photos', 'readonly').objectStore('photos').getAll());
    ps = (ps || []).filter((p) => p && p.draftId === job.draftId).sort((a, b) => (a.photoId || 0) - (b.photoId || 0));
    if (!ps.length) return congelado;
    const leg = {}; (Array.isArray(congelado) ? congelado : []).forEach((c) => { if (c && c.foto_uid) leg[c.foto_uid] = c.caption; });
    const fu = String((job.body && job.body.form_uid) || '');
    return ps.map((p) => {
      const uid = p.fotoUid || ('f_' + fu + '_' + p.photoId);
      return { url: p.uploadUrl || null, fileName: p.fileName, secao: p.pointKey, caption: (leg[uid] || p.caption || ''),
               status: (p.uploadStatus === 'ok' ? 'ok' : 'pending'), foto_uid: uid, client_ts: p.clientTs || 0 };
    });
  } catch (e) { return congelado; }
}

async function drenarForms(cfg, t0, placar, temLock) {
  const db = await idbAbrir('properSafe', 'outbox');
  if (!db) return;
  try {
    const jobs = await rq(db.transaction('outbox', 'readonly').objectStore('outbox').getAll());
    const pend = (jobs || []).filter((j) => j && j.status === 'pending' && j.url && j.body)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    for (const j of pend) {
      if (Date.now() - t0 > ORCAMENTO_MS) { placar.sobrou = true; break; }
      if (j.nextRetryAt && j.nextRetryAt > Date.now()) continue;
      let st = db.transaction('outbox', 'readwrite').objectStore('outbox');
      const cur = await rq(st.get(j.jobId));
      if (!cur || cur.status !== 'pending') continue;
      // com a trava 'proper-forms-outbox' ninguém mais está enviando esta fila (form e PCF
      // também só enviam com ela): lease vivo = contexto que morreu no meio. Sem trava, respeita.
      if (!temLock && cur.lease_ate && cur.lease_ate > Date.now()) { placar.adiado = true; continue; }
      cur.lease_ate = Date.now() + LEASE_MS; cur.lease_por = 'sw';
      await rq(st.put(cur));
      const corpo = Object.assign({}, cur.body, { key: cfg.key });
      if (cur.kind === 'saveFormulario') corpo.fotos_json = await fotosJson(db, cur);
      let res = null;
      try { res = await postarGas(cur.url, corpo, cur.kind === 'salvarPdfDrive' ? 120000 : 60000); }
      catch (e) { placar.falhaRede = true; }
      const stores = db.objectStoreNames.contains('photos') ? ['outbox', 'photos'] : ['outbox'];
      const tx = db.transaction(stores, 'readwrite');
      const st2 = tx.objectStore('outbox');
      const now = await rq(st2.get(cur.jobId));
      if (!now) continue;
      delete now.lease_ate; delete now.lease_por;
      now.tries = (now.tries || 0) + 1; now.updatedAt = Date.now();
      if (res && res.ok) {
        now.status = 'done'; now.lastError = ''; now.nextRetryAt = 0; now.result = res.d; now.enviado_por = 'sw';
        if (now.kind !== 'saveFormulario') now.body = null;
        placar.n++;
        if (now.kind === 'salvarFotoForm' && now.photoId != null && stores.length > 1) {
          try { const sp = tx.objectStore('photos'); const p = await rq(sp.get(now.photoId)); if (p) { p.uploadStatus = 'ok'; p.uploadUrl = (res.d && res.d.url) || p.uploadUrl || ''; await rq(sp.put(p)); } } catch (e) {}
        }
      } else {
        now.lastError = res ? String((res.d && (res.d.message || res.d.error)) || ('resposta ' + res.http)) : 'sem conexão';
        now.status = now.tries >= 6 ? 'dead' : 'pending';
        now.nextRetryAt = now.status === 'pending' ? Date.now() + Math.min(Math.pow(2, now.tries) * 5000, 600000) : 0;
      }
      await rq(st2.put(now));
      if (!res) break;
    }
  } finally { try { db.close(); } catch (e) {} }
}

// ════════════════════════════════════════════════════════════════════════════
// PCF_V121 / propertech-v123 (02/10/2026) — A FILA DE DADOS TAMBÉM SOBE COM O APP FECHADO.
// 🕳 Fernando, 02/10: "demorando muito pra enviar e ainda continua exigindo que a tela esteja aberta".
//    Até a v121 o service worker só drenava formulários e anexos; a visita, as peças e a preventiva
//    (fila `pgp_pending_sync`, no localStorage — que o SW não lê) só andavam com a TELA viva.
// O PCF V121 espelha essa fila no IndexedDB (`sqi::<h>`, mesmo banco dos anexos). Aqui ela sobe em
// ORDEM ESTRITA (para no 1º que falhar: a peça nunca passa à frente da visita dela), com a trava
// 'proper-sq' (a tela usa a mesma) e respeitando o envio direto que a tela esteja fazendo (emVoo).
// Feito ⇒ grava `sqd::<h>` {id, ts} e a tela tira o item da fila dela (só se for a MESMA versão).
// Recusa do servidor (status ≠ ok): até 3 tentativas (uma por rodada); depois fica para a tela decidir (Conferir).
// A recusa trava SÓ os itens da MESMA máquina (a peça não passa à frente da visita dela); as outras máquinas
// seguem (auditoria 02/10: uma recusa não pode prender a fila inteira). Rede caída ou HTTP sem JSON param tudo.
// ════════════════════════════════════════════════════════════════════════════
async function drenarDados(cfg, t0, placar) {
  const db = await idbAbrir('proper_pcf_idb', 'photos');
  if (!db) return;
  try {
    const chaves = await rq(db.transaction('photos', 'readonly').objectStore('photos')
      .getAllKeys(IDBKeyRange.bound('sqi::', 'sqi::￿')));
    const recs = [];
    for (const k of chaves) {
      const r = await rq(db.transaction('photos', 'readonly').objectStore('photos').get(k));
      if (r) recs.push([k, r]);
    }
    const travados = {};
    const grupo = (r) => { const b = r.body || {}, m = b.machine || {};
      return String(b.machine_id || m.id || b.serial || m.serial || b.tag || m.tag || b.os_id || '*'); };
    recs.sort((a, b) => ((a[1].ordem || 0) - (b[1].ordem || 0)) || ((a[1].ts || 0) - (b[1].ts || 0)));
    for (const [k, r0] of recs) {
      if (Date.now() - t0 > ORCAMENTO_MS) { placar.sobrou = true; break; }
      const g = grupo(r0);
      if (travados['*'] || travados[g]) continue;
      let st = db.transaction('photos', 'readwrite').objectStore('photos');
      const rec = await rq(st.get(k));
      if (!rec) continue;
      if (rec.emVoo && Date.now() - rec.emVoo < 180000) { placar.adiado = true; break; }   // a tela está enviando este agora
      if (rec.lease_ate && rec.lease_ate > Date.now()) { placar.adiado = true; break; }
      if (rec.sw_recusado) { travados[g] = 1; if (g === '*') break; continue; }              // recusado 3×: a tela decide (Conferir)
      rec.lease_por = 'sw'; rec.lease_ate = Date.now() + LEASE_MS;
      await rq(st.put(rec, k));
      let res = null;
      try { res = await postarGas(cfg.url, Object.assign({}, rec.body || {}, { action: rec.action, key: cfg.key }), 60000); }
      catch (e) { placar.falhaRede = true; }
      st = db.transaction('photos', 'readwrite').objectStore('photos');
      if (res && res.ok) {
        await rq(st.put({ id: rec.id, ts: rec.ts, action: rec.action, quando: Date.now() }, 'sqd::' + rec.h));
        await rq(st.delete(k));
        placar.n++;
      } else {
        const atual = await rq(st.get(k));
        if (atual) {
          delete atual.lease_por; delete atual.lease_ate;
          atual.sw_erro = res ? String((res.d && (res.d.error || res.d.message)) || ('HTTP ' + res.http)).slice(0, 160) : 'rede';
          const recusa = !!(res && res.d && res.d.status && res.d.status !== 'ok');
          if (recusa) { atual.sw_tentativas = (atual.sw_tentativas || 0) + 1; if (atual.sw_tentativas >= 3) atual.sw_recusado = true; }
          await rq(st.put(atual, k));
        }
        const recusou = !!(res && res.d && res.d.status && res.d.status !== 'ok');
        if (!recusou || g === '*') break;                        // rede/HTTP: para tudo · recusa sem máquina conhecida: para tudo
        travados[g] = 1;                                         // recusa: só a mesma máquina espera; as outras seguem
      }
    }
  } finally { try { db.close(); } catch (e) {} }
}

async function drenarTudo() {
  const t0 = Date.now();
  const placar = { n: 0, falhaRede: false, sobrou: false, adiado: false };
  const dbc = await idbAbrir('proper_pcf_idb', 'photos');
  if (!dbc) return placar;
  let cfg = null;
  try { cfg = await rq(dbc.transaction('photos', 'readonly').objectStore('photos').get('cfg::gas')); }
  finally { try { dbc.close(); } catch (e) {} }
  if (!cfg || !cfg.url || !cfg.key) return placar;     // a página ainda não abriu nesta versão
  const sq = await comLock('proper-sq', () => drenarDados(cfg, t0, placar));   // PCF_V121: visita/peças/preventiva primeiro
  if (sq && sq.pulou) placar.adiado = true;
  const a = await comLock('proper-forms-outbox', (tl) => drenarForms(cfg, t0, placar, tl));
  if (a && a.pulou) placar.adiado = true;
  const b = await comLock('proper-dq', () => drenarPcf(cfg, t0, placar));
  if (b && b.pulou) placar.adiado = true;
  if (placar.n) {
    try {
      const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      const semEsp = _v117SemEspelho;
      if (cs.some((c) => /\/ProperTech\//.test(c.url || ''))) _v117SemEspelho = false;   // só o PCF age no aviso
      cs.forEach((c) => { try { c.postMessage({ tipo: 'proper-outbox-enviado', n: placar.n, semEspelho: semEsp }); } catch (e) {} });
    } catch (e) {}
  }
  return placar;
}

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil((async () => {
    const p = await drenarTudo();
    if (p.sobrou) { try { await self.registration.sync.register(SYNC_TAG); } catch (e) {} }
    if (p.falhaRede) throw new Error('rede caiu no meio — o navegador tenta de novo');
    // (auditoria) a página estava enviando (trava ou lease): este sync NÃO pode ser
    // dado como cumprido — falhar faz o navegador tentar de novo mais tarde, e aí,
    // se a aba morreu no meio, o SW termina o serviço.
    if (p.adiado) throw new Error('outro contexto estava enviando — o navegador tenta de novo');
  })());
});
