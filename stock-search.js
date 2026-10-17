/* ============================================================
   stock-search.js — جستجو + دریافت خودکار از TSETMC
   نسخه: 2.4.0 — P/E و EPS از ClosingPriceDailyList
============================================================ */

(function(){
  'use strict';

  const H = window.KodalHelpers;
  if(!H){
    console.error('❌ stock-search.js: KodalHelpers لود نشده!');
    return;
  }
  const $ = id => document.getElementById(id);

  /* ============================================================
     ⭐ تشخیص نوع صنعت از روی اسم گروه
  ============================================================ */
  function detectSectorType(industry, symbol){
    if(symbol && window.SYMBOL_MAP && window.SYMBOL_MAP[symbol]){
      return window.SYMBOL_MAP[symbol];
    }
    if(!industry) return 'normal';

    const s = String(industry)
      .replace(/\u200c|\u200f|\u200e/g, '')
      .replace(/[يى]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if(/بانک|موسسه اعتباری|موسسات اعتباری|صرافی/.test(s)) return 'bank';

    if(/بیمه/.test(s) && !/سرمایه ?گذاری/.test(s) && !/سرمايه ?گذاري/.test(s)) return 'insurance';
    if(/صندوق بازنشستگی/.test(s) && !/سرمایه ?گذاری/.test(s) && !/سرمايه ?گذاري/.test(s)) return 'insurance';

    if(/لیزینگ/.test(s)) return 'leasing';
    if(/سایر\s*واسطه/.test(s)) return 'leasing';
    if(/چند\s*رشته/.test(s)) return 'investment';

    if(/سرمایه ?گذاری/.test(s)) return 'investment';
    if(/سرمايه ?گذاري/.test(s)) return 'investment';
    if(/^سرمایه ?گذاریها$/.test(s)) return 'investment';
    if(/^سرمايه ?گذاريها$/.test(s)) return 'investment';
    if(/سرمایه ?گذاری ?ها/.test(s)) return 'investment';
    if(/سرمايه ?گذاري ?ها/.test(s)) return 'investment';
    if(/شرکت ?های ?سرمایه ?گذاری/.test(s)) return 'investment';
    if(/شرکت ?هاي ?سرمايه ?گذاري/.test(s)) return 'investment';

    return 'normal';
  }
  window.detectSectorType = detectSectorType;

  /* ============================================================
     فیلتر کردن نتایج TSETMC
  ============================================================ */
  function _isRegularStock(item){
    const sym = (item.lVal18AFC || '').trim();
    const name = (item.lVal30 || '');
    const flow = item.flow || 0;

    if(!sym) return false;
    if(![1, 2, 4].includes(flow)) return false;
    if(/^ح\s*\./.test(name.trim())) return false;
    if(/حق\s*تقدم/i.test(name)) return false;
    if(/حق\s*تقدم/i.test(sym)) return false;
    if(/^اختيار|^اختیار/i.test(name)) return false;
    if(/^اختيار|^اختیار/i.test(sym)) return false;
    if(/^اوراق/.test(sym) || /^اوراق/.test(name)) return false;
    if(/^سلف/.test(sym) || /سلف\s*فروش/i.test(name)) return false;

    return true;
  }

  /* ============================================================
     جستجوی نماد
  ============================================================ */
  async function searchSymbol(query){
    if(!query || !query.trim()) return null;
    const url = `https://cdn.tsetmc.com/api/Instrument/GetInstrumentSearch/${encodeURIComponent(query.trim())}`;

    let response;
    try {
      response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    } catch(netErr) {
      throw new Error('اتصال به سرور تستمک برقرار نشد. اینترنت رو بررسی کن.');
    }
    if(!response.ok) throw new Error(`خطای شبکه: ${response.status}`);

    const data = await response.json();
    const results = data.instrumentSearch;
    if(!results || !results.length) return [];

    const filtered = results.filter(_isRegularStock);

    return filtered.map(item => ({
      insCode: item.insCode,
      symbol: item.lVal18AFC || '—',
      name: item.lVal30 || '—',
    }));
  }

  /* ============================================================
     قیمت لحظه‌ای
  ============================================================ */
  async function fetchPriceInfo(insCode){
    const url = `https://cdn.tsetmc.com/api/ClosingPrice/GetClosingPriceInfo/${insCode}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if(!response.ok) throw new Error(`خطای شبکه: ${response.status}`);

    const data = await response.json();
    const info = data.closingPriceInfo;
    if(!info) throw new Error('ساختار پاسخ نامعتبر');

    // ⭐ لاگ کامل برای دیدن همه فیلدها
    console.log('🔍 ClosingPriceInfo keys:', Object.keys(info));
    console.log('🔍 ClosingPriceInfo raw:', info);

    const lastPrice = info.pDrCotVal || 0;
    const closePrice = info.pClosing || 0;
    const yesterdayPrice = info.priceYesterday || 0;

    let changePercent = null;
    if(yesterdayPrice > 0 && closePrice > 0){
      changePercent = ((closePrice - yesterdayPrice) / yesterdayPrice) * 100;
    } else if(yesterdayPrice > 0 && lastPrice > 0){
      changePercent = ((lastPrice - yesterdayPrice) / yesterdayPrice) * 100;
    }

    // ⭐ P/E و EPS از همین API (اگه باشه)
    const tsetmcPE = info.pE && info.pE > 0 ? info.pE : null;
    const tsetmcEPS = info.eps && info.eps !== 0 ? info.eps : null;

    return { lastPrice, closePrice, yesterdayPrice, changePercent, tsetmcPE, tsetmcEPS };
  }

  /* ============================================================
     اطلاعات نماد (تعداد سهام، صنعت)
  ============================================================ */
  async function fetchInstrumentInfo(insCode){
    const url = `https://cdn.tsetmc.com/api/Instrument/GetInstrumentInfo/${insCode}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if(!response.ok) return null;

    const data = await response.json();
    const info = data.instrumentInfo;
    if(!info) return null;

    let shares = null;
    if(info.zTitad && info.zTitad > 0){
      shares = info.zTitad;
    }

    let industry = '';
    if(info.sector && info.sector.lSecVal){
      industry = String(info.sector.lSecVal).trim();
    }

    return { shares, industry };
  }

  /* ============================================================
     ⭐ P/E و EPS از ClosingPriceDailyList
  ============================================================ */
  async function fetchTsetmcPE(insCode){
    try {
      const url = `https://cdn.tsetmc.com/api/ClosingPrice/GetClosingPriceDailyList/${insCode}/1`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if(!response.ok){
        console.warn('fetchTsetmcPE: خطای شبکه', response.status);
        return null;
      }

      const data = await response.json();
      const list = data.closingPriceDaily;
      if(!list || !list.length){
        console.warn('fetchTsetmcPE: لیست خالیه');
        return null;
      }

      const latest = list[0];

      // ⭐ لاگ کامل برای دیباگ
      console.log('🎯 ClosingPriceDaily keys:', Object.keys(latest));
      console.log('🎯 ClosingPriceDaily raw:', latest);

      const pe = (latest.pE && latest.pE > 0 && latest.pE < 10000) ? latest.pE : null;
      const eps = (latest.eps && latest.eps !== 0) ? latest.eps : null;
      const peGroup = (latest.pEgroup && latest.pEgroup > 0) ? latest.pEgroup : null;

      console.log('✅ P/E استخراج‌شده:', pe, '| EPS:', eps, '| PE Group:', peGroup);

      return { pe, eps, peGroup };
    } catch(e){
      console.warn('❌ خطا در fetchTsetmcPE:', e.message);
      return null;
    }
  }

  /* ============================================================
     پر کردن فیلدهای فرم
  ============================================================ */
  function fillFields(data){
    if($('symbolName')) $('symbolName').value = data.symbol || '';

    if($('stockPrice') && data.lastPrice > 0){
      $('stockPrice').value = H.formatNumberInput(data.lastPrice);
    }

    if($('stockCount') && data.shares && data.shares > 0){
      $('stockCount').value = H.formatNumberInput(data.shares);
    }

    ['symbolName', 'stockPrice', 'stockCount'].forEach(id => {
      const el = $(id);
      if(!el) return;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function fillInfoBox(data){
    const priceText = data.lastPrice
      ? H.toFa(Math.round(data.lastPrice).toLocaleString('en-US'))
      : '—';
    const sharesText = data.shares
      ? H.toFa(Math.round(data.shares).toLocaleString('en-US'))
      : '—';

    if($('stockSymbolDisplay')) $('stockSymbolDisplay').value = data.symbol || '—';
    if($('stockPriceDisplay')) $('stockPriceDisplay').value = priceText;
    if($('stockSharesDisplay')) $('stockSharesDisplay').value = sharesText;
    if($('stockIndustryDisplay')) $('stockIndustryDisplay').value = data.industry || '—';

    if($('stockInfoBox')) $('stockInfoBox').style.display = 'block';
    if($('stockInfoSection')) $('stockInfoSection').style.display = 'block';
  }

  function showMessage(html, type){
    const box = $('searchResultMsg');
    if(!box) return;
    box.style.display = 'flex';
    box.className = 'search-result-msg ' + (type === 'error' ? 'error' : 'success');
    box.innerHTML = html;
  }

  function clearMessage(){
    const box = $('searchResultMsg');
    if(box){
      box.style.display = 'none';
      box.innerHTML = '';
    }
  }

  function buildSearchUI(){
    if($('stockSearchInput')) return;

    const anchor = $('stockSearchAnchor');
    if(!anchor) return;

    const section = document.createElement('div');
    section.className = 'input-section stock-search-section';
    section.innerHTML = `
      <div class="input-section-title">
        <span class="step-badge">۲</span>
        🔍 جستجوی سهم
      </div>

      <div class="stock-search-row">
        <input id="stockSearchInput" type="text"
               placeholder="⚠️ وارد کردن نماد الزامی است"
               autocomplete="off">
        <button id="stockSearchBtn" class="primary" type="button">
          🔍 جستجو
        </button>
      </div>

      <div id="stockSearchResults" class="stock-search-results"></div>
      <div id="searchResultMsg" class="search-result-msg" style="display:none"></div>
    `;

    anchor.parentNode.insertBefore(section, anchor.nextSibling);

    $('stockSearchBtn').onclick = () => handleSearch();
    $('stockSearchInput').addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        handleSearch();
      }
    });
  }

  async function handleSearch(){
    const input = $('stockSearchInput');
    const resultsBox = $('stockSearchResults');
    const btn = $('stockSearchBtn');

    const query = (input?.value || '').trim();
    if(!query){
      showMessage('⚠️ اسم نماد رو وارد کن', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ ...';
    resultsBox.innerHTML = '';
    clearMessage();

    try{
      const results = await searchSymbol(query);

      if(!results || !results.length){
        showMessage(`❌ نمادی با اسم «${H.escapeHtml(query)}» پیدا نشد`, 'error');
        return;
      }

      if(results.length === 1){
        await selectStock(results[0]);
        return;
      }

      const exactMatch = results.find(r =>
        r.symbol.toLowerCase() === query.toLowerCase()
      );
      if(exactMatch){
        await selectStock(exactMatch);
        return;
      }

      resultsBox.innerHTML = results.slice(0, 10).map((r, i) => `
        <div class="stock-result-item" data-idx="${i}">
          <span class="sri-symbol">${H.escapeHtml(r.symbol)}</span>
          <span class="sri-name">${H.escapeHtml(r.name)}</span>
        </div>
      `).join('');

      resultsBox.querySelectorAll('.stock-result-item').forEach((el, i) => {
        el.onclick = () => selectStock(results[i]);
      });

    }catch(err){
      showMessage('❌ ' + H.escapeHtml(err.message), 'error');
    }finally{
      btn.disabled = false;
      btn.textContent = '🔍 جستجو';
    }
  }

  async function selectStock(stock){
    const resultsBox = $('stockSearchResults');
    if(resultsBox) resultsBox.innerHTML = '';

    try{
      // ⭐ سه تا API رو موازی صدا بزن
      const [priceData, instData, peData] = await Promise.all([
        fetchPriceInfo(stock.insCode),
        fetchInstrumentInfo(stock.insCode).catch(() => null),
        fetchTsetmcPE(stock.insCode).catch(() => null),
      ]);

      const data = {
        symbol: stock.symbol,
        name: stock.name,
        industry: instData?.industry || '',
        ...priceData,
        shares: instData?.shares || null,
        // ⭐ P/E و EPS از ClosingPriceDailyList
        tsetmcPE: peData?.pe || null,
        tsetmcEPS: peData?.eps || null,
        groupPE: peData?.peGroup || null,
      };

      console.log('📊 نتیجه نهایی:', {
        symbol: data.symbol,
        tsetmcPE: data.tsetmcPE,
        tsetmcEPS: data.tsetmcEPS,
        groupPE: data.groupPE,
      });

console.log('🔍 قبل از ذخیره — data.tsetmcPE:', data.tsetmcPE, '| __kodal_setPE:', typeof window.__kodal_setPE);

      // ⭐ ذخیره در MARKET (هم window و هم MARKET داخلی)
      if(window.MARKET){
        window.MARKET.tsetmcPE = data.tsetmcPE;
        window.MARKET.tsetmcEPS = data.tsetmcEPS;
        window.MARKET.groupPE = data.groupPE;
      }
      // ⭐ صدا زدن تابع app.js برای آپدیت MARKET داخلی
      if(window.__kodal_setPE){
        window.__kodal_setPE({
          tsetmcPE: data.tsetmcPE,
          tsetmcEPS: data.tsetmcEPS,
          groupPE: data.groupPE,
        });
      }

      // ⭐ تشخیص نوع صنعت
      const sectorType = detectSectorType(data.industry, data.symbol);
      const industryName = data.industry || '';

      if(window.MARKET){
        window.MARKET.sectorType = sectorType;
        window.MARKET.industry = industryName;
      }

      if(window.__kodal_setSector){
        window.__kodal_setSector(sectorType, industryName);
      }

      console.log('🏭 نوع صنعت:', sectorType, '| گروه:', industryName);

      fillFields(data);
      fillInfoBox(data);

      if($('baseIndustry') && data.industry){
        $('baseIndustry').value = data.industry;
      }

      const change = data.changePercent;
      let changeHtml = '';
      if(change != null){
        const sign = change > 0 ? '+' : '';
        const color = change > 0 ? '#16834a' : change < 0 ? '#c62828' : '#94a3b8';
        const arrow = change > 0.5 ? '▲' : change < -0.5 ? '▼' : '─';
        changeHtml = `<span style="color:${color};font-weight:700;margin-right:8px">${arrow} ${H.toFa(sign + change.toFixed(2))}٪</span>`;
      }

      const priceText = data.lastPrice
        ? H.toFa(Math.round(data.lastPrice).toLocaleString('en-US'))
        : '—';

      const sharesText = data.shares
        ? H.toFa(Math.round(data.shares).toLocaleString('en-US'))
        : '—';

      const industryHtml = data.industry
        ? `<span style="color:#8b5cf6;font-size:11.5px;background:rgba(139,92,246,.12);padding:2px 8px;border-radius:6px;font-weight:600">🏭 ${H.escapeHtml(data.industry)}</span>`
        : '';

      const peHtml = data.tsetmcPE
        ? `<span style="color:#0ea5e9;font-size:11.5px;background:rgba(14,165,233,.12);padding:2px 8px;border-radius:6px;font-weight:600;margin-right:6px">📊 P/E سایت: ${H.toFa(data.tsetmcPE.toFixed(2))}</span>`
        : '';

      showMessage(`
        <span style="font-weight:700;color:var(--good)">✅ ${H.escapeHtml(data.symbol)}</span>
        <span style="color:var(--sub);font-size:12px;margin-right:6px">${H.escapeHtml(data.name)}</span>
        ${industryHtml}
        ${peHtml}
        <span style="margin-right:auto;font-size:13px">
          💰 <b>${priceText}</b> ریال ${changeHtml}
          <span style="color:var(--line);margin:0 8px">|</span>
          📊 <b>${sharesText}</b> سهم
        </span>
      `, 'success');

      if(window.showToast){
        window.showToast(`✅ ${data.symbol} بارگذاری شد`);
      }

      const goBtn = $('go');
      if(goBtn){
        goBtn.disabled = false;
        console.log('✅ دکمه تحلیل فعال شد');
      }

      if(window.PARSED && typeof window.render === 'function'){
        window.render(0);
      }

    }catch(err){
      showMessage('❌ ' + H.escapeHtml(err.message), 'error');
      console.error('selectStock error:', err);
    }
  }

  function init(){
    const anchor = $('stockSearchAnchor');
    if(anchor){
      buildSearchUI();
      return;
    }

    let tries = 0;
    const maxTries = 25;
    const timer = setInterval(() => {
      tries++;
      const anchor2 = $('stockSearchAnchor');
      if(anchor2){
        clearInterval(timer);
        buildSearchUI();
      } else if(tries >= maxTries){
        clearInterval(timer);
      }
    }, 200);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('%c🔍 stock-search.js v2.4.0 لود شد (با P/E از ClosingPriceDailyList)', 'color:#8b5cf6;font-weight:bold');

})();