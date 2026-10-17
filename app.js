/* ============================================================
   app.js — منطق اصلی تحلیل تک شرکت  |  v2.3.0
   وابسته به: helpers.js + ui-modal.js
============================================================ */

const $ = id => document.getElementById(id);
const H = window.KodalHelpers;
const { fa2en, toFa, norm, toNum, toman, tomanText, pct, num2, ratio, escapeHtml } = H;

function extractNumbers(line){
  const normalized = fa2en(line);
  const withoutDates = normalized
    .replace(/\d{4}\s*[\/\-\.]\s*\d{1,2}\s*[\/\-\.]\s*\d{1,2}/g, ' ')
    .replace(/\d{4}\s*[\/\-\.]\s*\d{1,2}(?!\d)/g, ' ')
    .replace(/\d{1,2}\s*ماهه/g, ' ')
    .replace(/(?:^|[\s|])\d{4}(?=[\s|]|$)/g, ' ');
  const matches = withoutDates.match(/[\(\（]?\s*[\-−]?\s*[\d][\d,٬،.]*\s*[\)\）]?/g) || [];
  return matches.map(toNum).filter(v => v !== null);
}

function formatNumberInput(value){
  return H.formatNumberInput(value);
}

function attachNumberFormatter(inputEl){
  if(!inputEl) return;
  inputEl.addEventListener('input', (e) => {
    const oldValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    const digitsBeforeCursor = fa2en(oldValue.slice(0, cursorPos)).replace(/[^\d]/g, '').length;
    const formatted = formatNumberInput(oldValue);
    e.target.value = formatted;
    let newPos = 0;
    let digitCount = 0;
    for(let i=0; i<formatted.length; i++){
      if(digitCount >= digitsBeforeCursor) break;
      newPos = i + 1;
      if(/[۰-۹]/.test(formatted[i])) digitCount++;
    }
    if(digitsBeforeCursor === 0) newPos = 0;
    try{ e.target.setSelectionRange(newPos, newPos); }catch(_){}
  });
}

/* ---------- Help Tooltip ---------- */
(function initHelpTooltip(){
  const tooltip = document.getElementById('globalTooltip');
  if(!tooltip) return;
  let currentHelp = null;
  let pinnedOpen = false;
  let hideTimer = null;

  function show(helpEl){
    const text = helpEl.getAttribute('data-tip') || '';
    if(!text) return;
    tooltip.textContent = text;
    tooltip.classList.add('show');
    position(helpEl);
    currentHelp = helpEl;
  }
  function hide(){
    tooltip.classList.remove('show');
    currentHelp = null;
    pinnedOpen = false;
  }
  function position(helpEl){
    const rect = helpEl.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    if(left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;
    if(left < 10) left = 10;
    if(top + tipRect.height > window.innerHeight - 10) top = rect.top - tipRect.height - margin;
    if(top < 10) top = 10;
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }
  document.addEventListener('mouseover', (e) => {
    const h = e.target.closest && e.target.closest('.help');
    if(h){ clearTimeout(hideTimer); show(h); }
  });
  document.addEventListener('mouseout', (e) => {
    const h = e.target.closest && e.target.closest('.help');
    if(h && currentHelp === h && !pinnedOpen) hideTimer = setTimeout(hide, 120);
  });
  document.addEventListener('click', (e) => {
    const h = e.target.closest && e.target.closest('.help');
    if(h){
      e.stopPropagation();
      if(currentHelp === h && pinnedOpen) hide();
      else { show(h); pinnedOpen = true; }
      return;
    }
    if(!e.target.closest('#globalTooltip')) hide();
  });
  window.addEventListener('scroll', () => { if(tooltip.classList.contains('show')) hide(); }, true);
  window.addEventListener('resize', () => { if(tooltip.classList.contains('show')) hide(); });
})();

/* ---------- Global State ---------- */
let file = null;
let PARSED = null;
window.PARSED = null;

let MARKET = {
  symbol: '',
  price: null,
  shares: null,
  periodMonths: 12,
  sectorType: 'normal',
  industry: '',
  tsetmcPE: null,      // ⭐ P/E سایت
  tsetmcEPS: null,     // ⭐ EPS سایت
  groupPE: null,       // ⭐ P/E گروه
};
window.MARKET = MARKET;
window.__kodal_setPE = function(peData){
  if(!peData) return;
  
  if(peData.tsetmcPE != null){
    MARKET.tsetmcPE = peData.tsetmcPE;
    if(window.MARKET) window.MARKET.tsetmcPE = peData.tsetmcPE;
  }
  if(peData.tsetmcEPS != null){
    MARKET.tsetmcEPS = peData.tsetmcEPS;
    if(window.MARKET) window.MARKET.tsetmcEPS = peData.tsetmcEPS;
  }
  if(peData.groupPE != null){
    MARKET.groupPE = peData.groupPE;
    if(window.MARKET) window.MARKET.groupPE = peData.groupPE;
  }
  
  window.MARKET = MARKET;
  
  // ⭐ ذخیره در localStorage فوری
  try{
    const saved = JSON.parse(localStorage.getItem('kodal_market') || '{}');
    saved.tsetmcPE = MARKET.tsetmcPE;
    saved.tsetmcEPS = MARKET.tsetmcEPS;
    saved.groupPE = MARKET.groupPE;
    localStorage.setItem('kodal_market', JSON.stringify(saved));
  }catch(e){}
  
  console.log('✅ MARKET آپدیت شد با P/E:', MARKET.tsetmcPE);
};
window.__kodal_setSector = function(sectorType, industry){
  MARKET.sectorType = sectorType || '';
  MARKET.industry = industry || '';
  window.MARKET = MARKET;
  const goBtn = document.getElementById('go');
  if(goBtn && window.file !== undefined && file){
    goBtn.disabled = false;
  }
};

const PERIOD_NAMES = ['دوره جاری','دوره مشابه سال قبل','سال مالی قبل','دوره ۴','دوره ۵'];
window.PERIOD_NAMES = PERIOD_NAMES;

/* ---------- Theme ---------- */
let CURRENT_THEME = 'light';
function applyTheme(theme){
  CURRENT_THEME = theme;
  if(theme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  const btn = $('themeBtn');
  if(btn) btn.textContent = theme === 'dark' ? '☀️ تم روشن' : '🌙 تم تاریک';
  if(PARSED && typeof render === 'function') render(0);
  if(typeof window.onThemeChange === 'function') window.onThemeChange(theme);
}
applyTheme('light');
if($('themeBtn')) $('themeBtn').onclick = () => {
  applyTheme(CURRENT_THEME === 'dark' ? 'light' : 'dark');
};

/* ---------- Market Data ---------- */
function loadMarketFromStorage(){
  try{
    const raw = localStorage.getItem('kodal_market');
    if(raw){
      const m = JSON.parse(raw);
      MARKET = {
        symbol: m.symbol||'', price: m.price||null, shares: m.shares||null,
        periodMonths: m.periodMonths || 12,
        sectorType: m.sectorType || 'normal', industry: m.industry || '',
        tsetmcPE: m.tsetmcPE || null,
        tsetmcEPS: m.tsetmcEPS || null,
        groupPE: m.groupPE || null,
      };
      window.MARKET = MARKET;
    }
  }catch(e){}
}
function saveMarketToStorage(){
  try{
    // ⭐ P/E رو از window.MARKET بگیر اگه MARKET داخلی نداره
    const finalPE = MARKET.tsetmcPE || window.MARKET?.tsetmcPE || null;
    const finalEPS = MARKET.tsetmcEPS || window.MARKET?.tsetmcEPS || null;
    const finalGroupPE = MARKET.groupPE || window.MARKET?.groupPE || null;
    
    const toSave = {
      symbol: MARKET.symbol || '',
      price: MARKET.price || null,
      shares: MARKET.shares || null,
      periodMonths: MARKET.periodMonths || 12,
      sectorType: MARKET.sectorType || 'normal',
      industry: MARKET.industry || '',
      tsetmcPE: finalPE,
      tsetmcEPS: finalEPS,
      groupPE: finalGroupPE,
    };
    localStorage.setItem('kodal_market', JSON.stringify(toSave));
    
    // ⭐ آپدیت MARKET داخلی هم
    MARKET.tsetmcPE = finalPE;
    MARKET.tsetmcEPS = finalEPS;
    MARKET.groupPE = finalGroupPE;
    
    console.log('💾 saveMarketToStorage:', { tsetmcPE: finalPE });
  }catch(e){}
}
function applyMarketInputs(){
  MARKET.symbol = ($('symbolName')?.value || '').trim();
  MARKET.price = toNum($('stockPrice')?.value);
  MARKET.shares = toNum($('stockCount')?.value);
  if(PARSED?._detectedInfo?.months){
    MARKET.periodMonths = PARSED._detectedInfo.months;
  } else if(!MARKET.periodMonths){
    MARKET.periodMonths = 12;
  }
  
  // ⭐ حفظ P/E و EPS سایت TSETMC
  if(window.MARKET && window.MARKET.tsetmcPE != null){
    MARKET.tsetmcPE = window.MARKET.tsetmcPE;
  }
  if(window.MARKET && window.MARKET.tsetmcEPS != null){
    MARKET.tsetmcEPS = window.MARKET.tsetmcEPS;
  }
  if(window.MARKET && window.MARKET.groupPE != null){
    MARKET.groupPE = window.MARKET.groupPE;
  }
  
  window.MARKET = MARKET;
  saveMarketToStorage();
  const hint = $('marketHint');
  if(hint){
    if(MARKET.price && MARKET.shares){
      hint.textContent = `✅ اطلاعات کامل — قیمت: ${toFa(MARKET.price.toLocaleString('en-US'))} ریال | سهام: ${toFa(MARKET.shares.toLocaleString('en-US'))}`;
      hint.classList.add('active');
    } else if(MARKET.price){
      hint.textContent = `✅ قیمت ذخیره شد (${toFa(MARKET.price.toLocaleString('en-US'))} ریال) — تعداد سهام از سرمایه فایل خونده می‌شه`;
      hint.classList.add('active');
    } else {
      hint.textContent = '💡 اگه قیمت و تعداد سهام رو وارد کنی، تب «ارزش‌گذاری» هم فعال می‌شه.';
      hint.classList.remove('active');
    }
  }
  if(PARSED) render(0);
}

attachNumberFormatter($('stockPrice'));
attachNumberFormatter($('stockCount'));

['symbolName','stockPrice','stockCount'].forEach(id => {
  const el = $(id);
  if(!el) return;
  let timer;
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if(MARKET.price || MARKET.shares || MARKET.symbol){ applyMarketInputs(); } }, 800);
  });
  el.addEventListener('change', () => { clearTimeout(timer); applyMarketInputs(); });
  el.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ clearTimeout(timer); applyMarketInputs(); } });
});

/* ---------- Storage ---------- */
const STORAGE_KEY = 'kodal_analyses_v1';
const MAX_SAVED = 200;
let STORAGE_AVAILABLE = false;
(function testStorage(){
  try{
    const k = '__test__' + Date.now();
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    STORAGE_AVAILABLE = true;
  }catch(e){ STORAGE_AVAILABLE = false; }
})();

function loadFromStorage(){
  if(!STORAGE_AVAILABLE) return [];
  try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function saveToStorage(list){
  if(!STORAGE_AVAILABLE) return false;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
  catch(e){
    if(e.name === 'QuotaExceededError'){ showToast('⚠️ حافظه مرورگر پر شده', true); }
    return false;
  }
}

let SAVED_LIST = loadFromStorage();

function renderSaved(){
  const box = $('savedList');
  if(!box) return;
  const dlBtn = $('downloadAll');
  if(dlBtn) dlBtn.disabled = SAVED_LIST.length === 0;
  if(!SAVED_LIST.length){
    box.innerHTML = '<div class="saved-empty">هنوز تحلیلی ذخیره نکردی.</div>';
    return;
  }
  const search = ($('savedSearch')?.value || '').trim().toLowerCase();
  const sortBy = $('savedSort')?.value || 'recent';
  let indexed = SAVED_LIST.map((item, idx) => ({...item, _idx: idx}));
  if(search) indexed = indexed.filter(x => x.name.toLowerCase().includes(search));
  if(sortBy === 'starred') indexed = indexed.filter(x => x.starred);
  else if(sortBy === 'oldest') indexed.reverse();
  else if(sortBy === 'name') indexed.sort((a,b) => a.name.localeCompare(b.name, 'fa'));
  if(!indexed.length){
    box.innerHTML = '<div class="saved-empty">نتیجه‌ای پیدا نشد.</div>';
    return;
  }
  box.innerHTML = indexed.map(item => {
    const idx = item._idx;
    const starred = item.starred ? 'on' : 'off';
    const starIcon = item.starred ? '★' : '☆';
    return `
      <div class="saved-item ${item.starred ? 'starred' : ''}">
        <div class="name">
          <span class="star ${starred}" onclick="toggleStar(${idx})">${starIcon}</span>
          <span>${item.name}</span>
          <span class="edit-name" onclick="editName(${idx})">✏️</span>
        </div>
        <div class="date">${item.date}</div>
        <div class="btns">
          <button class="primary" onclick="restoreAnalysis(${idx})">بازیابی</button>
          <button class="ghost" onclick="deleteAnalysis(${idx})">حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleStar = function(idx){
  if(!SAVED_LIST[idx]) return;
  SAVED_LIST[idx].starred = !SAVED_LIST[idx].starred;
  saveToStorage(SAVED_LIST);
  renderSaved();
};

window.editName = async function(idx){
  if(!SAVED_LIST[idx]) return;
  const current = SAVED_LIST[idx].name;
  const newName = await KodalUI.prompt({
    title: 'ویرایش نام تحلیل', icon: '✏️', message: 'اسم جدید رو وارد کن:',
    value: current, confirmText: 'ذخیره',
  });
  if(newName != null && newName.trim()){
    SAVED_LIST[idx].name = newName.trim();
    saveToStorage(SAVED_LIST);
    renderSaved();
    showToast('✅ اسم عوض شد');
  }
};

document.addEventListener('input', (e) => { if(e.target.id === 'savedSearch') renderSaved(); });
document.addEventListener('change', (e) => { if(e.target.id === 'savedSort') renderSaved(); });

window.deleteAnalysis = async function(idx){
  const ok = await KodalUI.confirm({
    title: 'حذف تحلیل', icon: '🗑️', message: 'این تحلیل حذف بشه؟',
    confirmText: 'بله، حذف کن', danger: true,
  });
  if(!ok) return;
  SAVED_LIST.splice(idx, 1);
  saveToStorage(SAVED_LIST);
  renderSaved();
  showToast('✅ حذف شد');
};

window.restoreAnalysis = function(idx){
  const item = SAVED_LIST[idx];
  if(!item) return;
  try{
    PARSED = JSON.parse(JSON.stringify(item.parsed));
    PARSED._periods = item.periods || 3;
    window.PARSED = PARSED;
    if(item.market){
      MARKET = {
        symbol: item.market.symbol||'', price: item.market.price||null, shares: item.market.shares||null,
        periodMonths: item.market.periodMonths || 12,
        sectorType: item.market.sectorType || 'normal', industry: item.market.industry || '',
      };
      window.MARKET = MARKET;
      if($('symbolName')) $('symbolName').value = MARKET.symbol;
      if($('stockPrice')) $('stockPrice').value = MARKET.price ? formatNumberInput(MARKET.price) : '';
      if($('stockCount')) $('stockCount').value = MARKET.shares ? formatNumberInput(MARKET.shares) : '';
    }


    const infoBox = $('periodInfoBox');
    const infoText = $('periodInfoText');
    if(infoBox && infoText){
      infoBox.style.display = 'flex';
      infoText.textContent = PARSED._detectedPeriod || 'نامشخص';
      
      const monthsSelect = $('periodMonthsSelect');
      const yearSelect = $('periodYearSelect');
      const badge = $('periodAutoBadge');
      
      if(monthsSelect && yearSelect){
        const detectedMonths = PARSED._detectedInfo?.months || MARKET.periodMonths || 12;
        monthsSelect.value = String(detectedMonths);
        
        const detectedYear = PARSED._detectedInfo?.year;
        if(detectedYear){
          const yearStr = String(detectedYear);
          const hasYear = Array.from(yearSelect.options).some(o => o.value === yearStr);
          if(!hasYear){
            const opt = document.createElement('option');
            opt.value = yearStr;
            opt.textContent = toFa(yearStr);
            yearSelect.appendChild(opt);
          }
          yearSelect.value = yearStr;
        }
        
        if(badge){
          badge.textContent = '✓ خودکار';
          badge.className = 'period-auto-badge';
        }
      }
    }


    $('out').style.display = 'block';
    const btn = $('saveBtn');
    btn.style.display = 'inline-block';
    btn.disabled = false;
    const watchBtn = $('sendToWatchBtn');
    if(watchBtn){ watchBtn.style.display = 'inline-block'; watchBtn.disabled = false; }
    render(0);
    $('status').textContent = '✅ بازیابی شد: ' + item.name;
    window.scrollTo({top: $('out').offsetTop - 20, behavior: 'smooth'});
  }catch(e){ alert('خطا: ' + e.message); }
};

function downloadAllAnalyses(){
  if(!SAVED_LIST.length){ showToast('لیست خالیه', true); return; }
  const data = { version: '2.3.0', exportDate: new Date().toISOString(), count: SAVED_LIST.length, analyses: SAVED_LIST };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
  a.download = `kodal-analyses-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast('📥 دانلود شد');
}

function uploadAnalyses(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const data = JSON.parse(e.target.result);
      if(!data || !Array.isArray(data.analyses)) throw new Error('ساختار فایل درست نیست');
      let added = 0;
      data.analyses.forEach(item => {
        if(!item || !item.name || !item.parsed) return;
        const isDup = SAVED_LIST.some(x => x.name === item.name && x.date === item.date);
        if(!isDup){ SAVED_LIST.unshift(item); added++; }
      });
      if(SAVED_LIST.length > MAX_SAVED) SAVED_LIST.length = MAX_SAVED;
      saveToStorage(SAVED_LIST);
      renderSaved();
      showToast(`✅ ${toFa(added)} تحلیل اضافه شد`);
    }catch(err){ showToast('خطا: ' + err.message, true); }
  };
  reader.readAsText(file);
}

if($('downloadAll')) $('downloadAll').onclick = downloadAllAnalyses;
if($('uploadFile')) $('uploadFile').onclick = () => $('uploadInput').click();
if($('uploadInput')) $('uploadInput').onchange = (e) => {
  const f = e.target.files[0];
  if(f) uploadAnalyses(f);
  e.target.value = '';
};

renderSaved();

/* ---------- Toast ---------- */
function showToast(msg, isError){
  const t = $('saveToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
window.showToast = showToast;

/* ---------- Save Modal ---------- */
function openSaveModal(){
  if(!PARSED){ showToast('اول یه فایل رو تحلیل کن!', true); return; }
  const defaultName = (MARKET.symbol ? MARKET.symbol + ' — ' : '') + toFa(new Date().toLocaleString('fa-IR'));
  $('saveNameInput').value = defaultName;
  $('saveModal').classList.add('show');
  setTimeout(() => $('saveNameInput').focus(), 50);
}
function closeSaveModal(){ $('saveModal').classList.remove('show'); }

if($('saveBtn')) $('saveBtn').onclick = openSaveModal;
if($('saveCancel')) $('saveCancel').onclick = closeSaveModal;

if($('saveConfirm')) $('saveConfirm').onclick = async () => {
  const name = ($('saveNameInput').value || '').trim();
  if(!name){ showToast('اسم خالی نباشه', true); return; }
  if(SAVED_LIST.length >= MAX_SAVED){
    const oldest = SAVED_LIST[SAVED_LIST.length - 1];
    const ok = await KodalUI.confirm({
      title: 'لیست پره', icon: '⚠️',
      message: `حداکثر ${toFa(MAX_SAVED)} تحلیل قابل ذخیره‌ست.<br><br>قدیمی‌ترین: <b>${escapeHtml(oldest?.name || '—')}</b>`,
      confirmText: 'ادامه بده', danger: true,
    });
    if(!ok) return;
  }
  try{
    SAVED_LIST.unshift({
      name: name, date: toFa(new Date().toLocaleString('fa-IR')),
      parsed: JSON.parse(JSON.stringify(PARSED)),
      periods: PARSED._periods, starred: false, market: {...MARKET},
    });
    if(SAVED_LIST.length > MAX_SAVED){
      const removedCount = SAVED_LIST.length - MAX_SAVED;
      SAVED_LIST.length = MAX_SAVED;
      setTimeout(() => { showToast(`⚠️ ${toFa(removedCount)} تحلیل قدیمی حذف شد`); }, 500);
    }
    const saved = saveToStorage(SAVED_LIST);
    renderSaved();
    closeSaveModal();
    showToast(saved ? '✅ ذخیره شد!' : '✅ ذخیره شد!');
  }catch(e){ showToast('خطا: ' + e.message, true); }
};
if($('saveNameInput')) $('saveNameInput').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') $('saveConfirm').click();
  if(e.key === 'Escape') closeSaveModal();
});
if($('saveModal')) $('saveModal').addEventListener('click', (e) => {
  if(e.target.id === 'saveModal') closeSaveModal();
});


/* ============================================================
   📄 کوتاه کردن اسم فایل (اگه کد سیستمی باشه)
============================================================ */
function shortenFileName(fileName){
  if(!fileName) return '—';
  
  // اگه اسم فایل فارسی داره، کامل نشون بده
  if(/[\u0600-\u06FF]/.test(fileName)){
    return fileName;
  }
  
  // چک کن ببین اسم فایل شبیه UUID هست یا نه
  // الگو: 8-4-4-4-12 کاراکتر (مثل 0e6300d4-44e3-4832-b739-b1123fcf.xlsx)
  const uuidPattern = /^([a-f0-9]{8})-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  const match = fileName.match(uuidPattern);
  
  if(match){
    // فقط بخش اول (8 کاراکتر) رو نگه دار و پسوند فایل رو اضافه کن
    const ext = fileName.split('.').pop();
    return match[1] + '...' + (ext ? '.' + ext : '');
  }
  
  // اگه اسم خیلی طولانی بود (بیشتر از ۳۰ کاراکتر)، کوتاهش کن
  if(fileName.length > 30){
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    return fileName.substring(0, 20) + '...' + ext;
  }
  
  return fileName;
}


/* ---------- File Input / Drop ---------- */
function showFileInfo(f){
  if(!f) return;
  const info = $('fileInfo');
  const nameEl = $('fileName');
  if(info && nameEl){ 
    nameEl.textContent = shortenFileName(f.name);
    nameEl.title = f.name; // وقتی موس روش می‌ره، اسم کامل نشون داده می‌شه
    info.classList.add('active'); 
  }
}
function hideFileInfo(){
  const info = $('fileInfo');
  if(info) info.classList.remove('active');
}

if($('file')) $('file').onchange = async e => {
  file = e.target.files[0];
  const hasSearched = MARKET.sectorType && MARKET.industry;
  $('go').disabled = !file || !hasSearched;
  const goHint = $('goHint');
  if(goHint) goHint.style.display = 'block';
  $('saveBtn').disabled = true;
  if(file){ showFileInfo(file); } else { hideFileInfo(); }
  $('err').style.display = 'none';
  if(hasSearched && file){ $('go').disabled = false; }

  // ⭐ تشخیص خودکار دوره به محض انتخاب فایل
  if(file){
    try{
      const lines = await getLines(file);
      const detected = detectPeriodFromLines(lines);
      
      // ذخیره موقت توی PARSED_INFO (نه PARSED کامل)
      window._detectedPeriodPreview = detected;
      
      const infoBox = $('periodInfoBox');
      const infoText = $('periodInfoText');
      const monthsSelect = $('periodMonthsSelect');
      const yearSelect = $('periodYearSelect');
      const badge = $('periodAutoBadge');

      if(infoBox && infoText){
        infoBox.style.display = 'flex';
        infoText.textContent = detected.label || 'نامشخص';
        infoText.style.display = detected.label ? 'inline-flex' : 'none';
      }

      // پر کردن منوها
      if(monthsSelect && yearSelect){
        const detectedMonths = detected.months || 12;
        monthsSelect.value = String(detectedMonths);

        const detectedYear = detected.year;
        if(detectedYear){
          const yearStr = String(detectedYear);
          const hasYear = Array.from(yearSelect.options).some(o => o.value === yearStr);
          if(!hasYear){
            const opt = document.createElement('option');
            opt.value = yearStr;
            opt.textContent = toFa(yearStr);
            yearSelect.appendChild(opt);
          }
          yearSelect.value = yearStr;
        }

        if(badge){
          badge.textContent = '✓ خودکار';
          badge.className = 'period-auto-badge';
        }
      }
    }catch(err){
      console.warn('تشخیص دوره پیش‌نمایش:', err);
    }
  }
};

if($('drop')){
  ['dragover','dragenter'].forEach(ev => $('drop').addEventListener(ev, e => {
    e.preventDefault();
    $('drop').classList.add('hover');
  }));
  ['dragleave','drop'].forEach(ev => $('drop').addEventListener(ev, e => {
    e.preventDefault();
    $('drop').classList.remove('hover');
  }));
  $('drop').addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if(!f) return;
    file = f;
    $('go').disabled = true;
    $('saveBtn').disabled = true;
    showFileInfo(f);
    $('err').style.display = 'none';
    if(MARKET.sectorType && MARKET.industry){ $('go').disabled = false; }
  });
  const browseBtn = $('drop').querySelector('.drop-browse-btn');
  if(browseBtn){ browseBtn.onclick = (e) => { e.stopPropagation(); $('file').click(); }; }


  $('drop').addEventListener('click', (e) => {
    // اگه روی دکمه، input، select یا هر عنصر تعاملی کلیک شد، فایل باز نکن
    if(e.target.closest('button')) return;
    if(e.target.closest('input')) return;
    if(e.target.closest('select')) return;
    if(e.target.closest('.period-info-box')) return;
    if(e.target.closest('.drop-file-info')) return;
    $('file').click();
  });


}

