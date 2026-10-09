/* ============================================================
   compare.js — منطق تب «مقایسه با صنعت»  |  v1.5
   وابسته به: app.js (window.KodalHelpers)
   طراحی جدید:
   - سهم اصلی (Base) + تا ۱۰ سهم هم‌گروهی
   - محاسبه آمار صنعت (میانگین/بهترین/بدترین/میانه)
   - جایگاه سهم اصلی در صنعت
   - ذخیره آمار صنعت و لیست صنایع
   - مقایسه دو صنعت با هم
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

  /* ---------- کمک‌کننده: فرمت عدد ---------- */
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

  /* ---------- میانگین/میانه/انحراف ---------- */
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
  const PEER_COLORS = ['#1769e0', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#65a30d', '#dc2626', '#0891b2', '#a16207', '#7c3aed'];

  /* ---------- State ---------- */
  let BASE = { file: null, parsed: null, symbol: '', industry: '', price: null, shares: null };
  let PEERS = [];
  let INDUSTRY_RESULTS = null;
  let INDUSTRY_SAVED = [];
  const MAX_PEERS = 10;

  const INDUSTRY_STORAGE_KEY = 'kodal_industries_v1';

  /* ============================================================
     Storage: صنایع ذخیره‌شده
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
     ۱. سهم اصلی — فرم و فایل
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
      const maxPer = Math.max(...Object.values(parsed).map(a => a.length));
      parsed._periods = Math.min(Math.max(maxPer, 1), 5);

      const detected = detectPeriod(lines);
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

  function detectPeriod(lines){
    return { label: null, year: null, months: null };
  }

  /* ============================================================
     ۲. هم‌گروهی‌ها — لیست داینامیک
  ============================================================ */
  function renderPeers(){
    const box = $('peersList');
    if(!box) return;

    if(!PEERS.length){
      box.innerHTML = `
        <div class="saved-empty" style="padding:20px;text-align:center;color:var(--sub);font-size:13px;border:2px dashed var(--line);border-radius:12px">
          هنوز سهم هم‌گروهی اضافه نکردی.<br>
          روی «➕ افزودن سهم هم‌گروهی» بزن یا فایل‌ها رو بکش و بذار اینجا.
        </div>
      `;
      updateCompareButton();
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
    const files = Array.from(fileList).slice(0, remaining);

    if(!files.length){
      if(errBox){
        errBox.style.display = 'block';
        errBox.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم هم‌گروهی مجازه.`;
      }
      return;
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
        const maxPer = Math.max(...Object.values(parsed).map(a => a.length));
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

    if(fileList.length > remaining && errBox){
      errBox.style.display = 'block';
      errBox.textContent = `حداکثر ${H.toFa(MAX_PEERS)} سهم هم‌گروهی مجازه. ${H.toFa(fileList.length - remaining)} فایل نادیده گرفته شد.`;
    }
  }

  function createPeerInputRow(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx,.csv,.html,.htm,.txt';
    input.multiple = true;
    return input;
  }

  function bindPeersInputs(){
    const addBtn = $('addPeerBtn');
    if(addBtn){
      addBtn.onclick = () => {
        const input = createPeerInputRow();
        input.onchange = (e) => {
          addPeerFiles(e.target.files);
          e.target.value = '';
        };
        input.click();
      };
    }

    const clearBtn = $('clearPeersBtn');
    if(clearBtn){
      clearBtn.onclick = () => {
        if(!PEERS.length) return;
        if(!confirm('همه سهم‌های هم‌گروهی پاک شن؟')) return;
        PEERS = [];
        renderPeers();
      };
    }
  }

  function bindPeersDrop(){
    const box = $('peersList');
    if(!box) return;

    ['dragover', 'dragenter'].forEach(ev => {
      box.addEventListener(ev, e => {
        e.preventDefault();
        box.classList.add('hover');
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      box.addEventListener(ev, e => {
        e.preventDefault();
        box.classList.remove('hover');
      });
    });
    box.addEventListener('drop', (e) => {
      addPeerFiles(e.dataTransfer.files);
    });
  }

  /* ============================================================
     ۳. محاسبه و مقایسه
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

  function runIndustryCompare(){
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
    renderIndustryOutput();
    const out = $('industryOut');
    if(out) out.style.display = 'block';
    const saveBtn = $('saveIndustryBtn');
    if(saveBtn){
      saveBtn.style.display = 'inline-block';
      saveBtn.disabled = false;
    }
    window.scrollTo({ top: $('industryOut').offsetTop - 20, behavior: 'smooth' });
  }

  /* ============================================================
     ۴. رندر خروجی
  ============================================================ */
  function renderIndustryOutput(){
    try{ renderBasePosition(); }catch(e){ console.error('renderBasePosition:', e); }
    try{ renderIndustryScores(); }catch(e){ console.error('renderIndustryScores:', e); }
    try{ renderIndustryZScore(); }catch(e){ console.error('renderIndustryZScore:', e); }
    try{ renderIndustryMainTable(); }catch(e){ console.error('renderIndustryMainTable:', e); }
    try{ renderIndustryBar(); }catch(e){ console.error('renderIndustryBar:', e); }
    try{ renderIndustryRadar(); }catch(e){ console.error('renderIndustryRadar:', e); }
    try{ renderIndustryRanking(); }catch(e){ console.error('renderIndustryRanking:', e); }
  }

  function renderBasePosition(){
    const box = $('basePositionSummary');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;

    const criteria = [
      { key: 'netMargin', getter: r => r.r.netMargin, dir: 'higher', label: 'حاشیه سود خالص', fmt: 'pct' },
      { key: 'roe', getter: r => r.r.roe, dir: 'higher', label: 'ROE', fmt: 'pct' },
      { key: 'currentRatio', getter: r => r.r.currentRatio, dir: 'higher', label: 'نسبت جاری', fmt: 'num' },
      { key: 'debtToEquity', getter: r => r.r.debtToEquity, dir: 'lower', label: 'بدهی به حقوق', fmt: 'num' },
      { key: 'cfoToNet', getter: r => r.r.cfoToNet, dir: 'higher', label: 'کیفیت سود', fmt: 'num' },
      { key: 'score', getter: r => r.score, dir: 'higher', label: 'امتیاز کلی', fmt: 'num' },
    ];

    const all = [base, ...peers];

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

    const baseScore = scores[0];
    const sortedScores = [...scores].sort((a, b) => b - a);
    const baseRank = sortedScores.indexOf(baseScore) + 1;
    const total = all.length;
    const betterThan = scores.filter(s => s < baseScore).length;
    const worseThan = scores.filter(s => s > baseScore).length;
    const totalPossible = criteria.length * (total - 1);

    const rankPercent = baseRank === 1 ? '🥇' : baseRank === 2 ? '🥈' : baseRank === 3 ? '🥉' : '🎖️';
    const posClass = baseRank <= total / 2 ? 'good' : 'bad';
    const posColor = posClass === 'good' ? 'var(--good)' : 'var(--bad)';
    const posLabel = baseRank <= total / 2 ? 'بهتر از میانگین صنعت' : 'ضعیف‌تر از میانگین صنعت';

    const betterPct = total > 1 ? (betterThan / (total - 1)) * 100 : 0;
    const worsePct = total > 1 ? (worseThan / (total - 1)) * 100 : 0;

    let html = `
      <div class="base-position-grid">
        <div class="bp-card bp-base">
          <div class="bp-label">🎯 سهم اصلی</div>
          <div class="bp-value" style="color:${BASE_COLOR}">${base.symbol}</div>
          ${base.industry ? `<div class="bp-sub">صنعت: ${base.industry}</div>` : ''}
        </div>

        <div class="bp-card bp-rank">
          <div class="bp-label">🏆 رتبه در صنعت</div>
          <div class="bp-value" style="color:${posColor}">
            ${rankPercent} ${H.toFa(baseRank)} از ${H.toFa(total)}
          </div>
          <div class="bp-sub" style="color:${posColor}">${posLabel}</div>
        </div>

        <div class="bp-card bp-better">
          <div class="bp-label">✅ بهتر از</div>
          <div class="bp-value" style="color:var(--good)">${H.toFa(betterThan)} سهم</div>
          <div class="bp-sub">${H.toFa(betterPct.toFixed(0))}٪ از هم‌گروهی‌ها</div>
        </div>

        <div class="bp-card bp-worse">
          <div class="bp-label">❌ ضعیف‌تر از</div>
          <div class="bp-value" style="color:var(--bad)">${H.toFa(worseThan)} سهم</div>
          <div class="bp-sub">${H.toFa(worsePct.toFixed(0))}٪ از هم‌گروهی‌ها</div>
        </div>

        <div class="bp-card bp-score">
          <div class="bp-label">📊 امتیاز کل</div>
          <div class="bp-value">${H.toFa(baseScore)}</div>
          <div class="bp-sub">از ${H.toFa(totalPossible)} امتیاز ممکن</div>
        </div>
      </div>
    `;

    box.innerHTML = html;
  }

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

    let html = `
      <div class="cmp-score-card" style="border-top-color:${BASE_COLOR}">
        <div class="symbol">
          <span class="color-dot" style="background:${BASE_COLOR}"></span>
          🎯 ${base.symbol}
        </div>
        <div class="num" style="color:${baseLvl.color}">${baseScore == null ? '—' : H.toFa(baseScore)}</div>
        <div class="lvl" style="color:${baseLvl.color}">${baseLvl.label}</div>
        ${rank ? `<div class="lvl" style="color:var(--sub);font-size:11.5px;margin-top:6px">رتبه ${H.toFa(rank)} از ${H.toFa(allScores.length)}</div>` : ''}
      </div>

      <div class="cmp-score-card" style="border-top-color:#94a3b8">
        <div class="symbol">
          <span class="color-dot" style="background:#94a3b8"></span>
          📊 میانگین صنعت
        </div>
        <div class="num" style="color:#94a3b8">${avgScore == null ? '—' : H.toFa(Math.round(avgScore))}</div>
        <div class="lvl" style="color:#94a3b8">${H.toFa(peers.length)} سهم هم‌گروهی</div>
      </div>

      <div class="cmp-score-card" style="border-top-color:#16834a">
        <div class="symbol">
          <span class="color-dot" style="background:#16834a"></span>
          🥇 بهترین صنعت
        </div>
        <div class="num" style="color:#16834a">${bestScore == null ? '—' : H.toFa(bestScore)}</div>
        <div class="lvl" style="color:#16834a">بالاترین امتیاز</div>
      </div>

      <div class="cmp-score-card" style="border-top-color:#c62828">
        <div class="symbol">
          <span class="color-dot" style="background:#c62828"></span>
          📉 بدترین صنعت
        </div>
        <div class="num" style="color:#c62828">${worstScore == null ? '—' : H.toFa(worstScore)}</div>
        <div class="lvl" style="color:#c62828">پایین‌ترین امتیاز</div>
      </div>
    `;

    box.innerHTML = html;
  }

  function renderIndustryZScore(){
    const box = $('industryZScore');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;
    const all = [base, ...peers];

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
            <div class="zone" style="color:var(--sub)">اطلاعات کافی نیست</div>
          </div>
        `;
      }

      let zone, zoneColor;
      if(z > 2.99){ zone = '🟢 منطقه امن'; zoneColor = '#16834a'; }
      else if(z >= 1.81){ zone = '🟡 منطقه خاکستری'; zoneColor = '#eab308'; }
      else { zone = '🔴 منطقه خطر'; zoneColor = '#c62828'; }

      const pos = Math.max(0, Math.min(100, (z / 4) * 100));

      return `
        <div class="cmp-zscore-card" style="border-top-color:${color}">
          <div class="symbol">
            <span class="color-dot" style="background:${color}"></span>
            ${isBase ? '🎯 ' : ''}${r.symbol}
          </div>
          <div class="num" style="color:${zoneColor}">${H.num2(z)}</div>
          <div class="zone" style="color:${zoneColor}">${zone}</div>
          <div class="bar"><div class="marker" style="left:${pos}%"></div></div>
        </div>
      `;
    }

    const peerZ = peers.map(p => p.zscore).filter(z => z != null && isFinite(z));
    const avgZ = avg(peerZ);

    let html = zCard(base, true);

    if(avgZ != null){
      const zoneAvg = avgZ > 2.99 ? '🟢 منطقه امن' : avgZ >= 1.81 ? '🟡 منطقه خاکستری' : '🔴 منطقه خطر';
      const zoneAvgColor = avgZ > 2.99 ? '#16834a' : avgZ >= 1.81 ? '#eab308' : '#c62828';
      const posAvg = Math.max(0, Math.min(100, (avgZ / 4) * 100));
      html += `
        <div class="cmp-zscore-card" style="border-top-color:#94a3b8">
          <div class="symbol">
            <span class="color-dot" style="background:#94a3b8"></span>
            📊 میانگین صنعت
          </div>
          <div class="num" style="color:${zoneAvgColor}">${H.num2(avgZ)}</div>
          <div class="zone" style="color:${zoneAvgColor}">${zoneAvg}</div>
          <div class="bar"><div class="marker" style="left:${posAvg}%"></div></div>
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
          <div class="zone" style="color:${zBest}">بالاترین Z</div>
        </div>
      `;
    }
    if(worstZ != null && worstZ !== bestZ){
      const zWorst = worstZ > 2.99 ? '#16834a' : worstZ >= 1.81 ? '#eab308' : '#c62828';
      html += `
        <div class="cmp-zscore-card" style="border-top-color:#c62828">
          <div class="symbol">
            <span class="color-dot" style="background:#c62828"></span>
            📉 بدترین صنعت
          </div>
          <div class="num" style="color:${zWorst}">${H.num2(worstZ)}</div>
          <div class="zone" style="color:${zWorst}">پایین‌ترین Z</div>
        </div>
      `;
    }

    box.innerHTML = html;
  }

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
    const all = [base, ...peers];

    let html = '<table class="cmp-table industry-table"><thead><tr>';
    html += '<th>نسبت</th>';
    html += `<th style="color:${BASE_COLOR}">🎯 ${base.symbol}</th>`;
    html += '<th style="color:#94a3b8">📊 میانگین صنعت</th>';
    html += '<th style="color:#16834a">🥇 بهترین</th>';
    html += '<th style="color:#c62828">📉 بدترین</th>';
    html += '<th>جایگاه سهم اصلی</th>';
    html += '</tr></thead><tbody>';

    MAIN_RATIOS.forEach(ratio => {
      const baseVal = _cmpVal(ratio.getter(base));
      const peerVals = peers.map(p => _cmpVal(ratio.getter(p))).filter(v => v != null);

      const avgVal = avg(peerVals);
      const bestVal = best(peerVals, ratio.dir);
      const worstVal = worst(peerVals, ratio.dir);

      let rank = null, totalWithBase = null;
      if(baseVal != null && peerVals.length > 0){
        const allVals = [baseVal, ...peerVals];
        const sorted = [...allVals].sort((a, b) => ratio.dir === 'higher' ? b - a : a - b);
        rank = sorted.indexOf(baseVal) + 1;
        totalWithBase = allVals.length;
      }

      let posHtml = '—';
      if(rank != null){
        const isGood = rank <= totalWithBase / 2;
        const posColor = isGood ? 'var(--good)' : 'var(--bad)';
        const posIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        posHtml = `<span style="color:${posColor};font-weight:700">${posIcon} ${H.toFa(rank)} از ${H.toFa(totalWithBase)}</span>`;
      }

      let vsAvg = '';
      if(baseVal != null && avgVal != null && avgVal !== 0){
        const diff = ((baseVal - avgVal) / Math.abs(avgVal)) * 100;
        const isBetter = ratio.dir === 'higher' ? diff > 0 : diff < 0;
        const color = isBetter ? 'var(--good)' : 'var(--bad)';
        const sign = diff > 0 ? '+' : '';
        vsAvg = `<div style="font-size:11px;color:${color};margin-top:2px">${sign}${H.toFa(diff.toFixed(1))}٪ نسبت به میانگین</div>`;
      }

      html += '<tr>';
      html += `<td>${ratio.label}</td>`;
      html += `<td style="color:${BASE_COLOR};font-weight:700;background:rgba(245,158,11,.08)">${formatRatioValue(baseVal, ratio.fmt)}${vsAvg}</td>`;
      html += `<td>${formatRatioValue(avgVal, ratio.fmt)}</td>`;
      html += `<td style="color:var(--good)">${formatRatioValue(bestVal, ratio.fmt)}</td>`;
      html += `<td style="color:var(--bad)">${formatRatioValue(worstVal, ratio.fmt)}</td>`;
      html += `<td>${posHtml}</td>`;
      html += '</tr>';
    });

    html += '</tbody></table>';
    box.innerHTML = html;
  }

  function renderIndustryBar(){
    const box = $('industryBar');
    const legendBox = $('industryBarLegend');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;

    const metrics = [
      { key: 'netMargin',    label: 'حاشیه سود خالص', getter: r => r.r.netMargin,    fmt: 'pct' },
      { key: 'roe',          label: 'ROE',             getter: r => r.r.roe,          fmt: 'pct' },
      { key: 'roa',          label: 'ROA',             getter: r => r.r.roa,          fmt: 'pct' },
      { key: 'opMargin',     label: 'حاشیه سود عملیاتی', getter: r => r.r.opMargin,  fmt: 'pct' },
    ];

    const W = 700, Hh = 320, padL = 120, padR = 20, padT = 20, padB = 50;
    const plotW = W - padL - padR;
    const plotH = Hh - padT - padB;
    const groupW = plotW / metrics.length;

    const all = [base, ...peers];
    const barW = Math.min(30, (groupW - 20) / all.length);
    const totalBarW = all.length * barW + (all.length - 1) * 3;

    let svg = `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid meet">`;
    const baseY = padT + plotH;

    svg += `<line x1="${padL}" y1="${baseY}" x2="${W-padR}" y2="${baseY}" stroke="${_c('chartBaseColor')}" stroke-width="1"/>`;

    const steps = 4;
    for(let i = 0; i <= steps; i++){
      const y = padT + (plotH * i / steps);
      svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${_c('chartLineColor')}" stroke-width="0.8" stroke-dasharray="3,3"/>`;
    }

    metrics.forEach((m, mi) => {
      const groupX = padL + mi * groupW;
      const startX = groupX + (groupW - totalBarW) / 2;

      const vals = all.map(r => m.getter(r)).filter(v => v != null && isFinite(v));
      const maxAbs = vals.length ? Math.max(...vals.map(Math.abs)) : 0;
      if(maxAbs === 0) return;

      all.forEach((r, ci) => {
        const val = m.getter(r);
        if(val == null || !isFinite(val)) return;
        const h = Math.abs(val) / maxAbs * plotH;
        const x = startX + ci * (barW + 3);
        const y = baseY - h;
        const opacity = r.isBase ? 1 : 0.7;
        svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${r.color}" rx="3" opacity="${opacity}">
                  <title>${r.isBase ? '🎯 ' : ''}${r.symbol} — ${m.label}: ${m.fmt === 'pct' ? H.pct(val) : H.num2(val)}</title>
                </rect>`;
      });

      const cx = groupX + groupW / 2;
      svg += `<text x="${cx}" y="${baseY + 22}" text-anchor="middle" font-size="12" font-weight="600" fill="${_c('chartLabelColor')}">${m.label}</text>`;
    });

    svg += '</svg>';
    box.innerHTML = svg;

    if(legendBox){
      legendBox.innerHTML = all.map(r =>
        `<span><i style="background:${r.color};${r.isBase ? 'border:2px solid #f59e0b' : 'opacity:.7'}"></i>${r.isBase ? '🎯 ' : ''}${r.symbol}</span>`
      ).join('');
    }
  }

  function renderIndustryRadar(){
    const box = $('industryRadar');
    const legendBox = $('industryRadarLegend');
    if(!box) return;

    const { base, peers } = INDUSTRY_RESULTS;

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
    const W = 480, Hh = 480;
    const cx = W / 2, cy = Hh / 2;
    const R = 170;

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
      svg += `<polygon points="${d}" fill="none" stroke="${_c('chartLineColor')}" stroke-width="1"/>`;
    }

    const outerPts = polygonPoints(R);
    outerPts.forEach(p => {
      svg += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="${_c('chartLineColor')}" stroke-width="1"/>`;
    });

    outerPts.forEach((p, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / N);
      const labelR = R + 28;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      const anchor = (Math.abs(Math.cos(angle)) < 0.1)
        ? 'middle'
        : (Math.cos(angle) > 0 ? 'start' : 'end');
      svg += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="11.5" font-weight="600" fill="${_c('chartLabelColor')}">${RADAR_METRICS[i].label}</text>`;
    });

    const allSorted = [...peers, base];

    allSorted.forEach(r => {
      const vals = RADAR_METRICS.map(m => m.getter(r));
      const pts = vals.map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / N);
        const radius = (v / 100) * R;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return [x, y];
      });
      const d = pts.map(p => p.join(',')).join(' ');
      const strokeW = r.isBase ? 3 : 1.8;
      const opacity = r.isBase ? 1 : 0.5;
      const fillOpacity = r.isBase ? '44' : '11';
      svg += `<polygon points="${d}" fill="${r.color}${fillOpacity}" stroke="${r.color}" stroke-width="${strokeW}" stroke-linejoin="round" opacity="${opacity}"/>`;
      if(r.isBase){
        pts.forEach(p => {
          svg += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${r.color}"/>`;
        });
      }
    });

    svg += '</svg>';
    box.innerHTML = svg;

    if(legendBox){
      legendBox.innerHTML = allSorted.map(r =>
        `<span><i style="background:${r.color};${r.isBase ? 'border:2px solid #f59e0b' : 'opacity:.6'}"></i>${r.isBase ? '🎯 ' : ''}${r.symbol}</span>`
      ).join('');
    }
  }

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
    html += '<th>رتبه</th><th>شرکت</th><th>امتیاز</th>';
    criteria.forEach(c => html += `<th>${c.label}</th>`);
    html += '</tr></thead><tbody>';

    ranked.forEach((r) => {
      const rank = rankMap.get(r);
      const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '🎖️';
      const rankClass = rank === 0 ? 'cmp-rank-1' : rank === 1 ? 'cmp-rank-2' : rank === 2 ? 'cmp-rank-3' : '';
      const isBase = r.isBase;
      const rowStyle = isBase
        ? `background:rgba(245,158,11,.08);font-weight:600`
        : '';

      html += `<tr style="${rowStyle}">`;
      html += `<td><span class="cmp-rank-medal">${medal}</span><span class="${rankClass}">${H.toFa(rank + 1)}</span></td>`;
      html += `<td style="color:${r.color};font-weight:700;text-align:right">${isBase ? '🎯 ' : ''}${r.symbol}</td>`;
      html += `<td style="background:transparent;color:${r.color};font-weight:700">${H.toFa(r.totalScore)}</td>`;

      criteria.forEach(c => {
        const rawV = c.getter(r);
        const cv = _cmpVal(rawV);
        const allCmp = all.map(x => _cmpVal(c.getter(x))).filter(x => x != null);
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
        const display = formatRatioValue(rawV, c.fmt);
        html += `<td class="${cls}">${display}</td>`;
      });
      html += `</tr>`;
    });

    html += '</tbody></table>';

    if(ranked.length){
      if(winners.length === 1 && maxScore > 0){
        const w = winners[0];
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🏆 <b>برنده کلی:</b> <span style="color:${w.color};font-weight:700">${w.isBase ? '🎯 ' : ''}${w.symbol}</span>
          با امتیاز <b>${H.toFa(w.totalScore)}</b> از ${H.toFa(totalPossible)}.
        </div>` + html;
      } else if(maxScore === 0){
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🤝 هیچ شرکتی برتری انحصاری نداره.
        </div>` + html;
      } else {
        html = `<div class="one-line-note" style="margin-bottom:12px">
          🤝 برندگان مشترک با امتیاز <b>${H.toFa(maxScore)}</b> از ${H.toFa(totalPossible)}.
        </div>` + html;
      }
    }

    box.innerHTML = html;
  }

  /* ============================================================
     ۵. ذخیره و بازیابی صنایع
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

      runIndustryCompare();

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
      version: '1.5',
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
     ۶. مقایسه دو صنعت
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

    const out = $('industryOut');
    if(out) out.style.display = 'block';

    let existing = document.getElementById('twoIndustriesCompareBox');
    if(existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'twoIndustriesCompareBox';
    box.className = 'card';
    box.style.borderRight = '4px solid #8b5cf6';
    box.innerHTML = `<h2>⚖️ مقایسه دو صنعت: <span style="color:#1769e0">${A.name}</span> vs <span style="color:#8b5cf6">${B.name}</span></h2>
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

    out.insertBefore(box, out.firstChild);

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

    window.scrollTo({ top: out.offsetTop - 20, behavior: 'smooth' });
    if(window.showToast) window.showToast('✅ مقایسه دو صنعت انجام شد');
  }

  /* ============================================================
     ۷. اتصال دکمه‌ها
  ============================================================ */
  function bindButtons(){
    const compareBtn = $('compareIndustryGo');
    if(compareBtn) compareBtn.onclick = runIndustryCompare;

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
     ۸. تغییر تم
  ============================================================ */
  window.onThemeChange = function(){
    if(INDUSTRY_RESULTS) renderIndustryOutput();
  };

  /* ============================================================
     Init
  ============================================================ */
  bindBaseInputs();
  bindPeersInputs();
  bindPeersDrop();
  bindButtons();
  renderPeers();
  renderIndustrySaved();

  console.log('%c📈 compare.js v1.5 لود شد (مقایسه با صنعت)', 'color:#f59e0b;font-weight:bold');

})();