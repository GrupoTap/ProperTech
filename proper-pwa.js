/* ProperTech — bootstrap PWA (registro do SW + affordance de instalação)
 * Autossuficiente: injeta o próprio CSS, não depende de libs, não usa <form>.
 * Android/Chrome: captura beforeinstallprompt e mostra botão "Instalar app".
 * iOS (sem prompt): mostra botão que abre instruções "Compartilhar → Adicionar à Tela de Início".
 * Some quando já está instalado (display-mode: standalone).
 */
(function () {
  'use strict';

  // 1) Registro do service worker (escopo automático = pasta do arquivo)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: '/ProperTech/' })
        .then(function (reg) { ligarAtualizacao(reg); })
        .catch(function (e) { console.warn('[PWA] registro do SW falhou:', e && e.message); });
    });
  }

  /* ══ V90 (S3) — CANAL DE ATUALIZACAO ═════════════════════════════════════
     O listener `SKIP_WAITING` existe no sw.js desde sempre e era CODIGO MORTO:
     nenhum `postMessage`, `updatefound`, `controllerchange` ou
     `registration.update()` existia no app.

     Consequencia em campo, medida na auditoria de 16/08: o index.html tem ~1 MB
     e a navegacao e network-first com corrida de 3 s. Em 3G de galpao a rede
     raramente ganha, entao serve-se o cache antigo e a versao nova entra na
     abertura SEGUINTE. Se o tecnico abre o app uma vez por dia, a correcao
     urgente chega no dia seguinte, e nao havia como forcar.

     A faixa e dispensavel de proposito: ninguem interrompe uma coleta porque o
     app quer atualizar. Quem decide o momento e o tecnico. */
  function ligarAtualizacao(reg) {
    if (!reg) return;
    var recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recarregando) return;
      recarregando = true;
      location.reload();
    });
    reg.addEventListener('updatefound', function () {
      var novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', function () {
        // `controller` presente = ja havia uma versao servindo. Sem ele e a
        // primeira instalacao, e ai nao ha nada a avisar.
        if (novo.state === 'installed' && navigator.serviceWorker.controller) faixa(novo);
      });
    });
    var procurar = function () { try { reg.update(); } catch (e) {} };
    setInterval(procurar, 3600000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') procurar();
    });
  }

  function faixa(sw) {
    if (document.getElementById('pcfAtualiza')) return;
    var d = document.createElement('div');
    d.id = 'pcfAtualiza';
    d.setAttribute('style',
      'position:fixed;left:12px;right:12px;z-index:2147483000;' +
      'bottom:calc(12px + env(safe-area-inset-bottom, 0px));' +
      'background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;' +
      'padding:12px 14px;box-shadow:0 8px 28px rgba(15,23,42,.25);display:flex;' +
      'align-items:center;gap:10px;font:14px/1.35 Inter,system-ui,sans-serif');
    d.innerHTML =
      '<span style="flex:1">Versão nova disponível.<br>' +
        '<small style="color:#64748b">Atualiza em 2 segundos, sem perder o que está preenchido.</small></span>' +
      '<button type="button" id="pcfAtualizaNao" style="min-height:44px;padding:0 10px;background:none;' +
        'border:0;color:#64748b;font:13px Inter,system-ui,sans-serif;cursor:pointer">Agora não</button>' +
      '<button type="button" id="pcfAtualizaSim" style="min-height:44px;padding:0 14px;border:0;' +
        'border-radius:10px;background:var(--accent,#C0392B);color:#fff;' +
        'font:700 14px Inter,system-ui,sans-serif;cursor:pointer">Atualizar</button>';
    document.body.appendChild(d);
    document.getElementById('pcfAtualizaNao').addEventListener('click', function () { d.remove(); });
    document.getElementById('pcfAtualizaSim').addEventListener('click', function () {
      d.remove();
      try { sw.postMessage('SKIP_WAITING'); } catch (e) { location.reload(); }
    });
  }

  // 2) Estado
  var deferredPrompt = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;
  var isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (isStandalone) return; // já instalado: nada a fazer

  // 3) Estilos + botão
  var css = document.createElement('style');
  css.textContent =
    '#pwaInstallBtn{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
    'z-index:99999;display:none;align-items:center;gap:8px;padding:11px 18px;border:none;' +
    'border-radius:999px;background:var(--accent,#C0392B);color:#fff;font:600 14px/1 Inter,system-ui,sans-serif;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer}' +
    '#pwaInstallBtn:active{opacity:.85}' +
    '#pwaIosSheet{position:fixed;inset:0;z-index:100000;display:none;background:rgba(0,0,0,.6);' +
    'align-items:flex-end;justify-content:center}' +
    '#pwaIosSheet .box{background:#1f2937;color:#f9fafb;width:100%;max-width:480px;border-radius:16px 16px 0 0;' +
    'padding:20px 22px 28px;font:400 15px/1.5 Inter,system-ui,sans-serif}' +
    '#pwaIosSheet h3{margin:0 0 10px;font-size:16px}' +
    '#pwaIosSheet ol{margin:8px 0 16px;padding-left:20px}' +
    '#pwaIosSheet button{width:100%;padding:12px;border:none;border-radius:10px;' +
    'background:var(--accent,#C0392B);color:#fff;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'pwaInstallBtn';
  btn.type = 'button';
  btn.innerHTML = '⬇️ Instalar app';
  document.body.appendChild(btn);

  // 4) Android/Chrome: prompt nativo
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    btn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', function () {
    btn.style.display = 'none';
    deferredPrompt = null;
  });

  // 5) iOS: sem prompt → instruções manuais
  if (isiOS && !isStandalone) {
    btn.style.display = 'flex';
    var sheet = document.createElement('div');
    sheet.id = 'pwaIosSheet';
    sheet.innerHTML =
      '<div class="box"><h3>Instalar o ProperTech</h3>' +
      '<ol><li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta ↑).</li>' +
      '<li>Escolha <b>Adicionar à Tela de Início</b>.</li>' +
      '<li>Confirme em <b>Adicionar</b>.</li></ol>' +
      '<button type="button" id="pwaIosClose">Entendi</button></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (ev) {
      if (ev.target === sheet || ev.target.id === 'pwaIosClose') sheet.style.display = 'none';
    });
  }

  // 6) Clique
  btn.addEventListener('click', function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; btn.style.display = 'none'; });
    } else if (isiOS) {
      var s = document.getElementById('pwaIosSheet');
      if (s) s.style.display = 'flex';
    }
  });
})();
