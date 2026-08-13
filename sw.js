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
const CACHE = 'propertech-v89'; // 13/08/2026 (V89): par do PCF V89 — CARD TRAVADO EM "sincronizando" + PIPELINE DE OUTRA OS. (1) WebView sem AbortSignal.timeout ficava SEM TETO nenhum (a V82 dizia "segue sem teto, como antes" e era literal): Promise.race devolve o controle ao app no prazo. (1c) pgpPostJson ganhou 5o parametro opcional {timeoutMs} — options.__timeoutMs existia desde a V82 com ZERO call sites. (1d/3/4b/5) teto por tipo de chamada no lugar dos 45s x3 = 138,5s herdados do POST de coleta: leitura de pipeline 15s, assumirTarefa 25s, concluir 40s, item de fila 30s. (2) ANTI-CORRIDA: _pfOsId e global e mutavel e pfLoadPipeline tem await no meio — trocar de OS com requisicao em voo gravava a resposta da OS A sob a CHAVE da OS B em pf_pipeline_cache_v1, e o cache morno pinta antes da rede; agora o id e CONGELADO na requisicao e a resposta cruzada e descartada (inclusive conferindo o os_id do envelope, que o GAS sempre mandou e ninguem lia). (3) WATCHDOG: o selo "sincronizando" so saia quando a resposta chegasse; agora sai em 20s e o tecnico le o que esta acontecendo. (4) concluir pinta na hora (par do GAS v98 P-4, que passou a devolver a linha da tarefa) — o refresh soft CONTINUA por causa dos desbloqueios em cascata. PAR: GAS v98 (itens 4/4b degradam silencioso contra o v97). Anterior: propertech-v88. // 13/08/2026 (V88): par do PCF V88 — SPRINT DE FLUIDEZ + FEEDBACK DE ESPERA. Perf: debounce de 350ms no pgpSaveDraftAgora da delegacao global de change (flush imediato mantido em visibilitychange/pagehide e antes de todo envio); memo _pgpMaqIdx do parque local + debounce 250ms no autocomplete de serie/TAG; _pgpSimIdx passa a memoizar tambem cat/modelById/campos normalizados; pgpUpdateAdminLocal ganha modo de lote opcional (deferSave) + pgpFlushAdminLocal; proper_admin_v2 lido UMA vez ao abrir OS de N maquinas; contadores de fila em memoria (_pgpFilaCount) no lugar de ~8 JSON.parse por badge; busca de OS com debounce 200ms + teto de 60 cards; vazamento de listener do pfToggleNotif fechado; contagem de fotos do rascunho lida de rec.count (fallback antigo mantido); memo _pgpCatMemo do catalogo; miniaturas com width/height. Feedback: pfToast CRIADO (8 chamadas guardadas por typeof no pipeline nunca apareciam desde a V61); Reenviar agora com progresso real via pgpModoOffProgresso; #pgpSerialSearching no autocomplete/Enter de serie; contador foto N de M durante upload de tarefa; aviso durante a compressao da foto; _pgpGerarPdfConsolidadoBusy + botao no Consolidar PDFs; _comLoadingBtn_ em restaurarSessao/restoreDraft/pgpRegisterNew/salvarColeta/recarregar pipeline; trava do botao da preventiva movida para ANTES do tripwire + .is-busy; pgpTestGs(manual) com feedback so no toque. Anterior: propertech-v87. // 08/08/2026 (V87): par do PCF V87 + GAS v94 — ADM MULTI-APARELHO + ASSUMIR INSTANTANEO. (P1) assumir tarefa vira otimista TAMBEM online: lock local + re-render sem rede no clique (selo "sincronizando…"), POST confirma por tras; locked → rollback; falha → fila (V77 G1). GAS v94 devolve a linha da tarefa e o reload do pipeline vira background. (P2) o rodape de assinaturas e pgpAssinaturasCompletas passam a respeitar o guard de contexto (pgpAssinaturasContextoOk) — era o vazamento visto em campo: "✅ Luiz Ricardo" (Fundicao Realeza) em cima da OS da FERTEC; fallback do guard nega por padrao quando ha OS ativa sem carimbo. (P3) assinaturas voltam do Drive: getPreventivaDaOS?incluir_assinaturas (GAS v94) reidrata _PGP_ASSINATURAS com carimbo da OS aberta + origem:'drive' ("assinado em campo em <data>"); o PDF regenerado em outro aparelho sai com as assinaturas ORIGINAIS. (P4) fotos voltam do Drive: action nova getFotosDaVisita em duas marchas — thumbs repovoam o photoStore (driveStatus:'ok', fila de upload quieta, nunca sobrescreve foto local) e a imagem CHEIA vem por foto na geracao do PDF (pgpTrocarThumbsPorImagemCheia). (P5) o cenario da visita (v.scenario, GAS v93) e auto-selecionado no restore ANTES de repor as pecas — sem isso a tabela nao existia e a reposicao era no-op silencioso ("Faltam 17"). P3/P4 EXIGEM GAS v94 (degradam silencioso); P1/P2/P5 funcionam contra o v93. Anterior: propertech-v86. // 07/08/2026 (V86): par do PCF V86 + GAS v93 — a OS REABERTA volta com os dados. pgpRestaurarColetaGravada pede ao GAS (action nova getPreventivaDaOS) a coleta ja gravada da maquina NESTA OS e repoe horimetro real, data da leitura, observacoes, auxiliar/horas e a ACAO de cada peca (trocada/conferida/na) — o campo que nunca voltava do servidor e que faz pgpMaquinaPercent contar, por isso a coleta reabria 0%. Nunca sobrescreve campo com valor (mesma disciplina do svEl do MODO MERGE, V71). Contra um GAS v92 a chamada falha e o comportamento e o da V85 (abre em branco). ZERO mudanca no envio, no visit_id, na fila offline e no PDF — o desbloqueio do registro e o fechamento da OS sao do GAS v93 e valem para o celular que ja esta em campo. Anterior: propertech-v85. // 07/08/2026 (V85): par do PCF V85 — duas mudancas disjuntas. (A) "Preparar o dia" deixa de baixar TODAS as OS ativas: as candidatas passam a ser so as OS EXTERNAS ativas e o tecnico marca quais leva (painel #pfPrepararPainel, selecao persistida em pf_preparar_sel_v1). Ate a V84 o botao baixava tudo, gastando cache e rede com OS internas (a oficina tem wifi) e cortando no teto de 25 EM SILENCIO — o teto agora BLOQUEIA com o numero exato a desmarcar. A regra "e externa" virou helper unico (pfOsEhExterna), usado tambem por pfRenderOS: ela existia so la dentro e o Preparar o dia ignorava local_atendimento por completo. (B) abrir formulario de oficina deixa de disparar a caixa nativa "Sair do site?": a navegacao externa de pfAbrirForm grava o rascunho (autoSaveDraft, chave pgp_draft_v1) e liga _allowLeave — o beforeunload de setupBackGuard continua INTACTO para o botao voltar e para o reload, que sao saidas nao intencionais de verdade. ZERO mudanca de GAS nesta versao. Anterior: propertech-v84. // 07/08/2026 (V84): par do PCF V84 — o card da lista de OS deixa de CALCULAR o atraso sozinho e passa a LER `situacao`/`dias_na_fase`/`prazo_saida_iso` do GAS v91. Até a V83 a conta era `Date.now() > data_prevista`, ou seja, só a data digitada à mão: o Prazo_Estimado_Total do motor de caminho crítico ficava de fora e o “há Nd” contava desde a ABERTURA DA OS, não desde a entrada na etapa — o técnico e o admin chegavam a números diferentes para a MESMA OS. ⚠ O consertar-só-no-GAS não bastava: `getOS(com_fila)` NÃO passa pelo `_filaItem_` (monta campo a campo desde o v84), então os campos do quadro da oficina nunca chegavam aqui; o v91 resolve com o helper `_prazoSituacao_`, chamado dos dois lados. Entram os chips `⏱ Nd na etapa / meta Md`, `⏳ Nd na oficina` e `📅 dd/mm · faltam Nd | Nd de atraso` (com a ORIGEM do prazo no title — data do admin × motor × meta do tipo), mais o semáforo 🔴/🟡 no topo e na borda esquerda, na paleta ESCURA do PCF. ⚠ Degradação controlada: cache frio de `pf_os_cache_v1` gravado antes do v91 não tem `situacao` e o card volta ao render da V83 inteiro — nenhum campo novo é obrigatório e a lista NUNCA esconde uma OS por falta deles. Anterior: propertech-v83. // 06/08/2026 (V83): par do PCF V83 — L-2 e L-7 do teste hard. (L-2) a supressão do os_id por incoerência OS×cliente deixa de ser MUDA: pgpOsIdSeguro passa a avisar na tela nomeando os dois clientes (dedup por par OS×cliente, porque a função tem 9 call sites e alguns rodam em laço de render), e o envio de preventiva E de inspeção ganha tripwire — entrando por tarefa de OS e saindo sem os_id, o técnico precisa confirmar que aceita salvar AVULSA. Sem isso a coleta gravava como avulsa, o autoCompletarTarefa do GAS retornava cedo e a tarefa do pipeline ficava aberta para sempre, com toast de sucesso e só um console.warn. (L-7) o agrupamento por fase do pfLoadPipeline passa a ter a CAMADA como primeira chave: o GAS v89 já devolve ordenado por Camada_Ordem, mas o front REFAZIA a ordem olhando só Fase_Ordem e a camada 2 (que recomeça a numeração de fase em 1) era desenhada NO MEIO da camada 1. A chave do grupo virou camada+fase porque duas camadas podem ter fase de mesmo nome e antes se fundiam num grupo só. OS de camada única renderiza IDÊNTICO à V82. Anterior: propertech-v82. // 05/08/2026 (V82): timeout nas ESCRITAS (_pgpFetchComRetry_ chamava fetch sem signal), fila crítica deixa de RECUSAR dado do técnico (as 3 guardas dos callers descartavam o payload; agora só o teto de BYTES barra) e tratador global de erro. Anterior: propertech-v81. // 04/08/2026 (v80): par do PCF V80 — P1 CORREÇÕES + P2 VISUALIZAÇÃO + P3 PRAZOS + INSPEÇÃO AVULSA. (C1) _pfOsCliente canônico separado do rótulo _pfOsNome: o PCF usava "Cliente · TIPO_OS" como se fosse o nome do cliente nos 3 caminhos de escrita, criando cliente e pasta duplicados e — pior — fazendo pgpOsIdSeguro nunca casar e SUPRIMIR o os_id. (A1) novaColeta passa a zerar _pgpOSInspecaoPromise: ESTA era a lacuna G6 — da 2ª coleta em diante, na mesma sessão, TODA foto/PDF ia para _SEM_OS. (A2) pgpEnviarGS garante a OS de inspeção ANTES de montar o payload (coleta sem foto e sem PDF saía órfã; o GAS só tinha fallback no savePreventiva). (A3) categoria do PDF por tipo de visita. (A4) os 9 call sites de pgpOsIdSeguro passam o cliente do PAINEL — o parâmetro era código morto e a guarda comparava sempre o painel 0. (A5) recarimbo do os_id no flush da fila de Drive, com data_ref = dia da COLETA: o vazio ficava gravado para sempre e partia a mesma inspeção em duas pastas. (A6) numero_os da INS- no PDF. (C2) textos honestos de fechar_pipeline + selo 🏁 de etapa encerrada + a tela nomeia as tarefas que seguram a OS. (ADM) gate único em pfBuildCard: tarefa de adm aparece TRAVADA, nunca escondida (esconder faria "X de Y" divergir entre PCF e PCM). (K2) tela de OS compacta com busca, ordenação Fila/Prazo/Minhas persistida e card com prioridade, posição na fila, dias, estágio e progresso. ─── v81 (04/08 noite, RODADA CORRETIVA sobre os 8 achados de campo): tarefa de INSPEÇÃO deixa de abrir marcada como PREVENTIVA (o ramo de inspeção do pfAbrirForm DECLARAVA o tipo e nunca o APLICAVA, e como _pgpTipoVisita é global bastava a sessão ter passado por uma preventiva); histórico deixa de dizer 'offline' quando o servidor só está lento (2 tentativas, 15s, e o motivo REAL na tela); histerese no indicador de conexão (uma miniatura decorativa que falhava apagava o chip do app inteiro, e conectar disparava a rajada que desconectava); rodapé e chip passam a ler a MESMA fonte no MESMO instante e a fila diz o que existe em vez de 'N/40'; poda das 4 filas + painel com idade, ação por item e blobs órfãos removidos; topo com ícones em posição FIXA, contador clicável e painel 'Faltando preencher' que leva até o campo; thumbs trazem a foto da visita anterior DO MESMO ITEM (getFotosItensMaquina, base64 por LGPD, cache 30d). Anterior: PCF_V80. Bump junto com cada deploy
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
