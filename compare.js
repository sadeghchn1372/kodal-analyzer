/* ============================================================
   compare.js — منطق تب «مقایسه با صنعت»  |  v2.1.0
   وابسته به: app.js (window.KodalHelpers)
============================================================ */

(function(){
  'use strict';

  const H = window.KodalHelpers || {};
  const $ = id => document.getElementById(id);

  /* ---------- کمک‌کننده: فرمت عدد ---------- */
  function _fmtNumInput(value){
    const clean = H.fa2en(String(value || '')).replace(/[^\d]/g, '');
    if(!clean) return '';
    const withComma = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return H.toFa(withComma);
  }

  /* ---------- کمک‌کننده: نرمال‌سازی ---------- */
  function _cmpVal(x){
    if(x == null || typeof x !== 'number' || !isFinite(x)) return null;
    return Math.round(x * 1e6) / 1e6;
  }

  /* ---------- میانگین/میانه ---------- */
  function avg(arr){
    const v = arr.filter(x => x != null && isFinite(x));
    if(!v.length) return null;
    return v.reduce((a,b) => a + b, 0) / v.length;
  }
  function median(arr){
    const v = arr.filter(x => x != null && isFinite(x)).sort((a,b) => a - b);
    if(!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid-1] + v[mid]) / 2;
  }
  function best(arr, direction){
    const v = arr.filter(x => x != null && isFinite(x));
    if(!v.length) return null;
    return direction === 'lower' ? Math.min(...v) : Math.max(...v);
  }
  function worst(arr, direction){
    const v = arr.filter(x => x != null && isFinite(x));
    if(!v.length) return null;
    return direction === 'lower' ? Math.max(...v) : Math.min(...v);
  }

  /* ---------- رنگ‌ها ---------- */
  const BASE_COLOR = '#f59e0b';
  const PEER_COLORS = ['#1769e0', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
  const MAX_PEERS = 5;

  /* ---------- State ---------- */
  let BASE = { file: null, parsed: null, symbol: '', industry: '', price: null, shares: null };
  let PEERS = [];
  let INDUSTRY_RESULTS = null;
  let INDUSTRY_SAVED = [];

  const INDUSTRY_STORAGE_KEY = 'kodal_industries_v1';

  /* ============================================================
     Storage
  ============================================================ */
  function loadIndustriesFromStorage(){
    try{
      const raw = localStorage.getItem(INDUSTRY_STORAGE_KEY);
      INDUSTRY_SAVED = raw ? JSON.parse(raw) : [];
    }catch(e){ INDUSTRY_SAVED = []; }
  }
  function saveIndustriesToStorage(){
    try{
      localStorage.setItem(INDUSTRY_STORAGE_KEY, JSON.stringify(INDUSTRY_SAVED));
      return true;
    }catch(e){
      if(e.name === 'QuotaExceededError' && window.showToast){
        window.showToast('⚠️ حافظه پر شده — قدیمی‌ها رو حذف کن', true);
      }
      return false;
    }
  }
  loadIndustriesFromStorage();

  /* ============================================================
     ۱. سهم اصلی
  ============================================================ */
  function bindBaseInputs(){
    const symEl = $('baseSymbol');
    const indEl = $('baseIndustry');
    const priceEl = $('basePrice');
    const sharesEl = $('baseShares');

    if(symEl){
      symEl.addEventListener('input', () => {
        BASE.symbol = symEl.value.trim();
        updateCompareButton();
      });
    }
    if(indEl){
      indEl.addEventListener('input', () => {
        BASE.industry = indEl.value.trim();
      });
    }
    if(priceEl){
      priceEl.addEventListener('input', (e) => {
        const oldValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        const digitsBeforeCursor = H.fa2en(oldValue.slice(0, cursorPos)).replace(/[^\d]/g, '').length;

        const formatted = _fmtNumInput(oldValue);
        e.target.value = formatted;

        let newPos = 0, digitCount = 0;
        for(let i = 0; i < formatted.length; i++){
          if(digitCount >= digitsBeforeCursor) break;
          newPos = i + 1;
          if(/[۰-۹]/.test(formatted[i])) digitCount++;
        }
        if(digitsBeforeCursor === 0) newPos = 0;
        try{ e.target.setSelectionRange(newPos, newPos); }catch(_){}

        BASE.price = H.toNum(formatted);
        updateCompareButton();
      });
    }
    if(sharesEl){
      sharesEl.addEventListener('input', (e) => {
        const oldValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        const digitsBeforeCursor = H.fa2en(oldValue.slice(0, cursorPos)).replace(/[^\d]/g, '').length;

        const formatted = _fmtNumInput(oldValue);
        e.target.value = formatted;

        let newPos = 0, digitCount = 0;
        for(let i = 0; i < formatted.length; i++){
          if(digitCount >= digitsBeforeCursor) break;
          newPos = i + 1;
          if(/[۰-۹]/.test(formatted[i])) digitCount++;
        }
        if(digitsBeforeCursor === 0) newPos = 0;
        try{ e.target.setSelectionRange(newPos, newPos); }catch(_){}

        BASE.shares = H.toNum(formatted);
        updateCompareButton();
      });
    }

    const baseFileInput = $('baseFile');
    if(baseFileInput){
      baseFileInput.onchange = async (e) => {
        const f = e.target.files[0];
        if(!f) return;
        await loadBaseFile(f);
        e.target.value = '';
      };
    }

    const drop = $('baseDrop');
    if(drop){
      ['dragover', 'dragenter'].forEach(ev => {
        drop.addEventListener(ev, e => {
          e.preventDefault();
          drop.classList.add('hover');
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        drop.addEventListener(ev, e => {
          e.preventDefault();
          drop.classList.remove('hover');
        });
      });
      drop.addEventListener('drop', async (e) => {
        const f = e.dataTransfer.files[0];
        if(!f) return;
        await loadBaseFile(f);
      });

      const browseBtn = drop.querySelector('.drop-browse-btn');
      if(browseBtn){
        browseBtn.onclick = (e) => {
          e.stopPropagation();
          if(baseFileInput) baseFileInput.click();
        };
      }
      drop.addEventListener('click', (e) => {
        if(e.target.closest('button')) return;
        if(baseFileInput) baseFileInput.click();
      });
    }
  }

  async function loadBaseFile(file){
    const errBox = $('industryErr');
    if(errBox) errBox.style.display = 'none';

    try{
      const lines = await H.getLines(file);
      if(!lines.length) throw new Error('خطی استخراج نشد');
      const parsed = H.parseItems(lines);
      const found = Object.keys(parsed).length;
      if(!found) throw new Error('قلمی شناسایی نشد');
      const maxPer = Math.max(...Object.values(parsed).filter(a => Array.isArray(a)).map(a => a.length));
      parsed._periods = Math.min(Math.max(maxPer, 1), 5);

      const detected = H.detectPeriodFromLines
        ? H.detectPeriodFromLines(lines)
        : { label: null, year: null, months: null };
      parsed._detectedInfo = detected;
      parsed._detectedPeriod = detected.label;

      BASE.file = file;
      BASE.parsed = parsed;

      if(!BASE.shares){
        const cap = parsed.capital?.[0];
        if(cap != null && cap > 0){
          BASE.shares = cap * 1000;
          const sharesEl = $('baseShares');
          if(sharesEl) sharesEl.value = _fmtNumInput(BASE.shares);
        }
      }

      if(!BASE.symbol){
        BASE.symbol = file.name.replace(/\.[^.]+$/, '');
        const symEl = $('baseSymbol');
        if(symEl) symEl.value = BASE.symbol;
      }

      const info = $('baseFileInfo');
      const nameEl = $('baseFileName');
      if(info && nameEl){
        nameEl.textContent = file.name;
        info.classList.add('active');
      }

      updateCompareButton();
    }catch(e){
      if(errBox){
        errBox.style.display = 'block';
        errBox.textContent = 'خطا در فایل سهم اصلی: ' + (e.message || e);
      }
    }
  }

  /* ============================================================
     ۲. هم‌گروهی‌ها
  ============================================================ */
  function renderPeers(){
    const box = $('peersList');
    if(!box) return;

    if(!PEERS.length){
      box.innerHTML = `
        <div class="saved-empty" style="padding:16px;text-align:center;color:var(--sub);font-size:12.5px">
          هنوز سهم هم‌گروهی اضافه نکردی. روی «📁 انتخاب فایل‌ها» بزن یا فایل‌ها رو بکش و بذار اینجا.
        </div>
      `;
      updateCompareButton();
      updateAddPeerButton();
      return;
    }

    box.innerHTML = PEERS.map((peer, i) => {
      const fileName = peer.file ? peer.file.name : '—';
      const symbolVal = (peer.symbol || '').replace(/"/g, '&quot;');
      const priceVal = peer.price ? _fmtNumInput(peer.price) : '';
      const sharesVal = peer.shares ? _fmtNumInput(peer.shares) : '';
      const errorBadge = peer.error
        ? `<span style="color:var(--bad);font-size:12px;flex-basis:100%">⚠️ ${peer.error}</span>`
        : '';
      return `
        <div class="peer-item">
          <span class="color-dot" style="background:${peer.color}"></span>

          <label class="field-label">
            نماد
            <input class="symbol-input" type="text"
                   value="${symbolVal}"
                   placeholder="نماد"
                   oninput="window.indUpdatePeerSymbol(${i}, this.value)">
          </label>

          <label class="field-label">
            قیمت (ریال)
            <input class="price-input" type="text" inputmode="numeric"
                   value="${priceVal}"
                   placeholder="اختیاری"
                   oninput="window.indUpdatePeerPrice(${i}, this.value)">
          </label>

          <label class="field-label">
            تعداد سهام
            <input class="shares-input" type="text" inputmode="numeric"
                   value="${sharesVal}"
                   placeholder="اختیاری"
                   oninput="window.indUpdatePeerShares(${i}, this.value)">
          </label>

          <button class="remove-btn" onclick="window.indRemovePeer(${i})">✕</button>

          <span class="file-info">📄 ${fileName}</span>
          ${errorBadge}
        </div>
      `;
    }).join('');

    updateCompareButton();
    updateAddPeerButton();
  }

  function updateAddPeerButton(){
    const addBtn2 = $('addPeerBtn2');
    if(addBtn2){
      if(PEERS.length >= MAX_PEERS){
        addBtn2.disabled = true;
        addBtn2.style.opacity = '0.5';
        addBtn2.style.cursor = 'not-allowed';
      } else {
        addBtn2.disabled = false;
        addBtn2.style.opacity = '1';
        addBtn2.style.cursor = 'pointer';
      }
    }

    const dropText = document.querySelector('.peers-drop-text');
    if(dropText){
      if(PEERS.length >= MAX_PEERS){
        dropText.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم پر شده`;
      } else if(PEERS.length > 0){
        dropText.textContent = `${H.toFa(PEERS.length)} از ${H.toFa(MAX_PEERS)} سهم اضافه شد`;
      } else {
        dropText.textContent = 'فایل‌های سهم‌های هم‌گروهی';
      }
    }
  }

  window.indUpdatePeerSymbol = function(idx, value){
    if(!PEERS[idx]) return;
    PEERS[idx].symbol = String(value || '').trim();
  };

  window.indUpdatePeerPrice = function(idx, value){
    if(!PEERS[idx]) return;
    const num = H.toNum(value);
    PEERS[idx].price = num;
    const inputs = document.querySelectorAll('.peer-item .price-input');
    if(inputs[idx]){
      const caretEnd = inputs[idx].selectionStart === inputs[idx].value.length;
      inputs[idx].value = num ? _fmtNumInput(num) : '';
      if(caretEnd){
        try{ inputs[idx].setSelectionRange(inputs[idx].value.length, inputs[idx].value.length); }catch(_){}
      }
    }
  };

  window.indUpdatePeerShares = function(idx, value){
    if(!PEERS[idx]) return;
    const num = H.toNum(value);
    PEERS[idx].shares = num;
    const inputs = document.querySelectorAll('.peer-item .shares-input');
    if(inputs[idx]){
      const caretEnd = inputs[idx].selectionStart === inputs[idx].value.length;
      inputs[idx].value = num ? _fmtNumInput(num) : '';
      if(caretEnd){
        try{ inputs[idx].setSelectionRange(inputs[idx].value.length, inputs[idx].value.length); }catch(_){}
      }
    }
  };

  window.indRemovePeer = function(idx){
    PEERS.splice(idx, 1);
    PEERS.forEach((p, i) => {
      p.color = PEER_COLORS[i % PEER_COLORS.length];
    });
    renderPeers();
  };

  async function addPeerFiles(fileList){
    if(!fileList || !fileList.length) return;

    const errBox = $('industryErr');
    if(errBox) errBox.style.display = 'none';

    const remaining = MAX_PEERS - PEERS.length;

    if(remaining <= 0){
      if(errBox){
        errBox.style.display = 'block';
        errBox.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم هم‌گروهی مجازه.`;
      }
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);

    if(fileList.length > remaining && errBox){
      errBox.style.display = 'block';
      errBox.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم هم‌گروهی مجازه. فقط ${H.toFa(remaining)} سهم اضافه شد.`;
    }

    for(const f of files){
      const idx = PEERS.length;
      const color = PEER_COLORS[idx % PEER_COLORS.length];
      const defaultSymbol = f.name.replace(/\.[^.]+$/, '');

      const peer = {
        file: f,
        symbol: defaultSymbol,
        price: null,
        shares: null,
        color,
        parsed: null,
        error: null,
      };
      PEERS.push(peer);
      renderPeers();

      try{
        const lines = await H.getLines(f);
        if(!lines.length) throw new Error('خطی استخراج نشد');
        const parsed = H.parseItems(lines);
        const found = Object.keys(parsed).length;
        if(!found) throw new Error('قلمی شناسایی نشد');
        const maxPer = Math.max(...Object.values(parsed).filter(a => Array.isArray(a)).map(a => a.length));
        parsed._periods = Math.min(Math.max(maxPer, 1), 5);
        PEERS[idx].parsed = parsed;

        if(!PEERS[idx].shares){
          const cap = parsed.capital?.[0];
          if(cap != null && cap > 0){
            PEERS[idx].shares = cap * 1000;
          }
        }
      }catch(e){
        PEERS[idx].error = e.message || 'خطا در پارس';
      }
      renderPeers();
    }
  }

  function bindPeersInputs(){
    const addBtn2 = $('addPeerBtn2');
    const peersInput = $('peersFileInput');
    const peersDrop = $('peersDrop');

    function triggerFileSelect(){
      if(PEERS.length >= MAX_PEERS){
        const errBox = $('industryErr');
        if(errBox){
          errBox.style.display = 'block';
          errBox.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم هم‌گروهی مجازه.`;
        }
        return;
      }
      if(peersInput) peersInput.click();
    }

    if(addBtn2){
      addBtn2.onclick = (e) => {
        e.stopPropagation();
        triggerFileSelect();
      };
    }

    if(peersDrop){
      peersDrop.onclick = (e) => {
        if(e.target.closest('button')) return;
        triggerFileSelect();
      };
    }

    if(peersInput){
      peersInput.onchange = (e) => {
        addPeerFiles(e.target.files);
        e.target.value = '';
      };
    }

    if(peersDrop){
      ['dragover', 'dragenter'].forEach(ev => {
        peersDrop.addEventListener(ev, e => {
          e.preventDefault();
          peersDrop.classList.add('hover');
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        peersDrop.addEventListener(ev, e => {
          e.preventDefault();
          peersDrop.classList.remove('hover');
        });
      });
      peersDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        addPeerFiles(e.dataTransfer.files);
      });
    }
  }

  /* ============================================================
     ۳. محاسبه
  ============================================================ */
  function extractValues(parsed, price, shares){
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

    const MILLION = 1_000_000;
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

  function updateCompareButton(){
    const btn = $('compareIndustryGo');
    if(!btn) return;
    const valid = BASE.parsed && PEERS.filter(p => p.parsed).length >= 2;
    btn.disabled = !valid;
  }

  /* ============================================================
     ۴. اجرای مقایسه
  ============================================================ */
  window.runIndustryCompare = function(){
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

    if(!BASE.parsed){
      const errBox = $('industryErr');
      if(errBox){ errBox.style.display = 'block'; errBox.textContent = 'اول فایل سهم اصلی رو بارگذاری کن.'; }
      return;
    }

    const validPeers = PEERS.filter(p => p.parsed);

    if(validPeers.length < 2){
      const errBox = $('industryErr');
      if(errBox){ errBox.style.display = 'block'; errBox.textContent = 'حداقل ۲ سهم هم‌گروهی سالم لازمه.'; }
      return;
    }

    const baseData = extractValues(BASE.parsed, BASE.price, BASE.shares);
    const base = {
      symbol: BASE.symbol || 'سهم اصلی',
      industry: BASE.industry || '',
      color: BASE_COLOR,
      isBase: true,
      parsed: BASE.parsed,
      price: BASE.price,
      shares: BASE.shares,
      ...baseData,
    };

    const peers = validPeers.map(p => {
      const data = extractValues(p.parsed, p.price, p.shares);
      return {
        symbol: p.symbol || '—',
        color: p.color,
        isBase: false,
        parsed: p.parsed,
        price: p.price,
        shares: p.shares,
        ...data,
      };
    });

    INDUSTRY_RESULTS = { base, peers };

    const out = $('industryOut');
    if(!out) return;
    out.style.display = 'block';

    renderIndustryOutput();

    const saveBtn = $('saveIndustryBtn');
    if(saveBtn){
      saveBtn.style.display = 'inline-block';
      saveBtn.disabled = false;
    }

    setTimeout(() => {
      const top = out.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo(0, top);
    }, 250);
  };

  /* ============================================================
     ۵. رندر خروجی
  ============================================================ */
  function renderIndustryOutput(){
    try{ renderIndustryScores(); }catch(e){ console.error('renderIndustryScores:', e); }
    try{ renderIndustryZScore(); }catch(e){ console.error('renderIndustryZScore:', e); }
    try{ renderIndustryMainTable(); }catch(e){ console.error('renderIndustryMainTable:', e); }
    try{ renderIndustryRanking(); }catch(e){ console.error('renderIndustryRanking:', e); }

    // ⭐ فعال کردن تب اول به صورت مستقیم
    setTimeout(() => {
      const container = document.querySelector('#industryOut');
      if(!container) return;
      const tabs = container.querySelectorAll('.inner-tab');
      const panels = container.querySelectorAll('.inner-panel');
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      const firstTab = container.querySelector('.inner-tab[data-indinner="scores"]');
      const firstPanel = container.querySelector('.inner-panel[data-indpanel="scores"]');
      if(firstTab) firstTab.classList.add('active');
      if(firstPanel) firstPanel.classList.add('active');
    }, 50);
  }

  /* ============================================================
     ⭐ سوییچ تب داخلی — global
  ============================================================ */
  window.indSwitchTab = function(target){
    const container = document.querySelector('#industryOut');
    if(!container) return;

    const tabs = container.querySelectorAll('.inner-tab');
    const panels = container.querySelectorAll('.inner-panel');

    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    const tab = container.querySelector('.inner-tab[data-indinner="' + target + '"]');
    if(tab) tab.classList.add('active');

    const panel = container.querySelector('.inner-panel[data-indpanel="' + target + '"]');
    if(panel) panel.classList.add('active');
  };

  /* ---------- امتیازهای سلامت ---------- */
  function renderIndustryScores(){
    const box = $('industryScores');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;
    const all = [base, ...peers];

    const baseScore = base.score;
    const peerScores = peers.map(p => p.score).filter(s => s != null);
    const avgScore = avg(peerScores);
    const bestScore = best(peerScores, 'higher');
    const worstScore = worst(peerScores, 'higher');

    const baseLvl = H.scoreLevel(baseScore);

    const allScores = all.map(x => x.score).filter(s => s != null);
    const sortedScores = [...allScores].sort((a, b) => b - a);
    const rank = baseScore != null ? sortedScores.indexOf(baseScore) + 1 : null;

    box.innerHTML = `
      <div class="cmp-score-card" style="border-top-color:${BASE_COLOR}">
        <div class="symbol">
          <span class="color-dot" style="background:${BASE_COLOR}"></span>
          ${base.symbol}
        </div>
        <div class="num" style="color:${baseLvl.color}">${baseScore == null ? '—' : H.toFa(baseScore)}</div>
        ${rank ? `<div class="lvl" style="color:var(--sub);font-size:11.5px;margin-top:6px">رتبه ${H.toFa(rank)} از ${H.toFa(allScores.length)}</div>` : ''}
      </div>

      <div class="cmp-score-card" style="border-top-color:#94a3b8">
        <div class="symbol">
          <span class="color-dot" style="background:#94a3b8"></span>
          میانگین صنعت
        </div>
        <div class="num" style="color:#94a3b8">${avgScore == null ? '—' : H.toFa(Math.round(avgScore))}</div>
      </div>

      <div class="cmp-score-card" style="border-top-color:#16834a">
        <div class="symbol">
          <span class="color-dot" style="background:#16834a"></span>
          بهترین صنعت
        </div>
        <div class="num" style="color:#16834a">${bestScore == null ? '—' : H.toFa(bestScore)}</div>
      </div>

      <div class="cmp-score-card" style="border-top-color:#c62828">
        <div class="symbol">
          <span class="color-dot" style="background:#c62828"></span>
          بدترین صنعت
        </div>
        <div class="num" style="color:#c62828">${worstScore == null ? '—' : H.toFa(worstScore)}</div>
      </div>
    `;
  }

  /* ---------- Altman Z-Score ---------- */
  function renderIndustryZScore(){
    const box = $('industryZScore');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;

    function zCard(r, isBase){
      const z = r.zscore;
      const color = isBase ? BASE_COLOR : r.color;

      if(z == null || !isFinite(z)){
        return `
          <div class="cmp-zscore-card" style="border-top-color:${color}">
            <div class="symbol">
              <span class="color-dot" style="background:${color}"></span>
              ${isBase ? '🎯 ' : ''}${r.symbol}
            </div>
            <div class="num" style="color:var(--sub)">—</div>
          </div>
        `;
      }

      const zoneColor = z > 2.99 ? '#16834a' : z >= 1.81 ? '#eab308' : '#c62828';

      return `
        <div class="cmp-zscore-card" style="border-top-color:${color}">
          <div class="symbol">
            <span class="color-dot" style="background:${color}"></span>
            ${isBase ? '🎯 ' : ''}${r.symbol}
          </div>
          <div class="num" style="color:${zoneColor}">${H.num2(z)}</div>
        </div>
      `;
    }

    const peerZ = peers.map(p => p.zscore).filter(z => z != null && isFinite(z));
    const avgZ = avg(peerZ);

    let html = zCard(base, true);

    if(avgZ != null){
      const zoneAvgColor = avgZ > 2.99 ? '#16834a' : avgZ >= 1.81 ? '#eab308' : '#c62828';
      html += `
        <div class="cmp-zscore-card" style="border-top-color:#94a3b8">
          <div class="symbol">
            <span class="color-dot" style="background:#94a3b8"></span>
            میانگین صنعت
          </div>
          <div class="num" style="color:${zoneAvgColor}">${H.num2(avgZ)}</div>
        </div>
      `;
    }

    const bestZ = best(peerZ, 'higher');
    const worstZ = worst(peerZ, 'higher');
    if(bestZ != null){
      const zBest = bestZ > 2.99 ? '#16834a' : bestZ >= 1.81 ? '#eab308' : '#c62828';
      html += `
        <div class="cmp-zscore-card" style="border-top-color:#16834a">
          <div class="symbol">
            <span class="color-dot" style="background:#16834a"></span>
            🥇 بهترین صنعت
          </div>
          <div class="num" style="color:${zBest}">${H.num2(bestZ)}</div>
        </div>
      `;
    }
    if(worstZ != null && worstZ !== bestZ){
      const zWorst = worstZ > 2.99 ? '#16834a' : worstZ >= 1.81 ? '#eab308' : '#c62828';
      html += `
        <div class="cmp-zscore-card" style="border-top-color:#c62828">
          <div class="symbol">
            <span class="color-dot" style="background:#c62828"></span>
            بدترین صنعت
          </div>
          <div class="num" style="color:${zWorst}">${H.num2(worstZ)}</div>
        </div>
      `;
    }

    box.innerHTML = html;
  }

  /* ---------- جدول اصلی ---------- */
  const MAIN_RATIOS = [
    { key: 'grossMargin',   label: 'حاشیه سود ناخالص',   getter: r => r.r.grossMargin,   dir: 'higher', fmt: 'pct' },
    { key: 'opMargin',      label: 'حاشیه سود عملیاتی',  getter: r => r.r.opMargin,      dir: 'higher', fmt: 'pct' },
    { key: 'netMargin',     label: 'حاشیه سود خالص',     getter: r => r.r.netMargin,     dir: 'higher', fmt: 'pct' },
    { key: 'roa',           label: 'ROA',                 getter: r => r.r.roa,           dir: 'higher', fmt: 'pct' },
    { key: 'roe',           label: 'ROE',                 getter: r => r.r.roe,           dir: 'higher', fmt: 'pct' },
    { key: 'currentRatio',  label: 'نسبت جاری',           getter: r => r.r.currentRatio,  dir: 'higher', fmt: 'num' },
    { key: 'quickRatio',    label: 'نسبت آنی',            getter: r => r.r.quickRatio,    dir: 'higher', fmt: 'num' },
    { key: 'debtToAsset',   label: 'بدهی به دارایی',      getter: r => r.r.debtToAsset,   dir: 'lower',  fmt: 'pct' },
    { key: 'debtToEquity',  label: 'بدهی به حقوق',        getter: r => r.r.debtToEquity,  dir: 'lower',  fmt: 'num' },
    { key: 'assetTurnover', label: 'گردش دارایی',         getter: r => r.r.assetTurnover, dir: 'higher', fmt: 'num' },
    { key: 'dso',           label: 'دوره وصول مطالبات',   getter: r => r.r.dso,           dir: 'lower',  fmt: 'day' },
    { key: 'cfoToNet',      label: 'کیفیت سود (CFO/Net)', getter: r => r.r.cfoToNet,      dir: 'higher', fmt: 'num' },
  ];

  function formatRatioValue(raw, fmt){
    if(raw == null) return '—';
    switch(fmt){
      case 'pct': return H.pct(raw);
      case 'num': return H.num2(raw);
      case 'day': return H.toFa(raw.toFixed(0)) + ' روز';
      default: return String(raw);
    }
  }

  function renderIndustryMainTable(){
    const box = $('industryMainTable');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;

    let html = '<div class="dupont-factors" style="margin-top:6px">';

    MAIN_RATIOS.forEach(ratio => {
      const baseVal = _cmpVal(ratio.getter(base));
      const peerVals = peers.map(p => _cmpVal(ratio.getter(p))).filter(v => v != null);

      const avgVal = avg(peerVals);
      const bestVal = best(peerVals, ratio.dir);
      const worstVal = worst(peerVals, ratio.dir);

      let color = '#94a3b8';
      let label = '—';
      if(baseVal != null && avgVal != null && avgVal !== 0){
        const diff = ((baseVal - avgVal) / Math.abs(avgVal)) * 100;
        const isBetter = ratio.dir === 'higher' ? diff > 0 : diff < 0;
        const absDiff = Math.abs(diff);

        if(isBetter){
          if(absDiff > 30){ color = '#16834a'; label = 'خیلی بهتر از میانگین'; }
          else if(absDiff > 10){ color = '#22c55e'; label = 'بهتر از میانگین'; }
          else { color = '#84cc16'; label = 'کمی بهتر از میانگین'; }
        } else {
          if(absDiff > 30){ color = '#c62828'; label = 'خیلی ضعیف‌تر'; }
          else if(absDiff > 10){ color = '#ef4444'; label = 'ضعیف‌تر از میانگین'; }
          else { color = '#f59e0b'; label = 'کمی ضعیف‌تر'; }
        }
      }

      let basePct = 50, avgPct = 50;
      if(bestVal != null && worstVal != null && bestVal !== worstVal){
        const range = Math.abs(bestVal - worstVal);
        if(ratio.dir === 'higher'){
          basePct = baseVal != null ? Math.max(5, Math.min(100, ((baseVal - worstVal) / range) * 100)) : 50;
          avgPct = avgVal != null ? Math.max(5, Math.min(100, ((avgVal - worstVal) / range) * 100)) : 50;
        } else {
          basePct = baseVal != null ? Math.max(5, Math.min(100, ((worstVal - baseVal) / range) * 100)) : 50;
          avgPct = avgVal != null ? Math.max(5, Math.min(100, ((worstVal - avgVal) / range) * 100)) : 50;
        }
      } else {
        basePct = 60;
        avgPct = 40;
      }

      const baseDisplay = formatRatioValue(baseVal, ratio.fmt);
      const avgDisplay = formatRatioValue(avgVal, ratio.fmt);

      html += `
        <div class="dupont-factor-row ratio-dupont-row">
          <div class="dupont-factor-label">${ratio.label}</div>
          <div class="dupont-factor-value-box" style="color:${color}">
            ${baseDisplay} — ${label}
          </div>
          <div class="dupont-factor-bar-inline ratio-bar-relative">
            <div class="dupont-factor-fill-inline" style="width:${basePct}%;background:${color}"></div>
            <div class="ratio-avg-marker" style="left:${avgPct}%" title="میانگین صنعت: ${avgDisplay}">
              <span class="ratio-avg-marker-label">میانگین</span>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    html += `
      <div class="ratio-inline-legend" style="margin-top:14px">
        <span><i style="background:${BASE_COLOR};width:14px;height:3px;border-radius:2px"></i> سهم اصلی</span>
        <span><i style="background:#1f2937;width:3px;height:12px;border-radius:2px"></i> میانگین صنعت</span>
      </div>
    `;

    box.innerHTML = html;
  }

  /* ---------- رتبه‌بندی ---------- */
  function renderIndustryRanking(){
    const box = $('industryRanking');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;
    const all = [base, ...peers];

    const criteria = [
      { label: 'حاشیه سود خالص', getter: r => r.r.netMargin, dir: 'higher', fmt: 'pct' },
      { label: 'ROE', getter: r => r.r.roe, dir: 'higher', fmt: 'pct' },
      { label: 'ROA', getter: r => r.r.roa, dir: 'higher', fmt: 'pct' },
      { label: 'حاشیه سود عملیاتی', getter: r => r.r.opMargin, dir: 'higher', fmt: 'pct' },
      { label: 'نسبت جاری', getter: r => r.r.currentRatio, dir: 'higher', fmt: 'num' },
      { label: 'بدهی به حقوق', getter: r => r.r.debtToEquity, dir: 'lower', fmt: 'num' },
      { label: 'کیفیت سود', getter: r => r.r.cfoToNet, dir: 'higher', fmt: 'num' },
      { label: 'رشد درآمد', getter: r => r.revGrowth, dir: 'higher', fmt: 'pct' },
    ];

    const scores = all.map(() => 0);

    criteria.forEach(c => {
      const vals = all.map(r => _cmpVal(c.getter(r)));
      const valid = vals.map((v, i) => ({ v, i })).filter(x => x.v != null);
      if(valid.length < 2) return;

      valid.sort((a, b) => c.dir === 'higher' ? b.v - a.v : a.v - b.v);

      let idx = 0;
      while(idx < valid.length){
        let j = idx;
        while(j < valid.length && valid[j].v === valid[idx].v) j++;
        if(j - idx === 1){
          scores[valid[idx].i] += valid.length - 1 - idx;
        }
        idx = j;
      }
    });

    const ranked = all.map((r, i) => ({ ...r, totalScore: scores[i] }));
    ranked.sort((a, b) => b.totalScore - a.totalScore);

    const totalPossible = criteria.length * (all.length - 1);
    const maxScore = ranked.length ? ranked[0].totalScore : 0;

    let cardsHtml = '<div class="rank-cards">';

    ranked.forEach((r, i) => {
      const rank = i + 1;
      const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';
      const isBase = r.isBase;

      const powerPct = maxScore > 0 ? (r.totalScore / maxScore) * 100 : 0;

      let color = '#94a3b8';
      let levelLabel = '—';
      const scoreRatio = maxScore > 0 ? r.totalScore / maxScore : 0;
      if(scoreRatio >= 0.9){ color = '#16834a'; levelLabel = 'پیشتاز'; }
      else if(scoreRatio >= 0.7){ color = '#22c55e'; levelLabel = 'قوی'; }
      else if(scoreRatio >= 0.5){ color = '#eab308'; levelLabel = 'متوسط'; }
      else if(scoreRatio >= 0.3){ color = '#f59e0b'; levelLabel = 'ضعیف'; }
      else { color = '#c62828'; levelLabel = 'عقب‌مانده'; }

      cardsHtml += `
        <div class="rank-card ${rankClass} ${isBase ? 'rank-base' : ''}" style="border-top-color:${color}">
          <div class="rank-card-medal rank-card-num" style="color:${color}">${H.toFa(rank)}</div>
          <div class="rank-card-symbol" style="color:${isBase ? BASE_COLOR : r.color}">
            ${isBase ? '🎯 ' : ''}${r.symbol}
          </div>
          <div class="rank-card-score" style="color:${color}">
            ${H.toFa(r.totalScore)}
          </div>
          <div class="rank-card-score-label">از ${H.toFa(totalPossible)}</div>
          <div class="rank-card-bar">
            <div class="rank-card-bar-fill" style="width:${powerPct}%;background:${color}"></div>
          </div>
          <div class="rank-card-level" style="color:${color}">${levelLabel}</div>
        </div>
      `;
    });

    cardsHtml += '</div>';

    let criteriaHtml = '<div class="rank-criteria-box">';
    criteriaHtml += '<div class="rank-criteria-title">📊 مقایسه معیار به معیار (به ترتیب رتبه)</div>';
    criteriaHtml += '<div class="dupont-factors" style="margin-top:6px">';

    criteria.forEach(c => {
      const sorted = [...ranked].sort((a, b) => {
        const va = _cmpVal(c.getter(a));
        const vb = _cmpVal(c.getter(b));
        if(va == null) return 1;
        if(vb == null) return -1;
        return c.dir === 'higher' ? vb - va : va - vb;
      });

      const vals = sorted.map(x => _cmpVal(c.getter(x))).filter(v => v != null);
      const maxV = vals.length ? Math.max(...vals) : 0;
      const minV = vals.length ? Math.min(...vals) : 0;

      criteriaHtml += `
        <div class="rank-criteria-group">
          <div class="rank-criteria-header">
            <span class="rank-criteria-name">${c.label}</span>
            <span class="rank-criteria-dir">${c.dir === 'higher' ? '⬆ بالاتر بهتر' : '⬇ پایین‌تر بهتر'}</span>
          </div>
      `;

      sorted.forEach((r, i) => {
        const v = _cmpVal(c.getter(r));
        const isBase = r.isBase;
        const rank = i + 1;

        let pct = 0;
        if(v != null && maxV !== minV){
          if(c.dir === 'higher'){
            pct = Math.max(5, ((v - minV) / (maxV - minV)) * 100);
          } else {
            pct = Math.max(5, ((maxV - v) / (maxV - minV)) * 100);
          }
        } else if(v != null){
          pct = 100;
        }

        let color;
        if(rank === 1) color = '#16834a';
        else if(rank <= Math.ceil(sorted.length / 2)) color = '#22c55e';
        else if(rank === sorted.length) color = '#c62828';
        else color = '#f59e0b';

        const display = formatRatioValue(v, c.fmt);

        criteriaHtml += `
          <div class="rank-row ${isBase ? 'rank-row-base' : ''}">
            <div class="rank-row-pos">
              <span class="rank-row-num" style="background:${color}22;color:${color}">${H.toFa(rank)}</span>
            </div>
            <div class="rank-row-symbol" style="color:${isBase ? BASE_COLOR : r.color}">
              ${isBase ? '🎯 ' : ''}${r.symbol}
            </div>
            <div class="rank-row-value" style="color:${color}">
              ${display}
            </div>
            <div class="rank-row-bar">
              <div class="rank-row-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
        `;
      });

      criteriaHtml += '</div>';
    });

    criteriaHtml += '</div></div>';

    let winnerHtml = '';
    if(ranked.length && maxScore > 0){
      const w = ranked[0];
      winnerHtml = `
        <div class="rank-winner-banner">
          <div class="rank-winner-icon">🏆</div>
          <div class="rank-winner-text">
            <div class="rank-winner-label">برنده کلی</div>
            <div class="rank-winner-symbol" style="color:${w.isBase ? BASE_COLOR : w.color}">
              ${w.isBase ? '🎯 ' : ''}${w.symbol}
            </div>
          </div>
          <div class="rank-winner-score">
            <span style="color:${BASE_COLOR}">${H.toFa(w.totalScore)}</span>
            <span style="color:var(--sub);font-size:12px">از ${H.toFa(totalPossible)}</span>
          </div>
        </div>
      `;
    }

    const legendHtml = `
      <div class="rank-legend">
        <span><i style="background:#16834a"></i> رتبه ۱ (بهترین)</span>
        <span><i style="background:#22c55e"></i> نیمه بالا</span>
        <span><i style="background:#f59e0b"></i> نیمه پایین</span>
        <span><i style="background:#c62828"></i> آخر</span>
        <span><i style="background:${BASE_COLOR}"></i> 🎯 سهم اصلی</span>
      </div>
    `;

    box.innerHTML = winnerHtml + cardsHtml + criteriaHtml + legendHtml;
  }

  /* ============================================================
     ۶. ذخیره و بازیابی صنایع
  ============================================================ */
  function openSaveIndustryModal(){
    if(!INDUSTRY_RESULTS){
      if(window.showToast) window.showToast('اول یه مقایسه انجام بده!', true);
      return;
    }
    const defName = (BASE.industry || 'صنعت') + ' — ' + H.toFa(new Date().toLocaleString('fa-IR'));
    const inp = $('saveIndustryNameInput');
    if(inp) inp.value = defName;
    const m = $('saveIndustryModal');
    if(m) m.classList.add('show');
    setTimeout(() => inp && inp.focus(), 50);
  }
  function closeSaveIndustryModal(){
    const m = $('saveIndustryModal');
    if(m) m.classList.remove('show');
  }

  function snapshotIndustry(){
    const { base, peers } = INDUSTRY_RESULTS;

    const stats = {};
    MAIN_RATIOS.forEach(ratio => {
      const peerVals = peers.map(p => _cmpVal(ratio.getter(p))).filter(v => v != null);
      stats[ratio.key] = {
        label: ratio.label,
        dir: ratio.dir,
        fmt: ratio.fmt,
        avg: avg(peerVals),
        median: median(peerVals),
        best: best(peerVals, ratio.dir),
        worst: worst(peerVals, ratio.dir),
        base: _cmpVal(ratio.getter(base)),
      };
    });

    const peerScores = peers.map(p => p.score).filter(s => s != null);
    const peerZ = peers.map(p => p.zscore).filter(z => z != null);

    return {
      name: (BASE.industry || 'بدون نام'),
      industry: BASE.industry || '',
      baseSymbol: base.symbol,
      baseScore: base.score,
      baseZScore: base.zscore,
      baseIndustry: base.industry,
      basePrice: base.price,
      baseShares: base.shares,
      peerCount: peers.length,
      peerScores,
      peerZ,
      stats,
      symbols: peers.map(p => p.symbol),
      date: H.toFa(new Date().toLocaleString('fa-IR')),
      timestamp: Date.now(),
      snapshot: {
        base: {
          symbol: base.symbol,
          industry: base.industry,
          price: base.price,
          shares: base.shares,
          parsed: JSON.parse(JSON.stringify(base.parsed)),
        },
        peers: peers.map(p => ({
          symbol: p.symbol,
          price: p.price,
          shares: p.shares,
          parsed: JSON.parse(JSON.stringify(p.parsed)),
        })),
      },
    };
  }

  function renderIndustrySaved(){
    const box = $('industrySavedList');
    if(!box) return;
    const dlBtn = $('industryDownloadAll');
    if(dlBtn) dlBtn.disabled = INDUSTRY_SAVED.length === 0;

    if(!INDUSTRY_SAVED.length){
      box.innerHTML = '<div class="saved-empty">هنوز صنعتی ذخیره نکردی.</div>';
      return;
    }

    const search = ($('industrySavedSearch')?.value || '').trim().toLowerCase();
    const sortBy = $('industrySavedSort')?.value || 'recent';

    let indexed = INDUSTRY_SAVED.map((item, idx) => ({ ...item, _idx: idx }));
    if(search) indexed = indexed.filter(x => (x.name || '').toLowerCase().includes(search));

    if(sortBy === 'starred') indexed = indexed.filter(x => x.starred);
    else if(sortBy === 'oldest') indexed.reverse();
    else if(sortBy === 'name') indexed.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));

    if(!indexed.length){
      box.innerHTML = '<div class="saved-empty">نتیجه‌ای پیدا نشد.</div>';
      return;
    }

    box.innerHTML = indexed.map(item => {
      const idx = item._idx;
      const starred = item.starred ? 'on' : 'off';
      const starIcon = item.starred ? '★' : '☆';
      const symbols = (item.symbols || []).slice(0, 5).join(' • ') + (item.symbols && item.symbols.length > 5 ? ' و...' : '');
      return `
        <div class="saved-item ${item.starred ? 'starred' : ''}">
          <div class="name">
            <span class="star ${starred}" onclick="window.indToggleStar(${idx})">${starIcon}</span>
            <span>${item.name}</span>
            <span class="edit-name" onclick="window.indEditName(${idx})">✏️</span>
          </div>
          <div class="date">${item.date}</div>
          <div class="date" style="direction:rtl;color:var(--sub);font-size:11px">
            🎯 ${item.baseSymbol} (امتیاز: ${H.toFa(item.baseScore ?? '—')}) — ${H.toFa(item.peerCount)} هم‌گروهی
          </div>
          <div class="date" style="direction:rtl;color:var(--sub);font-size:11px">${symbols}</div>
          <div class="btns">
            <button class="primary" onclick="window.indRestore(${idx})">بازیابی</button>
            <button class="ghost" onclick="window.indDelete(${idx})">حذف</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.indToggleStar = function(idx){
    if(!INDUSTRY_SAVED[idx]) return;
    INDUSTRY_SAVED[idx].starred = !INDUSTRY_SAVED[idx].starred;
    saveIndustriesToStorage();
    renderIndustrySaved();
  };

  window.indEditName = function(idx){
    if(!INDUSTRY_SAVED[idx]) return;
    const cur = INDUSTRY_SAVED[idx].name;
    const nn = prompt('اسم جدید:', cur);
    if(nn && nn.trim()){
      INDUSTRY_SAVED[idx].name = nn.trim();
      saveIndustriesToStorage();
      renderIndustrySaved();
      if(window.showToast) window.showToast('✅ اسم عوض شد');
    }
  };

  window.indDelete = function(idx){
    if(!confirm('این صنعت حذف بشه؟')) return;
    INDUSTRY_SAVED.splice(idx, 1);
    saveIndustriesToStorage();
    renderIndustrySaved();
  };

  window.indRestore = function(idx){
    const item = INDUSTRY_SAVED[idx];
    if(!item || !item.snapshot) return;
    try{
      BASE = {
        file: null,
        parsed: JSON.parse(JSON.stringify(item.snapshot.base.parsed)),
        symbol: item.snapshot.base.symbol,
        industry: item.snapshot.base.industry,
        price: item.snapshot.base.price,
        shares: item.snapshot.base.shares,
      };
      if($('baseSymbol')) $('baseSymbol').value = BASE.symbol || '';
      if($('baseIndustry')) $('baseIndustry').value = BASE.industry || '';
      if($('basePrice')) $('basePrice').value = BASE.price ? _fmtNumInput(BASE.price) : '';
      if($('baseShares')) $('baseShares').value = BASE.shares ? _fmtNumInput(BASE.shares) : '';
      if($('baseFileInfo') && BASE.symbol){
        $('baseFileInfo').classList.add('active');
        if($('baseFileName')) $('baseFileName').textContent = '(بازیابی‌شده از ذخیره)';
      }

      PEERS = item.snapshot.peers.map((p, i) => ({
        file: null,
        parsed: JSON.parse(JSON.stringify(p.parsed)),
        symbol: p.symbol,
        price: p.price,
        shares: p.shares,
        color: PEER_COLORS[i % PEER_COLORS.length],
        error: null,
      }));
      renderPeers();
      updateCompareButton();

      window.runIndustryCompare();

      if(window.showToast) window.showToast('✅ صنعت بازیابی شد');
    }catch(e){
      alert('خطا در بازیابی: ' + e.message);
    }
  };

  function downloadAllIndustries(){
    if(!INDUSTRY_SAVED.length){
      if(window.showToast) window.showToast('لیست خالیه', true);
      return;
    }
    const data = {
      version: '2.1.0',
      type: 'kodal_industries',
      exportDate: new Date().toISOString(),
      count: INDUSTRY_SAVED.length,
      industries: INDUSTRY_SAVED,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
    a.download = `kodal-industries-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if(window.showToast) window.showToast('📥 فایل دانلود شد');
  }

  function uploadIndustries(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try{
        const data = JSON.parse(e.target.result);
        if(!data || !Array.isArray(data.industries)) throw new Error('ساختار فایل درست نیست');
        let added = 0;
        data.industries.forEach(item => {
          if(!item || !item.name) return;
          const isDup = INDUSTRY_SAVED.some(x => x.name === item.name && x.timestamp === item.timestamp);
          if(!isDup){ INDUSTRY_SAVED.unshift(item); added++; }
        });
        if(INDUSTRY_SAVED.length > 30) INDUSTRY_SAVED.length = 30;
        saveIndustriesToStorage();
        renderIndustrySaved();
        if(window.showToast) window.showToast(`✅ ${H.toFa(added)} صنعت اضافه شد`);
      }catch(err){
        if(window.showToast) window.showToast('خطا: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  /* ============================================================
     ۷. مقایسه دو صنعت
  ============================================================ */
  function openCompareIndustriesModal(){
    if(INDUSTRY_SAVED.length < 2){
      if(window.showToast) window.showToast('حداقل ۲ صنعت ذخیره‌شده لازمه', true);
      return;
    }
    const selA = $('industryA');
    const selB = $('industryB');
    const options = INDUSTRY_SAVED.map((item, idx) =>
      `<option value="${idx}">${item.name} (${item.baseSymbol})</option>`
    ).join('');

    if(selA) selA.innerHTML = '<option value="">-- انتخاب --</option>' + options;
    if(selB) selB.innerHTML = '<option value="">-- انتخاب --</option>' + options;
    if(selB) selB.value = INDUSTRY_SAVED.length > 1 ? '1' : '';

    const err = $('compareIndustryErr');
    if(err) err.style.display = 'none';

    const m = $('compareIndustriesModal');
    if(m) m.classList.add('show');
  }
  function closeCompareIndustriesModal(){
    const m = $('compareIndustriesModal');
    if(m) m.classList.remove('show');
  }

  function runTwoIndustriesCompare(){
    const idxA = parseInt($('industryA')?.value, 10);
    const idxB = parseInt($('industryB')?.value, 10);
    const err = $('compareIndustryErr');

    if(isNaN(idxA) || isNaN(idxB)){
      if(err){ err.style.display = 'block'; err.textContent = 'هر دو صنعت رو انتخاب کن.'; }
      return;
    }
    if(idxA === idxB){
      if(err){ err.style.display = 'block'; err.textContent = 'دو صنعت متفاوت انتخاب کن.'; }
      return;
    }

    const A = INDUSTRY_SAVED[idxA];
    const B = INDUSTRY_SAVED[idxB];
    if(!A || !B){
      if(err){ err.style.display = 'block'; err.textContent = 'صنعت پیدا نشد.'; }
      return;
    }

    closeCompareIndustriesModal();

    const card = document.getElementById('compareTwoIndustriesCard');
    if(!card) return;

    let existing = document.getElementById('twoIndustriesCompareBox');
    if(existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'twoIndustriesCompareBox';
    box.style.marginTop = '18px';
    box.style.paddingTop = '18px';
    box.style.borderTop = '1px dashed var(--line)';

    box.innerHTML = `
      <h3 style="margin:0 0 14px;font-size:15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span>📊 نتیجه:</span>
        <span style="color:#1769e0">${A.name}</span>
        <span style="color:var(--sub)">vs</span>
        <span style="color:#8b5cf6">${B.name}</span>
      </h3>
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead>
            <tr>
              <th>نسبت</th>
              <th style="color:#1769e0">${A.name}</th>
              <th style="color:#8b5cf6">${B.name}</th>
              <th>برنده</th>
            </tr>
          </thead>
          <tbody id="twoIndustriesRows"></tbody>
        </table>
      </div>`;

    card.appendChild(box);

    const rows = document.getElementById('twoIndustriesRows');
    MAIN_RATIOS.forEach(ratio => {
      const aStats = A.stats?.[ratio.key];
      const bStats = B.stats?.[ratio.key];

      const aVal = aStats?.avg ?? null;
      const bVal = bStats?.avg ?? null;

      let winner = '—';
      let winnerColor = 'var(--sub)';
      if(aVal != null && bVal != null && aVal !== bVal){
        const isABetter = ratio.dir === 'higher' ? aVal > bVal : aVal < bVal;
        winner = isABetter ? `🥇 ${A.name}` : `🥇 ${B.name}`;
        winnerColor = isABetter ? '#1769e0' : '#8b5cf6';
      }

      const aDisplay = formatRatioValue(aVal, ratio.fmt);
      const bDisplay = formatRatioValue(bVal, ratio.fmt);

      rows.innerHTML += `
        <tr>
          <td>${ratio.label}</td>
          <td style="color:#1769e0">${aDisplay}</td>
          <td style="color:#8b5cf6">${bDisplay}</td>
          <td style="color:${winnerColor};font-weight:600">${winner}</td>
        </tr>
      `;
    });

    setTimeout(() => {
      const top = card.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo(0, top);
    }, 100);

    if(window.showToast) window.showToast('✅ مقایسه دو صنعت انجام شد');
  }

  /* ============================================================
     ۸. اتصال دکمه‌ها
  ============================================================ */
  function bindButtons(){
    const compareBtn = $('compareIndustryGo');
    if(compareBtn){
      compareBtn.onclick = window.runIndustryCompare;
    }

    const saveBtn = $('saveIndustryBtn');
    if(saveBtn) saveBtn.onclick = openSaveIndustryModal;

    const compareTwo = $('compareTwoIndustriesBtn');
    if(compareTwo) compareTwo.onclick = openCompareIndustriesModal;

    const dlBtn = $('industryDownloadAll');
    if(dlBtn) dlBtn.onclick = downloadAllIndustries;

    const upBtn = $('industryUploadFile');
    const upInput = $('industryUploadInput');
    if(upBtn && upInput){
      upBtn.onclick = () => upInput.click();
      upInput.onchange = (e) => {
        const f = e.target.files[0];
        if(f) uploadIndustries(f);
        e.target.value = '';
      };
    }

    const saveConfirm = $('saveIndustryConfirm');
    if(saveConfirm) saveConfirm.onclick = () => {
      const name = ($('saveIndustryNameInput')?.value || '').trim();
      if(!name){
        if(window.showToast) window.showToast('اسم خالی نباشه', true);
        return;
      }
      try{
        const snapshot = snapshotIndustry();
        snapshot.name = name;
        snapshot.starred = false;
        INDUSTRY_SAVED.unshift(snapshot);
        if(INDUSTRY_SAVED.length > 30) INDUSTRY_SAVED.length = 30;
        saveIndustriesToStorage();
        renderIndustrySaved();
        closeSaveIndustryModal();
        if(window.showToast) window.showToast('✅ صنعت ذخیره شد!');
      }catch(e){
        if(window.showToast) window.showToast('خطا: ' + e.message, true);
      }
    };

    const saveCancel = $('saveIndustryCancel');
    if(saveCancel) saveCancel.onclick = closeSaveIndustryModal;

    const saveModal = $('saveIndustryModal');
    if(saveModal) saveModal.addEventListener('click', e => {
      if(e.target.id === 'saveIndustryModal') closeSaveIndustryModal();
    });

    const saveNameInput = $('saveIndustryNameInput');
    if(saveNameInput) saveNameInput.addEventListener('keydown', e => {
      if(e.key === 'Enter') $('saveIndustryConfirm').click();
      if(e.key === 'Escape') closeSaveIndustryModal();
    });

    const cmpConfirm = $('compareIndustryConfirm');
    if(cmpConfirm) cmpConfirm.onclick = runTwoIndustriesCompare;

    const cmpCancel = $('compareIndustryCancel');
    if(cmpCancel) cmpCancel.onclick = closeCompareIndustriesModal;

    const cmpModal = $('compareIndustriesModal');
    if(cmpModal) cmpModal.addEventListener('click', e => {
      if(e.target.id === 'compareIndustriesModal') closeCompareIndustriesModal();
    });

    document.addEventListener('input', e => {
      if(e.target.id === 'industrySavedSearch') renderIndustrySaved();
    });
    document.addEventListener('change', e => {
      if(e.target.id === 'industrySavedSort') renderIndustrySaved();
    });
  }

  /* ============================================================
     ۹. تغییر تم
  ============================================================ */
  window.onThemeChange = function(){
    if(INDUSTRY_RESULTS) renderIndustryOutput();
  };

  /* ============================================================
     Init
  ============================================================ */
  function init(){
    bindBaseInputs();
    bindPeersInputs();
    bindButtons();
    renderPeers();
    renderIndustrySaved();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('%c📈 compare.js v2.1.0 لود شد', 'color:#f59e0b;font-weight:bold');

})();