/* ---------- Parse File Content ---------- */
async function getLines(f){
  const buf = await f.arrayBuffer();
  const head = new TextDecoder('utf-8').decode(new Uint8Array(buf).slice(0, 800)).toLowerCase();
  const isHtmlLike = head.includes('<html') || head.includes('<!doctype') || head.includes('<table') || /\.(xls|html?|txt)$/i.test(f.name) && head.includes('<');

  if(isHtmlLike && (head.includes('<html') || head.includes('<table') || head.includes('<!doctype'))){
    const txt = new TextDecoder('utf-8').decode(new Uint8Array(buf));
    const doc = new DOMParser().parseFromString(txt,'text/html');
    const tables = doc.querySelectorAll('table');
    let lines = [];
    if(tables.length){
      tables.forEach(t => {
        t.querySelectorAll('tr').forEach(tr => {
          const cells = [...tr.cells].map(c => c.innerText.replace(/\s+/g,' ').trim());
          const joined = cells.join(' | ');
          joined.split(/\r?\n|<br\s*\/?>/i).forEach(seg => { if(seg.trim()) lines.push(seg.trim()) });
          [...tr.cells].forEach(c => {
            c.innerText.split(/\r?\n/).forEach(seg => { if(seg.trim().length>3) lines.push(seg.trim()) });
          });
        });
      });
    } else {
      const txt2 = txt.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|h\d|li|tr)>/gi,'\n').replace(/<[^>]+>/g,'');
      lines = txt2.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    }
    return lines;
  }
  if(f.name.toLowerCase().endsWith('.csv') || (head.includes(',') && !head.includes('<'))) {
    const txt = new TextDecoder('utf-8').decode(new Uint8Array(buf));
    return txt.split(/\r?\n/).filter(Boolean);
  }
  if(!window.XLSX) throw Error('کتابخانه Excel بارگذاری نشد.');
  const wb = XLSX.read(buf, {type:'array'});
  let lines = [];
  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:'', raw:false});
    rows.forEach(r => {
      if(!r || !r.length) return;
      const joined = r.map(c => String(c).replace(/\s+/g,' ').trim()).filter(Boolean).join(' | ');
      if(!joined) return;
      joined.split(/\r?\n|<br\s*\/?>/i).forEach(seg => { if(seg.trim()) lines.push(seg.trim()) });
    });
  });
  return lines;
}

/* ---------- Labels ---------- */
const LABELS = {
  cogs: [
    /^هزینه\s*های\s*بیمه\s*ای$/,
    /^هزینه\s*های\s*بیمه\s*ای\s*$/,
    /بها[ىی]?\s*تمام\s*شده\s*درآمدهای?\s*عملیاتی/,
    /بها[ىی]?\s*تمام\s*شده\s*درامدهای?\s*عملیاتی/
  ],
  revenue: [
    /^درامدهای\s*بیمه\s*ای/,
    /^درآمدهای\s*بیمه\s*ای/,
    /^درامدهای\s*عملیاتی\s*\|/,
    /^درامدهای\s*عملیاتی$/,
    /^درامد\s*عملیاتی\s*\|/,
    /^درامد\s*عملیاتی$/,
    /^فروش\s*خالص$/,
    /^فروش\s*خالص\s*\|/
  ],
  grossProfit: [/سود\s*\(?[زیي]ان\)?\s*ناخالص\s*فعالیتهای\s*بیمه\s*ای/, /سود\s*ناخالص\s*فعالیتهای\s*بیمه\s*ای/, /سود\s*\(?[زیي]ان\)?\s*ناخالص/, /سود\s*ناخالص/, /سود.*ناخالص/],
  opEx:             [/هزینه.*فروش.*اداری/, /هزینه.*ادارى/, /هزینه.*فروش/],
  otherOpInc:       [/سایر\s*درامدها(?!\s*و\s*هزینه\s*غیر)/],
  opProfit:         [/سود.*عملیاتی/, /سود\s*عملیاتی/],
  financeCost:      [/^جمع\s*هزینه.*مالی/, /^جمع\s*هزینه.*مالى/, /هزینه.*مالی/, /هزینه.*مالى/],
  otherNonOp:       [/سایر\s*درامدها\s*و\s*هزینه.*غیرعملیاتی/, /سایر\s*درامدها\s*و\s*هزینه/],
  profitBeforeTax:  [/سود.*قبل\s*از\s*مالیات/],
  tax:              [/هزینه\s*مالیات/],
  netProfit:        [/^سود.*خالص$/, /^سود.*خالص\s*$/, /سود.*خالص(?!.*سهام)(?!.*سهم)/],
  eps: [
    /سود.*خالص\s*هر\s*سهم/, /سود.*هر\s*سهم/,
    /سود\s*\(?[زیي]ان\)?\s*پايه\s*هر\s*سهم/,
    /سود\s*پايه\s*هر\s*سهم/, /سود.*پايه.*سهم/, /EPS/i
  ],
  capital:          [
    // ⭐ دقیق: فقط وقتی که «سرمایه» تمام محتوای خط باشه یا با | یا فاصله بعدش بیاد
    /^سرمایه\s*(\||$)/, /^سرمايه\s*(\||$)/,
    /^سرمایه\s*[-–]\s*/, /^سرمايه\s*[-–]\s*/,
    /^سرمایه\s*ثبت/, /^سرمايه\s*ثبت/,
    /^سرمایه\s*شرکت/, /^سرمايه\s*شرکت/,
    /^capital$/, /^سرمایه\s*اسمی$/,
    // ⭐ برای فایل‌های فشرده که «سرمایه» وسط خطه، ولی مرز کلمه داره
    /\bسرمایه\s*(\||\s+[\d۰-۹])/, /\bسرمايه\s*(\||\s+[\d۰-۹])/,
  ],
  nonCurrentAssets: [/^جمع\s*دارایی.*غیرجاری/, /^جمع\s*دارايي.*غيرجاري/],
  currentAssets:    [/^جمع\s*دارایی.*جاری/, /^جمع\s*دارايي.*جاري/],
  totalAssets:      [/^جمع\s*دارایی/, /^جمع\s*دارايي/],
  inventory:        [/^موجودی\s*مواد\s*و\s*کالا/, /^موجودي\s*مواد\s*و\s*کالا/],
  receivables:      [/^دریافتنی.*تجاری/, /^دريافتني.*تجاري/],
  cash: [
    /^موجودی\s*نقد(\s*\|[\s\S]*)?$/, /^موجودي\s*نقد(\s*\|[\s\S]*)?$/,
    /^موجودی\s*نقد\s*و\s*بانک/, /^موجودي\s*نقد\s*و\s*بانک/,
    /^موجودی\s*نقد\s*و\s*معادل/, /^موجودي\s*نقد\s*و\s*معادل/,
    /^نقد\s*و\s*بانک/, /^نقد\s*و\s*معادل\s*نقد/,
    /^موجودی\s*نقدی/, /^موجودي\s*نقدي/, /^وجه\s*نقد/,
  ],
  shortTermInv:     [/^سرمایه.?گذاری.*کوتاه/, /^سرمايه.?گذاري.*کوتاه/],
  nonCurrentLiab:   [/^جمع\s*بدهی.*غیرجاری/, /^جمع\s*بدهي.*غيرجاري/],
  currentLiab: [
    /^جمع\s*بدهی.*جاری/, /^جمع\s*بدهي.*جاري/,
    /^جمع\s*بدهی\s*جاری/, /^جمع\s*بدهی‌های\s*جاری/,
    /^بدهی‌های\s*جاری/, /^بدهي\s*هاي\s*جاري/,
  ],
  totalLiab: [
    /^جمع\s*بدهی/, /^جمع\s*بدهي/,
    /جمع\s*بدهی(?![\u200c\s]*های[\u200c\s]*جاری)(?![\u200c\s]*های[\u200c\s]*غیرجاری)(?![\u200c\s]*جاری)(?![\u200c\s]*غیرجاری)/,
    /جمع\s*بدهي(?![\u200c\s]*هاي[\u200c\s]*جاري)(?![\u200c\s]*هاي[\u200c\s]*غيرجاري)(?![\u200c\s]*جاري)(?![\u200c\s]*غيرجاري)/,
  ],
  equity: [
    /^جمع\s*حقوق\s*مالکانه/, /^جمع\s*حقوق\s*صاحبان\s*سهام/,
    /^جمع\s*حقوق\s*مالکانه\s*و\s*بدهی/,
    /جمع\s*حقوق[\u200c\s]*صاحبان[\u200c\s]*سهام/,
    /جمع\s*حقوق[\u200c\s]*مالکانه/,
  ],
  retainedEarnings: [
    /انباشته/,
    /^سود\s*\(?[زیي]ان\)?\s*انباشته/,
    /^سود\s*انباشته/,
    /^زيان\s*انباشته/,
    /^زیان\s*انباشته/,
    /انباشته\s*شده/,
  ],
  longTermDebt:     [/^تسهیلات\s*مالی\s*بلندمدت/, /^پرداختنی.*بلندمدت/],
  payables:         [/^پرداختنی.*تجاری/, /^پرداختني.*تجاري/, /^حساب.*پرداختنی/, /^حساب.*پرداختني/],
  cfo:              [/جریان.*خالص.*نقد.*فعالیت.*عملیاتی/, /جریان.*نقد.*عملیاتی/, /جریان\s*خالص\s*ورود.*نقد/],
  cfi:              [/جریان.*خالص.*نقد.*فعالیت.*سرمایه.?گذاری/],
  cff:              [/جریان.*خالص.*نقد.*فعالیت.*تامین\s*مالی/, /جریان.*خالص.*نقد.*فعالیت.*تأمین\s*مالی/],
  capex:            [/پرداخت.*خرید\s*دارایی.*ثابت/, /پرداخت.*تحصیل\s*دارایی.*ثابت/],
  depreciation:     [/هزینه.*استهلاک/, /استهلاک\s*دارایی/],
  amortization:     [/هزینه.*استهلاک\s*دارایی.*نامشهود/, /استهلاک\s*نامشهود/],
};

function matchLabel(line){
  const n = norm(line);
  for(const key in LABELS){
    for(const rx of LABELS[key]){
      if(rx.test(n)) return key;
    }
  }
  return null;
}

function extractBestValues(nums, periods, preferLargest){
  let filtered = nums.filter(v => {
    if(v == null) return false;
    if(v >= 1390 && v <= 1420) return false;
    if(Math.abs(v) < 10 && !preferLargest) return false;
    return true;
  });
  if(filtered.length < periods){ filtered = nums.filter(v => v != null && !(v >= 1390 && v <= 1420)); }
  if(filtered.length < periods){ filtered = nums.filter(v => v != null); }
  if(filtered.length <= periods){ return filtered.slice(0, periods); }
  if(preferLargest){
    let bestStart = 0;
    let bestSum = -Infinity;
    for(let s = 0; s <= filtered.length - periods; s++){
      const group = filtered.slice(s, s + periods);
      const sum = group.reduce((a,b) => a + Math.abs(b), 0);
      if(sum > bestSum){ bestSum = sum; bestStart = s; }
    }
    return filtered.slice(bestStart, bestStart + periods);
  }
  const bigs = filtered.filter(v => Math.abs(v) >= 1000);
  if(bigs.length >= 1){
    const firstBig = filtered.indexOf(bigs[0]);
    return filtered.slice(firstBig, firstBig + periods);
  }
  return filtered.slice(0, periods);
}

