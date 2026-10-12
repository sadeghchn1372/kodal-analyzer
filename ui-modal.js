/* ============================================================
   ui-modal.js — Modal زیبا برای confirm و prompt  |  v1.0.0
============================================================ */
(function(){
  'use strict';

  if(window.KodalUI && window.KodalUI.__loaded) return;

  const styleId = 'kodal-ui-modal-style';
  if(!document.getElementById(styleId)){
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .kui-overlay{
        position:fixed;inset:0;background:rgba(0,0,0,.55);
        display:none;align-items:center;justify-content:center;
        z-index:9999999;padding:20px;animation:kuiFadeIn .2s ease;
      }
      .kui-overlay.show{display:flex}
      @keyframes kuiFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes kuiSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      .kui-box{
        background:var(--card, #fff);color:var(--txt, #1f2937);
        border-radius:16px;padding:22px;max-width:440px;width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,.4);
        border:1px solid var(--line, #e5e7eb);
        animation:kuiSlideUp .25s cubic-bezier(0.34, 1.56, 0.64, 1);
        direction:rtl;
      }
      .kui-title{
        margin:0 0 10px;font-size:16px;font-weight:700;color:var(--txt, #1f2937);
        display:flex;align-items:center;gap:8px;
      }
      .kui-icon{font-size:22px;line-height:1}
      .kui-message{
        font-size:13.5px;color:var(--txt, #1f2937);line-height:1.9;margin:0 0 16px;
      }
      .kui-input{
        width:100%;padding:11px 14px;border-radius:10px;
        border:1px solid var(--line, #e5e7eb);
        background:var(--chart-bg, #f9fafb);color:var(--txt, #1f2937);
        font:inherit;direction:rtl;box-sizing:border-box;margin-bottom:16px;
      }
      .kui-input:focus{outline:2px solid var(--blue, #1769e0);border-color:var(--blue, #1769e0)}
      .kui-actions{display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap}
      .kui-btn{
        padding:10px 18px;border-radius:10px;font:inherit;font-weight:600;
        font-size:13.5px;cursor:pointer;border:0;transition:.15s;
      }
      .kui-btn:hover{transform:translateY(-1px)}
      .kui-btn-primary{background:var(--blue, #1769e0);color:#fff}
      .kui-btn-danger{background:var(--bad, #c62828);color:#fff}
      .kui-btn-ghost{
        background:transparent;border:1px solid var(--line, #e5e7eb);
        color:var(--txt, #1f2937);
      }
      .kui-btn-ghost:hover{border-color:var(--blue, #1769e0);color:var(--blue, #1769e0)}
      .kui-btn:focus{outline:2px solid var(--blue, #1769e0);outline-offset:2px}
    `;
    document.head.appendChild(style);
  }

  function buildModal({title, icon, message, input, confirmText, cancelText, danger, hideCancel}){
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'kui-overlay';
      overlay.innerHTML = `
        <div class="kui-box" role="dialog" aria-modal="true">
          <h3 class="kui-title">
            ${icon ? `<span class="kui-icon">${icon}</span>` : ''}
            <span>${window.KodalHelpers.escapeHtml(title || '')}</span>
          </h3>
          ${message ? `<p class="kui-message">${message}</p>` : ''}
          ${input ? `<input class="kui-input" type="${input.type || 'text'}" value="${window.KodalHelpers.escapeHtml(input.value || '')}" placeholder="${window.KodalHelpers.escapeHtml(input.placeholder || '')}">` : ''}
          <div class="kui-actions">
            <button class="kui-btn ${danger ? 'kui-btn-danger' : 'kui-btn-primary'}" data-act="ok">
              ${window.KodalHelpers.escapeHtml(confirmText || 'تأیید')}
            </button>
            ${hideCancel ? '' : `<button class="kui-btn kui-btn-ghost" data-act="cancel">${window.KodalHelpers.escapeHtml(cancelText || 'انصراف')}</button>`}
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));

      const inputEl = overlay.querySelector('.kui-input');
      const okBtn = overlay.querySelector('[data-act="ok"]');
      const cancelBtn = overlay.querySelector('[data-act="cancel"]');

      function close(result){
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 250);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }

      function onKey(e){
        if(e.key === 'Escape') close(null);
        if(e.key === 'Enter') close(inputEl ? inputEl.value : true);
      }

      okBtn.onclick = () => close(inputEl ? inputEl.value : true);
      if(cancelBtn) cancelBtn.onclick = () => close(null);
      overlay.addEventListener('click', e => { if(e.target === overlay) close(null); });
      document.addEventListener('keydown', onKey);

      setTimeout(() => {
        if(inputEl){ inputEl.focus(); inputEl.select(); }
        else { okBtn.focus(); }
      }, 50);
    });
  }

  async function confirmBox(opts){
    if(typeof opts === 'string') opts = { message: opts };
    const res = await buildModal({
      title: opts.title || 'تأیید عملیات',
      icon: opts.icon || (opts.danger ? '⚠️' : '❓'),
      message: opts.message || '',
      confirmText: opts.confirmText || 'تأیید',
      cancelText: opts.cancelText || 'انصراف',
      danger: !!opts.danger,
    });
    return res === true;
  }

  async function promptBox(opts){
    if(typeof opts === 'string') opts = { message: opts };
    const res = await buildModal({
      title: opts.title || 'ورود مقدار',
      icon: opts.icon || '✏️',
      message: opts.message || '',
      input: {
        value: opts.value || '',
        placeholder: opts.placeholder || '',
        type: opts.type || 'text',
      },
      confirmText: opts.confirmText || 'تأیید',
      cancelText: opts.cancelText || 'انصراف',
    });
    if(res === null) return null;
    return String(res);
  }

  async function alertBox(opts){
    if(typeof opts === 'string') opts = { message: opts };
    await buildModal({
      title: opts.title || 'پیام',
      icon: opts.icon || 'ℹ️',
      message: opts.message || '',
      confirmText: opts.confirmText || 'باشه',
      hideCancel: true,
    });
  }

  window.KodalUI = {
    __loaded: true,
    confirm: confirmBox,
    prompt: promptBox,
    alert: alertBox,
  };

  console.log('%c🎨 ui-modal.js v1.0.0 لود شد', 'color:#ec4899;font-weight:bold');
})();