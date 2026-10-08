/* ============================================================
   watchlist.js — منطق تب «دیدبان»  |  v43
   طراحی: صادق رمضانی
   v43: انتخابگر نسبت + نمودار خطی تک‌پارامتری
============================================================ */

(function(){
  'use strict';

  const H = window.KodalHelpers || {};
  const $ = id => document.getElementById(id);
  const toFa = H.toFa || (x => String(x).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]));
  const fa2en = H.fa2en || (s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                                       .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  const PERIOD_NAMES = { 3: '۳ ماهه', 6: '۶ ماهه', 9: '۹ ماهه', 12: 'سالانه' };

  const WL_STORAGE_KEY = 'kodal_watchlist_v3';
  let WATCHLIST = { analysis: [] };
  let WL_DETAIL_ID = null;

  // ============================================================
  // لیست نسبت‌های قابل نمایش در نمودار
  // ============================================================
  const CHART_RATIOS = [
    { key: 'currentRatio',   label: 'نسبت جاری',                color: '#1769e0', type: 'num', calc: m => (m.ca != null && m.cl != null && m.cl !== 0) ? (m.ca / m.cl) : null },
    { key: 'quickRatio',     label: 'نسبت آنی',                  color: '#8b5cf6', type: 'num', calc: m => (m.ca != null && m.inv != null && m.cl != null && m.cl !== 0) ? ((m.ca - m.inv) / m.cl) : null },
    { key: 'cashRatio',      label: 'نسبت نقد',                  color: '#06b6d4', type: 'num', calc: m => (m.cash != null && m.cl != null && m.cl !== 0) ? (m.cash / m.cl) : null },
    { key: 'netMargin',      label: 'حاشیه سود خالص',           color: '#10b981', type: 'pct', calc: m => (m.net != null && m.revenue != null && m.revenue !== 0) ? (m.net / m.revenue) : null },
    { key: 'grossMargin',    label: 'حاشیه سود ناخالص',         color: '#f59e0b', type: 'pct', calc: m => (m.grossProfit != null && m.revenue != null && m.revenue !== 0) ? (m.grossProfit / m.revenue) : null },
    { key: 'opMargin',       label: 'حاشیه سود عملیاتی',        color: '#ec4899', type: 'pct', calc: m => (m.opProfit != null && m.revenue != null && m.revenue !== 0) ? (m.opProfit / m.revenue) : null },
    { key: 'roe',            label: 'ROE (بازده حقوق مالکانه)', color: '#dc2626', type: 'pct', calc: m => (m.net != null && m.eq != null && m.eq !== 0) ? (m.net / m.eq) : null },
    { key: 'roa',            label: 'ROA (بازده دارایی)',       color: '#0891b2', type: 'pct', calc: m => (m.net != null && m.ta != null && m.ta !== 0) ? (m.net / m.ta) : null },
    { key: 'debtToEquity',   label: 'بدهی به حقوق',              color: '#a16207', type: 'num', calc: m => (m.tl != null && m.eq != null && m.eq !== 0) ? (m.tl / m.eq) : null },
    { key: 'debtToAsset',    label: 'بدهی به دارایی',            color: '#7c3aed', type: 'pct', calc: m => (m.tl != null && m.ta != null && m.ta !== 0) ? (m.tl / m.ta) : null },
    { key: 'assetTurnover',  label: 'گردش دارایی',               color: '#0284c7', type: 'num', calc: m => (m.revenue != null && m.ta != null && m.ta !== 0) ? (m.revenue / m.ta) : null },
    { key: 'cfoToNet',       label: 'کیفیت سود (CFO/Net)',       color: '#65a30d', type: 'num', calc: m => (m.cfo != null && m.net != null && m.net !== 0) ? (m.cfo / m.net) : null },
  ];

  function loadWatchlist(){
    try{
      const raw = localStorage.getItem(WL_STORAGE_KEY);
      if(raw){
        const data = JSON.parse(raw);
        if(data && typeof data === 'object'){
          WATCHLIST.analysis = Array.isArray(data.analysis) ? data.analysis : [];
        }
      }
    }catch(e){
      WATCHLIST = { analysis: [] };
    }
  }
  function saveWatchlist(){
    try{
      localStorage.setItem(WL_STORAGE_KEY, JSON.stringify(WATCHLIST));
      return true;
    }catch(e){
      if(e.name === 'QuotaExceededError' && window.showToast){
        window.showToast('⚠️ حافظه پر شده — قدیمی‌ها رو حذف کن', true);
      }
      return false;
    }
  }
  loadWatchlist();

  function makeId(){
    return 'wl_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function fmtB(x){
    if(x == null || !isFinite(x)) return '—';
    const b = x / 10000;
    if(Math.abs(b) >= 1){
      return '<bdi dir="ltr">' + toFa(Math.round(b).toLocaleString('en-US')) + ' B</bdi>';
    }
    return '<bdi dir="ltr">' + toFa(Math.round(x).toLocaleString('en-US')) + ' M</bdi>';
  }

  function getReportLabel(r){
    const p = PERIOD_NAMES[r.period] || (r.period ? toFa(r.period) + ' ماهه' : '—');
    return `${p} — ${toFa(r.year)}`;
  }
  function getReportSortKey(r){
    const y = parseInt(fa2en(String(r.year || '0')), 10) || 0;
    const p = parseInt(fa2en(String(r.period || '0')), 10) || 0;
    return y * 100 + p;
  }

  /* ============================================================
     🎨 رندر لیست
  ============================================================ */
  function renderWatchlist(){
    renderAnalysisList();
    renderChartSelector();
  }

  function renderAnalysisList(){
    const box = $('wlAnalysisList');
    if(!box) return;
    const list = WATCHLIST.analysis;

    if(!list.length){
      box.innerHTML = '<div class="saved-empty">هنوز سهمی اضافه نکردی.<br>از تب «📊 تحلیل تک شرکت»، بعد از تحلیل، دکمه «👁️ افزودن به دیدبان» رو بزن.</div>';
      return;
    }

    box.innerHTML = list.map(w => {
      const cnt = w.reports?.length || 0;
      const sortedReps = [...(w.reports || [])].sort((a,b) => getReportSortKey(b) - getReportSortKey(a));
      const last = sortedReps[0];

      // تحلیل هشدار
      const alerts = analyzeAlerts(w);

      let alertBadge = '';
      if(alerts.hasEnoughData){
        const badgeClass = alerts.level === 'danger' ? 'danger'
                         : alerts.level === 'warning' ? 'warning'
                         : alerts.level === 'success' ? 'success'
                         : 'neutral';
        const badgeText = alerts.level === 'danger' ? `${toFa(alerts.items.length)} هشدار مهم`
                        : alerts.level === 'warning' ? `${toFa(alerts.items.length)} نکته`
                        : alerts.level === 'success' ? 'خبر خوب'
                        : 'بدون تغییر مهم';
        alertBadge = `<span class="wl-alert-badge ${badgeClass}" onclick="event.stopPropagation(); window.wlShowAlertPopup('${w.id}', this)">
          <span class="dot"></span>${badgeText}
        </span>`;
      } else {
        alertBadge = `<span class="wl-alert-badge neutral" title="برای نمایش هشدار، حداقل ۲ صورت مالی لازم است">
          <span class="dot"></span>نیاز به ۲ گزارش
        </span>`;
      }

      return `
        <div class="wl-card">
          <div class="wl-head">
            <span class="wl-symbol">${escapeHtml(w.symbol)}</span>
            ${w.industry ? `<span class="wl-industry">${escapeHtml(w.industry)}</span>` : ''}
            ${alertBadge}
          </div>
          <div class="wl-reports-count">📊 ${toFa(cnt)} صورت مالی ذخیره‌شده</div>
          ${last ? `<div class="wl-stats"><span>آخرین: <b>${escapeHtml(getReportLabel(last))}</b></span></div>` : ''}
          <div class="wl-actions">
            <button class="primary" onclick="window.wlShowDetail('${w.id}')">📊 جزئیات</button>
            <button onclick="window.wlEditIndustry('${w.id}')">✏️ صنعت</button>
            <button class="delete-btn" onclick="window.wlDelete('${w.id}')">🗑️ حذف</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ============================================================
     🔔 تحلیل هشدارهای تغییرات مهم
  ============================================================ */
  function analyzeAlerts(w){
    const reports = w.reports || [];
    if(reports.length < 2){
      return { hasEnoughData: false, level: 'neutral', items: [] };
    }

    // مرتب‌سازی صعودی (قدیمی به جدید)
    const sorted = [...reports].sort((a,b) => getReportSortKey(a) - getReportSortKey(b));

    // دو گزارش آخر
    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];

    const mPrev = prev.data?.metrics || {};
    const mCurr = curr.data?.metrics || {};

    const items = [];
    let hasDanger = false;
    let hasWarning = false;
    let hasSuccess = false;

    // تابع کمکی: تغییر نسبی
    const relChange = (curr, prev) => {
      if(curr == null || prev == null) return null;
      if(prev === 0) return null;
      return (curr - prev) / Math.abs(prev);
    };

    // تابع کمکی: تغییر مطلق
    const absChange = (curr, prev) => {
      if(curr == null || prev == null) return null;
      return curr - prev;
    };

    // ۱) تغییر درآمد
    const revG = relChange(mCurr.revenue, mPrev.revenue);
    if(revG != null){
      if(revG < -0.25){
        items.push({icon:'🚨', text:`افت شدید درآمد: <span class="num down">${toFa((Math.abs(revG)*100).toFixed(1))}٪</span>`});
        hasDanger = true;
      } else if(revG < -0.10){
        items.push({icon:'⚠️', text:`افت درآمد: <span class="num down">${toFa((Math.abs(revG)*100).toFixed(1))}٪</span>`});
        hasWarning = true;
      } else if(revG > 0.15){
        items.push({icon:'✅', text:`رشد درآمد: <span class="num up">${toFa((revG*100).toFixed(1))}٪</span>`});
        hasSuccess = true;
      }
    }

    // ۲) تغییر سود خالص
    const netG = relChange(mCurr.net, mPrev.net);
    if(netG != null){
      if(netG < -0.30){
        items.push({icon:'🚨', text:`افت شدید سود خالص: <span class="num down">${toFa((Math.abs(netG)*100).toFixed(1))}٪</span>`});
        hasDanger = true;
      } else if(netG < -0.15){
        items.push({icon:'⚠️', text:`افت سود خالص: <span class="num down">${toFa((Math.abs(netG)*100).toFixed(1))}٪</span>`});
        hasWarning = true;
      } else if(netG > 0.20){
        items.push({icon:'✅', text:`رشد سود خالص: <span class="num up">${toFa((netG*100).toFixed(1))}٪</span>`});
        hasSuccess = true;
      }
    }

    // ۳) تغییر حاشیه سود خالص
    const nmPrev = (mPrev.net != null && mPrev.revenue && mPrev.revenue !== 0) ? (mPrev.net / mPrev.revenue) : null;
    const nmCurr = (mCurr.net != null && mCurr.revenue && mCurr.revenue !== 0) ? (mCurr.net / mCurr.revenue) : null;
    const nmChange = (nmPrev != null && nmCurr != null) ? (nmCurr - nmPrev) : null;
    if(nmChange != null){
      if(nmChange < -0.05){
        items.push({icon:'🚨', text:`افت شدید حاشیه سود خالص به <span class="num down">${toFa((nmCurr*100).toFixed(1))}٪</span>`});
        hasDanger = true;
      } else if(nmChange < -0.02){
        items.push({icon:'⚠️', text:`افت حاشیه سود خالص به <span class="num down">${toFa((nmCurr*100).toFixed(1))}٪</span>`});
        hasWarning = true;
      } else if(nmChange > 0.03){
        items.push({icon:'✅', text:`بهبود حاشیه سود خالص به <span class="num up">${toFa((nmCurr*100).toFixed(1))}٪</span>`});
        hasSuccess = true;
      }
    }

    // ۴) تغییر بدهی/حقوق
    const dePrev = (mPrev.tl != null && mPrev.eq && mPrev.eq !== 0) ? (mPrev.tl / mPrev.eq) : null;
    const deCurr = (mCurr.tl != null && mCurr.eq && mCurr.eq !== 0) ? (mCurr.tl / mCurr.eq) : null;
    const deChange = (dePrev != null && deCurr != null) ? (deCurr - dePrev) : null;
    if(deChange != null){
      if(deChange > 0.5){
        items.push({icon:'🚨', text:`رشد شدید اهرم: بدهی/حقوق به <span class="num down">${toFa(deCurr.toFixed(2))}</span>`});
        hasDanger = true;
      } else if(deChange > 0.25){
        items.push({icon:'⚠️', text:`رشد اهرم: بدهی/حقوق به <span class="num down">${toFa(deCurr.toFixed(2))}</span>`});
        hasWarning = true;
      } else if(deChange < -0.20){
        items.push({icon:'✅', text:`کاهش اهرم: بدهی/حقوق به <span class="num up">${toFa(deCurr.toFixed(2))}</span>`});
        hasSuccess = true;
      }
    }

    // ۵) CFO منفی شده
    if(mCurr.cfo != null && mCurr.cfo < 0 && (mPrev.cfo == null || mPrev.cfo >= 0)){
      items.push({icon:'🚨', text:`جریان نقد عملیاتی منفی شد`});
      hasDanger = true;
    }

    // سطح نهایی
    let level = 'neutral';
    if(hasDanger) level = 'danger';
    else if(hasWarning) level = 'warning';
    else if(hasSuccess) level = 'success';

    return {
      hasEnoughData: true,
      level: level,
      items: items,
      prevLabel: getReportLabel(prev),
      currLabel: getReportLabel(curr),
    };
  }

  /* ============================================================
     🔔 پاپ‌آپ هشدارها
  ============================================================ */
  let _wlAlertPopup = null;
  window.wlShowAlertPopup = function(watchId, triggerEl){
    // اگه پاپ‌آپ بازه، ببندش
    if(_wlAlertPopup){
      _wlAlertPopup.remove();
      _wlAlertPopup = null;
      return;
    }

    const w = WATCHLIST.analysis.find(x => x.id === watchId);
    if(!w) return;

    const alerts = analyzeAlerts(w);

    const popup = document.createElement('div');
    popup.className = 'wl-alert-popup';

    let headerIcon = '';
    let headerText = '';
    if(alerts.level === 'danger'){ headerIcon = '🚨'; headerText = 'هشدارهای مهم'; }
    else if(alerts.level === 'warning'){ headerIcon = '⚠️'; headerText = 'نکات قابل توجه'; }
    else if(alerts.level === 'success'){ headerIcon = '✅'; headerText = 'خبرهای خوب'; }
    else { headerIcon = 'ℹ️'; headerText = 'تغییرات ناچیز'; }

    let html = `<h4>${headerIcon} ${headerText} — ${escapeHtml(w.symbol)}</h4>`;

    if(alerts.items.length === 0){
      html += `<div style="text-align:center;color:var(--sub);padding:8px 0">هیچ تغییر مهمی بین دو دوره آخر نیست.</div>`;
    } else {
      html += '<ul>';
      for(const it of alerts.items){
        html += `<li><span class="ic">${it.icon}</span><span>${it.text}</span></li>`;
      }
      html += '</ul>';
    }

    html += `<div style="font-size:11px;color:var(--sub);margin-top:10px;text-align:center;border-top:1px solid var(--line);padding-top:8px">
      مقایسه: ${escapeHtml(alerts.prevLabel || '—')} → ${escapeHtml(alerts.currLabel || '—')}
    </div>`;

    popup.innerHTML = html;
    document.body.appendChild(popup);

    // موقعیت‌دهی
    const rect = triggerEl.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - popupRect.width / 2;

    if(left + popupRect.width > window.innerWidth - 10) left = window.innerWidth - popupRect.width - 10;
    if(left < 10) left = 10;
    if(top + popupRect.height > window.innerHeight - 10) top = rect.top - popupRect.height - 8;
    if(top < 10) top = 10;

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';

    _wlAlertPopup = popup;

    // بستن با کلیک بیرون
    setTimeout(() => {
      const closeHandler = (e) => {
        if(_wlAlertPopup && !_wlAlertPopup.contains(e.target) && e.target !== triggerEl){
          _wlAlertPopup.remove();
          _wlAlertPopup = null;
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 50);
  };

  /* ============================================================
     📈 انتخابگر نمودار
  ============================================================ */
  function renderChartSelector(){
    const card = $('wlChartCard');
    const symbolSelect = $('wlChartSymbolSelect');
    const ratioSelect = $('wlChartRatioSelect');
    if(!card || !symbolSelect || !ratioSelect) return;

    const list = WATCHLIST.analysis.filter(w => (w.reports||[]).length >= 2);
    if(!list.length){
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';

    // پر کردن dropdown سهم‌ها
    const currentSymbol = symbolSelect.value;
    symbolSelect.innerHTML = list.map(w =>
      `<option value="${escapeHtml(w.id)}">${escapeHtml(w.symbol)}</option>`
    ).join('');
    if(currentSymbol && list.some(w => w.id === currentSymbol)){
      symbolSelect.value = currentSymbol;
    }

    // پر کردن dropdown نسبت‌ها
    const currentRatio = ratioSelect.value;
    ratioSelect.innerHTML = CHART_RATIOS.map(r =>
      `<option value="${r.key}">${r.label}</option>`
    ).join('');
    if(currentRatio && CHART_RATIOS.some(r => r.key === currentRatio)){
      ratioSelect.value = currentRatio;
    }

    symbolSelect.onchange = () => renderChartForSymbol(symbolSelect.value, ratioSelect.value);
    ratioSelect.onchange = () => renderChartForSymbol(symbolSelect.value, ratioSelect.value);

    renderChartForSymbol(symbolSelect.value, ratioSelect.value);
  }

  function renderChartForSymbol(symbolId, ratioKey){
    const container = $('wlChartSingle');
    const titleEl = $('wlChartTitle');
    if(!container) return;

    const item = WATCHLIST.analysis.find(w => w.id === symbolId);
    if(!item || !item.reports || item.reports.length < 2){
      container.innerHTML = '<div class="wl-chart-empty">این سهم حداقل ۲ صورت مالی برای نمایش روند نیاز دارد.</div>';
      if(titleEl) titleEl.textContent = '📊 روند';
      return;
    }

    const ratio = CHART_RATIOS.find(r => r.key === ratioKey) || CHART_RATIOS[0];

    // مرتب‌سازی صعودی (قدیمی به جدید)
    const sorted = [...item.reports].sort((a,b) => getReportSortKey(a) - getReportSortKey(b));

    // استخراج داده‌ها
    const points = [];
    for(const r of sorted){
      const m = r.data?.metrics || {};
      const value = ratio.calc(m);

      const periodLabel = PERIOD_NAMES[r.period] || (r.period ? toFa(r.period) + ' ماهه' : '—');
      const label = `${toFa(r.year)}\n${periodLabel}`;

      points.push({
        label: label,
        year: r.year,
        period: r.period,
        value: value,
      });
    }

    const validPoints = points.filter(p => p.value != null);
    if(validPoints.length < 2){
      container.innerHTML = '<div class="wl-chart-empty">داده کافی برای رسم این نسبت وجود ندارد.</div>';
      if(titleEl) titleEl.textContent = '📊 روند ' + ratio.label;
      return;
    }

    if(titleEl) titleEl.textContent = '📊 روند ' + ratio.label;

    const isPct = ratio.type === 'pct';
    const formatVal = isPct
      ? (v => toFa((v * 100).toFixed(1)) + '٪')
      : (v => toFa(v.toFixed(2)));

    container.innerHTML = buildSingleLineChart(
      points,
      p => p.value,
      ratio.color,
      ratio.label,
      formatVal,
      !isPct
    );
  }

  function buildSingleLineChart(points, getter, color, title, formatVal, isRatio){
    const W = 700, H = 300;
    const padL = 90, padR = 20, padT = 30, padB = 70;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const vals = points.map(getter).filter(v => v != null);
    if(vals.length < 2){
      return '<div class="wl-chart-empty">داده کافی برای نمایش روند وجود ندارد.</div>';
    }

    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    // حداقل بازه‌ی نمایش: 10٪ از خود مقدار (برای جلوگیری از نمودار تخت)
    const range = Math.max(maxV - minV, Math.max(Math.abs(maxV), 0.01) * 0.1);
    const topV = maxV + range * 0.15;
    const botV = Math.max(0, minV - range * 0.15);

    const yAt = v => padT + plotH - ((v - botV) / (topV - botV)) * plotH;
    // در حالت RTL: اولین نقطه (قدیمی‌ترین) سمت راست، آخرین نقطه (جدیدترین) سمت چپ
    const xAt = i => (padL + plotW) - (plotW / (points.length - 1)) * i;

    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;

    // خطوط افقی راهنما (کم‌رنگ‌تر تا تداخل نداشته باشه)
    const steps = 4;
    for(let i=0; i<=steps; i++){
      const y = padT + (plotH * i / steps);
      svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--chart-br)" stroke-width="0.6" stroke-dasharray="3,4" opacity="0.6"/>`;
    }

    // خط پایه
    svg += `<line x1="${padL}" y1="${padT+plotH}" x2="${W-padR}" y2="${padT+plotH}" stroke="var(--line)" stroke-width="1"/>`;

    // لیبل‌های محور Y
    for(let i=0; i<=steps; i++){
      const y = padT + (plotH * i / steps);
      const v = topV - (topV - botV) * (i / steps);
      const lbl = isRatio ? toFa(v.toFixed(1)) : toFa((v*100).toFixed(1)) + '٪';
      svg += `<text x="${padL-8}" y="${y+4}" text-anchor="end" font-size="10" fill="${color}">${lbl}</text>`;
    }

    // لیبل محور X
    points.forEach((p, i) => {
      const x = xAt(i);
      const [year, period] = p.label.split('\n');
      svg += `<text x="${x}" y="${padT+plotH+22}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--txt)">${year}</text>`;
      svg += `<text x="${x}" y="${padT+plotH+38}" text-anchor="middle" font-size="10" fill="var(--sub)">${period}</text>`;
    });

    // خط
    const linePoints = points
      .map((p, i) => {
        const v = getter(p);
        return v != null ? `${xAt(i)},${yAt(v)}` : null;
      })
      .filter(v => v);

    if(linePoints.length >= 2){
      svg += `<polyline points="${linePoints.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    // نقاط + برچسب با پس‌زمینه سفید (تا با خطوط راهنما تداخل نکنه)
    points.forEach((p, i) => {
      const v = getter(p);
      if(v == null) return;
      const x = xAt(i), y = yAt(v);
      const labelText = formatVal(v);
      // تخمین عرض برچسب بر اساس طول متن
      const lblW = labelText.length * 7 + 10;
      const lblH = 16;
      const lblY = y - 22;
      // مستطیل پس‌زمینه برچسب
      svg += `<rect x="${x - lblW/2}" y="${lblY - lblH + 4}" width="${lblW}" height="${lblH}" rx="4" fill="var(--card)" stroke="${color}" stroke-width="0.8" opacity="0.95"/>`;
      // متن برچسب
      svg += `<text x="${x}" y="${lblY}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${color}">${labelText}</text>`;
      // دایره نقطه
      svg += `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${color}" stroke-width="2.5"><title>${p.label.replace('\n',' ')} — ${title}: ${labelText}</title></circle>`;
    });

    svg += `</svg>`;
    return svg;
  }

  /* ============================================================
     📊 جزئیات
  ============================================================ */
  window.wlShowDetail = function(id){
    const list = WATCHLIST.analysis;
    const item = list.find(w => w.id === id);
    if(!item) return;

    WL_DETAIL_ID = id;

    const out = $('wlDetailOut');
    const body = $('wlDetailBody');
    if(!out || !body) return;

    const reports = item.reports || [];
    let html = '';

    html += `<div class="wl-detail-header">
      <button class="ghost wl-back-btn" onclick="window.wlCloseDetail()">← بازگشت</button>
      <h2>${escapeHtml(item.symbol)}</h2>
      ${item.industry ? `<span class="wl-industry">${escapeHtml(item.industry)}</span>` : ''}
      <span style="font-size:12px;color:var(--sub)">${toFa(reports.length)} صورت مالی</span>
    </div>`;

    if(!reports.length){
      html += '<div class="saved-empty">هنوز داده‌ای ذخیره نشده.</div>';
      body.innerHTML = html;
      out.style.display = 'block';
      window.scrollTo({top: out.offsetTop - 20, behavior:'smooth'});
      return;
    }

    html += renderAnalysisDetail(item, reports);

    body.innerHTML = html;
    out.style.display = 'block';
    window.scrollTo({top: out.offsetTop - 20, behavior:'smooth'});
  };

  window.wlCloseDetail = function(){
    if($('wlDetailOut')) $('wlDetailOut').style.display = 'none';
    WL_DETAIL_ID = null;
    window.scrollTo({top: 0, behavior:'smooth'});
  };

  function renderAnalysisDetail(item, reports){
    // مرتب‌سازی صعودی — قدیمی‌ترین بالا، جدیدترین پایین
    const sorted = [...reports].sort((a,b) => getReportSortKey(a) - getReportSortKey(b));

    let html = '';

    html += '<div class="monthly-kpi-grid" style="margin-bottom:14px">';
    const lastRep = sorted[sorted.length - 1];
    if(lastRep && lastRep.data && lastRep.data.score != null){
      const sc = lastRep.data.score;
      const lvl = (H.scoreLevel ? H.scoreLevel(sc) : {label:'—', color:'#94a3b8'});
      html += `<div class="monthly-kpi" style="border-right-color:${lvl.color}">
        <span class="k-label">آخرین امتیاز سلامت</span>
        <div class="k-value" style="color:${lvl.color}">${toFa(sc)}</div>
        <div class="k-sub">${lvl.label}</div>
      </div>`;
    }
    html += `<div class="monthly-kpi">
      <span class="k-label">تعداد صورت‌های مالی</span>
      <div class="k-value">${toFa(reports.length)}</div>
      <div class="k-sub">در دیدبان</div>
    </div>`;
    html += '</div>';

    html += '<div class="cmp-table-wrap"><table class="monthly-table"><thead><tr>';
    html += '<th>سال</th><th>دوره</th><th>درآمد</th><th>سود خالص</th><th>امتیاز</th><th>عملیات</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(r => {
      const d = r.data || {};
      const m = d.metrics || {};
      const sc = d.score;
      const scLvl = sc != null ? (H.scoreLevel ? H.scoreLevel(sc) : {label:'—', color:'#94a3b8'}) : null;

      const periodLabel = PERIOD_NAMES[r.period] || (r.period ? toFa(r.period) + ' ماهه' : '—');

      html += '<tr>';
      html += `<td>${toFa(r.year)}</td>`;
      html += `<td>${periodLabel}</td>`;
      html += `<td class="num">${m.revenue != null ? fmtB(m.revenue) : '—'}</td>`;
      html += `<td class="num">${m.net != null ? fmtB(m.net) : '—'}</td>`;
      html += `<td style="color:${scLvl ? scLvl.color : 'inherit'};font-weight:700">${sc != null ? toFa(sc) : '—'}</td>`;
      html += `<td>
        <button class="ghost" style="padding:4px 10px;font-size:11.5px" onclick="window.wlViewAnalysisReport('${item.id}', '${r.id}')">مشاهده</button>
        <button class="ghost" style="padding:4px 10px;font-size:11.5px;color:var(--bad);border-color:var(--bad)" onclick="window.wlDeleteReport('${item.id}', '${r.id}')">حذف</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  /* ---------- اقدامات ---------- */
  window.wlViewAnalysisReport = function(itemId, reportId){
    const item = WATCHLIST.analysis.find(w => w.id === itemId);
    if(!item) return;
    const rep = item.reports.find(r => r.id === reportId);
    if(!rep) return;

    const tab = document.querySelector('.main-tab[data-maintab="single"]');
    if(tab) tab.click();

    setTimeout(() => {
      if(window.restoreFromExternal && rep.data){
        window.restoreFromExternal(rep.data);
      } else {
        if(window.showToast) window.showToast('سیستم بازیابی آماده نیست', true);
      }
    }, 300);
  };

  window.wlDeleteReport = function(itemId, reportId){
    const item = WATCHLIST.analysis.find(w => w.id === itemId);
    if(!item) return;
    if(!confirm('این گزارش از دیدبان حذف بشه؟')) return;
    item.reports = item.reports.filter(r => r.id !== reportId);
    saveWatchlist();
    renderWatchlist();
    if(WL_DETAIL_ID === itemId){
      window.wlShowDetail(itemId);
    }
    if(window.showToast) window.showToast('✅ حذف شد');
  };

  window.wlEditIndustry = function(id){
    const item = WATCHLIST.analysis.find(w => w.id === id);
    if(!item) return;
    const nn = prompt('صنعت جدید:', item.industry || '');
    if(nn != null){
      item.industry = nn.trim();
      saveWatchlist();
      renderWatchlist();
      if(WL_DETAIL_ID === id) window.wlShowDetail(id);
      if(window.showToast) window.showToast('✅ ذخیره شد');
    }
  };

  window.wlDelete = function(id){
    const item = WATCHLIST.analysis.find(w => w.id === id);
    if(!item) return;
    const cnt = item.reports?.length || 0;
    if(!confirm(`سهم «${item.symbol}» و ${toFa(cnt)} گزارشش حذف بشه؟`)) return;
    WATCHLIST.analysis = WATCHLIST.analysis.filter(w => w.id !== id);
    saveWatchlist();
    renderWatchlist();
    if(WL_DETAIL_ID === id){
      if($('wlDetailOut')) $('wlDetailOut').style.display = 'none';
      WL_DETAIL_ID = null;
    }
    if(window.showToast) window.showToast('✅ حذف شد');
  };

  /* ============================================================
     📥 دانلود / آپلود
  ============================================================ */
  if($('wlDownloadBtn')) $('wlDownloadBtn').onclick = () => {
    const total = WATCHLIST.analysis.length;
    if(!total){
      if(window.showToast) window.showToast('دیدبان خالیه', true);
      return;
    }
    const data = {
      version: '43',
      type: 'kodal_watchlist',
      exportDate: new Date().toISOString(),
      analysisCount: WATCHLIST.analysis.length,
      watchlist: WATCHLIST,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toLocaleDateString('fa-IR').replace(/\//g,'-');
    a.download = `kodal-watchlist-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if(window.showToast) window.showToast('📥 فایل دانلود شد');
  };

  if($('wlUploadBtn')) $('wlUploadBtn').onclick = () => $('wlUploadInput').click();
  if($('wlUploadInput')) $('wlUploadInput').onchange = e => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const data = JSON.parse(ev.target.result);
        const wl = data.watchlist || data;
        if(!wl || !Array.isArray(wl.analysis)){
          throw new Error('ساختار فایل درست نیست');
        }
        let addedA = 0;

        (wl.analysis || []).forEach(item => {
          if(!item || !item.symbol) return;
          const dup = WATCHLIST.analysis.find(w => w.symbol.toLowerCase() === item.symbol.toLowerCase());
          if(!dup){
            if(!item.id) item.id = makeId();
            if(!item.reports) item.reports = [];
            WATCHLIST.analysis.push(item);
            addedA++;
          }
        });

        saveWatchlist();
        renderWatchlist();
        if(window.showToast) window.showToast(`✅ ${toFa(addedA)} سهم اضافه شد`);
      }catch(err){
        if(window.showToast) window.showToast('خطا: ' + err.message, true);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  /* ============================================================
     🌐 API
  ============================================================ */
  window.Watchlist = {
    add: function(opts){
      if(!opts || !opts.type || !opts.report || !opts.year){
        if(window.showToast) window.showToast('اطلاعات ناقص', true);
        return false;
      }

      if(opts.type !== 'analysis'){
        if(window.showToast) window.showToast('نوع نامعتبر', true);
        return false;
      }

      // سال و ماه رو از حالت فارسی به انگلیسی تبدیل کن
      const year = String(fa2en(String(opts.year)).replace(/[^\d]/g, ''));
      if(!year || isNaN(parseInt(year, 10))){
        if(window.showToast) window.showToast('سال نامعتبر', true);
        return false;
      }

      const period = parseInt(fa2en(String(opts.period)).replace(/[^\d]/g, ''), 10);
      if(![3,6,9,12].includes(period)){
        if(window.showToast) window.showToast('دوره نامعتبر (۳/۶/۹/۱۲)', true);
        return false;
      }

      const list = WATCHLIST.analysis;
      const symbol = (opts.existingSymbol || opts.symbol || '').trim();
      if(!symbol){
        if(window.showToast) window.showToast('اسم نماد خالی نباشه', true);
        return false;
      }

      let item = list.find(w => w.symbol.toLowerCase() === symbol.toLowerCase());

      if(!item){
        item = {
          id: makeId(),
          symbol: symbol,
          industry: (opts.industry || '').trim(),
          addedAt: new Date().toISOString(),
          reports: [],
        };
        list.push(item);
      } else if(opts.industry && !item.industry){
        item.industry = opts.industry.trim();
      }

      const isDup = item.reports.some(r => String(r.year) === year && parseInt(r.period) === period);

      if(isDup){
        if(window.showToast) window.showToast('این گزارش قبلاً توی دیدبان هست', true);
        return false;
      }

      const record = {
        id: 'rep_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        savedAt: Date.now(),
        savedDateFa: toFa(new Date().toLocaleString('fa-IR')),
        year: year,
        period: period,
        data: JSON.parse(JSON.stringify(opts.report)),
      };

      item.reports.push(record);
      saveWatchlist();
      renderWatchlist();

      if(window.showToast) window.showToast('✅ به دیدبان اضافه شد');
      return true;
    },

    getAll: function(type){
      if(type === 'analysis') return [...WATCHLIST.analysis];
      return { analysis: [...WATCHLIST.analysis] };
    },

    has: function(symbol, type){
      if(type !== 'analysis') return false;
      return WATCHLIST.analysis.some(w => w.symbol.toLowerCase() === String(symbol).toLowerCase());
    },

    render: renderWatchlist,

    open: function(type){
      const mainTab = document.querySelector('.main-tab[data-maintab="watchlist"]');
      if(mainTab) mainTab.click();
    },
  };

  renderWatchlist();

  console.log('%c👁️ watchlist.js v43 لود شد (با انتخابگر نسبت)', 'color:#10b981;font-weight:bold');

})();