function detectPeriodFromLines(lines){
  const text = lines.join(' ');
  const normalized = fa2en(text)
    .replace(/[يى]/g, 'ی').replace(/[ك]/g, 'ک')
    .replace(/\u200c|\u200f|\u200e/g, '')
    .replace(/\s+/g, ' ');

  let detectedYear = null;
  let detectedMonths = null;
  let detectedDate = null;

  function monthToPeriod(moNum){
    if(moNum === 3) return 3;
    if(moNum === 6) return 6;
    if(moNum === 9) return 9;
    if(moNum === 12) return 12;
    return null;
  }

  const keywordPatterns = [
    /دوره\s*منتهی\s*به\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
    /سال\s*مالی\s*منتهی\s*به\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
    /به\s*تاریخ\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
    /منتهی\s*به\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
    /پایان\s*یافته\s*در\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
    /خاتمه\s*یافته\s*در\s*(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/i,
  ];

  for(const rx of keywordPatterns){
    const m = normalized.match(rx);
    if(m){
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if(y >= 1390 && y <= 1420 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31){
        detectedYear = String(y);
        detectedDate = `${y}/${String(mo).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
        detectedMonths = monthToPeriod(mo);
        if(detectedMonths !== null) break;
      }
    }
  }

  if(detectedMonths === null){
    const candidates = [];
    const reYMD = /(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/g;
    let m;
    while((m = reYMD.exec(normalized)) !== null){
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if(y >= 1390 && y <= 1420 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31){
        candidates.push({ year: y, month: mo, day: d, pos: m.index });
      }
    }
    candidates.sort((a, b) => a.pos - b.pos);
    for(const c of candidates.slice(0, 8)){
      const p = monthToPeriod(c.month);
      if(p !== null){
        detectedYear = String(c.year);
        detectedMonths = p;
        detectedDate = `${c.year}/${String(c.month).padStart(2,'0')}/${String(c.day).padStart(2,'0')}`;
        break;
      }
    }
  }

  if(detectedMonths === null){
    const myRx = /(\d{1,2})\s*ماهه\s*(?:سال\s*)?(\d{4})/i;
    const mm = normalized.match(myRx);
    if(mm){
      const moNum = parseInt(mm[1], 10);
      if([3,6,9,12].includes(moNum)){
        detectedMonths = moNum;
        if(!detectedYear) detectedYear = mm[2];
      }
    }
  }

  if(detectedYear === null){
    const yRx = /(?:سال\s*مالی|سال\s*منتهی\s*به)\s*(\d{4})/i;
    const ym = normalized.match(yRx);
    if(ym) detectedYear = ym[1];
  }

  if(detectedMonths === null){
    if(/(?:۳|3)\s*ماهه/i.test(normalized)) detectedMonths = 3;
    else if(/(?:۶|6)\s*ماهه/i.test(normalized)) detectedMonths = 6;
    else if(/(?:۹|9)\s*ماهه/i.test(normalized)) detectedMonths = 9;
    else if(/(?:۱۲|12)\s*ماهه/i.test(normalized)) detectedMonths = 12;
  }

  let label = null;
  if(detectedMonths && detectedYear){ label = `${toFa(detectedMonths)} ماهه سال ${toFa(detectedYear)}`; }
  else if(detectedMonths){ label = `${toFa(detectedMonths)} ماهه`; }
  else if(detectedYear){ label = `سال مالی ${toFa(detectedYear)}`; }

  return { label, year: detectedYear, months: detectedMonths };
}



/* ============================================================
   🔧 شکستن خطوط فشرده — فقط اگه پارسر عادی ناکام بمونه
============================================================ */
function expandCompactLines(lines){
  const expanded = [];

  lines.forEach(line => {
    if(!line || typeof line !== 'string'){
      expanded.push(line);
      return;
    }

    // ⭐ اگه خط کوتاهه، دست نزن (فایل‌های عادی)
    if(line.length < 250){
      expanded.push(line);
      return;
    }

    // ⭐ اگه خط خیلی بلنده، بشکنش
    // الگو: متن فارسی (حداقل ۲ کاراکتر) + اعداد جدا شده با فاصله
    const breakRegex = /([\u0600-\u06FF][\u0600-\u06FF\s،\(\)\u200c]{1,80}?)\s+((?:[\(\（]?[\d۰-۹][\d٬,،۰-۹\.]*[\)\）]?\s*){1,6})/g;

    let lastIndex = 0;
    let match;
    const pieces = [];

    while((match = breakRegex.exec(line)) !== null){
      if(match.index > lastIndex){
        const before = line.slice(lastIndex, match.index).trim();
        if(before) pieces.push(before);
      }

      const textPart = match[1].trim();
      const numsPart = match[2].trim().replace(/\s+/g, ' | ');

      if(textPart.length >= 2){
        pieces.push(textPart + ' | ' + numsPart);
      } else {
        pieces.push(match[0].trim());
      }

      lastIndex = breakRegex.lastIndex;
    }

    if(lastIndex < line.length){
      const tail = line.slice(lastIndex).trim();
      if(tail) pieces.push(tail);
    }

    // اگه تونستیم بشکنیم (حداقل ۳ قطعه)، به expanded اضافه کن
    if(pieces.length >= 3){
      pieces.forEach(p => expanded.push(p));
    } else {
      expanded.push(line);
    }
  });

  return expanded;
}




function parseItems(lines){
  const items = {};
  const periods = 3;

  const fixedLines = lines.map(line => {
    if(!line || typeof line !== 'string') return line;
    let fixed = line;

    if(/^جمع\s*درآمدهای\s*عملیاتی/.test(fixed)){ return fixed.replace(/^جمع\s*درآمدهای\s*عملیاتی/, 'درآمدهای عملیاتی'); }
    if(/^جمع\s*درامدهای\s*عملیاتی/.test(fixed)){ return fixed.replace(/^جمع\s*درامدهای\s*عملیاتی/, 'درآمدهای عملیاتی'); }
    if(/^بها[ىی]\s*تمام\s*شده\s*درآمدهای\s*عملیاتی/.test(fixed)){ return fixed.replace(/^بها[ىی]\s*تمام\s*شده\s*درآمدهای\s*عملیاتی/, 'بهای تمام شده درآمدهای عملیاتی'); }
    if(/^سود\s*\(\s*زیان\s*\)\s*ناخالص/.test(fixed)){ return fixed.replace(/^سود\s*\(\s*زیان\s*\)\s*ناخالص/, 'سود ناخالص'); }
    if(/^سود\s*\(\s*زيان\s*\)\s*ناخالص/.test(fixed)){ return fixed.replace(/^سود\s*\(\s*زيان\s*\)\s*ناخالص/, 'سود ناخالص'); }
    return fixed;
  });

  const workingLines = fixedLines;
  let firstConsolidated = -1;
  let firstNonConsolidated = -1;

  for(let i = 0; i < workingLines.length; i++){
    const n = norm(workingLines[i]);
    const isConsolidatedHeader = 
      /^صورت\s*سود\s*و\s*زيان\s*تلفيقي/.test(n) ||
      /^صورت\s*سود\s*و\s*زيان\s*جامع\s*تلفيقي/.test(n) ||
      /^صورت\s*وضعيت\s*مالي\s*تلفيقي/.test(n) ||
      /^صورت\s*تغييرات\s*در\s*حقوق\s*مالکانه\s*تلفيقي/.test(n) ||
      /^صورت\s*جريان\s*هاي\s*نقدي\s*تلفيقي/.test(n);
    const isNonConsolidatedHeader =
      /^صورت\s*سود\s*و\s*زيان$/.test(n) ||
      /^صورت\s*سود\s*و\s*زيان\s*جامع$/.test(n) ||
      /^صورت\s*وضعيت\s*مالي$/.test(n) ||
      /^صورت\s*تغييرات\s*در\s*حقوق\s*مالکانه$/.test(n) ||
      /^صورت\s*جريان\s*هاي\s*نقدي$/.test(n);
    if(isConsolidatedHeader && firstConsolidated < 0){ firstConsolidated = i; }
    if(isNonConsolidatedHeader && firstNonConsolidated < 0){ firstNonConsolidated = i; }
  }

  let consolidatedStart = firstConsolidated;
  let consolidatedEnd = (firstNonConsolidated > firstConsolidated) ? firstNonConsolidated : workingLines.length;

  const linesToSearch = [];
  if(consolidatedStart >= 0){
    for(let i = consolidatedStart; i < consolidatedEnd; i++){ linesToSearch.push({ line: workingLines[i], index: i }); }
  } else {
    for(let i = 0; i < workingLines.length; i++){ linesToSearch.push({ line: workingLines[i], index: i }); }
  }

  const allMatches = {};
  for(const { line, index } of linesToSearch){
    const key = matchLabel(line);
    if(!key) continue;
    const nums = extractNumbers(line);
    if(!nums.length) continue;
    if(!allMatches[key]) allMatches[key] = [];
    allMatches[key].push({ line, nums, lineIndex: index });
  }

  for(const key in allMatches){
    const matches = allMatches[key];
    matches.forEach(m => { m.priority = calculatePriority(key, m.line, m.nums); });
    matches.sort((a, b) => {
      if(b.priority !== a.priority) return b.priority - a.priority;
      return a.lineIndex - b.lineIndex;
    });
    const best = matches[0];
    let filtered;
    if(key === 'eps'){ filtered = best.nums.slice(0, periods).filter(v => Math.abs(v) < 1e6); }
    else if(key === 'capital'){ filtered = best.nums.filter(v => v > 0).slice(0, periods); }
    else if(key === 'cash'){ filtered = extractBestValues(best.nums, periods, true); }
    else { filtered = extractBestValues(best.nums, periods, false); }
    items[key] = filtered;
  }

  // ⭐ FALLBACK: اگه capital پیدا نشد، دنبالش توی متن همه خطوط بگرد
  if(!items.capital || !items.capital.length || items.capital.every(v => v === 0)){
    console.log('🔧 FALLBACK: دنبال capital توی همه خطوط...');
    for(const line of workingLines){
      const n = norm(line);
      // رد کن خطوطی که capital اصلی نیستن
      if(/افزایش\s*سرمایه|سرمایه‌گذاری|سرمايه‌گذاري|در\s*جریان|صرف\s*سهام|سهام\s*خزانه|اندوخته|تخصيص|تخصیص|انتقال|مانده|تغییرات/.test(n)) continue;
      // فقط خطوطی که کلمه «سرمایه» دارن
      if(!/سرمایه|سرمايه/.test(n)) continue;
      // اگه کلمه «سرمایه» بلافاصله بعدش عدد داره
      if(!/سرمایه\s+[\(\（]?[\d۰-۹]|سرمايه\s+[\(\（]?[\d۰-۹]/.test(fa2en(line))) continue;
      
      const nums = extractNumbers(line);
      const validNums = nums.filter(v => v > 100000 && v < 1e10);
      if(validNums.length >= 1){
        items.capital = validNums.slice(0, periods);
        console.log('✅ capital پیدا شد:', line.slice(0, 80), '→', items.capital);
        break;
      }
    }
  }

  if(!items.grossProfit && items.revenue){
    if(items.cogs){
      items.grossProfit = items.revenue.map((r, i) => {
        const c = items.cogs[i] ?? 0;
        return (r != null) ? (r - Math.abs(c)) : null;
      });
    } else { items.grossProfit = [...items.revenue]; }
  }

  if(items.eps && items.eps[0] === 0){
    const epsMatches = allMatches.eps || [];
    for(const m of epsMatches){
      const filtered = m.nums.slice(0, periods).filter(v => Math.abs(v) < 1e6);
      if(filtered[0] !== 0 && filtered[0] != null){ items.eps = filtered; break; }
    }
  }

  return items;
}



/* ============================================================
   🧠 پارسر هوشمند — اول عادی، اگه ناکام بود، فشرده
============================================================ */
function parseItemsSmart(lines){
  // ⭐ تلاش اول: پارسر عادی
  let result = parseItems(lines);
  let found = Object.keys(result).filter(k => !k.startsWith('_')).length;

  // ⭐ اگه نتیجه کافی بود، برگردون
  if(found >= 8){
    console.log(`✅ پارسر عادی موفق: ${found} قلم`);
    return result;
  }

  // ⭐ تلاش دوم: پارسر فشرده
  console.log(`⚠️ پارسر عادی فقط ${found} قلم پیدا کرد — تلاش با پارسر فشرده...`);
  const expandedLines = expandCompactLines(lines);
  const result2 = parseItems(expandedLines);
  const found2 = Object.keys(result2).filter(k => !k.startsWith('_')).length;

  console.log(`📊 پارسر فشرده: ${found2} قلم`);

  // ⭐ هر کدوم بهتر بود، برگردون
  if(found2 > found){
    console.log('✅ پارسر فشرده بهتر بود — استفاده می‌شه');
    return result2;
  }

  console.log('✅ پارسر عادی بهتر بود — استفاده می‌شه');
  return result;
}




function calculatePriority(key, line, nums){
  let priority = 0;
  const n = norm(line);

  if(/\d{4}\s*[\/\-\.]\s*\d{1,2}\s*[\/\-\.]\s*\d{1,2}/.test(line)){ priority -= 1000; }
  if(/دوره\s*\d+\s*ماهه|تجديد|گزارش\s*شده|منتهي\s*به/.test(n)){ priority -= 800; }
  if(/سال\s*مالي/.test(n)){ priority -= 500; }
  if(line.length > 120) priority -= 30;

  const realNums = nums.filter(v => !(v >= 1390 && v <= 1420));
  if(realNums.length >= 2 && realNums.length <= 4) priority += 20;

  if(key === 'eps'){
    if(/سود\s*\(?[زیي]ان\)?\s*خالص\s*هر\s*سهم/.test(n)) priority += 5000;
    if(/سود\s*\(?[زیي]ان\)?\s*پايه\s*هر\s*سهم/.test(n)) priority += 2000;
    if(/عملياتي|غيرعملياتي|در\s*حال\s*تداوم|متوقف|قابل\s*انتساب/.test(n)) priority -= 5000;
  }

  if(key === 'netProfit'){
    if(/^سود\s*\(?زيان\)?\s*خالص$/.test(n)) priority += 2000;
    if(/^سود\s*\(?زیان\)?\s*خالص$/.test(n)) priority += 2000;
    if(/^سود.*زيان.*خالص$/.test(n)) priority += 500;
    if(/^سود\s*خالص$/.test(n)) priority += 500;
    if(/^سود.*خالص$/.test(n)) priority += 300;
    if(/عمليات\s*در\s*حال\s*تداوم/.test(n)) priority -= 2000;
    if(/عمليات\s*متوقف/.test(n)) priority -= 2000;
    if(/قابل\s*انتساب/.test(n)) priority -= 1500;
    if(/مالکان\s*شرکت|منافع\s*فاقد/.test(n)) priority -= 1500;
    if(/سود\s*پايه\s*هر\s*سهم|هر\s*سهم/.test(n)) priority -= 1500;
    if(/قبل\s*از\s*ماليات|قبل\s*از\s*احتساب/.test(n)) priority -= 1500;
    if(/جامع/.test(n)) priority -= 1500;
    if(/انباشته/.test(n)) priority -= 2000;
    if(/گزارش\s*شده|تجديد|متوقف|سهام/.test(n)) priority -= 1500;
  }

  if(key === 'equity'){
    if(/^جمع\s*حقوق\s*مالکانه$/.test(n)) priority += 2000;
    if(/^جمع\s*حقوق\s*صاحبان\s*سهام$/.test(n)) priority += 2000;
    if(/^جمع\s*حقوق\s*مالکانه\s*قابل\s*انتساب/.test(n)) priority -= 500;
    if(/^جمع\s*دارايي/.test(n)) priority -= 3000;
    if(/^جمع\s*بدهي/.test(n)) priority -= 3000;
    if(/^جمع\s*حقوق\s*مالکانه\s*و\s*بدهي/.test(n)) priority -= 3000;
    if(/مانده|تغييرات|اصلاح/.test(n)) priority -= 1500;
  }

  if(key === 'revenue'){
    if(/^درامدهای\s*عملیاتی$/.test(n)) priority += 2000;
    if(/^درامد\s*عملیاتی$/.test(n)) priority += 2000;
    if(/^فروش\s*خالص$/.test(n)) priority += 1500;
    if(/جمع\s*فروش|پيش‌بيني|برآورد|تعداد|نرخ|مبلغ\s*فروش/.test(n)) priority -= 1500;
    if(/سال\s*مالي|روند\s*فروش/.test(n)) priority -= 2000;
  }

  if(key === 'totalAssets'){
    if(/^جمع\s*دارايي‌ها$/.test(n)) priority += 2000;
    if(/^جمع\s*دارايي‌هاي\s*(جاري|غيرجاري)$/.test(n)) priority -= 1000;
  }
  if(key === 'totalLiab'){
    if(/^جمع\s*بدهي‌ها$/.test(n)) priority += 2000;
    if(/^جمع\s*بدهي‌هاي\s*(جاري|غيرجاري)$/.test(n)) priority -= 1000;
  }
  if(key === 'currentAssets'){
    if(/^جمع\s*دارايي‌هاي\s*جاري$/.test(n)) priority += 2000;
  }
  if(key === 'currentLiab'){
    if(/^جمع\s*بدهي‌هاي\s*جاري$/.test(n)) priority += 2000;
  }
  if(key === 'cogs'){
    if(/^بهاى\s*تمام\s*شده\s*درآمدهاي\s*عملياتي$/.test(n)) priority += 2000;
    if(/^بهاي\s*تمام\s*شده\s*درامدهاي\s*عملياتي$/.test(n)) priority += 2000;
    if(/كلاي\s*توليد|كلاي\s*فروش|خدمات|جمع\s*بهای|جدول|برآورد/.test(n)) priority -= 1500;
  }
  if(key === 'opProfit'){
    if(/^سود\s*\(?زيان\)?\s*عملياتى$/.test(n)) priority += 2000;
    if(/^سود\s*عملياتى$/.test(n)) priority += 2000;
    if(/عمليات\s*در\s*حال\s*تداوم|قبل\s*از\s*ماليات|قبل\s*از\s*احتساب/.test(n)) priority -= 1500;
  }
  if(key === 'grossProfit'){
    if(/^سود\s*\(?زيان\)?\s*ناخالص$/.test(n)) priority += 2000;
    if(/^سود\s*ناخالص$/.test(n)) priority += 2000;
  }

  if(key === 'capital'){
    if(/^سرمایه\s*[-–]\s*میلیون/.test(n)) priority += 5000;
    if(/^سرمايه\s*[-–]\s*ميليون/.test(n)) priority += 5000;
    if(/^سرمایه$/.test(n)) priority += 3000;
    if(/^سرمايه$/.test(n)) priority += 3000;
    if(/افزایش|کاهش|تغییرات|انتقال|در\s*جریان/.test(n)) priority -= 3000;
  }
  return priority;
}

/* ---------- HINTS ---------- */
const HINTS = {
  'نسبت جاری': { template: 'شرکت اگه همین الان بخواد بدهی‌های کوتاه‌مدتش رو بده، ...', good: 'پول یا دارایی کافی داره', warn: 'به سختی می‌تونه بدهی‌هاش رو بده', bad: 'می‌مونه تو گل' },
  'نسبت آنی (Quick)': { template: 'اگه شرکت بدبخت شد و خواست فوری بدهی‌هاش رو بده، بدون اینکه انبارش رو بفروشه، ...', good: 'می‌تونه بدهی‌هارو بده', warn: 'به سختی می‌تونه', bad: 'نمی‌تونه بدهی‌هارو بده' },
  'نسبت نقد': { template: 'شرکت همین الان ... با پول نقدش، بدهی هاش بده', good: 'می‌تونه ', warn: 'فقط بخشی رو می‌تونه ', bad: 'نمی‌تونه ' },
  'سرمایه در گردش': { template: 'بعد از اینکه بدهی‌های کوتاه‌مدتش رو داد، ... که بتونه کارش رو بچرخونه', good: 'پول کافی براش مونده', warn: 'پول کمی براش مونده', bad: 'پولی براش نمونده و تو فشاره' },
  'بدهی به دارایی': { dynamic: true, template: 'از هر ۱۰۰ تومن دارایی شرکت، {v} تومنش مال طلبکارهاست نه سهامدارها' },
  'بدهی به حقوق صاحبان سهام': { template: 'شرکت ... روی پول سهامدارها قرض گرفته', good: 'کم', warn: 'متوسط', bad: 'زیاد' },
  'پوشش بهره': { dynamic: true, template: 'سود شرکت {v} برابر هزینه بهره‌شه' },
  'اهرم حقوق مالکانه': { dynamic: true, template: 'با پول سهامدارها {v} برابر دارایی خریداری شده' },
  'حاشیه سود ناخالص': { dynamic: true, template: 'از هر ۱۰۰ تومن فروش، {v} تومن بعد از هزینه تولید براش میمونه' },
  'حاشیه سود عملیاتی': { dynamic: true, template: 'از هر ۱۰۰ تومن فروش، بعد از حقوق و اجاره و بازاریابی، {v} تومن می‌مونه' },
  'حاشیه سود خالص': { dynamic: true, template: 'شرکت از هر ۱۰۰ تومن فروش، {v} تومن به جیب شرکت می‌ره' },
  'ROA': { template: 'شرکت از دارایی‌هاش ... سود درمیاره؟', good: 'خیلی خوب', warn: 'متوسط', bad: 'کم' },
  'ROE': { dynamic: true, template: 'شرکت از هر ۱۰۰ تومان پول سهامداران، {v} تومان سود ساخته' },
  'گردش دارایی': { dynamic: true, template: 'به ازای هر ۱ تومن دارایی، {v} تومن فروش ساخته' },
  'گردش موجودی': { template: 'انبار ... تو سال پر و خالی شده؟', good: 'چند بار', warn: 'کم', bad: 'خیلی کم' },
  'گردش مطالبات': { template: 'شرکت ... پول فروش نسیه‌ش رو می‌گیره', good: 'سریع', warn: 'با تاخیر', bad: 'خیلی کند' },
  'دوره وصول مطالبات (روز)': { dynamic: true, template: 'به طور میانگین {v} روز طول می‌کشه شرکت پول فروش نسیه رو بگیره' },
  'جریان نقد عملیاتی / سود خالص': { template: 'سودی که تو دفترها نشون داده، ...  پول نقد شده', good: 'واقعاً', warn: 'تا حدی', bad: 'کم' },
  'آزاد FCF': { template: 'بعد از همه هزینه‌ها و سرمایه‌گذاری، ...  براش مونده', good: 'پول خوبی', warn: 'پول کمی', bad: 'فقط هیچ' },
  'CFO به درآمد': { dynamic: true, template: 'از فروش شرکت، {v} به پول نقد تبدیل شده' },
  'P/E': { dynamic: true, template: 'قیمت سهم {v} برابر سود سالانه‌شه (بر اساس EPS صورت مالی جاری)' },
 
  'P/B': { dynamic: true, template: 'قیمت بازار سهم {v} برابر ارزش دفتری‌شه' },
  'P/S': { dynamic: true, template: 'ارزش بازار شرکت {v} برابر فروش سالانه‌شه' },
  'EPS': { dynamic: true, template: 'شرکت به ازای هر سهم {v} سود ساخته' },
  'EV/EBITDA': { template: 'کل ارزش شرکت (با بدهی) ... برابر سود نقدی قبل از استهلاکشه', good: 'کمتر از ۶', warn: 'حدود ۶ تا ۱۲', bad: 'بیشتر از ۱۲' },
  'چرخه تبدیل نقد (CCC)': { dynamic: true, template: 'از وقتی مواد اولیه می‌خره تا وقتی پول فروش به دستش می‌رسه، {v} روز طول می‌کشه' },
  'نرخ رشد فروش': { dynamic: true, template: 'فروش شرکت نسبت به دوره قبل {v}' },
  'نرخ رشد سود خالص': { dynamic: true, template: 'سود شرکت نسبت به دوره قبل {v}' },
  'PEG': { template: 'P/E رو تقسیم بر رشد سود می‌کنیم تا ببینیم گرونی سهم به خاطر رشده یا نه؟ ...', good: 'زیر ۱ (ارزون نسبت به رشدش)', warn: 'حدود ۱ تا ۲ (متعادل)', bad: 'بالای ۲ (گرون حتی با رشد)' },
  'ROCE (بازده سرمایه به کار گرفته شده)': { template: 'شرکت از سرمایه‌ای که تو کارش گذاشته، ...  ساخته', good: 'سود خوبی', warn: 'سود متوسطی', bad: 'سود کمی' },
  'پوشش بهره نقدی': { dynamic: true, template: 'شرکت با پول نقد واقعی، {v} برابر هزینه بهره‌اش رو می‌تونه بده' },
};

/* ---------- Chart Colors ---------- */
function chartTextColor(){ return document.body.classList.contains('dark') ? '#94a3b8' : '#64748b'; }
function chartLineColor(){ return document.body.classList.contains('dark') ? '#334155' : '#e2e8f0'; }
function chartBaseColor(){ return document.body.classList.contains('dark') ? '#475569' : '#cbd5e1'; }
function chartLabelColor(){ return document.body.classList.contains('dark') ? '#cbd5e1' : '#475569'; }

/* ---------- Charts ---------- */
function buildBarChart(series, periodNames){
  if(!series.length) return '<p style="text-align:center;color:var(--sub);font-size:13px">داده‌ای برای نمایش نیست.</p>';
  series = series.map(s => ({...s, values: [...s.values].reverse()}));
  periodNames = [...periodNames].reverse();
  const periods = periodNames.length;
  const W = 620, H = 260, padL = 145, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let maxAbs = 0;
  series.forEach(s => s.values.forEach(v => { if(v!=null) maxAbs = Math.max(maxAbs, Math.abs(v)); }));
  if(maxAbs === 0) return '<p style="text-align:center;color:var(--sub);font-size:13px">همه مقادیر صفر هستند.</p>';
  const groupW = plotW / periods;
  const barW = Math.max(4, Math.min(24, (groupW - 10) / series.length));
  const barGap = 3;
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  const baseY = padT + plotH;
  svg += `<line x1="${padL}" y1="${baseY}" x2="${W-padR}" y2="${baseY}" stroke="${chartBaseColor()}" stroke-width="1"/>`;
  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y = padT + (plotH * i / steps);
    const val = maxAbs * (1 - i/steps);
    svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${chartLineColor()}" stroke-width="0.8" stroke-dasharray="3,3"/>`;
    svg += `<text x="${padL-30}" y="${y+4}" text-anchor="end" font-size="10" fill="${chartTextColor()}">${toFa(Math.round(val/10000).toLocaleString('en-US'))}</text>`;
  }
  for(let p=0; p<periods; p++){
    const groupX = padL + p*groupW;
    const totalW = series.length * barW + (series.length-1)*barGap;
    const startX = groupX + (groupW - totalW)/2;
    series.forEach((s, si) => {
      const v = s.values[p];
      if(v == null) return;
      const h = Math.abs(v) / maxAbs * plotH;
      const x = startX + si * (barW + barGap);
      const y = baseY - h;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${s.color}" rx="3"><title>${s.name}: ${tomanText(v)}</title></rect>`;
    });
    const cx = groupX + groupW/2;
    svg += `<text x="${cx}" y="${baseY+18}" text-anchor="middle" font-size="10" fill="${chartLabelColor()}">${periodNames[p]}</text>`;
  }
  svg += `</svg>`;
  return svg;
}

function buildPieChart(slices){
  slices = slices.filter(s => s.value != null && s.value > 0);
  if(!slices.length) return '<p style="text-align:center;color:var(--sub);font-size:13px">داده‌ای برای نمایش نیست.</p>';
  const total = slices.reduce((a,b) => a + b.value, 0);
  if(total <= 0) return '<p style="text-align:center;color:var(--sub);font-size:13px">همه مقادیر صفر هستند.</p>';
  const W = 260, H = 200, cx = 100, cy = 100, r = 78, innerR = 42;
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  let startAngle = -Math.PI/2;
  slices.forEach((s) => {
    const angle = (s.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r*Math.cos(startAngle), y1 = cy + r*Math.sin(startAngle);
    const x2 = cx + r*Math.cos(endAngle),   y2 = cy + r*Math.sin(endAngle);
    const x3 = cx + innerR*Math.cos(endAngle),   y3 = cy + innerR*Math.sin(endAngle);
    const x4 = cx + innerR*Math.cos(startAngle), y4 = cy + innerR*Math.sin(startAngle);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    const percentage = (s.value / total * 100).toFixed(1);
    svg += `<path d="${path}" fill="${s.color}" stroke="var(--card)" stroke-width="2"><title>${s.label}: ${toFa(percentage)}٪</title></path>`;
    startAngle = endAngle;
  });
  svg += `</svg>`;
  const legend = slices.map(s => {
    const percentage = (s.value / total * 100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0">
      <i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${s.color}"></i>
      <span>${s.label}: <b style="direction:ltr">${toFa(percentage)}٪</b></span>
    </div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:0 0 200px">${svg}</div><div>${legend}</div></div>`;
}

/* ---------- Score ---------- */
function calcScore(v){
  let score = 0, total = 0;
  const cr = ratio(v.ca, v.cl);
  if(cr != null){ total += 25; if(cr >= 2) score += 25; else if(cr >= 1.5) score += 20; else if(cr >= 1) score += 14; else if(cr >= 0.7) score += 7; else score += 2; }
  const da = ratio(v.tl, v.ta);
  if(da != null){ total += 20; if(da <= 0.4) score += 20; else if(da <= 0.55) score += 15; else if(da <= 0.7) score += 10; else if(da <= 0.85) score += 5; else score += 1; }
  const nm = ratio(v.net, v.revenue);
  if(nm != null){ total += 25; if(nm >= 0.2) score += 25; else if(nm >= 0.12) score += 19; else if(nm >= 0.07) score += 13; else if(nm >= 0.03) score += 7; else if(nm > 0) score += 3; }
  const roe = (v.eq != null && v.eq > 0) ? ratio(v.net, v.eq) : null;
  if(roe != null){ total += 15; if(roe >= 0.25) score += 15; else if(roe >= 0.18) score += 12; else if(roe >= 0.1) score += 8; else if(roe >= 0.05) score += 4; }
  const cq = ratio(v.cfo, v.net);
  if(cq != null){ total += 15; if(cq >= 1) score += 15; else if(cq >= 0.7) score += 11; else if(cq >= 0.4) score += 7; else if(cq >= 0.1) score += 3; }
  if(total === 0) return null;
  return Math.round(score / total * 100);
}
function scoreLevel(s){
  if(s == null) return {label:'—', color:'#94a3b8', text:'اطلاعات کافی نیست.'};
  if(s >= 80) return {label:'عالی', color:'#16834a', text:'شرکت از نظر مالی سالم و قوی است.'};
  if(s >= 65) return {label:'خوب', color:'#22c55e', text:'وضعیت مالی خوب است.'};
  if(s >= 50) return {label:'متوسط', color:'#eab308', text:'وضعیت مالی متوسط است.'};
  if(s >= 35) return {label:'ضعیف', color:'#f59e0b', text:'وضعیت مالی ضعیف است.'};
  return {label:'پرریسک', color:'#c62828', text:'وضعیت پرریسک است.'};
}

/* ⭐ فیلتر نسبت‌ها بر اساس نوع صنعت */
function filterRatiosBySector(list){
  const st = (window.MARKET && window.MARKET.sectorType) || 'normal';

  if(st === 'bank'){
    const hiddenForBank = ['نسبت جاری','نسبت آنی (Quick)','نسبت نقد','سرمایه در گردش','ROCE (بازده سرمایه به کار گرفته شده)','گردش موجودی','گردش مطالبات','دوره وصول مطالبات (روز)','چرخه تبدیل نقد (CCC)','EV/EBITDA'];
    return list.filter(([name]) => !hiddenForBank.includes(name));
  }
  if(st === 'insurance'){
    const hiddenForInsurance = ['نسبت جاری','نسبت آنی (Quick)','نسبت نقد','سرمایه در گردش','ROCE (بازده سرمایه به کار گرفته شده)','گردش موجودی','گردش مطالبات','دوره وصول مطالبات (روز)','چرخه تبدیل نقد (CCC)','حاشیه سود ناخالص','EV/EBITDA'];
    return list.filter(([name]) => !hiddenForInsurance.includes(name));
  }
  if(st === 'investment'){
    const hiddenForInvestment = ['نسبت آنی (Quick)','گردش موجودی','حاشیه سود ناخالص','گردش مطالبات','دوره وصول مطالبات (روز)','چرخه تبدیل نقد (CCC)','EV/EBITDA','ROCE (بازده سرمایه به کار گرفته شده)','پوشش بهره','پوشش بهره نقدی'];
    return list.filter(([name]) => !hiddenForInvestment.includes(name));
  }
  if(st === 'leasing'){
    const hiddenForLeasing = ['گردش موجودی','دوره وصول مطالبات (روز)','چرخه تبدیل نقد (CCC)','ROCE (بازده سرمایه به کار گرفته شده)','EV/EBITDA','پوشش بهره نقدی'];
    return list.filter(([name]) => !hiddenForLeasing.includes(name));
  }
  return list;
}
window.filterRatiosBySector = filterRatiosBySector;

/* ============================================================
   DuPont Analysis
============================================================ */
function renderDuPont(v){
  const box = $('dupontBox');
  const noteEl = $('dupontNote');
  if(!box) return;
  const eq = (v.eq != null) ? v.eq : ((v.ta != null && v.tl != null) ? (v.ta - v.tl) : null);
  const ta = (v.ta != null) ? v.ta : ((v.ca != null && v.nonCA != null) ? (v.ca + v.nonCA) : null);
  const tl = (v.tl != null) ? v.tl : ((v.cl != null && v.nonCL != null) ? (v.cl + v.nonCL) : null);
  const nm = ratio(v.net, v.revenue);
  const at = ratio(v.revenue, ta);
  const em = ratio(ta, eq);
  const roe = (eq != null && eq > 0) ? ratio(v.net, eq) : null;

  if(eq != null && eq <= 0){
    const retainedEarnings = v.re;
    const capital = v.capital;
    const totalLiab = tl;
    const totalAssets = ta;
    const reasons = [];
    if(retainedEarnings != null && retainedEarnings < 0){
      reasons.push({ icon: '📉', title: 'زیان انباشته', desc: `شرکت زیان‌های پشت‌سرهم داده و این زیان‌ها روی هم جمع شدن: <b>${toman(retainedEarnings)}</b>.` });
    }
    if(totalLiab != null && totalAssets != null){
      const debtToAsset = totalLiab / totalAssets;
      if(debtToAsset > 1){ reasons.push({ icon: '⛓️', title: 'بدهی بیشتر از دارایی', desc: `جمع بدهی‌ها (${toman(totalLiab)}) از جمع دارایی‌ها (${toman(totalAssets)}) بیشتره.` }); }
    }
    if(v.net != null && v.net < 0){
      reasons.push({ icon: '🔻', title: 'زیان در دوره جاری', desc: `شرکت همین الان هم داره زیان می‌ده: <b>${toman(v.net)}</b>.` });
    }
    if(capital != null && capital > 0 && totalAssets != null){
      const ratioCap = capital / totalAssets;
      if(ratioCap < 0.1){ reasons.push({ icon: '🏦', title: 'سرمایه اسمی ناچیز', desc: `سرمایه اسمی شرکت (${toman(capital)}) نسبت به کل دارایی‌هاش خیلی کمه.` }); }
    }
    if(reasons.length === 0){ reasons.push({ icon: '❓', title: 'اطلاعات کافی نیست', desc: 'علت دقیق منفی بودن حقوق مالکانه از داده‌های موجود مشخص نشد.' }); }
    const reasonHtml = reasons.map(r => `
      <div class="dne-reason">
        <div class="dne-reason-head"><span class="dne-reason-icon">${r.icon}</span><b>${r.title}</b></div>
        <div class="dne-reason-desc">${r.desc}</div>
      </div>
    `).join('');
    box.innerHTML = `
      <div class="dupont-negative-equity">
        <span class="dne-icon">🚨</span>
        <div class="dne-title">حقوق مالکانه منفی یا صفر</div>
        <div class="dne-subtitle">بدهی‌های شرکت از دارایی‌هاش بیشتره. ROE معنی نداره.</div>
        <div class="dne-stats">
          <div class="dne-stat"><div class="dne-stat-label">حقوق مالکانه</div><div class="dne-stat-value negative">${toman(eq)}</div></div>
          <div class="dne-stat"><div class="dne-stat-label">جمع دارایی</div><div class="dne-stat-value">${toman(ta)}</div></div>
          <div class="dne-stat"><div class="dne-stat-label">جمع بدهی</div><div class="dne-stat-value negative">${toman(tl)}</div></div>
        </div>
        <div class="dne-explain">
          <div class="dne-explain-title">🔍 چرا؟</div>
          ${reasonHtml}
          <span class="dne-note">⚠️ <b>هشدار:</b> حقوق مالکانه منفی جدی‌ترین علامت خطر است.</span>
        </div>
      </div>
    `;
    if(noteEl) noteEl.innerHTML = '';
    return;
  }

  if(nm == null || at == null || em == null || roe == null){
    const items = [['درآمد عملیاتی', v.revenue],['سود خالص', v.net],['جمع دارایی‌ها', ta],['حقوق مالکانه', eq]];
    const missing = items.filter(x => x[1] == null).map(x => x[0]);
    box.innerHTML = `<div class="err" style="display:block">⚠️ اطلاعات کافی نیست.<br><b>ناموجود:</b> ${missing.length ? missing.join('، ') : 'همه'}</div>`;
    if(noteEl) noteEl.innerHTML = '';
    return;
  }

  let roeLevel, roeColor, roeLabel;
  if(roe < 0){ roeLevel = 'bad'; roeColor = '#c62828'; roeLabel = 'زیان‌ده'; }
  else if(roe < 0.05){ roeLevel = 'bad'; roeColor = '#c62828'; roeLabel = 'خیلی ضعیف'; }
  else if(roe < 0.10){ roeLevel = 'warn'; roeColor = '#f59e0b'; roeLabel = 'ضعیف'; }
  else if(roe < 0.15){ roeLevel = 'neutral'; roeColor = '#eab308'; roeLabel = 'متوسط'; }
  else if(roe < 0.25){ roeLevel = 'good'; roeColor = '#22c55e'; roeLabel = 'خوب'; }
  else { roeLevel = 'excellent'; roeColor = '#16834a'; roeLabel = 'عالی'; }
  const roePos = Math.max(0, Math.min(100, (roe / 0.40) * 100));

  let nmScore, nmColor, nmLabel;
  if(nm < 0.05){ nmScore = Math.max(5, (nm / 0.05) * 25); nmColor = '#c62828'; nmLabel = 'ضعیف'; }
  else if(nm < 0.10){ nmScore = 25 + ((nm - 0.05) / 0.05) * 25; nmColor = '#f59e0b'; nmLabel = 'متوسط'; }
  else if(nm < 0.20){ nmScore = 50 + ((nm - 0.10) / 0.10) * 30; nmColor = '#eab308'; nmLabel = 'خوب'; }
  else { nmScore = Math.min(100, 80 + ((nm - 0.20) / 0.20) * 20); nmColor = '#16834a'; nmLabel = 'عالی'; }

  let atScore, atColor, atLabel;
  if(at < 0.1){ atScore = Math.max(3, (at / 0.1) * 15); atColor = '#c62828'; atLabel = 'خیلی ضعیف'; }
  else if(at < 0.3){ atScore = 15 + ((at - 0.1) / 0.2) * 20; atColor = '#ef4444'; atLabel = 'ضعیف'; }
  else if(at < 0.7){ atScore = 35 + ((at - 0.3) / 0.4) * 30; atColor = '#f59e0b'; atLabel = 'متوسط'; }
  else if(at < 1.5){ atScore = 65 + ((at - 0.7) / 0.8) * 25; atColor = '#22c55e'; atLabel = 'خوب'; }
  else { atScore = Math.min(100, 90 + ((at - 1.5) / 1) * 10); atColor = '#16834a'; atLabel = 'عالی'; }

  let emScore, emColor, emLabel;
  if(em < 1.5){ emScore = 70; emColor = '#22c55e'; emLabel = 'محافظه‌کارانه'; }
  else if(em < 2.5){ emScore = 90; emColor = '#16834a'; emLabel = 'متعادل'; }
  else if(em < 4){ emScore = 60; emColor = '#f59e0b'; emLabel = 'اهرم بالا'; }
  else { emScore = 30; emColor = '#c62828'; emLabel = 'پرخطر'; }

  let problemText = '', problemIcon = '', problemTitle = '', problemSuggestion = '';
  const nmGood = nm >= 0.10;
  const atGood = at >= 0.3;
  if(roe >= 0.15){ problemIcon = '✅'; problemTitle = 'وضعیت عالی'; problemText = `شرکت از نظر بازدهی سهامدار در وضعیت <b>خوبی</b> قرار داره.`; problemSuggestion = `این روند رو حفظ کنه، بازدهی پایدار خواهد داشت.`; }
  else if(!atGood && (nmGood || at < 0.1)){ problemIcon = '🚨'; problemTitle = 'مشکل اصلی: دارایی‌های بی‌استفاده'; problemText = `شرکت دارایی‌های زیادی داره ولی <b>نمی‌تونه باهاشون فروش بسازه</b>.`; problemSuggestion = `فروش دارایی‌های بی‌استفاده یا افزایش تولید/فروش.`; }
  else if(!nmGood && nm >= 0){ problemIcon = '⚠️'; problemTitle = 'مشکل اصلی: حاشیه سود کم'; problemText = `شرکت داره زیاد می‌فروشه ولی <b>سود کمی می‌کنه</b>.`; problemSuggestion = `افزایش قیمت فروش یا کاهش هزینه‌های عملیاتی.`; }
  else if(em >= 4){ problemIcon = '⚠️'; problemTitle = 'مشکل اصلی: وابستگی به بدهی'; problemText = `بخش قابل توجهی از سود شرکت از <b>پول قرض</b> میاد.`; problemSuggestion = `کاهش بدهی یا افزایش سرمایه.`; }
  else if(roe < 0.05){ problemIcon = '🚨'; problemTitle = 'بازدهی خیلی ضعیف'; problemText = `بازدهی این شرکت برای سهامدار <b>${pct(roe)}</b> است.`; problemSuggestion = `بررسی جدی ساختار کسب‌وکار.`; }
  else { problemIcon = '🟡'; problemTitle = 'وضعیت متوسط'; problemText = `شرکت نه عالی است نه فاجعه.`; problemSuggestion = `بهبود یکی از سه عامل می‌تونه بازدهی رو بهتر کنه.`; }

  box.innerHTML = `
    <div class="dupont-hero">
      <div class="dupont-hero-label">بازدهی سهامدار (ROE)</div>
      <div class="dupont-hero-num" style="color:${roeColor}">${pct(roe)}</div>
      <div class="dupont-hero-level" style="color:${roeColor}">${roeLabel}</div>
      <div class="dupont-scale">
        <div class="dupont-scale-bar">
          <div class="dupont-scale-zone zone-bad" style="width:25%"></div>
          <div class="dupont-scale-zone zone-warn" style="width:12.5%"></div>
          <div class="dupont-scale-zone zone-neutral" style="width:12.5%"></div>
          <div class="dupont-scale-zone zone-good" style="width:25%"></div>
          <div class="dupont-scale-zone zone-excellent" style="width:25%"></div>
          <div class="dupont-scale-marker" style="left:${roePos}%"></div>
        </div>
        <div class="dupont-scale-ticks"><span>۰٪</span><span>۵٪</span><span>۱۰٪</span><span>۱۵٪</span><span>۲۵٪</span><span>۴۰٪+</span></div>
      </div>
    </div>
    <div class="dupont-factors">
      <div class="dupont-factors-title">🎯 این بازدهی از کجا میاد؟</div>
      <div class="dupont-factor">
        <div class="dupont-factor-head">
          <span class="dupont-factor-name">💰 سودآوری</span>
          <span class="dupont-factor-value" style="color:${nmColor}">${pct(nm)} — ${nmLabel}</span>
        </div>
        <div class="dupont-factor-bar"><div class="dupont-factor-fill" style="width:${nmScore}%;background:${nmColor}"></div></div>
      </div>
      <div class="dupont-factor">
        <div class="dupont-factor-head">
          <span class="dupont-factor-name">🔄 گردش دارایی</span>
          <span class="dupont-factor-value" style="color:${atColor}">${num2(at)} — ${atLabel}</span>
        </div>
        <div class="dupont-factor-bar"><div class="dupont-factor-fill" style="width:${atScore}%;background:${atColor}"></div></div>
      </div>
      <div class="dupont-factor">
        <div class="dupont-factor-head">
          <span class="dupont-factor-name">⚖️ اهرم مالی</span>
          <span class="dupont-factor-value" style="color:${emColor}">${num2(em)} — ${emLabel}</span>
        </div>
        <div class="dupont-factor-bar"><div class="dupont-factor-fill" style="width:${emScore}%;background:${emColor}"></div></div>
      </div>
    </div>
    <div class="dupont-story" style="border-right-color:${roeColor}">
      <div class="dupont-story-title"><span class="dupont-story-icon">${problemIcon}</span><b>${problemTitle}</b></div>
      <div class="dupont-story-text">${problemText}</div>
      <div class="dupont-story-suggestion"><b>💡 پیشنهاد:</b> ${problemSuggestion}</div>
    </div>
  `;
  if(noteEl) noteEl.innerHTML = '';
}

/* ============================================================
   کیفیت سود
============================================================ */
function renderOperatingQuality(v){
  const st = (window.MARKET && window.MARKET.sectorType) || 'normal';
  if(st === 'bank') return;
  const box = $('operatingQualityBox');
  const noteEl = $('operatingQualityNote');
  if(!box) return;
  const revenue = v.revenue;
  const cogs = v.cogs;
  const opEx = v.opEx;
  const opProfit = v.opProfit;
  if(revenue == null || opProfit == null){
    box.innerHTML = '<div class="err" style="display:block">داده کافی نیست.</div>';
    if(noteEl) noteEl.innerHTML = '';
    return;
  }
  const realOpProfit = (cogs != null && opEx != null) ? (revenue - Math.abs(cogs) - Math.abs(opEx)) : null;
  const otherInc = (realOpProfit != null) ? (opProfit - realOpProfit) : null;
  const otherToRev = (otherInc != null && revenue !== 0) ? (otherInc / revenue) : null;
  let otherClass = 'other';
  if(otherToRev != null && otherToRev > 0.5) otherClass = 'other bad';
  let html = '<div class="qual-grid">';
  html += `
    <div class="qual-box real">
      <h4>✅ سود عملیاتی خالص</h4>
      <div class="qual-val">${toman(realOpProfit)}</div>
      <div class="qual-sub">درآمد − بهای تمام شده − هزینه‌های عملیاتی</div>
    </div>
    <div class="qual-box ${otherClass}">
      <h4>${otherToRev != null && otherToRev > 0.3 ? '⚠️' : '📊'} سایر درآمدها</h4>
      <div class="qual-val">${toman(otherInc)}</div>
      <div class="qual-sub">سود سهام، فروش دارایی، سود سپرده و...</div>
    </div>
  `;
  html += '</div>';
  if(realOpProfit != null && otherInc != null && opProfit !== 0){
    const total = Math.abs(realOpProfit) + Math.abs(otherInc);
    if(total > 0){
      const realPct = (Math.abs(realOpProfit) / total) * 100;
      const otherPct = (Math.abs(otherInc) / total) * 100;
      html += `
        <div class="qual-bar-wrap">
          <div class="qual-bar-title">ترکیب سود عملیاتی:</div>
          <div class="qual-bar">
            <div class="qual-bar-real" style="width:${realPct}%">${toFa(realPct.toFixed(0))}٪</div>
            <div class="qual-bar-other" style="width:${otherPct}%">${toFa(otherPct.toFixed(0))}٪</div>
          </div>
          <div class="qual-legend">
            <span><i style="background:#10b981"></i> سود عملیاتی خالص</span>
            <span><i style="background:#f59e0b"></i> سایر درآمدها</span>
          </div>
        </div>
      `;
    }
  }
  box.innerHTML = html;
  if(!noteEl) return;
  let note = '';
  if(otherInc == null){ note = 'اطلاعات کافی نیست.'; }
  else if(otherToRev != null && otherToRev > 0.5){ note = `🚨 <b>هشدار جدی:</b> سایر درآمدها (${toman(otherInc)}) بیش از <b>۵۰٪ درآمد عملیاتی</b> است.`; }
  else if(otherToRev != null && otherToRev > 0.3){ note = `⚠️ <b>توجه:</b> سایر درآمدها (${toman(otherInc)}) حدود <b>${toFa((otherToRev*100).toFixed(0))}٪</b> است.`; }
  else if(otherToRev != null && otherToRev > 0){ note = `✅ بخش عمده سود عملیاتی از <b>عملیات اصلی</b> میاد.`; }
  else if(otherToRev != null && otherToRev < -0.05){ note = `📊 سایر درآمدها منفی قابل توجه است (${toman(otherInc)}) — شرکت هزینه جانبی داشته.`; }
  else if(otherInc != null && otherInc < 0){ note = `✅ سود کاملاً پایدار از <b>عملیات اصلی</b> میاد. سایر درآمدها منفی جزئی (${toman(otherInc)}) ولی ناچیزه.`; }
  else { note = 'اطلاعات کافی نیست.'; }
  noteEl.innerHTML = note;
}

/* ============================================================
   EBITDA
============================================================ */
function renderEBITDA(v){
  const st = (window.MARKET && window.MARKET.sectorType) || 'normal';
  if(st === 'bank') return;
  const dep = v.deprec;
  const op = v.opProfit;
  const revenue = v.revenue;
  const box = $('ebitdaBox');
  const noteEl = $('ebitdaNote');
  if(!box) return;
  if(op == null){
    box.innerHTML = `<div class="err" style="display:block">برای محاسبه EBITDA، <b>سود عملیاتی</b> لازم است.</div>`;
    if(noteEl) noteEl.innerHTML = '';
    return;
  }
  const depVal = (dep != null) ? Math.abs(dep) : 0;
  const ebitda = op + depVal;
  const margin = ratio(ebitda, revenue);
  let marginColor, marginLabel;
  let marginPos = 0;
  if(margin == null){ marginColor = '#94a3b8'; marginLabel = 'نامشخص'; marginPos = 0; }
  else if(margin < 0){ marginColor = '#c62828'; marginLabel = 'ضرر'; marginPos = 0; }
  else if(margin < 0.05){ marginColor = '#c62828'; marginLabel = 'ضعیف'; marginPos = (margin / 0.05) * 20; }
  else if(margin < 0.10){ marginColor = '#ef4444'; marginLabel = 'متوسط'; marginPos = 20 + ((margin - 0.05) / 0.05) * 20; }
  else if(margin < 0.20){ marginColor = '#f59e0b'; marginLabel = 'خوب'; marginPos = 40 + ((margin - 0.10) / 0.10) * 30; }
  else if(margin < 0.30){ marginColor = '#22c55e'; marginLabel = 'عالی'; marginPos = 70 + ((margin - 0.20) / 0.10) * 15; }
  else { marginColor = '#16834a'; marginLabel = 'فوق‌العاده'; marginPos = Math.min(100, 85 + ((margin - 0.30) / 0.20) * 15); }
  marginPos = Math.max(0, Math.min(100, marginPos));
  let storyIcon, storyTitle, storyText, storySuggestion;
  if(margin == null){ storyIcon = '⚠️'; storyTitle = 'حاشیه EBITDA قابل محاسبه نیست'; storyText = `برای محاسبه حاشیه EBITDA، <b>درآمد عملیاتی</b> لازم است.`; storySuggestion = `فایل صورت مالی رو با ستون درآمد دوباره بارگذاری کن.`; }
  else if(margin < 0){ storyIcon = '🚨'; storyTitle = 'شرکت ضرر می‌ده'; storyText = `EBITDA منفی یعنی شرکت حتی <b>قبل از استهلاک</b> هم ضرر می‌ده.`; storySuggestion = `بررسی جدی ساختار هزینه‌ها.`; }
  else if(margin < 0.05){ storyIcon = '⚠️'; storyTitle = 'حاشیه سود نقدی ضعیف'; storyText = `شرکت از هر ۱۰۰ تومان فروش، فقط <b>${toFa((margin*100).toFixed(1))} تومان</b> سود نقدی می‌سازه.`; storySuggestion = `کاهش هزینه‌ها یا افزایش قیمت فروش.`; }
  else if(margin < 0.10){ storyIcon = '🟡'; storyTitle = 'حاشیه سود نقدی متوسط'; storyText = `شرکت از هر ۱۰۰ تومان فروش، <b>${toFa((margin*100).toFixed(1))} تومان</b> سود نقدی می‌سازه.`; storySuggestion = `تلاش برای بهبود حاشیه سود.`; }
  else if(margin < 0.20){ storyIcon = '✅'; storyTitle = 'حاشیه سود نقدی خوب'; storyText = `شرکت از هر ۱۰۰ تومان فروش، <b>${toFa((margin*100).toFixed(1))} تومان</b> سود نقدی می‌سازه.`; storySuggestion = `این روند رو حفظ کنه.`; }
  else { storyIcon = '🌟'; storyTitle = 'حاشیه سود نقدی عالی'; storyText = `شرکت از هر ۱۰۰ تومان فروش، <b>${toFa((margin*100).toFixed(1))} تومان</b> سود نقدی می‌سازه.`; storySuggestion = `برای ارزش‌گذاری از EV/EBITDA استفاده کن.`; }
  if(dep == null){ storyText += `<br><br><span style="color:var(--warn);font-size:12px">⚠️ توجه: استهلاک پیدا نشد.</span>`; }
  box.innerHTML = `
    <div class="ebitda-hero">
      <div class="ebitda-hero-label">EBITDA — سود نقدی قبل از استهلاک</div>
      <div class="ebitda-hero-num" style="color:${marginColor}">${toman(ebitda)}</div>
      <div class="ebitda-hero-level" style="color:${marginColor}">حاشیه: ${margin == null ? '—' : pct(margin)} — ${marginLabel}</div>
      <div class="ebitda-scale">
        <div class="ebitda-scale-bar">
          <div class="ebitda-scale-zone zone-bad" style="width:20%"></div>
          <div class="ebitda-scale-zone zone-warn" style="width:20%"></div>
          <div class="ebitda-scale-zone zone-neutral" style="width:30%"></div>
          <div class="ebitda-scale-zone zone-good" style="width:15%"></div>
          <div class="ebitda-scale-zone zone-excellent" style="width:15%"></div>
          <div class="ebitda-scale-marker" style="left:${marginPos}%"></div>
        </div>
        <div class="ebitda-scale-ticks"><span>۰٪</span><span>۵٪</span><span>۱۰٪</span><span>۲۰٪</span><span>۳۰٪</span><span>۵۰٪+</span></div>
      </div>
    </div>
    <div class="ebitda-story" style="border-right-color:${marginColor}">
      <div class="ebitda-story-title"><span class="ebitda-story-icon">${storyIcon}</span><b>${storyTitle}</b></div>
      <div class="ebitda-story-text">${storyText}</div>
      <div class="ebitda-story-suggestion"><b>💡 پیشنهاد:</b> ${storySuggestion}</div>
    </div>
  `;
  if(noteEl) noteEl.innerHTML = '';
}

/* ============================================================
   Altman Z-Score
============================================================ */
function renderZScore(v){
  const st = (window.MARKET && window.MARKET.sectorType) || 'normal';
  if(st === 'bank') return;
  const ta = v.ta;
  if(ta == null || ta === 0){
    $('zscoreBox').innerHTML = '<div class="err" style="display:block">جمع دارایی موجود نیست.</div>';
    return;
  }
  const wc = (v.ca != null && v.cl != null) ? (v.ca - v.cl) : null;
  const x1 = wc != null ? wc / ta : 0;
  const x2 = v.re != null ? v.re / ta : 0;
  const x3 = v.opProfit != null ? v.opProfit / ta : 0;
  const sharesFromCap = (v.capital != null) ? v.capital * 1000 : null;
  const sharesNow = (MARKET.shares) || sharesFromCap;
  const priceNow = MARKET.price;
  const marketCapRial = (priceNow != null && sharesNow != null) ? priceNow * sharesNow : null;
  const tlRial = (v.tl != null) ? v.tl * 1_000_000 : null;
  let x4 = 0;
  let usedMarketCap = false;
  if(marketCapRial != null && tlRial != null && tlRial > 0){ x4 = marketCapRial / tlRial; usedMarketCap = true; }
  else if(v.eq != null && v.tl != null && v.tl > 0){ x4 = v.eq / v.tl; }
  const x5 = v.revenue != null ? v.revenue / ta : 0;
  const z = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;
  let zone, color, desc;
  if(z > 2.99){ zone = 'منطقه امن ✅'; color = '#16834a'; desc = `💚 Z-Score ${num2(z)} — شرکت سالم است.`; }
  else if(z >= 1.81){ zone = 'منطقه خاکستری 🟡'; color = '#eab308'; desc = `🟡 Z-Score ${num2(z)} — وضعیت نامشخص است.`; }
  else { zone = 'منطقه خطر 🚨'; color = '#c62828'; desc = `🔴 Z-Score ${num2(z)} — ریسک ورشکستگی بالاست.`; }
  const zNote = usedMarketCap ? '📌 محاسبه بر اساس ارزش بازار سهام' : '⚠️ قیمت سهام وارد نشده — از ارزش دفتری استفاده شد';
  const pos = Math.max(0, Math.min(100, (z / 4) * 100));
  $('zscoreBox').innerHTML = `
    <div class="zscore-wrap">
      <div class="zscore-num" style="color:${color}">${num2(z)}</div>
      <div class="zscore-zone" style="color:${color}">${zone}</div>
      <div class="zscore-bar"><div class="zscore-marker" style="left:${pos}%"></div></div>
      <div class="zscore-ticks"><span>۰</span><span>۱.۸۱</span><span>۲.۹۹</span><span>۴+</span></div>
      <div class="zscore-note" style="border-right-color:${color}">${desc}</div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--sub);text-align:center;padding:6px 10px;background:rgba(102,112,133,.08);border-radius:8px">${zNote}</div>
    </div>
  `;
}

/* ============================================================
   EPS
============================================================ */
function renderEPS(v){
  const box = $('epsBox');
  if(!box) return;
  const epsRaw = v.eps;
  const periodMonths = MARKET.periodMonths || 12;
  if(epsRaw == null){
    box.innerHTML = '<div class="err" style="display:block">سود هر سهم (EPS) پیدا نشد.</div>';
    return;
  }
  let annualizeFactor, annualizeLabel;
  if(periodMonths === 3){ annualizeFactor = 4; annualizeLabel = '۳ ماهه × ۴'; }
  else if(periodMonths === 6){ annualizeFactor = 2; annualizeLabel = '۶ ماهه × ۲'; }
  else if(periodMonths === 9){ annualizeFactor = 4 / 3; annualizeLabel = '۹ ماهه × ۱.۳۳'; }
  else if(periodMonths === 12){ annualizeFactor = 1; annualizeLabel = 'سالانه (بدون تغییر)'; }
  else { annualizeFactor = 12 / periodMonths; annualizeLabel = `${toFa(periodMonths)} ماهه × ${toFa((12/periodMonths).toFixed(2))}`; }
  const epsAnnual = epsRaw * annualizeFactor;
  let color;
  if(epsRaw < 0) color = '#c62828';
  else if(epsRaw < 100) color = '#94a3b8';
  else if(epsRaw < 500) color = '#f59e0b';
  else if(epsRaw < 2000) color = '#eab308';
  else if(epsRaw < 5000) color = '#22c55e';
  else color = '#16834a';
  box.innerHTML = `
    <div class="eps-hero">
      <div class="eps-grid">
        <div class="eps-card eps-current">
          <div class="eps-card-label">📊 سود هر سهم (دوره جاری)</div>
          <div class="eps-card-num" style="color:${color}">${toFa(Math.round(epsRaw).toLocaleString('en-US'))}</div>
          <div class="eps-card-unit">ریال</div>
          <div class="eps-card-period">${PARSED?._detectedPeriod || toFa(periodMonths) + ' ماهه'}</div>
        </div>
        <div class="eps-card eps-annual">
          <div class="eps-card-label">🎯 پیش‌بینی سالانه</div>
          <div class="eps-card-num" style="color:${color}">${toFa(Math.round(epsAnnual).toLocaleString('en-US'))}</div>
          <div class="eps-card-unit">ریال</div>
          <div class="eps-card-period">${annualizeLabel}</div>
        </div>
      </div>
      <div class="eps-note">💡 <b>توضیح:</b> پیش‌بینی سالانه فقط یه تخمین ساده‌ست.</div>
    </div>
  `;
}

/* ============================================================
   💰 تحلیل پتانسیل افزایش سرمایه
============================================================ */
function renderCapitalPotential(v){
  const box = $('capitalPotentialBox');
  if(!box) return;
  const re = v.re;
  const capital = v.capital;
  if(re == null || capital == null || capital === 0){
    box.innerHTML = '<div class="err" style="display:block">برای تحلیل پتانسیل افزایش سرمایه، <b>سود انباشته</b> و <b>سرمایه</b> لازم است.</div>';
    return;
  }
  const reToCap = re / capital;
  const reToEq = (v.eq != null && v.eq !== 0) ? re / v.eq : null;
  
  // ⭐ تفسیر داینامیک برای سود انباشته / سرمایه
  let reToCapText = '';
  if(reToCap >= 10){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره! یعنی می‌تونه تا ${toFa(Math.round(reToCap*100))}٪ افزایش سرمایه بده. پتانسیل بی‌نهایت!`;
  } else if(reToCap >= 5){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — پتانسیل بسیار بالا برای افزایش سرمایه از سود انباشته.`;
  } else if(reToCap >= 2){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — می‌تونه تا ${toFa(Math.round(reToCap*100))}٪ افزایش سرمایه بده.`;
  } else if(reToCap >= 1){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — می‌تونه تا ${toFa(Math.round(reToCap*100))}٪ افزایش سرمایه بده.`;
  } else if(reToCap >= 0.5){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — می‌تونه تا ${toFa(Math.round(reToCap*100))}٪ افزایش سرمایه بده.`;
  } else if(reToCap >= 0.3){
    reToCapText = `شرکت ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — پتانسیل محدود برای افزایش سرمایه.`;
  } else if(reToCap >= 0.1){
    reToCapText = `شرکت فقط ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمی‌ش سود انباشته داره — احتمالاً از تجدید ارزیابی استفاده می‌کنه.`;
  } else {
    reToCapText = `سود انباشته ناچیزه — افزایش سرمایه از سود انباشته ممکن نیست.`;
  }

  // ⭐ تفسیر داینامیک برای سود انباشته / حقوق مالکانه
  let reToEqText = '';
  if(reToEq != null){
    const reToEqPct = reToEq * 100;
    if(reToEqPct >= 80){
      reToEqText = `${toFa(reToEqPct.toFixed(1))}٪ سرمایه سهامداران از سودهای انباشته گذشته اومده! شرکت فوق‌العاده خودکفا و سودآور بوده.`;
    } else if(reToEqPct >= 60){
      reToEqText = `${toFa(reToEqPct.toFixed(1))}٪ سرمایه از سود انباشته اومده — شرکت بسیار خودکفا بوده.`;
    } else if(reToEqPct >= 40){
      reToEqText = `${toFa(reToEqPct.toFixed(1))}٪ سرمایه از سود انباشته اومده — شرکت خوب عمل کرده.`;
    } else if(reToEqPct >= 20){
      reToEqText = `${toFa(reToEqPct.toFixed(1))}٪ سرمایه از سود انباشته اومده — وضعیت متوسط.`;
    } else if(reToEqPct >= 10){
      reToEqText = `فقط ${toFa(reToEqPct.toFixed(1))}٪ از سود انباشته اومده — بیشتر سرمایه از آورده سهامدارهاست.`;
    } else if(reToEqPct >= 0){
      reToEqText = `فقط ${toFa(reToEqPct.toFixed(1))}٪ از سود انباشته اومده — شرکت زیاد سود نساخته.`;
    } else {
      reToEqText = `شرکت زیان‌ده بوده — زیان انباشته داره.`;
    }
  }
  let statusColor, statusIcon, statusTitle, statusText, suggestion;
  if(re < 0){
    const lossRatio = Math.abs(re) / capital;
    if(lossRatio >= 1.0){
      statusColor = '#c62828'; statusIcon = '🚨'; statusTitle = 'زیان انباشته بیش از سرمایه';
      statusText = `زیان انباشته شرکت (${toman(re)}) از سرمایه اسمی (${toman(capital)}) بیشتره.`;
      suggestion = 'مشمول ماده ۱۴۱ قانون تجارت — باید افزایش سرمایه از تجدید ارزیابی یا آورده نقدی انجام بشه.';
    } else if(lossRatio >= 0.5){
      statusColor = '#ef4444'; statusIcon = '⚠️'; statusTitle = 'زیان انباشته قابل توجه';
      statusText = `حدود ${toFa((lossRatio*100).toFixed(0))}٪ از سرمایه اسمی از بین رفته.`;
      suggestion = 'افزایش سرمایه از تجدید ارزیابی دارایی‌ها یا آورده نقدی سهامداران.';
    } else {
      statusColor = '#f59e0b'; statusIcon = '🟡'; statusTitle = 'زیان انباشته کم';
      statusText = `حدود ${toFa((lossRatio*100).toFixed(0))}٪ از سرمایه اسمی از بین رفته.`;
      suggestion = 'قابل جبران با سودآوری — افزایش سرمایه ضروری نیست.';
    }
  } else if(reToCap >= 1){
    statusColor = '#16834a'; statusIcon = '🌟'; statusTitle = 'پتانسیل بالای افزایش سرمایه';
    statusText = `سود انباشته ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمیه.`;
    suggestion = 'می‌تونه از محل سود انباشته افزایش سرمایه بده — نیازی به پول نقد سهامداران نیست.';
  } else if(reToCap >= 0.3){
    statusColor = '#22c55e'; statusIcon = '✅'; statusTitle = 'توانایی افزایش سرمایه';
    statusText = `سود انباشته ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمیه.`;
    suggestion = 'می‌تونه از محل سود انباشته افزایش سرمایه بده.';
  } else if(reToCap >= 0.1){
    statusColor = '#eab308'; statusIcon = '🟡'; statusTitle = 'پتانسیل محدود';
    statusText = `سود انباشته ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمیه.`;
    suggestion = 'برای افزایش سرمایه قابل توجه، نیاز به صرف سهام یا آورده نقدی هم داره.';
  } else {
    statusColor = '#94a3b8'; statusIcon = '➖'; statusTitle = 'پتانسیل کم';
    statusText = `سود انباشته فقط ${toFa(reToCap.toFixed(2))} برابر سرمایه اسمیه.`;
    suggestion = 'برای افزایش سرمایه، احتمالاً از تجدید ارزیابی یا آورده نقدی استفاده می‌کنه.';
  }
  const html = `
    <div class="capital-hero" style="border-top-color:${statusColor}">
      <div class="capital-icon">${statusIcon}</div>
      <div class="capital-title" style="color:${statusColor}">${statusTitle}</div>
      <div class="capital-text">${statusText}</div>
      <div class="capital-suggestion"><b>💡 پیشنهاد:</b> ${suggestion}</div>
    </div>
    <div class="capital-stats">
      <div class="capital-stat">
        <div class="capital-stat-label">سود / زیان انباشته</div>
        <div class="capital-stat-value" style="color:${re < 0 ? '#c62828' : '#16834a'}">${toman(re)}</div>
      </div>
      <div class="capital-stat">
        <div class="capital-stat-label">سرمایه اسمی</div>
        <div class="capital-stat-value">${toman(capital)}</div>
      </div>
      <div class="capital-stat">
        <div class="capital-stat-label">سود انباشته / سرمایه</div>
        <div class="capital-stat-value" style="color:${statusColor}">${toFa(reToCap.toFixed(2))}</div>
      </div>
      ${reToEq != null ? `
      <div class="capital-stat">
        <div class="capital-stat-label">سود انباشته / حقوق مالکانه</div>
        <div class="capital-stat-value">${toFa((reToEq*100).toFixed(1))}٪</div>
      </div>` : ''}
    </div>

    <div class="capital-interpretations">
      <div class="capital-interp">
        <div class="capital-interp-label">💰 سود انباشته / سرمایه</div>
        <div class="capital-interp-text">${reToCapText}</div>
      </div>
      ${reToEq != null ? `
      <div class="capital-interp">
        <div class="capital-interp-label">🏛️ سود انباشته / حقوق مالکانه</div>
        <div class="capital-interp-text">${reToEqText}</div>
      </div>` : ''}
    </div>
  `;
  box.innerHTML = html;
}

/* ============================================================
   نگاه سریع
============================================================ */
function renderQuickMetrics(){
  const box = document.getElementById('quickMetrics');
  if(!box) return;
  if(!PARSED) return;
  const SECTOR = (window.MARKET && window.MARKET.sectorType) || 'normal';
  const isInvestment = (SECTOR === 'investment');
  let METRICS = [
    { key: 'revenue',     label: 'درآمد عملیاتی',     dir: 'higher' },
    { key: 'grossProfit', label: 'سود ناخالص',         dir: 'higher' },
    { key: 'opProfit',    label: 'سود عملیاتی',        dir: 'higher' },
    { key: 'netProfit',   label: 'سود خالص',           dir: 'higher' },
    { key: 'totalAssets', label: 'جمع دارایی‌ها',      dir: 'higher' },
    { key: 'totalLiab',   label: 'جمع بدهی‌ها',        dir: 'lower'  },
    { key: 'equity',      label: 'حقوق مالکانه',       dir: 'higher' },
    { key: 'cfo',         label: 'جریان نقد عملیاتی',  dir: 'higher' },
  ];
  if(isInvestment){ METRICS = METRICS.filter(m => m.key !== 'grossProfit'); }
  function fmtB(x){
    if(x == null || !isFinite(x)) return '—';
    const b = x / 10000;
    const unitStyle = 'font-size:0.6em;font-weight:600;opacity:0.85;';
    if(Math.abs(b) >= 1){ return '<bdi dir="rtl">' + toFa(Math.round(b).toLocaleString('en-US')) + ' <span style="' + unitStyle + '">میلیارد تومان</span></bdi>'; }
    const m = Math.round(x / 10);
    return '<bdi dir="rtl">' + toFa(m.toLocaleString('en-US')) + ' <span style="' + unitStyle + '">میلیون تومان</span></bdi>';
  }
  function renderCard(m){
    const curr = PARSED[m.key]?.[0] ?? null;
    const prev = PARSED[m.key]?.[1] ?? null;
    if(curr == null){
      return `<div class="qm-card qm-empty"><div class="qm-label">${m.label}</div><div class="qm-value">—</div><div class="qm-change qm-neutral">اطلاعات موجود نیست</div></div>`;
    }
    let changeHtml = '<span class="qm-neutral">─ بی‌تغییر</span>';
    let cardClass = '';
    if(prev != null && prev !== 0){
      const change = (curr - prev) / Math.abs(prev);
      const pctChange = Math.abs(change * 100);
      const isUp = change > 0.005;
      const isDown = change < -0.005;
      if(!isUp && !isDown){ changeHtml = '<span class="qm-neutral">─ بی‌تغییر</span>'; cardClass = ''; }
      else {
        const arrow = isUp ? '▲' : '▼';
        const sign = isUp ? '+' : '−';
        const pctText = toFa(pctChange.toFixed(1)) + '٪';
        let isGood;
        if(m.dir === 'higher'){ isGood = isUp; } else { isGood = isDown; }
        const colorClass = isGood ? 'qm-good' : 'qm-bad';
        changeHtml = `<span class="${colorClass}">${arrow} ${sign}${pctText}</span>`;
        cardClass = colorClass;
      }
    } else if(prev == null){ changeHtml = '<span class="qm-neutral">— بدون مقایسه</span>'; }
    return `<div class="qm-card ${cardClass}"><div class="qm-label">${m.label}</div><div class="qm-value">${fmtB(curr)}</div><div class="qm-change">${changeHtml}</div></div>`;
  }
  box.innerHTML = METRICS.map(renderCard).join('');
}

/* ============================================================
   Accordion
============================================================ */
(function initAccordion(){
  function bind(){
    const cards = document.querySelectorAll('#out .acc-card');
    if(!cards.length) return;
    cards.forEach(card => {
      const header = card.querySelector('.acc-header');
      if(!header) return;
      if(header.dataset.accBound) return;
      header.dataset.accBound = '1';
      header.addEventListener('click', (e) => {
        if(e.target.closest('.help')) return;
        const isOpen = card.classList.contains('acc-open');
        cards.forEach(c => c.classList.remove('acc-open'));
        if(!isOpen) card.classList.add('acc-open');
      });
    });
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  const observer = new MutationObserver(() => bind());
  observer.observe(document.body, { childList: true, subtree: true });
})();

/* ============================================================
   آپدیت خلاصه Accordion
============================================================ */
function updateAccordionSummaries(v){
  const st = (window.MARKET && window.MARKET.sectorType) || 'normal';
  const isBank = (st === 'bank');
  const isInsurance = (st === 'insurance');
  const scoreEl = document.getElementById('accScoreSummary');
  if(scoreEl){
    const sc = calcScore(v);
    if(sc == null){ scoreEl.textContent = '—'; scoreEl.className = 'acc-summary'; }
    else {
      const lvl = scoreLevel(sc);
      scoreEl.textContent = toFa(sc) + ' — ' + lvl.label;
      scoreEl.className = 'acc-summary';
      if(sc >= 65) scoreEl.classList.add('acc-summary-good');
      else if(sc >= 50) scoreEl.classList.add('acc-summary-warn');
      else scoreEl.classList.add('acc-summary-bad');
    }
  }
  const dupontEl = document.getElementById('accDupontSummary');
  if(dupontEl){
    const roe = (v.eq != null && v.eq > 0) ? ratio(v.net, v.eq) : null;
    if(roe == null){ dupontEl.textContent = (v.eq != null && v.eq <= 0) ? 'بی‌معنی (سرمایه منفی)' : '—'; dupontEl.className = 'acc-summary'; if(v.eq != null && v.eq <= 0) dupontEl.classList.add('acc-summary-bad'); }
    else {
      let label, cls;
      if(roe < 0){ label = 'زیان‌ده'; cls = 'acc-summary-bad'; }
      else if(roe < 0.05){ label = 'خیلی ضعیف'; cls = 'acc-summary-bad'; }
      else if(roe < 0.10){ label = 'ضعیف'; cls = 'acc-summary-warn'; }
      else if(roe < 0.15){ label = 'متوسط'; cls = 'acc-summary-warn'; }
      else if(roe < 0.25){ label = 'خوب'; cls = 'acc-summary-good'; }
      else { label = 'عالی'; cls = 'acc-summary-good'; }
      dupontEl.textContent = pct(roe) + ' — ' + label;
      dupontEl.className = 'acc-summary ' + cls;
    }
  }
  const ebitdaEl = document.getElementById('accEbitdaSummary');
  if(ebitdaEl && (isBank || isInsurance)){ ebitdaEl.textContent = '—'; ebitdaEl.className = 'acc-summary'; }
  else if(ebitdaEl){
    const op = v.opProfit;
    const dep = v.deprec;
    if(op == null){ ebitdaEl.textContent = '—'; ebitdaEl.className = 'acc-summary'; }
    else {
      const depVal = (dep != null) ? Math.abs(dep) : 0;
      const ebitda = op + depVal;
      const margin = ratio(ebitda, v.revenue);
      if(margin == null){ ebitdaEl.textContent = 'بدون درآمد'; ebitdaEl.className = 'acc-summary'; }
      else {
        let label, cls;
        if(margin < 0){ label = 'ضرر'; cls = 'acc-summary-bad'; }
        else if(margin < 0.05){ label = 'ضعیف'; cls = 'acc-summary-bad'; }
        else if(margin < 0.10){ label = 'متوسط'; cls = 'acc-summary-warn'; }
        else if(margin < 0.20){ label = 'خوب'; cls = 'acc-summary-good'; }
        else { label = 'عالی'; cls = 'acc-summary-good'; }
        ebitdaEl.textContent = pct(margin) + ' — ' + label;
        ebitdaEl.className = 'acc-summary ' + cls;
      }
    }
  }
  const zEl = document.getElementById('accZscoreSummary');
  if(zEl && (isBank || isInsurance)){ zEl.textContent = '—'; zEl.className = 'acc-summary'; }
  else if(zEl){
    const ta = v.ta;
    if(ta == null || ta === 0){ zEl.textContent = '—'; zEl.className = 'acc-summary'; }
    else {
      const wc = (v.ca != null && v.cl != null) ? (v.ca - v.cl) : null;
      const x1 = wc != null ? wc / ta : 0;
      const x2 = v.re != null ? v.re / ta : 0;
      const x3 = v.opProfit != null ? v.opProfit / ta : 0;
      const sharesFromCap2 = (v.capital != null) ? v.capital * 1000 : null;
      const sharesNow2 = MARKET.shares || sharesFromCap2;
      const priceNow2 = MARKET.price;
      const marketCapRial2 = (priceNow2 != null && sharesNow2 != null) ? priceNow2 * sharesNow2 : null;
      const tlRial2 = (v.tl != null) ? v.tl * 1_000_000 : null;
      let x4 = 0;
      if(marketCapRial2 != null && tlRial2 != null && tlRial2 > 0){ x4 = marketCapRial2 / tlRial2; }
      else if(v.eq != null && v.tl != null && v.tl > 0){ x4 = v.eq / v.tl; }
      const x5 = v.revenue != null ? v.revenue / ta : 0;
      const z = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;
      let label, cls;
      if(z > 2.99){ label = 'امن'; cls = 'acc-summary-good'; }
      else if(z >= 1.81){ label = 'خاکستری'; cls = 'acc-summary-warn'; }
      else { label = 'خطر'; cls = 'acc-summary-bad'; }
      zEl.textContent = num2(z) + ' — ' + label;
      zEl.className = 'acc-summary ' + cls;
    }
  }
  const qualityEl = document.getElementById('accQualitySummary');
  if(qualityEl && (isBank || isInsurance)){ qualityEl.textContent = '—'; qualityEl.className = 'acc-summary'; }
  else if(qualityEl){
    const revenue = v.revenue;
    const opProfit = v.opProfit;
    const cogs = v.cogs;
    const opEx = v.opEx;
    if(revenue == null || opProfit == null){ qualityEl.textContent = '—'; qualityEl.className = 'acc-summary'; }
    else {
      const realOpProfit = (cogs != null && opEx != null) ? (revenue - Math.abs(cogs) - Math.abs(opEx)) : null;
      const otherInc = (realOpProfit != null) ? (opProfit - realOpProfit) : null;
      const otherToRev = (otherInc != null && revenue !== 0) ? (otherInc / revenue) : null;
      if(otherToRev == null){ qualityEl.textContent = '—'; qualityEl.className = 'acc-summary'; }
      else {
        let label, cls;
        if(otherToRev < -0.05){ label = 'سود جانبی منفی قابل توجه ⚠️'; cls = 'acc-summary-warn'; }
        else if(otherToRev < 0){ label = 'سود پایدار از عملیات اصلی ✅'; cls = 'acc-summary-good'; }
        else if(otherToRev > 0.5){ label = 'بیش از نیمی از سود از عملیات اصلی نیست 🔴'; cls = 'acc-summary-bad'; }
        else if(otherToRev > 0.3){ label = 'بخش قابل توجهی سود جانبی است ⚠️'; cls = 'acc-summary-warn'; }
        else if(otherToRev > 0.15){ label = 'بخش کمی از سود جانبی است'; cls = 'acc-summary-warn'; }
        else { label = 'سود پایدار از عملیات اصلی ✅'; cls = 'acc-summary-good'; }
        qualityEl.textContent = label;
        qualityEl.className = 'acc-summary ' + cls;
      }
    }
  }
  const epsEl = document.getElementById('accEpsSummary');
  if(epsEl){
    const epsRaw = v.eps;
    if(epsRaw == null){ epsEl.textContent = '—'; epsEl.className = 'acc-summary'; }
    else {
      const periodMonths = MARKET.periodMonths || 12;
      let factor = 1;
      if(periodMonths === 3) factor = 4;
      else if(periodMonths === 6) factor = 2;
      else if(periodMonths === 9) factor = 4/3;
      const epsAnnual = epsRaw * factor;
      epsEl.textContent = toFa(Math.round(epsAnnual).toLocaleString('en-US')) + ' ریال';
      epsEl.className = 'acc-summary';
      if(epsRaw < 0) epsEl.classList.add('acc-summary-bad');
      else if(epsAnnual < 500) epsEl.classList.add('acc-summary-warn');
      else if(epsAnnual > 2000) epsEl.classList.add('acc-summary-good');
    }
  }
  const capitalEl = document.getElementById('accCapitalSummary');
  if(capitalEl){
    const re = v.re;
    const capital = v.capital;
    if(re == null || capital == null || capital === 0){
      capitalEl.textContent = '—';
      capitalEl.className = 'acc-summary';
    } else {
      const reToCap = re / capital;
      let label, cls;
      if(re < 0){
        const lossRatio = Math.abs(re) / capital;
        if(lossRatio >= 1.0){
          label = 'زیان بیش از سرمایه 🚨'; cls = 'acc-summary-bad';
        } else if(lossRatio >= 0.5){
          label = 'زیان قابل توجه ⚠️'; cls = 'acc-summary-bad';
        } else {
          label = 'زیان کم'; cls = 'acc-summary-warn';
        }
      } else if(reToCap >= 1){
        label = 'پتانسیل بالا 🌟'; cls = 'acc-summary-good';
      } else if(reToCap >= 0.3){
        label = 'توانایی افزایش سرمایه ✅'; cls = 'acc-summary-good';
      } else if(reToCap >= 0.1){
        label = 'پتانسیل محدود 🟡'; cls = 'acc-summary-warn';
      } else {
        label = 'پتانسیل کم'; cls = 'acc-summary';
      }
      capitalEl.textContent = label;
      capitalEl.className = 'acc-summary ' + cls;
    }
  }
}


/* ============================================================
   تحلیل کن — Main
============================================================ */
if($('go')) $('go').onclick = async () => {
  try{
    if(!MARKET.sectorType || !MARKET.industry){
      if(window.showToast) window.showToast('⚠️ اول نماد رو از باکس «جستجوی سریع سهم» جستجو کن', true);
      if($('goHint')) $('goHint').style.display = 'block';
      return;
    }
    if(!file){
      if(window.showToast) window.showToast('⚠️ اول فایل صورت مالی رو بارگذاری کن', true);
      return;
    }
    if(window.License){
      const status = window.License.getStatus();
      if(status.state !== 'active'){ window.License.open(); showToast('لایسنس فعال نیست', true); return; }
      const res = window.License.consumeUpload();
      if(res.error){ showToast(res.error, true); window.License.open(); return; }
      window.License.updateIndicator();
    }
    $('status').textContent = 'در حال خواندن و تجزیه فایل...';
    $('err').style.display = 'none';
    const lines = await getLines(file);
    if(!lines.length) throw Error('هیچ خطی استخراج نشد.');
    PARSED = parseItems(lines);
    PARSED._rawLines = lines;  // ⭐ برای دیباگ
    PARSED._capitalLines = lines.filter(l => /سرمایه|سرمايه/.test(l)).slice(0, 20);
    window.PARSED = PARSED;
    const found = Object.keys(PARSED).length;
    if(!found) throw Error('هیچ قلمی شناسایی نشد.');
    const maxPer = Math.max(...Object.values(PARSED).filter(a => Array.isArray(a)).map(a => a.length));
    PARSED._periods = Math.min(Math.max(maxPer,1), 5);

// ⭐ چک کن آیا کاربر دوره رو دستی عوض کرده یا نه
const monthsSelect = $('periodMonthsSelect');
const yearSelect = $('periodYearSelect');
const badge = $('periodAutoBadge');
const userManuallyChanged = badge && badge.classList.contains('manual');

if(userManuallyChanged && monthsSelect && yearSelect){
  // کاربر دستی عوض کرده → از انتخاب‌های کاربر استفاده کن
  const userMonths = parseInt(monthsSelect.value, 10);
  const userYear = parseInt(yearSelect.value, 10);
  PARSED._detectedInfo = {
    label: toFa(userMonths) + ' ماهه سال ' + toFa(userYear),
    year: String(userYear),
    months: userMonths
  };
  PARSED._detectedPeriod = PARSED._detectedInfo.label;
  MARKET.periodMonths = userMonths;
  saveMarketToStorage();
} else {
  // کاربر دستی عوض نکرده → از تشخیص خودکار استفاده کن
  PARSED._detectedInfo = detectPeriodFromLines(lines);
  PARSED._detectedPeriod = PARSED._detectedInfo.label;
  if(PARSED._detectedInfo.months){ 
    MARKET.periodMonths = PARSED._detectedInfo.months; 
    saveMarketToStorage(); 
  }
}
    const infoBox = $('periodInfoBox');
    const infoText = $('periodInfoText');
    if(infoBox && infoText){
      infoBox.style.display = 'inline-flex';
      infoText.textContent = PARSED._detectedPeriod || 'نامشخص';
    }
    $('out').style.display = 'block';
    const btn = $('saveBtn');
    btn.style.display = 'inline-block';
    btn.disabled = false;
    const watchBtn = $('sendToWatchBtn');
    if(watchBtn){ watchBtn.style.display = 'inline-block'; watchBtn.disabled = false; }
    if($('stockPrice') && ($('stockPrice').value || $('stockCount').value)){ applyMarketInputs(); }
    render(0);
    $('status').textContent = `تجزیه انجام شد ✅ (${toFa(found)} قلم)`;
  }catch(e){
    console.error(e);
    $('err').style.display = 'block';
    $('err').textContent = 'خطا: ' + e.message;
    $('status').textContent = 'تحلیل انجام نشد.';
  }
};

function val(k, i){ return PARSED?.[k]?.[i] ?? null; }

/* ============================================================
   rebuildAllCharts
============================================================ */
function rebuildAllCharts(){
  if(!PARSED) return;
  const ci = 0;
  const v = { ca: val('currentAssets', ci), nonCA: val('nonCurrentAssets', ci), tl: val('totalLiab', ci), eq: val('equity', ci) };
  const periods = PARSED._periods || 3;
  const periodLabels = [];
  for(let i = 0; i < periods; i++){ periodLabels.push(PERIOD_NAMES[i] || ('دوره ' + (i+1))); }
  const barBox = document.getElementById('barChart');
  if(barBox){
    barBox.innerHTML = buildBarChart([
      {name:'درآمد', color:'#1769e0', values: (PARSED.revenue||[]).slice(0,periods)},
      {name:'سود ناخالص', color:'#f59e0b', values: (PARSED.grossProfit||[]).slice(0,periods)},
      {name:'سود عملیاتی', color:'#8b5cf6', values: (PARSED.opProfit||[]).slice(0,periods)},
      {name:'سود خالص', color:'#10b981', values: (PARSED.netProfit||[]).slice(0,periods)},
    ], periodLabels);
  }
  const cfoBox = document.getElementById('cfoChart');
  if(cfoBox){ cfoBox.innerHTML = buildBarChart([{name:'CFO', color:'#0ea5e9', values: (PARSED.cfo||[]).slice(0,periods)}], periodLabels); }
  const pieAssets = document.getElementById('pieAssets');
  if(pieAssets){ pieAssets.innerHTML = buildPieChart([{label:'دارایی جاری', value: v.ca, color:'#10b981'},{label:'دارایی غیرجاری', value: v.nonCA, color:'#ef4444'}]); }
  const pieFunding = document.getElementById('pieFunding');
  if(pieFunding){ pieFunding.innerHTML = buildPieChart([{label:'بدهی‌ها', value: v.tl, color:'#ef4444'},{label:'حقوق مالکانه', value: v.eq, color:'#10b981'}]); }
}
window.__rebuildCharts = rebuildAllCharts;





/* ============================================================
   📝 جمع‌بندی هوشمند — پاراگراف + کارت + توصیه
============================================================ */
function renderSmartAnalysis(v){
  const summaryBox = $('summary');
  const cardsBox = $('smartCards');
  const adviceBox = $('smartAdvice');
  if(!summaryBox) return;

  // ═══════════════════════════════════════════
  // ۱. جمع‌آوری همه معیارها
  // ═══════════════════════════════════════════
  const metrics = [];

  // سودآوری
  const netMargin = ratio(v.net, v.revenue);
  if(netMargin != null && v.net != null){
    if(v.net < 0){
      metrics.push({ key:'profit', level:'bad', icon:'🔴', label:'سودآوری', 
        short:'شرکت ضرر می‌ده',
        detail:'شرکت در این دوره ضرر کرده، یعنی خرجش بیشتر از درآمدش بوده.' });
    } else if(netMargin > 0.2){
      metrics.push({ key:'profit', level:'good', icon:'🟢', label:'سودآوری', 
        short:'سودآوری عالی',
        detail:'از هر ۱۰۰ تومان فروش، حدود ' + toFa((netMargin*100).toFixed(0)) + ' تومان سود خالص می‌مونه.' });
    } else if(netMargin > 0.08){
      metrics.push({ key:'profit', level:'good', icon:'🟢', label:'سودآوری', 
        short:'سودآوری خوب',
        detail:'از هر ۱۰۰ تومان فروش، حدود ' + toFa((netMargin*100).toFixed(0)) + ' تومان سود می‌مونه.' });
    } else if(netMargin > 0){
      metrics.push({ key:'profit', level:'warn', icon:'🟡', label:'سودآوری', 
        short:'سود کم',
        detail:'از هر ۱۰۰ تومان فروش، فقط ' + toFa((netMargin*100).toFixed(0)) + ' تومان سود می‌مونه.' });
    }
  }

  // بدهی
  const debtRatio = ratio(v.tl, v.ta);
  if(debtRatio != null){
    const debtPct = toFa((debtRatio*100).toFixed(0));
    if(debtRatio > 0.7){
      metrics.push({ key:'debt', level:'bad', icon:'🔴', label:'بدهی', 
        short:'بدهی خیلی زیاد',
        detail:'از هر ۱۰۰ تومان دارایی، ' + debtPct + ' تومانش مال طلبکارهاست، نه سهامدارها.' });
    } else if(debtRatio > 0.5){
      metrics.push({ key:'debt', level:'warn', icon:'🟡', label:'بدهی', 
        short:'بدهی نسبتاً زیاد',
        detail:'از هر ۱۰۰ تومان دارایی، ' + debtPct + ' تومانش مال طلبکارهاست.' });
    } else {
      metrics.push({ key:'debt', level:'good', icon:'🟢', label:'بدهی', 
        short:'بدهی متعادل',
        detail:'از هر ۱۰۰ تومان دارایی، ' + debtPct + ' تومانش مال طلبکارهاست.' });
    }
  }

  // نقدینگی
  const currentRatio = ratio(v.ca, v.cl);
  if(currentRatio != null){
    if(currentRatio < 1){
      metrics.push({ key:'liq', level:'bad', icon:'🔴', label:'نقدینگی', 
        short:'مشکل نقدینگی',
        detail:'بدهی‌های کوتاه‌مدت شرکت از دارایی‌های سریع‌فروشش بیشتره.' });
    } else if(currentRatio < 1.5){
      metrics.push({ key:'liq', level:'warn', icon:'🟡', label:'نقدینگی', 
        short:'نقدینگی متوسط',
        detail:'دارایی سریع‌فروش شرکت تقریباً به اندازه بدهی کوتاه‌مدتشه.' });
    } else {
      metrics.push({ key:'liq', level:'good', icon:'🟢', label:'نقدینگی', 
        short:'نقدینگی خوب',
        detail:'شرکت دارایی سریع‌فروش کافی برای پرداخت بدهی‌های کوتاه‌مدتش داره.' });
    }
  }

  // رشد فروش
  const prevRev = val('revenue', 1);
  if(v.revenue != null && prevRev != null && prevRev !== 0){
    const growth = (v.revenue - prevRev) / Math.abs(prevRev);
    const growthPct = toFa((Math.abs(growth)*100).toFixed(0));
    if(growth > 0.2){
      metrics.push({ key:'growth', level:'good', icon:'🟢', label:'رشد فروش', 
        short:'رشد خوب فروش',
        detail:'فروش شرکت نسبت به دوره قبل ' + growthPct + '٪ بیشتر شده.' });
    } else if(growth > 0){
      metrics.push({ key:'growth', level:'good', icon:'🟢', label:'رشد فروش', 
        short:'رشد ملایم فروش',
        detail:'فروش شرکت نسبت به دوره قبل ' + growthPct + '٪ بیشتر شده.' });
    } else if(growth > -0.1){
      metrics.push({ key:'growth', level:'warn', icon:'🟡', label:'رشد فروش', 
        short:'فروش تقریباً ثابت',
        detail:'فروش شرکت تقریباً مثل دوره قبل مونده.' });
    } else {
      metrics.push({ key:'growth', level:'bad', icon:'🔴', label:'رشد فروش', 
        short:'افت فروش',
        detail:'فروش شرکت نسبت به دوره قبل ' + growthPct + '٪ کمتر شده.' });
    }
  }

  // کیفیت سود
  if(v.cfo != null && v.net != null && v.net > 0){
    const cashRatio = v.cfo / v.net;
    if(cashRatio > 0.8){
      metrics.push({ key:'cash', level:'good', icon:'🟢', label:'کیفیت سود', 
        short:'سود واقعی',
        detail:'سودی که شرکت تو دفترها نشون داده، واقعاً به پول نقد تبدیل شده.' });
    } else if(cashRatio > 0.4){
      metrics.push({ key:'cash', level:'warn', icon:'🟡', label:'کیفیت سود', 
        short:'سود نیمه‌واقعی',
        detail:'بخشی از سود شرکت به پول نقد تبدیل شده، ولی نه همه‌ش.' });
    } else {
      metrics.push({ key:'cash', level:'bad', icon:'🔴', label:'کیفیت سود', 
        short:'سود روی کاغذ',
        detail:'سود شرکت تو دفترها هست، ولی پول نقد کمی به دستش رسیده.' });
    }
  }

  // قیمت سهم
  if(MARKET.price && v.eps != null && v.eps > 0){
    const pe = MARKET.price / v.eps;
    if(pe < 5){
      metrics.push({ key:'pe', level:'good', icon:'🟢', label:'قیمت سهم', 
        short:'قیمت سهم ارزون',
        detail:'قیمت سهم حدود ' + toFa(pe.toFixed(1)) + ' برابر سود سالانه‌شه.' });
    } else if(pe < 12){
      metrics.push({ key:'pe', level:'good', icon:'🟢', label:'قیمت سهم', 
        short:'قیمت سهم متعادل',
        detail:'قیمت سهم حدود ' + toFa(pe.toFixed(1)) + ' برابر سود سالانه‌شه.' });
    } else if(pe < 20){
      metrics.push({ key:'pe', level:'warn', icon:'🟡', label:'قیمت سهم', 
        short:'قیمت سهم نسبتاً بالا',
        detail:'قیمت سهم حدود ' + toFa(pe.toFixed(1)) + ' برابر سود سالانه‌شه.' });
    } else {
      metrics.push({ key:'pe', level:'bad', icon:'🔴', label:'قیمت سهم', 
        short:'قیمت سهم گرون',
        detail:'قیمت سهم حدود ' + toFa(pe.toFixed(1)) + ' برابر سود سالانه‌شه.' });
    }
  }

  // ═══════════════════════════════════════════
  // ۲. ساخت پاراگراف روان
  // ═══════════════════════════════════════════
  let para = '';
  const companyName = MARKET.symbol ? '<b>' + MARKET.symbol + '</b>' : 'شرکت';
  const periodName = PARSED?._detectedPeriod || 'این دوره';

  para += companyName + ' در ' + periodName + '، ';

  if(v.revenue != null && v.net != null){
    para += 'درآمد <b>' + toman(v.revenue) + '</b> و سود خالص <b>' + toman(v.net) + '</b> داشته. ';
  }

  // وضعیت کلی
  const goodCount = metrics.filter(m => m.level === 'good').length;
  const warnCount = metrics.filter(m => m.level === 'warn').length;
  const badCount = metrics.filter(m => m.level === 'bad').length;

  if(badCount === 0 && warnCount === 0){
    para += 'از نظر مالی، وضعیت شرکت <b style="color:#16834a">خیلی خوبه</b> و هیچ مشکل مهمی دیده نمی‌شه. ';
  } else if(badCount === 0){
    para += 'از نظر مالی، وضعیت شرکت <b style="color:#16834a">خوبه</b>، هرچند چند نکته کوچیک هست که باید پیگیری بشه. ';
  } else if(badCount === 1){
    para += 'از نظر مالی، شرکت <b style="color:#c62828">یه مشکل مهم</b> داره که باید بررسی بشه. ';
  } else {
    para += 'از نظر مالی، شرکت <b style="color:#c62828">چند مشکل مهم</b> داره که باید بررسی بشن. ';
  }

  // بهترین و بدترین
  const best = metrics.find(m => m.level === 'good');
  const worst = metrics.find(m => m.level === 'bad') || metrics.find(m => m.level === 'warn');

  if(best){
    para += 'قوی‌ترین نقطه شرکت <b>' + best.short + '</b> هست. ';
  }
  if(worst && worst !== best){
    para += 'ولی <b>' + worst.short + '</b> یه نکته‌ست که باید حواست بهش باشه. ';
  }

  // اگه P/E داریم
  if(MARKET.tsetmcPE){
    para += 'قیمت سهم در بازار حدود <b>' + toFa(MARKET.tsetmcPE.toFixed(1)) + ' برابر</b> سودشه. ';
  }

  summaryBox.innerHTML = para;

  // ═══════════════════════════════════════════
  // ۳. ساخت ۳ کارت (قوت / ضعف / پیگیری)
  // ═══════════════════════════════════════════
  if(cardsBox){
    let cardsHtml = '';

    // کارت قوت
    const strength = metrics.find(m => m.level === 'good');
    if(strength){
      cardsHtml += `
        <div class="smart-card smart-good">
          <div class="smart-card-head">
            <span class="smart-card-icon">💪</span>
            <span class="smart-card-title">قوی‌ترین نقطه</span>
          </div>
          <div class="smart-card-label">${strength.short}</div>
          <div class="smart-card-detail">${strength.detail}</div>
        </div>
      `;
    }

    // کارت ضعف
    const weakness = metrics.find(m => m.level === 'bad') || metrics.find(m => m.level === 'warn');
    if(weakness && weakness !== strength){
      const levelClass = weakness.level === 'bad' ? 'smart-bad' : 'smart-warn';
      cardsHtml += `
        <div class="smart-card ${levelClass}">
          <div class="smart-card-head">
            <span class="smart-card-icon">${weakness.level === 'bad' ? '⚠️' : '👀'}</span>
            <span class="smart-card-title">${weakness.level === 'bad' ? 'ضعف مهم' : 'نکته قابل بررسی'}</span>
          </div>
          <div class="smart-card-label">${weakness.short}</div>
          <div class="smart-card-detail">${weakness.detail}</div>
        </div>
      `;
    }

    // کارت پیگیری (اگه ۳ تا یا بیشتر metric داریم، یه مورد دیگه هم نشون بده)
    const others = metrics.filter(m => m !== strength && m !== weakness && m.level !== 'good');
    if(others.length > 0){
      const followUp = others[0];
      cardsHtml += `
        <div class="smart-card smart-warn">
          <div class="smart-card-head">
            <span class="smart-card-icon">🔍</span>
            <span class="smart-card-title">پیگیری کن</span>
          </div>
          <div class="smart-card-label">${followUp.short}</div>
          <div class="smart-card-detail">${followUp.detail}</div>
        </div>
      `;
    }

    cardsBox.innerHTML = cardsHtml;
  }

  // ═══════════════════════════════════════════
  // ۴. توصیه نهایی
  // ═══════════════════════════════════════════
  if(adviceBox){
    let advice = '';
    let adviceColor = '#16834a';
    let adviceIcon = '📌';

    if(badCount >= 2){
      advice = 'این شرکت چند مشکل مهم داره. قبل از هر تصمیمی، حتماً با یه مشاور مالی مشورت کن.';
      adviceColor = '#c62828';
    } else if(badCount === 1){
      advice = 'شرکت یه مشکل مهم داره. اگه می‌خوای سرمایه‌گذاری کنی، اول ببین اون مشکل داره حل می‌شه یا نه.';
      adviceColor = '#c62828';
    } else if(warnCount >= 2){
      advice = 'شرکت وضعیت خوبی داره، ولی چند نکته هست که باید پیگیری بشه.';
      adviceColor = '#a16207';
    } else if(warnCount === 1){
      advice = 'شرکت وضعیت خوبی داره. فقط یه نکته کوچیک هست که باید حواست بهش باشه.';
      adviceColor = '#a16207';
    } else {
      advice = 'شرکت از نظر مالی وضعیت خیلی خوبی داره.';
      adviceColor = '#16834a';
    }

    adviceBox.innerHTML = `
      <div class="smart-advice-inner" style="border-right-color:${adviceColor}">
        <span class="smart-advice-icon">${adviceIcon}</span>
        <span class="smart-advice-text">${advice}</span>
      </div>
      <div class="smart-advice-disclaimer">
        ⚠️ این تحلیل فقط بر اساس صورت مالی این دوره‌ست و پیشنهاد خرید یا فروش نیست.
      </div>
    `;
  }
}




/* ============================================================
   📅 راه‌اندازی انتخابگر دستی دوره
============================================================ */
function initPeriodEditor(){
  const monthsSelect = $('periodMonthsSelect');
  const yearSelect = $('periodYearSelect');
  const badge = $('periodAutoBadge');
  const infoText = $('periodInfoText');

  if(!monthsSelect || !yearSelect) return;

  // وقتی کاربر دوره رو عوض کرد
  monthsSelect.onchange = () => {
    applyPeriodManually(monthsSelect, yearSelect, badge, infoText);
  };

  // وقتی کاربر سال رو عوض کرد
  yearSelect.onchange = () => {
    applyPeriodManually(monthsSelect, yearSelect, badge, infoText);
  };
}



function applyPeriodManually(monthsSelect, yearSelect, badge, infoText){
  const months = parseInt(monthsSelect.value, 10);
  const year = parseInt(yearSelect.value, 10);
  
  if(!months || !year) return;

  // آپدیت MARKET
  MARKET.periodMonths = months;
  window.MARKET = MARKET;
  saveMarketToStorage();

  // آپدیت PARSED (اگه تحلیل انجام شده)
  if(PARSED){
    PARSED._detectedInfo = {
      label: toFa(months) + ' ماهه سال ' + toFa(year),
      year: String(year),
      months: months
    };
    PARSED._detectedPeriod = PARSED._detectedInfo.label;
  }

  // نشون دادن وضعیت «دستی»
  if(badge){
    badge.textContent = '✏️ دستی';
    badge.className = 'period-auto-badge manual';
  }
  if(infoText){
    infoText.textContent = toFa(months) + ' ماهه سال ' + toFa(year);
  }

  // ⭐ دوباره رندر کن (چون EPS و Z-Score و... به دوره وابسته‌ن)
  if(PARSED && typeof render === 'function'){
    render(0);
  }

  if(window.showToast){
    window.showToast('✅ دوره به ' + toFa(months) + ' ماهه سال ' + toFa(year) + ' تغییر کرد');
  }
}



/* ============================================================
   render — رندر اصلی
============================================================ */
function render(ci){
  window.MARKET = MARKET;
  const SECTOR = (window.MARKET && window.MARKET.sectorType) || 'normal';
  const isBank = (SECTOR === 'bank');
  const isInvestment = (SECTOR === 'investment');
  const isInsurance = (SECTOR === 'insurance');
  const isLeasing = (SECTOR === 'leasing');

  ['zscore', 'quality', 'ebitda'].forEach(accName => {
    const card = document.querySelector(`#out .acc-card[data-acc="${accName}"]`);
    if(!card) return;
    if(isBank || isInsurance){ card.style.display = 'none'; }
    else if(isInvestment || isLeasing){ card.style.display = (accName === 'zscore' || accName === 'ebitda') ? 'none' : ''; }
    else { card.style.display = ''; }
  });

  const v = {
    revenue: val('revenue',ci), cogs: val('cogs',ci), gross: val('grossProfit',ci),
    opEx: val('opEx',ci), opProfit: val('opProfit',ci), financeCost: val('financeCost',ci),
    otherNonOp: val('otherNonOp',ci), pbt: val('profitBeforeTax',ci), tax: val('tax',ci),
    net: val('netProfit',ci), eps: val('eps',ci), capital: val('capital',ci),
    nonCA: val('nonCurrentAssets',ci), ca: val('currentAssets',ci), ta: val('totalAssets',ci),
    inv: val('inventory',ci), recv: val('receivables',ci), cash: val('cash',ci), sti: val('shortTermInv',ci),
    nonCL: val('nonCurrentLiab',ci), cl: val('currentLiab',ci), tl: val('totalLiab',ci),
    eq: val('equity',ci), re: val('retainedEarnings',ci), ltd: val('longTermDebt',ci),
    pay: val('payables',ci),
    cfo: val('cfo',ci), cfi: val('cfi',ci), cff: val('cff',ci), capex: val('capex',ci),
    deprec: val('depreciation',ci),
  };

  renderQuickMetrics();
  updateAccordionSummaries(v);

  const sc = calcScore(v);
  const lvl = scoreLevel(sc);
  $('scoreNum').textContent = sc == null ? '—' : toFa(sc);
  $('scoreNum').style.color = lvl.color;
  $('scoreLabel').innerHTML = `<b style="color:${lvl.color}">وضعیت: ${lvl.label}</b>`;
  $('scoreFill').style.width = (sc || 0) + '%';
  $('scoreText').textContent = lvl.text;
  $('scoreText').style.borderRightColor = lvl.color;
  renderDuPont(v);
  renderEBITDA(v);
  renderOperatingQuality(v);
  renderZScore(v);
  renderEPS(v);
  renderCapitalPotential(v);

  rebuildAllCharts();

  const MILLION = 1_000_000;
  const periodMonths = MARKET.periodMonths || 12;
  const annualizeFactor = 12 / periodMonths;
  const sharesFromCapital = (v.capital != null) ? v.capital * 1000 : null;
  const shares = MARKET.shares || sharesFromCapital;
  const price = MARKET.price;
  const netRial = (v.net != null) ? v.net * MILLION * annualizeFactor : null;
  const eqRial = (v.eq != null) ? v.eq * MILLION : null;
  const revRial = (v.revenue != null) ? v.revenue * MILLION * annualizeFactor : null;
  const tlRial = (v.tl != null) ? v.tl * MILLION : null;
  const cashRial = (v.cash != null) ? v.cash * MILLION : null;
  const ebitdaVal = (v.opProfit != null) ? (v.opProfit + (v.deprec != null ? Math.abs(v.deprec) : 0)) : null;
  const ebitdaRial = (ebitdaVal != null) ? ebitdaVal * MILLION * annualizeFactor : null;
  const marketCap = (price != null && shares != null) ? price * shares : null;
  const epsFromFile = v.eps;
  const eps = (epsFromFile != null) ? epsFromFile : ((netRial != null && shares != null && shares !== 0) ? netRial / shares : null);
  const pe = (price != null && eps != null && eps > 0) ? price / eps : null;
    // ⭐ P/E سایت TSETMC
    const tsetmcPE = MARKET.tsetmcPE || null;
  const pb = (marketCap != null && eqRial != null && eqRial !== 0 && eqRial > 0) ? marketCap / eqRial : null;
  const ps = (marketCap != null && revRial != null && revRial !== 0) ? marketCap / revRial : null;
  const ev = (marketCap != null) ? (marketCap + (tlRial || 0) - (cashRial || 0)) : null;
  const evEbitda = (ev != null && ebitdaRial != null && ebitdaRial > 0) ? ev / ebitdaRial : null;
  const prevRevenue = val('revenue', 1);
  const prevNet = val('netProfit', 1);
  const growthRev = (v.revenue != null && prevRevenue != null && prevRevenue !== 0) ? (v.revenue - prevRevenue) / Math.abs(prevRevenue) : null;
  const growthNet = (v.net != null && prevNet != null && prevNet !== 0) ? (v.net - prevNet) / Math.abs(prevNet) : null;
  const cogsAbs = (v.cogs != null) ? Math.abs(v.cogs) : null;
  const dso = (v.recv && v.revenue) ? 365 * (v.recv / v.revenue) : null;
  const dio = (v.inv && cogsAbs) ? 365 * (v.inv / cogsAbs) : null;
  const dpo = (cogsAbs && v.pay) ? 365 * (v.pay / Math.abs(cogsAbs)) : null;
  const ccc = (dso != null && dio != null && dpo != null) ? (dso + dio - dpo) : null;
  const roce = (v.opProfit != null && v.ta != null && v.cl != null && (v.ta - v.cl) !== 0) ? v.opProfit / (v.ta - v.cl) : null;
  const peg = (pe != null && pe > 0 && growthNet != null && growthNet > 0) ? pe / (growthNet * 100) : null;
  const cashInterestCoverage = (v.cfo != null && v.financeCost != null && Math.abs(v.financeCost) > 0) ? v.cfo / Math.abs(v.financeCost) : null;
  const interestCoverage = (() => {
    if(v.financeCost == null || v.financeCost === 0 || v.opProfit == null) return null;
    const depAbs = (v.deprec != null) ? Math.abs(v.deprec) : 0;
    const ebit = v.opProfit + depAbs;
    return ebit / Math.abs(v.financeCost);
  })();
  const quickRatioSafe = (v.ca != null && v.inv != null && v.cl != null && v.cl !== 0) ? (v.ca - v.inv) / v.cl : null;

  const R = {
    liq: [
      ['نسبت جاری', ratio(v.ca, v.cl), x=>x<1, x=>x>=1&&x<2],
      ['نسبت آنی (Quick)', quickRatioSafe, x=>x<0.7, x=>x>=0.7&&x<1],
      ['نسبت نقد', ratio(v.cash, v.cl), x=>x<0.1, x=>x>=0.1&&x<0.3],
      ['سرمایه در گردش', (v.ca!=null&&v.cl!=null)?(v.ca-v.cl):null, x=>x<0, ()=>false],
    ],
    lev: [
      ['بدهی به دارایی', ratio(v.tl, v.ta), x=>x>0.7, x=>x>0.4],
      ['بدهی به حقوق صاحبان سهام', (v.eq != null && v.eq > 0) ? ratio(v.tl, v.eq) : null, x=>x>2, x=>x>1&&x<=2],
      ['پوشش بهره', interestCoverage, x=>x<2, x=>x>=2&&x<4],
      ['اهرم حقوق مالکانه', (v.eq != null && v.eq > 0) ? ratio(v.ta, v.eq) : null, x=>x>4, x=>x>2&&x<=4],
    ],
    prof: [
      ['حاشیه سود ناخالص', ratio(v.gross, v.revenue), x=>x<0.1, x=>x<0.2],
      ['حاشیه سود عملیاتی', ratio(v.opProfit, v.revenue), x=>x<0.05, x=>x<0.15],
      ['حاشیه سود خالص', ratio(v.net, v.revenue), x=>x<0.05, x=>x<0.1],
      ['ROA', ratio(v.net, v.ta), x=>x<0.02, x=>x<0.05],
      ['ROE', (v.eq != null && v.eq > 0) ? ratio(v.net, v.eq) : null, x=>x<0.05, x=>x<0.15],
      ['ROCE (بازده سرمایه به کار گرفته شده)', roce, x=>x<0.05, x=>x<0.15],
      ['نرخ رشد فروش', growthRev, x=>x<0, x=>x<0.1],
      ['نرخ رشد سود خالص', growthNet, x=>x<0, x=>x<0.1],
    ],
    eff: [
      ['گردش دارایی', ratio(v.revenue, v.ta), x=>x<0.3, x=>x<0.6],
      ['گردش موجودی', (v.cogs != null && v.inv != null && v.inv !== 0) ? Math.abs(v.cogs) / v.inv : null, x=>x<1, x=>x<3],
      ['گردش مطالبات', ratio(v.revenue, v.recv), x=>x<2, x=>x<4],
      ['دوره وصول مطالبات (روز)', dso, x=>x>180, x=>x>90],
      ['چرخه تبدیل نقد (CCC)', ccc, x=>x>90, x=>x>30],
    ],
    cf: [
      ['جریان نقد عملیاتی / سود خالص', ratio(v.cfo, v.net), x=>x<0.5, x=>x<0.8],
      ['آزاد FCF', (v.cfo!=null && v.capex!=null)?(v.cfo - Math.abs(v.capex)):null, x=>x<0, ()=>false],
      ['CFO به درآمد', ratio(v.cfo, v.revenue), x=>x<0.02, x=>x<0.05],
      ['پوشش بهره نقدی', cashInterestCoverage, x=>x<2, x=>x<5],
    ],
    val: [
      ['P/E', pe, x=>x>20, x=>x>12],
      
      ['P/B', pb, x=>x>5, x=>x>3],
      ['P/S', ps, x=>x>5, x=>x>3],
      ['EPS', eps, x=>x<0, ()=>false],
      ['PEG', peg, x=>x>2, x=>x>1],
      ['EV/EBITDA', evEbitda, x=>x>12, x=>x>8],
    ],
  };

  const fmt = (name, x) => {
    if(x==null) {
      if(name === 'ROE' && v.eq != null && v.eq <= 0){ return '<span style="color:var(--bad);font-weight:700;font-size:11px">بی‌معنی (سرمایه منفی)</span>'; }
      return '—';
    }
    const meaninglessIfNegative = /^(P\/E|PEG|P\/B|P\/S|EV\/EBITDA)$/.test(name);
    if(meaninglessIfNegative && x < 0){ return '<span style="color:var(--bad);font-weight:700">زیان‌ده</span>'; }
    if(name === 'EPS' && x < 0){ return `<span style="color:var(--bad);font-weight:700">${toFa(Math.round(x).toLocaleString('en-US'))} ریال (زیان)</span>`; }
    if(/حاشیه|ROA|ROE|ROCE|CFO به درآمد|نرخ رشد|بدهی به دارایی/.test(name)) return pct(x);
    if(/روز|CCC|چرخه تبدیل/.test(name)) return toFa(x.toFixed(0))+' روز';
    if(/سرمایه در گردش|آزاد FCF/.test(name)) return toman(x);
    if(name === 'EPS'){ return toFa(Math.round(x).toLocaleString('en-US')) + ' ریال'; }
    return num2(x);
  };

  const statusClass = (x, bad, warn) => {
    if(x==null) return '';
    if(bad(x)) return 'bad';
    if(warn(x)) return 'warn';
    return 'good';
  };

  const meaningfulRatio = (name, x) => {
    if(x == null) return false;
    const meaninglessIfNegative = /^(P\/E|PEG|P\/B|P\/S|EV\/EBITDA)$/.test(name);
    if(meaninglessIfNegative && x < 0) return false;
    return true;
  };

  function tableFor(list){
    list = filterRatiosBySector(list);
    return '<div class="ratio-cards">' + list.map(([name,x,bad,warn,good])=>{
      const isMeaningless = !meaningfulRatio(name, x);
      const isNegativeEPS = name === 'EPS' && x != null && x < 0;
      const isNegativeEquityROE = name === 'ROE' && v.eq != null && v.eq <= 0;
      let c, label, color;
      if(isNegativeEquityROE){ c = 'bad'; label = 'بی‌معنی'; color = '#c62828'; }
      else if(isMeaningless){ c = 'bad'; label = 'زیان‌ده'; color = '#c62828'; }
      else if(isNegativeEPS){ c = 'bad'; label = 'زیان‌ده'; color = '#c62828'; }
      else {
        // ⭐ اگه تابع good اضافه شده بود، ازش استفاده کن
        if(typeof good === 'function'){
          if(bad(x)){ c = 'bad'; }
          else if(warn(x)){ c = 'warn'; }
          else if(good(x)){ c = 'good'; }
          else { c = 'good'; }
        } else {
          c = statusClass(x, bad, warn);
        }
        label = c==='bad'?'ضعیف':c==='warn'?'قابل بررسی':c==='good'?'مطلوب':'—';
        color = c === 'bad' ? '#c62828' : c === 'warn' ? '#eab308' : c === 'good' ? '#16834a' : '#94a3b8';
      }
      let score = 50;
      if(c === 'bad') score = 15;
      else if(c === 'warn') score = 45;
      else if(c === 'good') score = 85;
      const hint = HINTS[name] || '';
      const dynamicHint = isNegativeEquityROE
        ? 'این نسبت برای شرکت با سرمایه منفی معنی نداره.'
        : isMeaningless
        ? 'این نسبت برای شرکت زیان‌ده معنی نداره.'
        : makeHintDynamic(name, hint, c, x);
      return `
        <div class="ratio-card">
          <div class="ratio-card-row">
            <div class="ratio-card-name">${name}</div>
            <div class="ratio-card-value-box">
              <span class="ratio-card-num" style="color:${color}">${fmt(name,x)}</span>
              <span class="ratio-card-status" style="color:${color}">${label}</span>
            </div>
            <div class="ratio-card-bar-inline">
              <div class="ratio-card-fill-inline" style="width:${score}%;background:${color}"></div>
            </div>
          </div>
          ${dynamicHint ? `<div class="ratio-card-hint">${dynamicHint}</div>` : ''}
        </div>
      `;
    }).join('') + '</div>';
  }

  function formatDynamicValue(name, x){
    if(x == null || !isFinite(x)) return '—';
    const noPercentSign = /^(بدهی به دارایی|حاشیه سود ناخالص|حاشیه سود عملیاتی|حاشیه سود خالص)$/.test(name);
    if(/حاشیه|ROA|ROE|ROCE|بدهی به دارایی|CFO به درآمد|نرخ رشد/.test(name)){
      const pctVal = x * 100;
      const rounded = Math.abs(pctVal) >= 1 ? Math.round(pctVal) : null;
      if(rounded !== null){ return toFa(rounded.toLocaleString('en-US')) + (noPercentSign ? '' : '٪'); }
      return toFa(pctVal.toFixed(2)) + (noPercentSign ? '' : '٪');
    }
    if(/روز|CCC|چرخه تبدیل/.test(name)){ return toFa(Math.round(x)) + ' روز'; }
    if(name === 'EPS'){ return toFa(Math.round(x).toLocaleString('en-US')) + ' ریال'; }
    if(Math.abs(x) >= 1){ return toFa(Math.round(x).toLocaleString('en-US')); }
    return num2(x);
  }

  function makeHintDynamic(name, hint, status, x){
    if(!hint) return '';
    if(typeof hint === 'object' && hint.dynamic && hint.template){
      let value = formatDynamicValue(name, x);
      let color = '#16834a';
      if(status === 'warn') color = '#eab308';
      else if(status === 'bad') color = '#c62828';
      if(/نرخ رشد/.test(name)){
        if(x != null && isFinite(x)){
          const absPct = toFa((Math.abs(x) * 100).toFixed(1)) + '٪';
          const word = x >= 0 ? 'رشد کرده' : 'افت کرده';
          const finalColor = x >= 0 ? '#16834a' : '#c62828';
          return hint.template.replace('{v}', `<span class="ratio-hint-answer" style="color:${finalColor};font-weight:700">${absPct} ${word}</span>`);
        }
        return hint.template.replace('{v}', '<span style="color:#94a3b8">نامشخص</span>');
      }

      return hint.template.replace('{v}', `<span class="ratio-hint-answer" style="color:${color};font-weight:700">${value}</span>`);
    }
    if(typeof hint === 'object' && hint.template){
      const template = hint.template;
      let replacement = '';
      let color = '';
      if(status === 'good'){ replacement = hint.good || ''; color = '#16834a'; }
      else if(status === 'warn'){ replacement = hint.warn || ''; color = '#eab308'; }
      else if(status === 'bad'){ replacement = hint.bad || ''; color = '#c62828'; }
      else { return template.replace('...', '<span style="color:#94a3b8">؟؟</span>'); }
      return template.replace('...', `<span class="ratio-hint-answer" style="color:${color};font-weight:700">${replacement}</span>`);
    }
    return hint;
  }

  document.querySelectorAll('#tabSingle .tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('#tabSingle .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      if(t.dataset.t === 'val' && price == null){
        $('ratios').innerHTML = '<div class="err" style="display:block">برای نمایش نسبت‌های ارزش‌گذاری، ابتدا <b>قیمت سهام</b> رو وارد کن.</div>';
      } else { $('ratios').innerHTML = tableFor(R[t.dataset.t]); }
    };
  });
  $('ratios').innerHTML = tableFor(R.liq);

  (function hideEmptyRatioTabs(){
    const tabKeys = ['liq', 'lev', 'prof', 'eff', 'cf', 'val'];
    let firstVisible = null;
    tabKeys.forEach(key => {
      const list = R[key] || [];
      const filtered = filterRatiosBySector(list);
      const tabBtn = document.querySelector(`#tabSingle .tab[data-t="${key}"]`);
      if(!tabBtn) return;
      if(filtered.length === 0){ tabBtn.style.display = 'none'; tabBtn.classList.remove('active'); }
      else { tabBtn.style.display = ''; if(!firstVisible) firstVisible = tabBtn; }
    });
    const activeTab = document.querySelector('#tabSingle .tab.active');
    if(activeTab && activeTab.style.display === 'none' && firstVisible){
      document.querySelectorAll('#tabSingle .tab').forEach(x => x.classList.remove('active'));
      firstVisible.classList.add('active');
      const activeKey = firstVisible.dataset.t;
      $('ratios').innerHTML = tableFor(R[activeKey]);
    }
  })();












  renderSmartAnalysis(v);
  updatePrintHeader();
}




/* ---------- Copy Summary ---------- */
if($('copySummary')) $('copySummary').onclick = () => {
  const text = $('summary').innerText;
  if(!text){ showToast('خلاصه‌ای موجود نیست', true); return; }
  const title = MARKET.symbol ? `📊 تحلیل ${MARKET.symbol}` : '📊 تحلیل صورت‌های مالی';
  const fullText = `${title} — ${toFa(new Date().toLocaleString('fa-IR'))}\n\n${text}`;
  navigator.clipboard.writeText(fullText).then(() => { showToast('✅ خلاصه کپی شد!'); })
  .catch(() => {
    const ta = document.createElement('textarea');
    ta.value = fullText;
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); showToast('✅ خلاصه کپی شد!'); }
    catch(e){ showToast('خطا در کپی', true); }
    document.body.removeChild(ta);
  });
};




/* ---------- Print Header ---------- */
function updatePrintHeader(){
  const old = document.querySelector('.print-header');
  if(old) old.remove();
  const header = document.createElement('div');
  header.className = 'print-header';
  const periodName = PARSED?._detectedPeriod || (PERIOD_NAMES[0] || '');
  const title = MARKET.symbol ? `📊 گزارش تحلیل ${MARKET.symbol}` : '📊 گزارش تحلیل مالی';
  header.innerHTML = `<h2>${title}</h2><p class="sub">تاریخ گزارش: ${toFa(new Date().toLocaleString('fa-IR'))} — ${periodName}</p>`;
  const out = $('out');
  if(out) out.insertBefore(header, out.firstChild);
}
window.addEventListener('beforeprint', updatePrintHeader);

/* ---------- Main Tabs ---------- */
function switchMainTab(target){
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.main-tab[data-maintab="${target}"]`);
  if(tab) tab.classList.add('active');
  const panelId = target === 'compare' ? 'tabCompare' : target === 'industries' ? 'tabIndustries' : target === 'watchlist' ? 'tabWatchlist' : 'tabSingle';
  const panel = document.getElementById(panelId);
  if(panel) panel.classList.add('active');
  window.scrollTo({top: 0, behavior: 'smooth'});
}
window.switchMainTab = switchMainTab;
document.querySelectorAll('.main-tab').forEach(tab => {
  tab.onclick = () => switchMainTab(tab.dataset.maintab);
});

/* ---------- KodalHelpers ---------- */
window.KodalHelpers = Object.assign(window.KodalHelpers || {}, {
  getLines, parseItems, calcScore, scoreLevel, ratio, toman, tomanText, pct, num2, toFa, fa2en, toNum, PERIOD_NAMES,
  chartTextColor, chartLineColor, chartBaseColor, chartLabelColor, detectPeriodFromLines,
});

/* ============================================================
   Send to Watchlist
============================================================ */
(function initSendToWatch(){
  const btn = document.getElementById('sendToWatchBtn');
  if(!btn) return;
  function showErr(msg){
    const box = document.getElementById('watchAddErr');
    if(!box) return;
    box.style.display = 'block';
    box.textContent = msg;
  }
  btn.onclick = () => {
    if(!PARSED){ showToast('اول یه فایل رو تحلیل کن!', true); return; }
    if(!window.Watchlist){ showToast('سیستم دیدبان لود نشده', true); return; }
    const modal = document.getElementById('addWatchModal');
    if(!modal){
      const symbol = prompt('اسم نماد:', MARKET.symbol || '');
      if(!symbol) return;
      const period = prompt('دوره (۳/۶/۹/۱۲):', String(MARKET.periodMonths || 12));
      if(!period) return;
      const year = prompt('سال (مثلاً: ۱۴۰۳):', '');
      if(!year) return;
      window.Watchlist.add({ type: 'analysis', symbol: symbol.trim(), industry: '', report: buildAnalysisSnapshot(), year: year.trim(), period: period.trim() });
      return;
    }
    const title = document.getElementById('addWatchTitle');
    const subtitle = document.getElementById('addWatchSubtitle');
    if(title) title.textContent = '👁️ افزودن به دیدبان — تحلیل شرکت';
    if(subtitle) subtitle.textContent = 'این تحلیل رو به دیدبان اضافه کن';
    const existingBox = document.getElementById('watchExistingBox');
    const newBox = document.getElementById('watchNewBox');
    const radioExisting = document.getElementById('watchModeExisting');
    const radioNew = document.getElementById('watchModeNew');
    const symbolToCheck = MARKET.symbol || '';
    const hasExisting = symbolToCheck && window.Watchlist.has(symbolToCheck, 'analysis');
    if(hasExisting && radioExisting){ radioExisting.checked = true; if(existingBox) existingBox.style.display = 'block'; if(newBox) newBox.style.display = 'none'; }
    else if(radioNew){ radioNew.checked = true; if(existingBox) existingBox.style.display = 'none'; if(newBox) newBox.style.display = 'block'; }
    const select = document.getElementById('watchExistingSelect');
    if(select){
      const all = window.Watchlist.getAll('analysis') || [];
      select.innerHTML = '<option value="">-- انتخاب کن --</option>' + all.map(w => `<option value="${String(w.symbol).replace(/"/g,'&quot;')}">${w.symbol}${w.industry ? ' (' + w.industry + ')' : ''}</option>`).join('');
      if(hasExisting) select.value = symbolToCheck;
    }
    if(document.getElementById('watchNewSymbol')) document.getElementById('watchNewSymbol').value = symbolToCheck;
    if(document.getElementById('watchNewIndustry')) document.getElementById('watchNewIndustry').value = '';
    const periodFields = document.getElementById('watchPeriodFields');
    const detectedYear = PARSED?._detectedInfo?.year || '';
    const detectedMonths = PARSED?._detectedInfo?.months || '';
    if(periodFields){
      if(detectedYear && detectedMonths){
        periodFields.innerHTML = `
          <div style="padding:12px 14px;background:rgba(16,185,129,.1);border-radius:10px;border-right:4px solid var(--good);font-size:13px;line-height:1.9">
            <div>📅 <b>دوره:</b> ${toFa(detectedMonths)} ماهه</div>
            <div>📆 <b>سال:</b> ${toFa(detectedYear)}</div>
          </div>
          <input type="hidden" id="watchPeriod" value="${detectedMonths}">
          <input type="hidden" id="watchYear" value="${detectedYear}">
        `;
      } else {
        periodFields.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">دوره</label>
              <select id="watchPeriod" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="3">۳ ماهه</option><option value="6">۶ ماهه</option><option value="9">۹ ماهه</option><option value="12" selected>سالانه</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">سال</label>
              <select id="watchYear" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="1402">۱۴۰۲</option><option value="1403">۱۴۰۳</option><option value="1404">۱۴۰۴</option><option value="1405" selected>۱۴۰۵</option><option value="1406">۱۴۰۶</option>
              </select>
            </div>
          </div>
        `;
      }
    }
    [radioExisting, radioNew].forEach(r => {
      if(!r) return;
      r.onchange = () => {
        if(radioExisting && radioExisting.checked){ if(existingBox) existingBox.style.display = 'block'; if(newBox) newBox.style.display = 'none'; }
        else { if(existingBox) existingBox.style.display = 'none'; if(newBox) newBox.style.display = 'block'; }
      };
    });
    const confirmBtn = document.getElementById('addWatchConfirm');
    if(confirmBtn){
      confirmBtn.onclick = () => {
        try{
          const mode = radioExisting && radioExisting.checked ? 'existing' : 'new';
          let symbol = '', industry = '';
          if(mode === 'existing'){
            symbol = (document.getElementById('watchExistingSelect')?.value || '').trim();
            if(!symbol){ showErr('یه سهم از لیست انتخاب کن'); return; }
            const all = window.Watchlist.getAll('analysis') || [];
            const found = all.find(w => w.symbol === symbol);
            if(found) industry = found.industry || '';
          } else {
            symbol = (document.getElementById('watchNewSymbol')?.value || '').trim();
            industry = (document.getElementById('watchNewIndustry')?.value || '').trim();
            if(!symbol){ showErr('اسم نماد خالی نباشه'); return; }
          }
          let period = (document.getElementById('watchPeriod')?.value || '').trim();
          let year = (document.getElementById('watchYear')?.value || '').trim();
          period = fa2en(String(period)).replace(/[^\d]/g, '');
          year = fa2en(String(year)).replace(/[^\d]/g, '');
          if(!period){ showErr('دوره رو انتخاب کن'); return; }
          if(!year){ showErr('سال رو انتخاب کن'); return; }
          const ok = window.Watchlist.add({ type: 'analysis', symbol: symbol, industry: industry, report: buildAnalysisSnapshot(), year: year, period: period });
          if(ok) modal.classList.remove('show');
        }catch(err){ showErr(err.message || 'خطا'); }
      };
    }
    modal.classList.add('show');
    setTimeout(() => document.getElementById('watchPeriod')?.focus(), 50);
  };
  function buildAnalysisSnapshot(){
    const ci = 0;
    const v = {
      revenue: val('revenue',ci), net: val('netProfit',ci), ta: val('totalAssets',ci), tl: val('totalLiab',ci), eq: val('equity',ci),
      ca: val('currentAssets',ci), nonCA: val('nonCurrentAssets',ci), cl: val('currentLiab',ci), nonCL: val('nonCurrentLiab',ci),
      cfo: val('cfo',ci), opProfit: val('opProfit',ci), grossProfit: val('grossProfit',ci), financeCost: val('financeCost',ci),
      inv: val('inventory',ci), cash: val('cash',ci), capex: val('capex',ci), deprec: val('depreciation',ci),
      opEx: val('opEx',ci), cogs: val('cogs',ci), otherOpInc: val('otherOpInc',ci),
    };
    let eqFinal = v.eq;
    if(eqFinal == null && v.ta != null && v.tl != null){ eqFinal = v.ta - v.tl; }
    let taFinal = v.ta;
    if(taFinal == null && v.ca != null && v.nonCA != null){ taFinal = v.ca + v.nonCA; }
    let tlFinal = v.tl;
    if(tlFinal == null && v.cl != null && v.nonCL != null){ tlFinal = v.cl + v.nonCL; }
    const vFixed = Object.assign({}, v, { eq: eqFinal, ta: taFinal, tl: tlFinal });
    const score = calcScore(vFixed);
    return {
      metrics: vFixed, score: score,
      period: PARSED?._detectedPeriod || PERIOD_NAMES[ci] || ('دوره ' + (ci+1)),
      parsedFull: JSON.parse(JSON.stringify(PARSED || {})),
      market: Object.assign({}, MARKET),
      savedAt: Date.now(),
    };
  }
  const cancelBtn = document.getElementById('addWatchCancel');
  if(cancelBtn) cancelBtn.onclick = () => {
    const m = document.getElementById('addWatchModal');
    if(m) m.classList.remove('show');
  };
  const modal = document.getElementById('addWatchModal');
  if(modal){
    modal.addEventListener('click', e => { if(e.target.id === 'addWatchModal') e.target.classList.remove('show'); });
  }
})();

/* ---------- Restore from External ---------- */
window.restoreFromExternal = function(reportData){
  try{
    if(!reportData) return;
    if(reportData.parsedFull){ PARSED = JSON.parse(JSON.stringify(reportData.parsedFull)); }
    else if(reportData.metrics){ showToast('اطلاعات کامل در دسترس نیست', true); return; }
    else { showToast('داده نامعتبر', true); return; }
    if(reportData.market){
      MARKET = {
        symbol: reportData.market.symbol || '', price: reportData.market.price || null,
        shares: reportData.market.shares || null,
        periodMonths: reportData.market.periodMonths || 12,
        sectorType: reportData.market.sectorType || 'normal',
        industry: reportData.market.industry || '',
      };
      window.MARKET = MARKET;
      if($('symbolName')) $('symbolName').value = MARKET.symbol;
      if($('stockPrice')) $('stockPrice').value = MARKET.price ? formatNumberInput(MARKET.price) : '';
      if($('stockCount')) $('stockCount').value = MARKET.shares ? formatNumberInput(MARKET.shares) : '';
    }

    
    const infoBox = $('periodInfoBox');
    const infoText = $('periodInfoText');
    if(infoBox && infoText){
      infoBox.style.display = 'flex';
      infoText.textContent = PARSED._detectedPeriod || 'نامشخص';
      
      // ⭐ پر کردن انتخابگرها با مقادیر خودکار
      const monthsSelect = $('periodMonthsSelect');
      const yearSelect = $('periodYearSelect');
      const badge = $('periodAutoBadge');
      
      if(monthsSelect && yearSelect){
        // ماه
        const detectedMonths = PARSED._detectedInfo?.months || 12;
        monthsSelect.value = String(detectedMonths);
        
        // سال
        const detectedYear = PARSED._detectedInfo?.year;
        if(detectedYear){
          // اگه سال توی لیست بود، انتخابش کن
          const yearStr = String(detectedYear);
          const hasYear = Array.from(yearSelect.options).some(o => o.value === yearStr);
          if(hasYear){
            yearSelect.value = yearStr;
          } else {
            // سال جدید به لیست اضافه کن
            const opt = document.createElement('option');
            opt.value = yearStr;
            opt.textContent = toFa(yearStr);
            yearSelect.appendChild(opt);
            yearSelect.value = yearStr;
          }
        }
        
        // نشون دادن وضعیت «خودکار»
        if(badge){
          badge.textContent = '✓ خودکار';
          badge.className = 'period-auto-badge';
        }
      }
    }


    if($('out')) $('out').style.display = 'block';
    if($('saveBtn')){ $('saveBtn').style.display = 'inline-block'; $('saveBtn').disabled = false; }
    if($('sendToWatchBtn')){ $('sendToWatchBtn').style.display = 'inline-block'; $('sendToWatchBtn').disabled = false; }
    render(0);
    if($('status')) $('status').textContent = '✅ بازیابی شد';
    window.scrollTo({top: $('out').offsetTop - 20, behavior: 'smooth'});
  }catch(e){
    console.error(e);
    showToast('خطا در بازیابی: ' + e.message, true);
  }
};

/* ---------- Collapsible Cards ---------- */
(function initCollapsibleCards(){
  const STORAGE_KEY = 'kodal_collapsed_cards_v1';
  function loadCollapsed(){ try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }catch(e){ return {}; } }
  function saveCollapsed(obj){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch(e){} }
  function getCardId(card){
    const h2 = card.querySelector('h2');
    if(!h2) return null;
    let text = (h2.textContent || '').trim();
    text = text.replace(/\?/g, '').replace(/\s+/g, ' ').slice(0, 60);
    return text;
  }
  function applyCollapseState(){
    const collapsed = loadCollapsed();
    document.querySelectorAll('.card').forEach(card => {
      const h2 = card.querySelector('h2');
      if(!h2) return;
      if(card.closest('#saveModal, #saveCompareModal, #addWatchModal, #saveIndustryModal, #compareIndustriesModal')) return;
      if(!h2.classList.contains('collapsible-h2')){
        h2.classList.add('collapsible-h2');
        const icon = document.createElement('span');
        icon.className = 'collapse-icon';
        icon.textContent = '▼';
        h2.insertBefore(icon, h2.firstChild);
      }
      const id = getCardId(card);
      if(!id) return;
      if(collapsed[id]){ card.classList.add('collapsed'); } else { card.classList.remove('collapsed'); }
      if(!h2.dataset.collapseReady){
        h2.dataset.collapseReady = '1';
        h2.addEventListener('click', (e) => {
          if(e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
          if(e.target.closest('button') || e.target.closest('a')) return;
          const isCollapsed = card.classList.toggle('collapsed');
          const collapsedObj = loadCollapsed();
          const cardId = getCardId(card);
          if(cardId){
            if(isCollapsed){ collapsedObj[cardId] = true; } else { delete collapsedObj[cardId]; }
            saveCollapsed(collapsedObj);
          }
        });
      }
    });
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', applyCollapseState); }
  else { applyCollapseState(); }
  const observer = new MutationObserver(() => { applyCollapseState(); });
  observer.observe(document.body, { childList: true, subtree: true });
})();

/* ---------- Refresh App ---------- */
(function initRefreshApp(){
  const btn = $('refreshAppBtn');
  if(!btn) return;
  btn.onclick = async () => {
    const ok = await KodalUI.confirm({
      title: 'به‌روزرسانی اپ', icon: '🔄', message: 'آیا آپدیت برنامه بررسی شود؟',
      confirmText: 'بله، به‌روزرسانی کن', danger: true,
    });
    if(!ok) return;
    btn.disabled = true;
    btn.textContent = '⏳ در حال بررسی آپدیت...';
    try{
      if('caches' in window){
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if('serviceWorker' in navigator){
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_t', Date.now());
        window.location.replace(url.toString());
      }, 500);
    }catch(err){
      console.error('خطا در پاک کردن کش:', err);
      btn.disabled = false;
      btn.textContent = '🔄 به‌روزرسانی اپ';
      if(window.showToast) window.showToast('خطا: ' + err.message, true);
    }
  };
})();

/* ---------- Inner Tabs ---------- */
(function initInnerTabs(){
  function bind(){
    const tabs = document.querySelectorAll('#out .inner-tab');
    const panels = document.querySelectorAll('#out .inner-panel');
    if(!tabs.length) return;
    tabs.forEach(tab => {
      if(tab.dataset.innerBound) return;
      tab.dataset.innerBound = '1';
      tab.addEventListener('click', () => {
        const target = tab.dataset.inner;
        if(!target) return;
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.querySelector(`#out .inner-panel[data-innerpanel="${target}"]`);
        if(panel) panel.classList.add('active');
        if(target === 'charts'){
          setTimeout(() => {
            if(window.PARSED && typeof window.__rebuildCharts === 'function'){ window.__rebuildCharts(); }
          }, 50);
        }
        const card = tab.closest('.card');
        if(card){
          const cardTop = card.getBoundingClientRect().top + window.pageYOffset - 20;
          window.scrollTo({ top: cardTop, behavior: 'smooth' });
        }
      });
    });
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
  const observer = new MutationObserver(() => { bind(); });
  observer.observe(document.body, { childList: true, subtree: true });
})();

