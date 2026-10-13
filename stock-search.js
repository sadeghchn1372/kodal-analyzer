/* ============================================================
   stock-search.js — جستجو + دریافت خودکار از TSETMC
   نسخه: 1.3.0 — با فیلتر اختیار معامله
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
     فیلتر کردن نتایج TSETMC — فقط سهام معمولی
     flow: 1=بورس, 2=فرابورس, 3=اختیار, 4=پایه, 5=اوراق
  ============================================================ */
  function _isRegularStock(item){
    const sym = (item.lVal18AFC || '').trim();
    const name = (item.lVal30 || '');
    const flow = item.flow || 0;

    if(!sym) return false;

    // فقط بورس (1)، فرابورس (2)، پایه (4)
    if(![1, 2, 4].includes(flow)) return false;

    // حذف حق تقدم
    if(/^ح\s*\./.test(name.trim())) return false;
    if(/حق\s*تقدم/i.test(name)) return false;
    if(/حق\s*تقدم/i.test(sym)) return false;

    // حذف اختیار
    if(/^اختيار|^اختیار/i.test(name)) return false;
    if(/^اختيار|^اختیار/i.test(sym)) return false;

    // حذف اوراق و سلف
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

    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if(!response.ok) throw new Error(`خطای شبکه: ${response.status}`);

    const data = await response.json();
    const results = data.instrumentSearch;
    if(!results || !results.length) return [];

    // ⭐ فیلتر کردن
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

    const lastPrice = info.pDrCotVal || 0;
    const closePrice = info.pClosing || 0;
    const yesterdayPrice = info.priceYesterday || 0;

    let changePercent = null;
    if(yesterdayPrice > 0 && closePrice > 0){
      changePercent = ((closePrice - yesterdayPrice) / yesterdayPrice) * 100;
    } else if(yesterdayPrice > 0 && lastPrice > 0){
      changePercent = ((lastPrice - yesterdayPrice) / yesterdayPrice) * 100;
    }

    return { lastPrice, closePrice, yesterdayPrice, changePercent };
  }

  /* ============================================================
     اطلاعات کامل سهم (تعداد سهام)
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

    return { shares };
  }

  /* ============================================================
     پر کردن فیلدها
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

  /* ============================================================
     نمایش پیام
  ============================================================ */
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

  /* ============================================================
     ساخت UI جستجو
  ============================================================ */
  function buildSearchUI(){
    // اگه از قبل هست، رد کن
    if($('stockSearchInput')) return;

    // anchor رو پیدا کن
    const anchor = $('stockSearchAnchor');
    if(!anchor){
      console.warn('⚠️ stock-search.js: anchor پیدا نشد');
      return;
    }

    const section = document.createElement('div');
    section.className = 'input-section stock-search-section';
    section.innerHTML = `
      <div class="input-section-title">
        <span class="step-badge">۲</span>
        🔍 جستجوی سریع سهم
        <span class="optional-badge">قیمت و تعداد سهام خودکار پر می‌شه</span>
      </div>

      <div class="stock-search-row">
        <input id="stockSearchInput" type="text"
               placeholder="مثلاً: فملی، فولاد، شپنا"
               autocomplete="off">
        <button id="stockSearchBtn" class="primary" type="button">
          🔍 جستجو
        </button>
      </div>

      <div id="stockSearchResults" class="stock-search-results"></div>
      <div id="searchResultMsg" class="search-result-msg" style="display:none"></div>
    `;

    // جاگذاری
    anchor.parentNode.insertBefore(section, anchor.nextSibling);

    $('stockSearchBtn').onclick = () => handleSearch();
    $('stockSearchInput').addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        handleSearch();
      }
    });

    console.log('✅ stock-search.js: UI ساخته شد');
  }

  /* ============================================================
     مدیریت جستجو
  ============================================================ */
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

  /* ============================================================
     انتخاب سهم
  ============================================================ */
  async function selectStock(stock){
    const resultsBox = $('stockSearchResults');
    if(resultsBox) resultsBox.innerHTML = '';

    try{
      const [priceData, instData] = await Promise.all([
        fetchPriceInfo(stock.insCode),
        fetchInstrumentInfo(stock.insCode).catch(() => null),
      ]);

      const data = {
        symbol: stock.symbol,
        name: stock.name,
        ...priceData,
        shares: instData?.shares || null,
      };

      fillFields(data);

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

      showMessage(`
        <span style="font-weight:700;color:var(--good)">✅ ${H.escapeHtml(data.symbol)}</span>
        <span style="color:var(--sub);font-size:12px;margin-right:6px">${H.escapeHtml(data.name)}</span>
        <span style="margin-right:auto;font-size:13px">
          💰 <b>${priceText}</b> ریال ${changeHtml}
          <span style="color:var(--line);margin:0 8px">|</span>
          📊 <b>${sharesText}</b> سهم
        </span>
      `, 'success');

      if(window.showToast){
        window.showToast(`✅ ${data.symbol} بارگذاری شد`);
      }

    }catch(err){
      showMessage('❌ ' + H.escapeHtml(err.message), 'error');
    }
  }

  /* ============================================================
     اجرا
  ============================================================ */
  function init(){
    // اول anchor رو چک کن
    const anchor = $('stockSearchAnchor');
    if(anchor){
      buildSearchUI();
      return;
    }

    // اگه anchor نبود، صبر کن تا لود بشه (max 5 seconds)
    let tries = 0;
    const maxTries = 25; // 25 × 200ms = 5 seconds
    const timer = setInterval(() => {
      tries++;
      const anchor2 = $('stockSearchAnchor');
      if(anchor2){
        clearInterval(timer);
        buildSearchUI();
      } else if(tries >= maxTries){
        clearInterval(timer);
        console.warn('⚠️ stock-search.js: anchor بعد از ۵ ثانیه پیدا نشد');
      }
    }, 200);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('%c🔍 stock-search.js v1.3.0 لود شد', 'color:#8b5cf6;font-weight:bold');

})();