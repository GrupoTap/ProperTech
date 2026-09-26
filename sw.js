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
const CACHE = CACHE_BASE + 'v115';  // 26/09/2026 — par do PCF_V113 (PCF estável: splash, fila persist-first, Background Sync, mapa com satélite). Sem bump, o celular serve o V112 do cache.
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
//        PCF_V112 ↔  propertech-v114  (21/09 — o documento volta a começar no DOCTYPE)
//        PCF_V113 ↔  propertech-v115  (26/09 — PCF estável + Background Sync + Leaflet no shell)
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
async function postarGas(url, corpo, tetoMs) {
  const ctl = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(tetoMs) : undefined;
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(corpo), signal: ctl });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch (e) {}
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

async function drenarTudo() {
  const t0 = Date.now();
  const placar = { n: 0, falhaRede: false, sobrou: false, adiado: false };
  const dbc = await idbAbrir('proper_pcf_idb', 'photos');
  if (!dbc) return placar;
  let cfg = null;
  try { cfg = await rq(dbc.transaction('photos', 'readonly').objectStore('photos').get('cfg::gas')); }
  finally { try { dbc.close(); } catch (e) {} }
  if (!cfg || !cfg.url || !cfg.key) return placar;     // a página ainda não abriu nesta versão
  const a = await comLock('proper-forms-outbox', (tl) => drenarForms(cfg, t0, placar, tl));
  if (a && a.pulou) placar.adiado = true;
  const b = await comLock('proper-dq', () => drenarPcf(cfg, t0, placar));
  if (b && b.pulou) placar.adiado = true;
  if (placar.n) {
    try {
      const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      cs.forEach((c) => { try { c.postMessage({ tipo: 'proper-outbox-enviado', n: placar.n }); } catch (e) {} });
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