/* ============================================================
   پیام‌های سازنده (Modal)
============================================================ */
window.openMessageModal = function(){
  const modal = document.getElementById('messageModal');
  if(modal) modal.classList.add('show');
};
window.closeMessageModal = function(){
  const modal = document.getElementById('messageModal');
  if(modal) modal.classList.remove('show');
};
document.addEventListener('click', (e) => {
  const modal = document.getElementById('messageModal');
  if(modal && e.target === modal){ modal.classList.remove('show'); }
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    const modal = document.getElementById('messageModal');
    if(modal && modal.classList.contains('show')){ modal.classList.remove('show'); }
  }
});

/* ============================================================
   دکمه باز/بسته کل بخش ورودی (تحلیل تک شرکت)
============================================================ */
(function initInputSectionToggle(){
  const btn = document.getElementById('inputSectionToggleBtn');
  const container = document.getElementById('allInputSections');
  const text = document.getElementById('inputSectionToggleText');
  if(!btn || !container) return;
  function applyState(collapsed){
    if(collapsed){ container.classList.add('collapsed'); if(text) text.textContent = 'باز کردن ورودی‌ها'; }
    else { container.classList.remove('collapsed'); if(text) text.textContent = 'بستن ورودی‌ها'; }
  }
  applyState(false);
  btn.onclick = () => {
    const isCollapsed = container.classList.toggle('collapsed');
    if(text) text.textContent = isCollapsed ? 'باز کردن ورودی‌ها' : 'بستن ورودی‌ها';
  };
})();


// راه‌اندازی انتخابگر دستی دوره
initPeriodEditor();
console.log('%c🎯 app.js v2.3.0 لود شد (با گروه investment کامل)', 'color:#1769e0;font-weight:bold');