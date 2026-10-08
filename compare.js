/* ============================================================
   compare.js — منطق تب «مقایسه شرکت‌ها»  |  v38
   وابسته به: app.js (window.KodalHelpers)
   تغییرات v38: چک لایسنس قبل از مقایسه
============================================================ */

(function(){
  'use strict';

  const H = window.KodalHelpers || {};
  const $ = id => document.getElementById(id);

  /* ---------- کمک‌کننده: خواندن ایمن رنگ‌ها ---------- */
  function _c(name){
    try{
      const fn = H && H[name];
      return typeof fn === 'function' ? fn() : '#888888';
    }catch(e){ return '#888888'; }
  }

  /* ---------- کمک‌کننده: تبدیل عدد به فرمت فارسی با کاما ---------- */
  function _fmtNumInput(value){
    const clean = H.fa2en(String(value || '')).replace(/[^\d]/g, '');
    if(!clean) return '';
    const withComma = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return H.toFa(withComma);
  }

  /* ---------- کمک‌کننده: نرمال‌سازی برای مقایسه ---------- */
  function _cmpVal(x){
    if(x == null || typeof x !== 'number' || !isFinite(x)) return null;
    return Math.round(x * 1e6) / 1e6;
  }

  /* ---------- رنگ‌های اختصاصی هر شرکت ---------- */
  const COMPANY_COLORS = ['#1769e0', '#10b981', '#f59e0b', '#8b5cf6'];

  /* ---------- State ---------- */
  let CMP_FILES = [];
  let CMP_RESULTS = null;
  const CMP_STORAGE_KEY = 'kodal_compare_v1';
  let CMP_SAVED = [];

  /* ---------- Storage ---------- */
  function loadCompareFromStorage(){
    try{
      const raw = localStorage.getItem(CMP_STORAGE_KEY);
      CMP_SAVED = raw ? JSON.parse(raw) : [];
    }catch(e){ CMP_SAVED = []; }
  }
  function saveCompareToStorage(){
    try{
      localStorage.setItem(CMP_STORAGE_KEY, JSON.stringify(CMP_SAVED));
      return true;
    }catch(e){
      if(e.name === 'QuotaExceededError' && window.showToast){
        window.showToast('⚠️ حافظه پر شده — قدیمی‌ها رو حذف کن', true);
      }
      return false;
    }
  }
  loadCompareFromStorage();

  /* ============================================================
     ۱. مدیریت لیست فایل‌ها
  ============================================================ */
  function renderCmpList(){
    const wrap = $('cmpListWrap');
    const list = $('cmpList');
    if(!wrap || !list) return;

    if(!CMP_FILES.length){
      wrap.style.display = 'none';
      list.innerHTML = '';
      updateGoButton();
      return;
    }
    wrap.style.display = 'block';

    list.innerHTML = CMP_FILES.map((item, i) => {
      const fileName = item.file ? item.file.name : (item._fromSaved ? '(ذخیره‌شده)' : '—');
      const symbolVal = (item.symbol || '').replace(/"/g,'&quot;');
      const priceVal = item.price ? _fmtNumInput(item.price) : '';
      const sharesVal = item.shares ? _fmtNumInput(item.shares) : '';
      const errorBadge = item.error
        ? `<span style="color:var(--bad);font-size:12px;flex-basis:100%">⚠️ ${item.error}</span>`
        : '';
      return `
        <div class="cmp-item">
          <span class="color-dot" style="background:${item.color}"></span>

          <label class="field-label">
            نماد
            <input class="symbol-input" type="text"
                   value="${symbolVal}"
                   placeholder="مثلاً: فولاد"
                   oninput="window.cmpUpdateSymbol(${i}, this.value)">
          </label>

          <label class="field-label">
            قیمت (ریال)
            <input class="price-input" type="text" inputmode="numeric"
                   value="${priceVal}"
                   placeholder="مثلاً: ۵,۲۰۰"
                   oninput="window.cmpUpdatePrice(${i}, this.value)">
          </label>

          <label class="field-label">
            تعداد سهام
            <input class="shares-input" type="text" inputmode="numeric"
                   value="${sharesVal}"
                   placeholder="مثلاً: ۵,۰۰۰,۰۰۰,۰۰۰"
                   oninput="window.cmpUpdateShares(${i}, this.value)">
          </label>

          <button class="remove-btn" onclick="window.cmpRemoveFile(${i})">✕ حذف</button>

          <span class="file-info">📄 ${fileName}</span>
          ${errorBadge}
        </div>
      `;
    }).join('');

    updateGoButton();
  }

  function updateGoButton(){
    const btn = $('cmpGo');
    if(!btn) return;
    const valid = CMP_FILES.filter(x => x.parsed).length;
    btn.disabled = valid < 2 || valid > 4;
    const saveBtn = $('cmpSaveBtn');
    if(saveBtn && !CMP_RESULTS){
      saveBtn.style.display = 'none';
    }
  }

  window.cmpUpdateSymbol = function(idx, value){
    if(!CMP_FILES[idx]) return;
    CMP_FILES[idx].symbol = String(value || '').trim();
  };

  window.cmpUpdatePrice = function(idx, value){
    if(!CMP_FILES[idx]) return;
    const num = H.toNum(value);
    CMP_FILES[idx].price = num;
    const inputs = document.querySelectorAll('.cmp-item .price-input');
    if(inputs[idx]){
      const caretEnd = inputs[idx].selectionStart === inputs[idx].value.length;
      inputs[idx].value = num ? _fmtNumInput(num) : '';
      if(caretEnd){
        try{ inputs[idx].setSelectionRange(inputs[idx].value.length, inputs[idx].value.length); }catch(_){}
      }
    }
  };

  window.cmpUpdateShares = function(idx, value){
    if(!CMP_FILES[idx]) return;
    const num = H.toNum(value);
    CMP_FILES[idx].shares = num;
    const inputs = document.querySelectorAll('.cmp-item .shares-input');
    if(inputs[idx]){
      const caretEnd = inputs[idx].selectionStart === inputs[idx].value.length;
      inputs[idx].value = num ? _fmtNumInput(num) : '';
      if(caretEnd){
        try{ inputs[idx].setSelectionRange(inputs[idx].value.length, inputs[idx].value.length); }catch(_){}
      }
    }
  };

  window.cmpRemoveFile = function(idx){
    CMP_FILES.splice(idx, 1);
    CMP_FILES.forEach((item, i) => {
      item.color = COMPANY_COLORS[i % COMPANY_COLORS.length];
    });
    renderCmpList();
  };

  /* ============================================================
     ۲. اضافه کردن فایل‌ها
  ============================================================ */
  async function addFiles(fileList){
    if(!fileList || !fileList.length) return;

    const errBox = $('cmpErr');
    if(errBox) errBox.style.display = 'none';

    const remaining = 4 - CMP_FILES.length;
    const files = Array.from(fileList).slice(0, remaining);

    for(const f of files){
      const idx = CMP_FILES.length;
      const color = COMPANY_COLORS[idx % COMPANY_COLORS.length];
      const defaultSymbol = f.name.replace(/\.[^.]+$/, '');

      const item = {
        file: f,
        symbol: defaultSymbol,
        price: null,
        shares: null,
        color: color,
        parsed: null,
        error: null,
      };
      CMP_FILES.push(item);
      renderCmpList();

      try{
        const lines = await H.getLines(f);
        if(!lines.length) throw new Error('خطی استخراج نشد');
        const parsed = H.parseItems(lines);
        const found = Object.keys(parsed).length;
        if(!found) throw new Error('قلمی شناسایی نشد');
        const maxPer = Math.max(...Object.values(parsed).map(a => a.length));
        parsed._periods = Math.min(Math.max(maxPer, 1), 5);
        CMP_FILES[idx].parsed = parsed;

        if(!CMP_FILES[idx].shares){
          const capital = parsed.capital?.[0];
          if(capital != null && capital > 0){
            CMP_FILES[idx].shares = capital * 1000;
          }
        }
      }catch(e){
        CMP_FILES[idx].error = e.message || 'خطا در پارس';
      }
      renderCmpList();
    }

    if(fileList.length > remaining && errBox){
      errBox.style.display = 'block';
      errBox.textContent = `حداکثر ۴ فایل مجازه. ${fileList.length - remaining} فایل نادیده گرفته شد.`;
    }
  }

  /* ============================================================
     ۳. دکمه‌ها
  ============================================================ */
  if($('cmpFiles')) $('cmpFiles').onchange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };
  if($('cmpAddBtn')) $('cmpAddBtn').onclick = () => $('cmpFiles').click();

  if($('cmpDrop')){
    ['dragover','dragenter'].forEach(ev => {
      $('cmpDrop').addEventListener(ev, e => {
        e.preventDefault();
        $('cmpDrop').classList.add('hover');
      });
    });
    ['dragleave','drop'].forEach(ev => {
      $('cmpDrop').addEventListener(ev, e => {
        e.preventDefault();
        $('cmpDrop').classList.remove('hover');
      });
    });
    $('cmpDrop').addEventListener('drop', e => {
      addFiles(e.dataTransfer.files);
    });
  }

  if($('cmpClearBtn')) $('cmpClearBtn').onclick = () => {
    if(!CMP_FILES.length) return;
    if(!confirm('همه فایل‌ها پاک شن؟')) return;
    CMP_FILES = [];
    CMP_RESULTS = null;
    renderCmpList();
    const out = $('cmpOut');
    if(out) out.style.display = 'none';
  };

  if($('cmpGo')) $('cmpGo').onclick = () => {
    try{
      runCompare();
    }catch(e){
      console.error(e);
      const errBox = $('cmpErr');
      if(errBox){
        errBox.style.display = 'block';
        errBox.textContent = 'خطا: ' + e.message;
      }
    }
  };

  /* ============================================================
     ۴. اجرای مقایسه
  ============================================================ */
  function extractCurrentValues(item){
    const parsed = item.parsed;
    const ci = 0;
    const val = k => parsed?.[k]?.[ci] ?? null;

    const v = {
      revenue: val('revenue'),
      cogs: val('cogs'),
      gross: val('grossProfit'),
      opProfit: val('opProfit'),
      financeCost: val('financeCost'),
      net: val('netProfit'),
      capital: val('capital'),
      ca: val('currentAssets'),
      ta: val('totalAssets'),
      inv: val('inventory'),
      recv: val('receivables'),
      cash: val('cash'),
      cl: val('currentLiab'),
      tl: val('totalLiab'),
      eq: val('equity'),
      re: val('retainedEarnings'),
      cfo: val('cfo'),
      capex: val('capex'),
      deprec: val('depreciation'),
    };

    const v1 = {
      revenue: parsed?.['revenue']?.[1] ?? null,
      net: parsed?.['netProfit']?.[1] ?? null,
    };

    const r = {
      currentRatio: H.ratio(v.ca, v.cl),
      quickRatio: H.ratio((v.ca ?? 0) - (v.inv ?? 0), v.cl),
      cashRatio: H.ratio(v.cash, v.cl),
      debtToAsset: H.ratio(v.tl, v.ta),
      debtToEquity: H.ratio(v.tl, v.eq),
      interestCoverage: v.financeCost && v.opProfit
        ? H.ratio(v.opProfit, Math.abs(v.financeCost)) : null,
      equityMultiplier: H.ratio(v.ta, v.eq),
      grossMargin: H.ratio(v.gross, v.revenue),
      opMargin: H.ratio(v.opProfit, v.revenue),
      netMargin: H.ratio(v.net, v.revenue),
      roa: H.ratio(v.net, v.ta),
      roe: H.ratio(v.net, v.eq),
      assetTurnover: H.ratio(v.revenue, v.ta),
      invTurnover: H.ratio(v.cogs, v.inv),
      recvTurnover: H.ratio(v.revenue, v.recv),
      dso: (v.recv && v.revenue) ? 365 * (v.recv / v.revenue) : null,
      cfoToNet: H.ratio(v.cfo, v.net),
      fcf: (v.cfo != null && v.capex != null) ? (v.cfo - Math.abs(v.capex)) : null,
      cfoToRevenue: H.ratio(v.cfo, v.revenue),
    };

    /* ---------- Altman Z-Score ---------- */
    const taZ = v.ta;
    let zscore = null;
    if(taZ != null && taZ !== 0){
      const wc = (v.ca != null && v.cl != null) ? (v.ca - v.cl) : null;
      const x1 = wc != null ? wc / taZ : 0;
      const x2 = v.re != null ? v.re / taZ : 0;
      const x3 = v.opProfit != null ? v.opProfit / taZ : 0;
      const x4 = v.eq != null ? v.eq / Math.max(v.tl || 0, 1) : 0;
      const x5 = v.revenue != null ? v.revenue / taZ : 0;
      zscore = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;
    }

    /* ---------- ارزش‌گذاری ---------- */
    const MILLION = 1_000_000;
    const price = item.price;
    const shares = item.shares;

    const netRial = (v.net != null) ? v.net * MILLION : null;
    const eqRial = (v.eq != null) ? v.eq * MILLION : null;
    const revRial = (v.revenue != null) ? v.revenue * MILLION : null;
    const tlRial = (v.tl != null) ? v.tl * MILLION : null;
    const cashRial = (v.cash != null) ? v.cash * MILLION : null;

    const ebitdaVal = (v.opProfit != null)
      ? (v.opProfit + (v.deprec != null ? Math.abs(v.deprec) : 0))
      : null;
    const ebitdaRial = (ebitdaVal != null) ? ebitdaVal * MILLION : null;

    const marketCap = (price != null && shares != null) ? price * shares : null;
    const eps = (netRial != null && shares != null && shares !== 0) ? netRial / shares : null;
    const pe = (price != null && eps != null && eps !== 0) ? price / eps : null;
    const pb = (marketCap != null && eqRial != null && eqRial !== 0) ? marketCap / eqRial : null;
    const ps = (marketCap != null && revRial != null && revRial !== 0) ? marketCap / revRial : null;
    const ev = (marketCap != null) ? (marketCap + (tlRial || 0) - (cashRial || 0)) : null;
    const evEbitda = (ev != null && ebitdaRial != null && ebitdaRial !== 0) ? ev / ebitdaRial : null;

    const revGrowth = (v.revenue != null && v1.revenue != null && v1.revenue !== 0)
      ? (v.revenue - v1.revenue) / Math.abs(v1.revenue) : null;

    const score = H.calcScore(v);

    return {
      v, r, revGrowth, score, zscore,
      val: { marketCap, eps, pe, pb, ps, ev, evEbitda },
    };
  }

  function runCompare(){
    // 🔐 چک لایسنس
    if(window.License){
      const status = window.License.getStatus();
      if(status.state !== 'active'){
        window.License.open();
        if(window.showToast) window.showToast('لایسنس فعال نیست یا اعتبار تموم شده', true);
        return;
      }
      const res = window.License.consumeUpload();
      if(res.error){
        if(window.showToast) window.showToast(res.error, true);
        window.License.open();
        return;
      }
      window.License.updateIndicator();
    }

    const valid = CMP_FILES.filter(x => x.parsed);
    if(valid.length < 2){
      throw new Error('حداقل ۲ فایل سالم لازمه.');
    }

    CMP_RESULTS = valid.map(item => {
      const data = extractCurrentValues(item);
      return {
        symbol: item.symbol || item.file?.name || '—',
        color: item.color,
        parsed: item.parsed,
        price: item.price,
        shares: item.shares,
        ...data,
      };
    });

    renderCompareOutput();
    const out = $('cmpOut');
    if(out) out.style.display = 'block';
    const saveBtn = $('cmpSaveBtn');
    if(saveBtn){
      saveBtn.style.display = 'inline-block';
      saveBtn.disabled = false;
    }
    window.scrollTo({top: $('cmpOut').offsetTop - 20, behavior: 'smooth'});
  }

  /* ============================================================
     ۵. رندر خروجی
  ============================================================ */
  function renderCompareOutput(){
    try{ renderCmpScores(); }catch(e){ console.error('renderCmpScores:', e); }
    try{ renderCmpZScore(); }catch(e){ console.error('renderCmpZScore:', e); }
    try{ renderCmpKeyNumbers(); }catch(e){ console.error('renderCmpKeyNumbers:', e); }
    try{ renderCmpRatios('liq'); }catch(e){ console.error('renderCmpRatios:', e); }
    try{ renderCmpBar(); }catch(e){ console.error('renderCmpBar:', e); }
    try{ renderCmpRadar(); }catch(e){ console.error('renderCmpRadar:', e); }
    try{ renderCmpRanking(); }catch(e){ console.error('renderCmpRanking:', e); }
    bindRatioTabs();
  }

  function bindRatioTabs(){
    document.querySelectorAll('#tabCompare .tab').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('#tabCompare .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderCmpRatios(t.dataset.ct);
      };
    });
  }

  /* ---------- ۵-۱. امتیاز سلامت ---------- */
  function renderCmpScores(){
    const box = $('cmpScores');
    if(!box) return;

    const scores = CMP_RESULTS.map(r => r.score).filter(s => s != null);
    const maxScore = scores.length ? Math.max(...scores) : null;

    box.innerHTML = CMP_RESULTS.map(r => {
      const lvl = H.scoreLevel(r.score);
      const isWinner = r.score != null && r.score === maxScore;
      return `
        <div class="cmp-score-card" style="border-top-color:${r.color}">
          <div class="symbol">
            <span class="color-dot" style="background:${r.color}"></span>
            ${r.symbol}
            ${isWinner ? '<span class="crown">🏆</span>' : ''}
          </div>
          <div class="num" style="color:${lvl.color}">${r.score == null ? '—' : H.toFa(r.score)}</div>
          <div class="lvl" style="color:${lvl.color}">${lvl.label}</div>
        </div>
      `;
    }).join('');
  }

  /* ---------- ۵-۲. Altman Z-Score ---------- */
  function renderCmpZScore(){
    const box = $('cmpZScore');
    if(!box) return;

    const validZ = CMP_RESULTS
      .map(r => r.zscore)
      .filter(z => z != null && isFinite(z));
    const maxZ = validZ.length ? Math.max(...validZ) : null;
    const minZ = validZ.length ? Math.min(...validZ) : null;
    const allEqual = (maxZ === minZ);

    box.innerHTML = CMP_RESULTS.map(r => {
      const z = r.zscore;

      if(z == null || !isFinite(z)){
        return `
          <div class="cmp-zscore-card" style="border-top-color:${r.color}">
            <div class="symbol">
              <span class="color-dot" style="background:${r.color}"></span>
              ${r.symbol}
            </div>
            <div class="num" style="color:var(--sub)">—</div>
            <div class="zone" style="color:var(--sub)">اطلاعات کافی نیست</div>
          </div>
        `;
      }

      let zone, color;
      if(z > 2.99){
        zone = '🟢 منطقه امن';
        color = '#16834a';
      } else if(z >= 1.81){
        zone = '🟡 منطقه خاکستری';
        color = '#eab308';
      } else {
        zone = '🔴 منطقه خطر';
        color = '#c62828';
      }

      const pos = Math.max(0, Math.min(100, (z / 4) * 100));
      const isWinner = !allEqual && maxZ != null && _cmpVal(z) === _cmpVal(maxZ);

      return `
        <div class="cmp-zscore-card" style="border-top-color:${r.color}">
          <div class="symbol">
            <span class="color-dot" style="background:${r.color}"></span>
            ${r.symbol}
            ${isWinner ? '🏆' : ''}
          </div>
          <div class="num" style="color:${color}">${H.num2(z)}</div>
          <div class="zone" style="color:${color}">${zone}</div>
          <div class="bar">
            <div class="marker" style="left:${pos}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- ۵-۳. اعداد کلیدی ---------- */
  function renderCmpKeyNumbers(){
    const box = $('cmpKeyNumbers');
    if(!box) return;

    const rows = [
      ['درآمد عملیاتی', r => r.v.revenue, 'money'],
      ['سود ناخالص', r => r.v.gross, 'money'],
      ['سود عملیاتی', r => r.v.opProfit, 'money'],
      ['سود خالص', r => r.v.net, 'money'],
      ['جمع دارایی‌ها', r => r.v.ta, 'money'],
      ['جمع بدهی‌ها', r => r.v.tl, 'money'],
      ['حقوق مالکانه', r => r.v.eq, 'money'],
      ['جریان نقد عملیاتی', r => r.v.cfo, 'money'],
      ['رشد درآمد', r => r.revGrowth, 'pct'],
    ];

    let html = '<table class="cmp-table"><thead><tr><th>معیار</th>';
    CMP_RESULTS.forEach(r => {
      html += `<th style="color:${r.color}">${r.symbol}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach(([label, getter, fmt]) => {
      const rawValues = CMP_RESULTS.map(r => getter(r));
      const cmpValues = rawValues.map(v => _cmpVal(v));
      const validCmp = cmpValues.filter(v => v != null);
      const maxCmp = validCmp.length ? Math.max(...validCmp) : null;
      const minCmp = validCmp.length ? Math.min(...validCmp) : null;
      const allEqual = (maxCmp === minCmp);

      html += `<tr><td>${label}</td>`;
      rawValues.forEach((rawV, i) => {
        const cv = cmpValues[i];
        let cellClass = '';
        if(cv != null && validCmp.length >= 2 && !allEqual){
          if(cv === maxCmp) cellClass = 'best-cell';
          else if(cv === minCmp) cellClass = 'worst-cell';
        }
        const display = fmt === 'money' ? H.toman(rawV) : H.pct(rawV);
        html += `<td class="${cellClass}">${display}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    box.innerHTML = html;
  }

  /* ---------- ۵-۴. نسبت‌ها ---------- */
  const RATIO_GROUPS = {
    liq: {
      rows: [
        ['نسبت جاری', r => r.r.currentRatio, 'higher'],
        ['نسبت آنی', r => r.r.quickRatio, 'higher'],
        ['نسبت نقد', r => r.r.cashRatio, 'higher'],
      ],
    },
    lev: {
      rows: [
        ['بدهی به دارایی', r => r.r.debtToAsset, 'lower'],
        ['بدهی به حقوق', r => r.r.debtToEquity, 'lower'],
        ['پوشش بهره', r => r.r.interestCoverage, 'higher'],
        ['اهرم حقوق مالکانه', r => r.r.equityMultiplier, 'lower'],
      ],
    },
    prof: {
      rows: [
        ['حاشیه سود ناخالص', r => r.r.grossMargin, 'higher'],
        ['حاشیه سود عملیاتی', r => r.r.opMargin, 'higher'],
        ['حاشیه سود خالص', r => r.r.netMargin, 'higher'],
        ['ROA', r => r.r.roa, 'higher'],
        ['ROE', r => r.r.roe, 'higher'],
      ],
    },
    eff: {
      rows: [
        ['گردش دارایی', r => r.r.assetTurnover, 'higher'],
        ['گردش موجودی', r => r.r.invTurnover, 'higher'],
        ['گردش مطالبات', r => r.r.recvTurnover, 'higher'],
        ['دوره وصول مطالبات (روز)', r => r.r.dso, 'lower'],
      ],
    },
    cf: {
      rows: [
        ['CFO به سود خالص', r => r.r.cfoToNet, 'higher'],
        ['CFO به درآمد', r => r.r.cfoToRevenue, 'higher'],
        ['آزاد FCF', r => r.r.fcf, 'higher'],
      ],
    },
    val: {
      rows: [
        ['قیمت سهام (ریال)', r => r.price, 'none'],
        ['تعداد سهام', r => r.shares, 'none'],
        ['ارزش بازار', r => r.val.marketCap, 'higher'],
        ['EPS', r => r.val.eps, 'higher'],
        ['P/E', r => r.val.pe, 'lower'],
        ['P/B', r => r.val.pb, 'lower'],
        ['P/S', r => r.val.ps, 'lower'],
        ['EV/EBITDA', r => r.val.evEbitda, 'lower'],
      ],
    },
  };

  function renderCmpRatios(group){
    const box = $('cmpRatios');
    if(!box) return;
    const cfg = RATIO_GROUPS[group];
    if(!cfg) return;

    const hasAnyPrice = CMP_RESULTS.some(r => r.price != null);
    let hint = '';
    if(group === 'val' && !hasAnyPrice){
      hint = '<div class="cmp-hint">💡 برای نمایش نسبت‌های ارزش‌گذاری، قیمت و تعداد سهام هر شرکت رو بالای همین صفحه وارد کن. اگه تعداد سهام رو هم نذاری، از سرمایه ثبت‌شده فایل خونده می‌شه.</div>';
    }

    let html = '<table class="cmp-table"><thead><tr><th>نسبت</th>';
    CMP_RESULTS.forEach(r => {
      html += `<th style="color:${r.color}">${r.symbol}</th>`;
    });
    html += '</tr></thead><tbody>';

    cfg.rows.forEach(([label, getter, direction]) => {
      const rawValues = CMP_RESULTS.map(r => getter(r));
      const cmpValues = rawValues.map(v => _cmpVal(v));
      const validCmp = cmpValues.filter(v => v != null && v !== 0);
      const maxCmp = validCmp.length ? Math.max(...validCmp) : null;
      const minCmp = validCmp.length ? Math.min(...validCmp) : null;
      const allEqual = (maxCmp === minCmp);

      html += `<tr><td>${label}</td>`;
      rawValues.forEach((rawV, i) => {
        const cv = cmpValues[i];
        let cellClass = '';
        if(direction !== 'none' && cv != null && validCmp.length >= 2 && !allEqual){
          if(direction === 'higher'){
            if(cv === maxCmp) cellClass = 'best-cell';
            else if(cv === minCmp) cellClass = 'worst-cell';
          } else if(direction === 'lower'){
            if(cv === minCmp) cellClass = 'best-cell';
            else if(cv === maxCmp) cellClass = 'worst-cell';
          }
        }

        let display = '—';
        if(rawV != null){
          if(/دوره|روز/.test(label)){
            display = H.toFa(rawV.toFixed(0)) + ' روز';
          } else if(/حاشیه|ROA|ROE|CFO به/.test(label)){
            display = H.pct(rawV);
          } else if(/ارزش بازار|FCF/.test(label)){
            display = H.toman(rawV);
          } else if(label === 'قیمت سهام (ریال)'){
            display = '<bdi dir="ltr">' + H.toFa(rawV.toLocaleString('en-US')) + '</bdi>';
          } else if(label === 'تعداد سهام'){
            display = '<bdi dir="ltr">' + H.toFa(rawV.toLocaleString('en-US')) + '</bdi>';
          } else if(label === 'EPS'){
            display = '<bdi dir="ltr">' + H.toFa(rawV.toFixed(0)) + ' ریال</bdi>';
          } else if(/P\/E|P\/B|P\/S|EV/.test(label)){
            display = H.num2(rawV);
          } else {
            display = H.num2(rawV);
          }
        }
        html += `<td class="${cellClass}">${display}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    box.innerHTML = hint + html;
  }

  /* ---------- ۵-۵. نمودار میله‌ای ---------- */
  function renderCmpBar(){
    const box = $('cmpBar');
    const legendBox = $('cmpBarLegend');
    if(!box) return;

    const metrics = [
      { key: 'netMargin', label: 'حاشیه سود خالص', format: 'pct' },
      { key: 'roe', label: 'ROE', format: 'pct' },
      { key: 'currentRatio', label: 'نسبت جاری', format: 'num' },
      { key: 'debtToEquity', label: 'بدهی/حقوق', format: 'num' },
    ];

    const W = 660, Hh = 300, padL = 120, padR = 20, padT = 20, padB = 50;
    const plotW = W - padL - padR;
    const plotH = Hh - padT - padB;

    const groupW = plotW / metrics.length;
    const barW = Math.min(38, (groupW - 14) / CMP_RESULTS.length);
    const barGap = 4;
    const totalBarW = CMP_RESULTS.length * barW + (CMP_RESULTS.length - 1) * barGap;

    let svg = `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid meet">`;
    const baseY = padT + plotH;

    svg += `<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}"
                  stroke="${_c('chartBaseColor')}" stroke-width="1"/>`;

    const steps = 4;
    for(let i = 0; i <= steps; i++){
      const y = padT + (plotH * i / steps);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
                    stroke="${_c('chartLineColor')}" stroke-width="0.8" stroke-dasharray="3,3"/>`;
    }

    metrics.forEach((m, mi) => {
      const groupX = padL + mi * groupW;
      const startX = groupX + (groupW - totalBarW) / 2;

      const vals = CMP_RESULTS.map(r => r.r[m.key]).filter(v => v != null);
      const maxVal = vals.length ? Math.max(...vals.map(Math.abs)) : 0;

      CMP_RESULTS.forEach((r, ci) => {
        const val = r.r[m.key];
        if(val == null || maxVal === 0) return;
        const h = Math.abs(val) / maxVal * plotH;
        const x = startX + ci * (barW + barGap);
        const y = baseY - h;
        const display = m.format === 'pct' ? H.pct(val) : H.num2(val);
        svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}"
                      fill="${r.color}" rx="3">
                  <title>${r.symbol} — ${m.label}: ${display}</title>
                </rect>`;
      });

      const cx = groupX + groupW / 2;
      svg += `<text x="${cx}" y="${baseY + 20}" text-anchor="middle"
                    font-size="11" fill="${_c('chartLabelColor')}">${m.label}</text>`;
    });

    svg += '</svg>';
    box.innerHTML = svg;

    if(legendBox){
      legendBox.innerHTML = CMP_RESULTS.map(r =>
        `<span><i style="background:${r.color}"></i>${r.symbol}</span>`
      ).join('');
    }
  }

  /* ---------- ۵-۶. نمودار راداری ---------- */
  function renderCmpRadar(){
    const box = $('cmpRadar');
    const legendBox = $('cmpRadarLegend');
    if(!box) return;

    const RADAR_METRICS = [
      {
        label: 'حاشیه سود خالص',
        getter: r => {
          const nm = r.r.netMargin;
          if(nm == null) return 0;
          return Math.max(0, Math.min(100, (nm / 0.30) * 100));
        },
      },
      {
        label: 'ROE',
        getter: r => {
          const roe = r.r.roe;
          if(roe == null) return 0;
          return Math.max(0, Math.min(100, (roe / 0.30) * 100));
        },
      },
      {
        label: 'نسبت جاری',
        getter: r => {
          const cr = r.r.currentRatio;
          if(cr == null) return 0;
          return Math.max(0, Math.min(100, ((cr - 0.5) / 2.5) * 100));
        },
      },
      {
        label: 'کم‌بدهی',
        getter: r => {
          const de = r.r.debtToEquity;
          if(de == null) return 0;
          return Math.max(0, Math.min(100, ((3 - de) / 3) * 100));
        },
      },
      {
        label: 'کیفیت سود',
        getter: r => {
          const cq = r.r.cfoToNet;
          if(cq == null) return 0;
          return Math.max(0, Math.min(100, (cq / 1.2) * 100));
        },
      },
      {
        label: 'رشد درآمد',
        getter: r => {
          const g = r.revGrowth;
          if(g == null) return 0;
          return Math.max(0, Math.min(100, ((g + 0.30) / 0.60) * 100));
        },
      },
    ];

    const N = RADAR_METRICS.length;
    const W = 460, Hh = 460;
    const cx = W / 2, cy = Hh / 2;
    const R = 165;

    function polygonPoints(radius){
      const pts = [];
      for(let i = 0; i < N; i++){
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / N);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        pts.push([x, y]);
      }
      return pts;
    }

    let svg = `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid meet">`;

    for(let ring = 1; ring <= 5; ring++){
      const rr = (R * ring) / 5;
      const pts = polygonPoints(rr);
      const d = pts.map(p => p.join(',')).join(' ');
      svg += `<polygon points="${d}" fill="none"
                        stroke="${_c('chartLineColor')}" stroke-width="1"/>`;
    }

    const outerPts = polygonPoints(R);
    outerPts.forEach(p => {
      svg += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"
                    stroke="${_c('chartLineColor')}" stroke-width="1"/>`;
    });

    outerPts.forEach((p, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / N);
      const labelR = R + 26;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      const anchor = (Math.abs(Math.cos(angle)) < 0.1)
        ? 'middle'
        : (Math.cos(angle) > 0 ? 'start' : 'end');
      svg += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}"
                    font-size="11.5" font-weight="600"
                    fill="${_c('chartLabelColor')}">${RADAR_METRICS[i].label}</text>`;
    });

    CMP_RESULTS.forEach(r => {
      const vals = RADAR_METRICS.map(m => m.getter(r));
      const pts = vals.map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / N);
        const radius = (v / 100) * R;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return [x, y];
      });
      const d = pts.map(p => p.join(',')).join(' ');
      svg += `<polygon points="${d}"
                        fill="${r.color}22"
                        stroke="${r.color}"
                        stroke-width="2"
                        stroke-linejoin="round"/>`;
      pts.forEach(p => {
        svg += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${r.color}"/>`;
      });
    });

    svg += '</svg>';
    box.innerHTML = svg;

    if(legendBox){
      legendBox.innerHTML = CMP_RESULTS.map(r =>
        `<span><i style="background:${r.color}"></i>${r.symbol}</span>`
      ).join('');
    }
  }

  /* ---------- ۵-۷. رتبه‌بندی (۸ معیار با P/E و P/B) ---------- */
  function renderCmpRanking(){
    const box = $('cmpRanking');
    if(!box) return;

    const criteria = [
      // سلامت مالی
      { label: 'حاشیه سود خالص', getter: r => r.r.netMargin, dir: 'higher' },
      { label: 'ROE', getter: r => r.r.roe, dir: 'higher' },
      { label: 'نسبت جاری', getter: r => r.r.currentRatio, dir: 'higher' },
      { label: 'بدهی به حقوق', getter: r => r.r.debtToEquity, dir: 'lower' },
      { label: 'کیفیت سود (CFO/Net)', getter: r => r.r.cfoToNet, dir: 'higher' },
      { label: 'رشد درآمد', getter: r => r.revGrowth, dir: 'higher' },
      // ارزش‌گذاری
      { label: 'P/E', getter: r => r.val.pe, dir: 'lower' },
      { label: 'P/B', getter: r => r.val.pb, dir: 'lower' },
    ];

    const scores = CMP_RESULTS.map(() => 0);

    /* منطق: فقط برنده‌ی تنها امتیاز می‌گیره، مساوی‌ها صفر */
    criteria.forEach(c => {
      const cmpVals = CMP_RESULTS.map(r => _cmpVal(c.getter(r)));
      const valid = cmpVals
        .map((v, i) => ({ v, i }))
        .filter(x => x.v != null);
      if(valid.length < 2) return;

      valid.sort((a, b) => c.dir === 'higher' ? b.v - a.v : a.v - b.v);

      const N = valid.length;
      let idx = 0;
      while(idx < N){
        let j = idx;
        while(j < N && valid[j].v === valid[idx].v) j++;

        const groupSize = j - idx;
        if(groupSize === 1){
          const groupScore = N - 1 - idx;
          scores[valid[idx].i] += groupScore;
        }
        idx = j;
      }
    });

    const ranked = CMP_RESULTS.map((r, i) => ({ ...r, totalScore: scores[i] }))
                              .sort((a, b) => b.totalScore - a.totalScore);

    const totalPossibleScore = criteria.length * (CMP_RESULTS.length - 1);
    const maxScore = ranked.length ? ranked[0].totalScore : 0;
    const winners = ranked.filter(r => r.totalScore === maxScore);

    const rankMap = new Map();
    let currentRank = 0;
    let prevScore = null;
    ranked.forEach((r, i) => {
      if(r.totalScore !== prevScore){
        currentRank = i;
        prevScore = r.totalScore;
      }
      rankMap.set(r, currentRank);
    });

    let html = '<table class="cmp-table"><thead><tr>';
    html += '<th>رتبه</th><th>شرکت</th><th>امتیاز کل</th>';
    criteria.forEach(c => html += `<th>${c.label}</th>`);
    html += '</tr></thead><tbody>';

    ranked.forEach((r) => {
      const rank = rankMap.get(r);
      const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '🎖️';
      const rankClass = rank === 0 ? 'cmp-rank-1' : rank === 1 ? 'cmp-rank-2' : rank === 2 ? 'cmp-rank-3' : '';

      html += `<tr>`;
      html += `<td><span class="cmp-rank-medal">${medal}</span><span class="${rankClass}">${H.toFa(rank + 1)}</span></td>`;
      html += `<td style="color:${r.color};font-weight:700;text-align:right">${r.symbol}</td>`;
      html += `<td style="background:transparent;color:${r.color};font-weight:700">${H.toFa(r.totalScore)}</td>`;

      criteria.forEach(c => {
        const rawV = c.getter(r);
        const cv = _cmpVal(rawV);
        const allCmp = CMP_RESULTS.map(x => _cmpVal(c.getter(x))).filter(x => x != null);
        let cls = '';
        if(cv != null && allCmp.length >= 2){
          const maxV = Math.max(...allCmp), minV = Math.min(...allCmp);
          if(maxV !== minV){
            const isBest = c.dir === 'higher' ? cv === maxV : cv === minV;
            const isWorst = c.dir === 'higher' ? cv === minV : cv === maxV;
            if(isBest) cls = 'best-cell';
            else if(isWorst) cls = 'worst-cell';
          }
        }
        let display = '—';
        if(rawV != null){
          if(/حاشیه|ROE|رشد/.test(c.label)) display = H.pct(rawV);
          else display = H.num2(rawV);
        }
        html += `<td class="${cls}">${display}</td>`;
      });
      html += `</tr>`;
    });

    html += '</tbody></table>';

    if(ranked.length){
      if(winners.length === 1 && maxScore > 0){
        const w = winners[0];
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🏆 <b>برنده کلی:</b> <span style="color:${w.color};font-weight:700">${w.symbol}</span>
          با امتیاز <b>${H.toFa(w.totalScore)}</b> از ${H.toFa(totalPossibleScore)} امتیاز ممکن.
        </div>` + html;
      } else if(maxScore === 0){
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🤝 <b>هیچ شرکتی برتری انحصاری نداره</b> — توی همه معیارها یا مساوی هستن یا تفاوت معنی‌داری ندارن.
        </div>` + html;
      } else {
        const winnerNames = winners.map(w =>
          `<span style="color:${w.color};font-weight:700">${w.symbol}</span>`
        ).join(' و ');
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🤝 <b>برندگان مشترک:</b> ${winnerNames}
          با امتیاز برابر <b>${H.toFa(maxScore)}</b> از ${H.toFa(totalPossibleScore)} امتیاز ممکن.
        </div>` + html;
      }
    }

    box.innerHTML = html;
  }

  /* ============================================================
     ۶. ذخیره و بازیابی مقایسه‌ها
  ============================================================ */
  function renderCmpSaved(){
    const box = $('cmpSavedList');
    if(!box) return;
    const dlBtn = $('cmpDownloadAll');
    if(dlBtn) dlBtn.disabled = CMP_SAVED.length === 0;

    if(!CMP_SAVED.length){
      box.innerHTML = '<div class="saved-empty">هنوز مقایسه‌ای ذخیره نکردی.</div>';
      return;
    }

    const search = ($('cmpSavedSearch')?.value || '').trim().toLowerCase();
    const sortBy = $('cmpSavedSort')?.value || 'recent';

    let indexed = CMP_SAVED.map((item, idx) => ({ ...item, _idx: idx }));
    if(search) indexed = indexed.filter(x => x.name.toLowerCase().includes(search));

    if(sortBy === 'starred') indexed = indexed.filter(x => x.starred);
    else if(sortBy === 'oldest') indexed.reverse();
    else if(sortBy === 'name') indexed.sort((a, b) => a.name.localeCompare(b.name, 'fa'));

    if(!indexed.length){
      box.innerHTML = '<div class="saved-empty">نتیجه‌ای پیدا نشد.</div>';
      return;
    }

    box.innerHTML = indexed.map(item => {
      const idx = item._idx;
      const starred = item.starred ? 'on' : 'off';
      const starIcon = item.starred ? '★' : '☆';
      const symbols = item.companies.map(c => c.symbol).join(' • ');
      return `
        <div class="saved-item ${item.starred ? 'starred' : ''}">
          <div class="name">
            <span class="star ${starred}" onclick="window.cmpToggleStar(${idx})">${starIcon}</span>
            <span>${item.name}</span>
            <span class="edit-name" onclick="window.cmpEditName(${idx})">✏️</span>
          </div>
          <div class="date">${item.date}</div>
          <div class="date" style="direction:rtl;color:var(--sub);font-size:11px">${symbols}</div>
          <div class="btns">
            <button class="primary" onclick="window.cmpRestore(${idx})">بازیابی</button>
            <button class="ghost" onclick="window.cmpDelete(${idx})">حذف</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.cmpToggleStar = function(idx){
    if(!CMP_SAVED[idx]) return;
    CMP_SAVED[idx].starred = !CMP_SAVED[idx].starred;
    saveCompareToStorage();
    renderCmpSaved();
  };

  window.cmpEditName = function(idx){
    if(!CMP_SAVED[idx]) return;
    const cur = CMP_SAVED[idx].name;
    const nn = prompt('اسم جدید:', cur);
    if(nn && nn.trim()){
      CMP_SAVED[idx].name = nn.trim();
      saveCompareToStorage();
      renderCmpSaved();
      if(window.showToast) window.showToast('✅ اسم عوض شد');
    }
  };

  window.cmpDelete = function(idx){
    if(!confirm('این مقایسه حذف بشه؟')) return;
    CMP_SAVED.splice(idx, 1);
    saveCompareToStorage();
    renderCmpSaved();
  };

  window.cmpRestore = function(idx){
    const item = CMP_SAVED[idx];
    if(!item) return;
    try{
      CMP_FILES = item.companies.map((c, i) => ({
        file: null,
        _fromSaved: true,
        symbol: c.symbol,
        price: c.price || null,
        shares: c.shares || null,
        color: COMPANY_COLORS[i % COMPANY_COLORS.length],
        parsed: JSON.parse(JSON.stringify(c.parsed)),
        error: null,
      }));
      CMP_FILES.forEach(c => {
        c.parsed._periods = c.parsed._periods || 3;
      });
      renderCmpList();
      runCompare();
      if(window.showToast) window.showToast('✅ مقایسه بازیابی شد');
    }catch(e){
      alert('خطا در بازیابی: ' + e.message);
    }
  };

  function openSaveCmpModal(){
    if(!CMP_RESULTS || !CMP_RESULTS.length){
      if(window.showToast) window.showToast('اول یه مقایسه انجام بده!', true);
      return;
    }
    const symbols = CMP_RESULTS.map(r => r.symbol).join(' vs ');
    const defName = symbols + ' — ' + H.toFa(new Date().toLocaleString('fa-IR'));
    const inp = $('saveCompareNameInput');
    if(inp) inp.value = defName;
    const m = $('saveCompareModal');
    if(m) m.classList.add('show');
    setTimeout(() => inp && inp.focus(), 50);
  }
  function closeSaveCmpModal(){
    const m = $('saveCompareModal');
    if(m) m.classList.remove('show');
  }

  if($('cmpSaveBtn')) $('cmpSaveBtn').onclick = openSaveCmpModal;
  if($('saveCompareCancel')) $('saveCompareCancel').onclick = closeSaveCmpModal;
  if($('saveCompareModal')) $('saveCompareModal').addEventListener('click', e => {
    if(e.target.id === 'saveCompareModal') closeSaveCmpModal();
  });

  if($('saveCompareConfirm')) $('saveCompareConfirm').onclick = () => {
    const name = ($('saveCompareNameInput').value || '').trim();
    if(!name){
      if(window.showToast) window.showToast('اسم خالی نباشه', true);
      return;
    }
    try{
      const companies = CMP_RESULTS.map(r => ({
        symbol: r.symbol,
        price: r.price,
        shares: r.shares,
        parsed: JSON.parse(JSON.stringify(r.parsed)),
      }));
      CMP_SAVED.unshift({
        name,
        date: H.toFa(new Date().toLocaleString('fa-IR')),
        companies,
        starred: false,
      });
      if(CMP_SAVED.length > 30) CMP_SAVED.length = 30;
      saveCompareToStorage();
      renderCmpSaved();
      closeSaveCmpModal();
      if(window.showToast) window.showToast('✅ مقایسه ذخیره شد!');
    }catch(e){
      if(window.showToast) window.showToast('خطا: ' + e.message, true);
    }
  };
  if($('saveCompareNameInput')) $('saveCompareNameInput').addEventListener('keydown', e => {
    if(e.key === 'Enter') $('saveCompareConfirm').click();
    if(e.key === 'Escape') closeSaveCmpModal();
  });

  document.addEventListener('input', e => {
    if(e.target.id === 'cmpSavedSearch') renderCmpSaved();
  });
  document.addEventListener('change', e => {
    if(e.target.id === 'cmpSavedSort') renderCmpSaved();
  });

  if($('cmpDownloadAll')) $('cmpDownloadAll').onclick = () => {
    if(!CMP_SAVED.length){
      if(window.showToast) window.showToast('لیست خالیه', true);
      return;
    }
    const data = {
      version: '38',
      type: 'kodal_compare',
      exportDate: new Date().toISOString(),
      count: CMP_SAVED.length,
      compares: CMP_SAVED,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
    a.download = `kodal-compares-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if(window.showToast) window.showToast('📥 فایل دانلود شد');
  };

  if($('cmpUploadFile')) $('cmpUploadFile').onclick = () => $('cmpUploadInput').click();
  if($('cmpUploadInput')) $('cmpUploadInput').onchange = e => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const data = JSON.parse(ev.target.result);
        if(!data || !Array.isArray(data.compares)) throw new Error('ساختار فایل درست نیست');
        let added = 0;
        data.compares.forEach(item => {
          if(!item || !item.name || !item.companies) return;
          const isDup = CMP_SAVED.some(x => x.name === item.name && x.date === item.date);
          if(!isDup){ CMP_SAVED.unshift(item); added++; }
        });
        if(CMP_SAVED.length > 30) CMP_SAVED.length = 30;
        saveCompareToStorage();
        renderCmpSaved();
        if(window.showToast) window.showToast(`✅ ${H.toFa(added)} مقایسه اضافه شد`);
      }catch(err){
        if(window.showToast) window.showToast('خطا: ' + err.message, true);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  window.onThemeChange = function(){
    if(CMP_RESULTS) renderCompareOutput();
  };

  renderCmpList();
  renderCmpSaved();

})();