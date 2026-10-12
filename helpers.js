/* ============================================================
   helpers.js — توابع مشترک همه ماژول‌ها  |  v1.0.0
============================================================ */
(function(){
  'use strict';

  if(window.KodalHelpers && window.KodalHelpers.__loaded) return;

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

  function fa2en(s){
    return String(s ?? '')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  function toFa(input){
    if(input == null) return input;
    return String(input).replace(/[0-9]/g, d => FA_DIGITS[Number(d)]);
  }

  function norm(x){
    return fa2en(String(x ?? ''))
      .replace(/\u200c|\u200f|\u200e/g,'')
      .replace(/[يى]/g,'ی').replace(/[ك]/g,'ک')
      .replace(/[ۀة]/g,'ه').replace(/[أإٱآ]/g,'ا')
      .replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ی')
      .replace(/[\u064B-\u0652\u0640]/g,'')
      .replace(/[()（）\[\]]/g,'')
      .replace(/[،,:;٫.]+/g,'')
      .replace(/\s+/g,'')
      .toLowerCase();
  }

  function toNum(x){
    if(x == null) return null;
    let s = fa2en(String(x).trim());
    if(!s) return null;
    const neg = /^\(.*\)$/.test(s) || s.includes('−') || /^-/.test(s);
    s = s.replace(/[()−\-–—]/g,'').replace(/[٬،,]/g,'').replace(/[^\d.]/g,'');
    if(!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  const toman = x => {
    if(x == null) return '—';
    const b = x / 10000;
    if(Math.abs(b) < 1){
      return '<bdi dir="ltr">' + toFa(Math.round(x / 10).toLocaleString('en-US')) + ' M</bdi>';
    }
    return '<bdi dir="ltr">' + toFa(Math.round(b).toLocaleString('en-US')) + ' B</bdi>';
  };

  const tomanText = x => {
    if(x == null) return '—';
    const b = x / 10000;
    if(Math.abs(b) < 1) return toFa(Math.round(x / 10).toLocaleString('en-US')) + ' M';
    return toFa(Math.round(b).toLocaleString('en-US')) + ' B';
  };

  const pct  = x => x == null ? '—' : toFa((x * 100).toFixed(1)) + '٪';
  const num2 = x => x == null ? '—' : toFa(x.toFixed(2));
  const ratio = (a, b) => (a != null && b != null && b !== 0) ? a / b : null;

  function formatNumberInput(value){
    const clean = fa2en(String(value)).replace(/[^\d]/g, '');
    if(!clean) return '';
    const withComma = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return toFa(withComma);
  }

  const PERIOD_NAMES = ['دوره جاری','دوره مشابه سال قبل','سال مالی قبل','دوره ۴','دوره ۵'];

  window.KodalHelpers = Object.assign(window.KodalHelpers || {}, {
    __loaded: true,
    fa2en, toFa, norm, toNum,
    escapeHtml,
    toman, tomanText, pct, num2, ratio,
    formatNumberInput,
    PERIOD_NAMES,
    FA_DIGITS,
  });

  window.toFa = window.toFa || toFa;
  window.fa2en = window.fa2en || fa2en;

  console.log('%c🔧 helpers.js v1.0.0 لود شد', 'color:#8b5cf6;font-weight:bold');
})();