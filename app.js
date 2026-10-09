/* ---------- Utility ---------- */
const $ = id => document.getElementById(id);
const fa2en = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                       .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

/* ---------- تبدیل اعداد به فارسی ---------- */
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
function toFa(input){
  if(input == null) return input;
  return String(input).replace(/[0-9]/g, d => FA_DIGITS[Number(d)]);
}

function norm(x){
  return fa2en(String(x??''))
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
  if(x==null) return null;
  let s = fa2en(String(x).trim());
  if(!s) return null;
  let neg = /^\(.*\)$/.test(s) || s.includes('−') || /^-/.test(s);
  s = s.replace(/[()−\-–—]/g,'').replace(/[٬،,]/g,'').replace(/[^\d.]/g,'');
  if(!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/* ---------- فرمت اعداد ---------- */
const money = x => x==null ? '—' : toFa(x.toLocaleString('en-US',{maximumFractionDigits:0}));

const toman = x => {
  if(x == null) return '—';
  const billionToman = x / 10000;
  if(Math.abs(billionToman) < 1){
    const millionToman = Math.round(x / 10);
    return '<bdi dir="ltr">' + toFa(millionToman.toLocaleString('en-US')) + ' M</bdi>';
  }
  const roundedBillion = Math.round(billionToman);
  return '<bdi dir="ltr">' + toFa(roundedBillion.toLocaleString('en-US')) + ' B</bdi>';
};

const tomanText = x => {
  if(x == null) return '—';
  const billionToman = x / 10000;
  if(Math.abs(billionToman) < 1){
    return toFa(Math.round(x / 10).toLocaleString('en-US')) + ' M';
  }
  return toFa(Math.round(billionToman).toLocaleString('en-US')) + ' B';
};

const pct   = x => x==null ? '—' : toFa((x*100).toFixed(1))+'٪';
const num2  = x => x==null ? '—' : toFa(x.toFixed(2));
const ratio = (a,b) => (a!=null && b!=null && b!==0) ? a/b : null;

function extractNumbers(line){
  const matches = fa2en(line).match(/[\(\（]?\s*[\-−]?\s*[\d][\d,٬،.]*\s*[\)\）]?/g) || [];
  return matches.map(toNum).filter(v => v !== null);
}

/* ---------- فرمت اعداد ورودی ---------- */
function formatNumberInput(value){
  const clean = fa2en(String(value)).replace(/[^\d]/g, '');
  if(!clean) return '';
  const withComma = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toFa(withComma);
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

/* ---------- Global Tooltip ---------- */
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

/* ---------- State ---------- */
let file = null, PARSED = null;
let MARKET = {
  symbol: '',
  price: null,
  shares: null,
  periodMonths: 12,
};

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

/* ---------- Market Input ---------- */
function loadMarketFromStorage(){
  try{
    const raw = localStorage.getItem('kodal_market');
    if(raw){
      const m = JSON.parse(raw);
      MARKET = {
        symbol: m.symbol||'',
        price: m.price||null,
        shares: m.shares||null,
        periodMonths: m.periodMonths || 12,
      };
    }
  }catch(e){}
}
function saveMarketToStorage(){
  try{
    localStorage.setItem('kodal_market', JSON.stringify(MARKET));
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
loadMarketFromStorage();

setTimeout(() => {
  if(MARKET.symbol && $('symbolName')) $('symbolName').value = MARKET.symbol;
  if(MARKET.price && $('stockPrice')) $('stockPrice').value = formatNumberInput(MARKET.price);
  if(MARKET.shares && $('stockCount')) $('stockCount').value = formatNumberInput(MARKET.shares);
  if(MARKET.price && $('marketHint')){
    $('marketHint').textContent = `✅ اطلاعات بازار از قبل ذخیره شده${MARKET.symbol ? ' — '+MARKET.symbol : ''}`;
    $('marketHint').classList.add('active');
  }
}, 100);

attachNumberFormatter($('stockPrice'));
attachNumberFormatter($('stockCount'));

['symbolName','stockPrice','stockCount'].forEach(id => {
  const el = $(id);
  if(!el) return;
  let timer;
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if(MARKET.price || MARKET.shares || MARKET.symbol){
        applyMarketInputs();
      }
    }, 800);
  });
  el.addEventListener('change', () => {
    clearTimeout(timer);
    applyMarketInputs();
  });
  el.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      clearTimeout(timer);
      applyMarketInputs();
    }
  });
});

/* ---------- Saved (localStorage) ---------- */
const STORAGE_KEY = 'kodal_analyses_v1';
let STORAGE_AVAILABLE = false;

(function testStorage(){
  try{
    const k = '__test__' + Date.now();
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    STORAGE_AVAILABLE = true;
  }catch(e){
    STORAGE_AVAILABLE = false;
  }
})();

function loadFromStorage(){
  if(!STORAGE_AVAILABLE) return [];
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveToStorage(list){
  if(!STORAGE_AVAILABLE) return false;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  }catch(e){
    if(e.name === 'QuotaExceededError'){
      showToast('⚠️ حافظه مرورگر پر شده — قدیمی‌ها رو حذف کن', true);
    }
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
    box.innerHTML = '<div class="saved-empty">هنوز تحلیلی ذخیره نکردی. بعد از تحلیل، دکمه «💾 ذخیره تحلیل» رو بزن.</div>';
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
    box.innerHTML = '<div class="saved-empty">نتیجه‌ای برای جستجو پیدا نشد.</div>';
    return;
  }

  box.innerHTML = indexed.map(item => {
    const idx = item._idx;
    const starred = item.starred ? 'on' : 'off';
    const starIcon = item.starred ? '★' : '☆';
    return `
      <div class="saved-item ${item.starred ? 'starred' : ''}">
        <div class="name">
          <span class="star ${starred}" onclick="toggleStar(${idx})" title="ستاره‌دار">${starIcon}</span>
          <span>${item.name}</span>
          <span class="edit-name" onclick="editName(${idx})" title="ویرایش اسم">✏️</span>
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

window.editName = function(idx){
  if(!SAVED_LIST[idx]) return;
  const current = SAVED_LIST[idx].name;
  const newName = prompt('اسم جدید:', current);
  if(newName && newName.trim()){
    SAVED_LIST[idx].name = newName.trim();
    saveToStorage(SAVED_LIST);
    renderSaved();
    showToast('✅ اسم عوض شد');
  }
};

document.addEventListener('input', (e) => {
  if(e.target.id === 'savedSearch') renderSaved();
});
document.addEventListener('change', (e) => {
  if(e.target.id === 'savedSort') renderSaved();
});

window.deleteAnalysis = function(idx){
  if(!confirm('این تحلیل حذف بشه؟')) return;
  SAVED_LIST.splice(idx, 1);
  saveToStorage(SAVED_LIST);
  renderSaved();
};

window.restoreAnalysis = function(idx){
  const item = SAVED_LIST[idx];
  if(!item) return;
  try{
    PARSED = JSON.parse(JSON.stringify(item.parsed));
    PARSED._periods = item.periods || 3;
    if(item.market){
      MARKET = {
        symbol: item.market.symbol||'',
        price: item.market.price||null,
        shares: item.market.shares||null,
        periodMonths: item.market.periodMonths || 12,
      };
      if($('symbolName')) $('symbolName').value = MARKET.symbol;
      if($('stockPrice')) $('stockPrice').value = MARKET.price ? formatNumberInput(MARKET.price) : '';
      if($('stockCount')) $('stockCount').value = MARKET.shares ? formatNumberInput(MARKET.shares) : '';
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
    $('pdfBtn').style.display = 'inline-block';

    const watchBtn = $('sendToWatchBtn');
    if(watchBtn){
      watchBtn.style.display = 'inline-block';
      watchBtn.disabled = false;
    }

    render(0);
    $('status').textContent = '✅ تحلیل بازیابی شد: ' + item.name;
    window.scrollTo({top: $('out').offsetTop - 20, behavior: 'smooth'});
  }catch(e){ alert('خطا در بازیابی: ' + e.message); }
};

function downloadAllAnalyses(){
  if(!SAVED_LIST.length){
    showToast('لیست خالیه', true);
    return;
  }
  const data = {
    version: '40',
    exportDate: new Date().toISOString(),
    count: SAVED_LIST.length,
    analyses: SAVED_LIST,
  };
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
  showToast('📥 فایل دانلود شد');
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
      if(SAVED_LIST.length > 50) SAVED_LIST.length = 50;
      saveToStorage(SAVED_LIST);
      renderSaved();
      showToast(`✅ ${toFa(added)} تحلیل اضافه شد (مجموع: ${toFa(SAVED_LIST.length)})`);
    }catch(err){
      showToast('خطا در خواندن فایل: ' + err.message, true);
    }
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

if($('saveConfirm')) $('saveConfirm').onclick = () => {
  const name = ($('saveNameInput').value || '').trim();
  if(!name){ showToast('اسم خالی نباشه', true); return; }
  try{
    SAVED_LIST.unshift({
      name: name,
      date: toFa(new Date().toLocaleString('fa-IR')),
      parsed: JSON.parse(JSON.stringify(PARSED)),
      periods: PARSED._periods,
      starred: false,
      market: {...MARKET},
    });
    if(SAVED_LIST.length > 50) SAVED_LIST.length = 50;
    const saved = saveToStorage(SAVED_LIST);
    renderSaved();
    closeSaveModal();
    showToast(saved ? '✅ ذخیره شد!' : '✅ ذخیره شد! برای نگه‌داری دکمه 📥 دانلود رو بزن');
  }catch(e){
    showToast('خطا: ' + e.message, true);
  }
};
if($('saveNameInput')) $('saveNameInput').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') $('saveConfirm').click();
  if(e.key === 'Escape') closeSaveModal();
});
if($('saveModal')) $('saveModal').addEventListener('click', (e) => {
  if(e.target.id === 'saveModal') closeSaveModal();
});

/* ---------- File input (تک شرکت) ---------- */
function showFileInfo(f){
  if(!f) return;
  const info = $('fileInfo');
  const nameEl = $('fileName');
  if(info && nameEl){
    nameEl.textContent = f.name;
    info.classList.add('active');
  }
}
function hideFileInfo(){
  const info = $('fileInfo');
  if(info) info.classList.remove('active');
}

if($('file')) $('file').onchange = e => {
  file = e.target.files[0];
  $('go').disabled = !file;
  $('saveBtn').disabled = true;
  if(file){
    showFileInfo(file);
  } else {
    hideFileInfo();
  }
  $('err').style.display = 'none';
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
    $('go').disabled = false;
    $('saveBtn').disabled = true;
    showFileInfo(f);
    $('err').style.display = 'none';
  });
}

/* ---------- File parser ---------- */
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

/* ---------- Item detection ---------- */
const LABELS = {
  revenue:          [/درامدهای\s*عملیاتی/, /درامد\s*عملیاتی/, /فروش\s*خالص/, /عملیات\s*در\s*حال\s*تداوم.*درامد/, /درامد\s*حاصل\s*از\s*فروش/],
  cogs:             [/بهای?\s*تمام\s*شده\s*درامد/, /بهای?\s*تمام\s*شده/, /بهای?\s*تمام\s*شده\s*کالای\s*فروش/],
  grossProfit:      [/سود.*ناخالص/, /سود\s*ناخالص/],
  opEx:             [/هزینه.*فروش.*اداری/, /هزینه.*ادارى/, /هزینه.*فروش/],
  otherOpInc:       [/سایر\s*درامدها(?!\s*و\s*هزینه\s*غیر)/],
  opProfit:         [/سود.*عملیاتی/, /سود\s*عملیاتی/],
  financeCost:      [/هزینه.*مالی/, /هزینه.*مالى/],
  otherNonOp:       [/سایر\s*درامدها\s*و\s*هزینه.*غیرعملیاتی/, /سایر\s*درامدها\s*و\s*هزینه/],
  profitBeforeTax:  [/سود.*قبل\s*از\s*مالیات/],
  tax:              [/هزینه\s*مالیات/],
  netProfit:        [/^سود.*خالص$/, /^سود.*خالص\s*$/, /سود.*خالص(?!.*سهام)/],
  eps:              [/سود.*خالص\s*هر\s*سهم/, /سود.*هر\s*سهم/],
  capital:          [/^سرمایه$/, /^سرمايه$/, /سرمایه\s*ثبت/, /سرمایه\s*شرکت/, /^capital$/, /^سرمایه\s*اسمی$/, /سرمایه$/, /^سرمايه\s*ثبت/],
  nonCurrentAssets: [/^جمع\s*دارایی.*غیرجاری/, /^جمع\s*دارايي.*غيرجاري/],
  currentAssets:    [/^جمع\s*دارایی.*جاری/, /^جمع\s*دارايي.*جاري/],
  totalAssets:      [/^جمع\s*دارایی/, /^جمع\s*دارايي/],
  inventory:        [/^موجودی\s*مواد\s*و\s*کالا/, /^موجودي\s*مواد\s*و\s*کالا/],
  receivables:      [/^دریافتنی.*تجاری/, /^دريافتني.*تجاري/],
  cash:             [
    /^موجودی\s*نقد(\s*\|[\s\S]*)?$/,
    /^موجودي\s*نقد(\s*\|[\s\S]*)?$/,
    /^موجودی\s*نقد\s*و\s*بانک/,
    /^موجودي\s*نقد\s*و\s*بانک/,
    /^موجودی\s*نقد\s*و\s*معادل/,
    /^موجودي\s*نقد\s*و\s*معادل/,
    /^نقد\s*و\s*بانک/,
    /^نقد\s*و\s*معادل\s*نقد/,
    /^موجودی\s*نقدی/,
    /^موجودي\s*نقدي/,
    /^وجه\s*نقد/,
  ],
  shortTermInv:     [/^سرمایه.?گذاری.*کوتاه/, /^سرمايه.?گذاري.*کوتاه/],
  nonCurrentLiab:   [/^جمع\s*بدهی.*غیرجاری/, /^جمع\s*بدهي.*غيرجاري/],
  currentLiab:      [
    /^جمع\s*بدهی.*جاری/, /^جمع\s*بدهي.*جاري/,
    /^جمع\s*بدهی\s*جاری/, /^جمع\s*بدهی‌های\s*جاری/,
    /^بدهی‌های\s*جاری/, /^بدهي\s*هاي\s*جاري/,
  ],
  totalLiab:        [/^جمع\s*بدهی/, /^جمع\s*بدهي/],
  equity:           [/^جمع\s*حقوق\s*مالکانه/, /^جمع\s*حقوق\s*صاحبان\s*سهام/, /^جمع\s*حقوق\s*مالکانه\s*و\s*بدهی/],
  retainedEarnings: [/^سود.*انباشته/, /^سود.*انباشته/],
  longTermDebt:     [/^تسهیلات\s*مالی\s*بلندمدت/, /^پرداختنی.*بلندمدت/],
  cfo:              [/جریان.*خالص.*نقد.*فعالیت.*عملیاتی/, /جریان.*نقد.*عملیاتی/, /جریان\s*خالص\s*ورود.*نقد/],
  cfi:              [/جریان.*خالص.*نقد.*فعالیت.*سرمایه.?گذاری/],
  cff:              [/جریان.*خالص.*نقد.*فعالیت.*تامین\s*مالی/, /جریان.*خالص.*نقد.*فعالیت.*تأمین\s*مالی/],
  capex:            [/پرداخت.*خرید\s*دارایی.*ثابت/],
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
  let filtered = nums.filter(v => Math.abs(v) >= 1);
  if(filtered.length < periods){
    filtered = nums.filter(v => v != null);
  }
  if(filtered.length <= periods){
    return filtered.slice(0, periods);
  }

  if(preferLargest){
    let bestStart = 0;
    let bestSum = -Infinity;
    for(let s = 0; s <= filtered.length - periods; s++){
      const group = filtered.slice(s, s + periods);
      const sum = group.reduce((a,b) => a + Math.abs(b), 0);
      if(sum > bestSum){
        bestSum = sum;
        bestStart = s;
      }
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

/* ---------- تشخیص دوره صورت مالی از محتوای فایل ---------- */
function detectPeriodFromLines(lines){
  const text = lines.join(' ');
  const normalized = fa2en(text)
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
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
  if(detectedMonths && detectedYear){
    label = `${toFa(detectedMonths)} ماهه سال ${toFa(detectedYear)}`;
  } else if(detectedMonths){
    label = `${toFa(detectedMonths)} ماهه`;
  } else if(detectedYear){
    label = `سال مالی ${toFa(detectedYear)}`;
  }

  console.log('🔍 detectPeriodFromLines:', { detectedDate, detectedYear, detectedMonths, label });

  return {
    label: label,
    year: detectedYear,
    months: detectedMonths,
  };
}

function parseItems(lines){
  const items = {};
  const periods = 3;
  for(const line of lines){
    const key = matchLabel(line);
    if(!key) continue;
    const nums = extractNumbers(line);
    if(!nums.length) continue;

    let filtered;
    if(key === 'eps'){
      filtered = nums.slice(0, periods).filter(v => Math.abs(v) < 1e6);
    } else if(key === 'capital'){
      filtered = nums.slice(0, periods);
    } else if(key === 'cash'){
      filtered = extractBestValues(nums, periods, true);
    } else {
      filtered = extractBestValues(nums, periods, false);
    }

    if(!items[key]) items[key] = [];
    for(let i=0;i<filtered.length;i++){
      if(items[key][i] === undefined || items[key][i] === null) items[key][i] = filtered[i];
    }
  }
  return items;
}

const HINTS = {
  'نسبت جاری': 'نشان می‌دهد شرکت چقدر می‌تواند بدهی‌های کوتاه‌مدتش را با دارایی‌های کوتاه‌مدتش بپردازد. بالای ۱ خوب، بالای ۲ عالی، زیر ۱ یعنی خطر.',
  'نسبت آنی (Quick)': 'مثل نسبت جاری ولی موجودی انبار را حساب نمی‌کند. بالای ۱ خوب، زیر ۰.۷ یعنی خطر.',
  'نسبت نقد': 'فقط پول نقد را در برابر بدهی کوتاه‌مدت می‌سنجد. بالای ۰.۲ خوب، زیر ۰.۱ یعنی ریسک.',
  'سرمایه در گردش': 'دارایی جاری منهای بدهی جاری. مثبت = شرکت پول کافی داره، منفی = مشکل.',
  'بدهی به دارایی': 'چند درصد دارایی‌ها از بدهی تأمین شده. زیر ۵۰٪ خوب، بالای ۷۰٪ خطر.',
  'بدهی به حقوق صاحبان سهام': 'در برابر هر ۱ واحد پول سهامداران، شرکت چقدر بدهی دارد. زیر ۱ عالی، بالای ۲ ریسکی.',
  'پوشش بهره': 'شرکت چند برابر سود عملیاتی‌اش هزینه بهره را می‌دهد. بالای ۳ خوب، زیر ۲ خطر.',
  'اهرم حقوق مالکانه': 'کل دارایی تقسیم بر سرمایه سهامداران. زیر ۲ خوب، بالای ۴ ریسکی.',
  'حاشیه سود ناخالص': 'از هر ۱۰۰ تومان فروش، چقدر بعد از کسر هزینه مواد و تولید باقی می‌ماند.',
  'حاشیه سود عملیاتی': 'از هر ۱۰۰ تومان فروش، چقدر بعد از کسر هزینه‌های عملیاتی می‌ماند.',
  'حاشیه سود خالص': 'از هر ۱۰۰ تومان فروش، در نهایت چقدر سود خالص می‌ماند. بالای ۲۰٪ عالی، زیر ۵٪ ضعیف.',
  'ROA': 'بازده دارایی‌ها: به ازای هر ۱ تومان دارایی، چقدر سود ساخته شده. بالای ۵٪ خوب.',
  'ROE': 'بازده حقوق صاحبان سهام: بالای ۱۵٪ خوب، بالای ۲۰٪ عالی.',
  'گردش دارایی': 'به ازای هر ۱ تومان دارایی، چقدر فروش ساخته شده. بالاتر = استفاده بهتر.',
  'گردش موجودی': 'در سال چند بار انبار چرخیده و فروش رفته. بالاتر = سریع‌تر.',
  'گردش مطالبات': 'در سال چند بار طلب‌ها وصول شده. بالاتر = وصول سریع‌تر.',
  'دوره وصول مطالبات (روز)': 'میانگین روزهای وصول طلب. کمتر بهتر. بالای ۹۰ روز یعنی کند.',
  'جریان نقد عملیاتی / سود خالص': 'آیا سود دفتری، نقد هم هست؟ بالای ۱ عالی، زیر ۰.۵ یعنی سود روی کاغذ.',
  'کیفیت سود (CFO/Net)': 'معیار اینکه سود واقعی است یا حسابداری. بالاتر بهتر.',
  'آزاد FCF': 'پولی که بعد از هزینه‌های نگهداری کار باقی می‌ماند. مثبت = پول می‌سازد، منفی = نیازمند تأمین مالی.',
  'CFO به درآمد': 'چند درصد فروش به پول نقد تبدیل شده. بالاتر = کسب‌وکار نقدی‌تر.',
  'P/E': 'قیمت به درآمد: چند برابر سود سالانه، سهام معامله می‌شه. زیر ۵ ارزنده، بالای ۱۵ گرون.',
  'P/B': 'قیمت به ارزش دفتری: چند برابر ارزش دفتری، سهام معامله می‌شه. زیر ۱ یعنی زیر ارزش دفتری.',
  'P/S': 'قیمت به فروش: چند برابر فروش سالانه، ارزش شرکت گذاشته شده. زیر ۱ خوب، بالای ۳ گرون.',
  'EPS': 'سود هر سهم (ریال): به ازای هر سهم، چقدر سود ساخته شده.',
  'ارزش بازار': 'کل ارزش شرکت توی بورس (قیمت × تعداد سهام) — به ریال.',
  'EV/EBITDA': 'ارزش شرکت به EBITDA: زیر ۶ ارزنده، بالای ۱۲ گرون.',
};

/* ---------- SVG Charts ---------- */
function chartTextColor(){ return document.body.classList.contains('dark') ? '#94a3b8' : '#64748b'; }
function chartLineColor(){ return document.body.classList.contains('dark') ? '#334155' : '#e2e8f0'; }
function chartBaseColor(){ return document.body.classList.contains('dark') ? '#475569' : '#cbd5e1'; }
function chartLabelColor(){ return document.body.classList.contains('dark') ? '#cbd5e1' : '#475569'; }

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
  const roe = ratio(v.net, v.eq);
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

/* ---------- DuPont ---------- */
function renderDuPont(v){
  const nm = ratio(v.net, v.revenue);
  const at = ratio(v.revenue, v.ta);
  const em = ratio(v.ta, v.eq);
  const roe = ratio(v.net, v.eq);

  const noteEl = $('dupontNote');

  if(nm == null || at == null || em == null){
    const items = [['درآمد', v.revenue],['سود خالص', v.net],['جمع دارایی‌ها', v.ta],['حقوق مالکانه', v.eq]];
    const missing = items.filter(x => x[1] == null).map(x => x[0]);
    $('dupontBox').innerHTML = `<div class="err" style="display:block">اطلاعات کافی برای DuPont نیست.<br><b>اقلام ناموجود:</b> ${missing.length ? missing.join('، ') : 'همه موجودن'}</div>`;
    if(noteEl) noteEl.innerHTML = '';
    return;
  }

  $('dupontBox').innerHTML = `
    <div class="dupont">
      <div class="dupont-box"><span class="lbl">حاشیه سود خالص</span><span class="val">${pct(nm)}</span></div>
      <div class="dupont-op">×</div>
      <div class="dupont-box"><span class="lbl">گردش دارایی</span><span class="val">${num2(at)}</span></div>
      <div class="dupont-op">×</div>
      <div class="dupont-box"><span class="lbl">اهرم مالی</span><span class="val">${num2(em)}</span></div>
      <div class="dupont-op">=</div>
      <div class="dupont-box dupont-result"><span class="lbl">ROE</span><span class="val">${pct(roe)}</span></div>
    </div>
  `;

  let note = '';
  const nmHigh = nm > 0.15;
  const atHigh = at > 0.8;
  const emHigh = em > 3;

  if(nmHigh && atHigh){
    note = '🌟 شرکت هم محصولش رو گرون می‌فروشه (سود بالا)، هم سریع می‌فروشه (گردش بالا). این یعنی کسب‌وکار قوی.';
  } else if(nmHigh && !atHigh){
    note = '💰 شرکت محصول گرون می‌فروشه و سود خوبی می‌گیره، ولی فروشش کمه. مثل فروشگاه‌های لوکس.';
  } else if(!nmHigh && atHigh){
    note = '🚀 شرکت با سود کم ولی فروش زیاد پول درمیاره. مثل سوپرمارکت‌ها که حاشیه سود کمی دارن ولی فروششون زیاده.';
  } else {
    note = '😐 نه سود خوبی داره نه فروش سریعی. باید بررسی کنی چرا شرکت سود نمی‌سازه.';
  }

  if(emHigh && roe != null){
    note += ' ⚠️ نکته: یه بخشی از سود شرکت از پول قرض (بدهی) میاد، نه از خود کسب‌وکار.';
  }

  if(noteEl) noteEl.innerHTML = note;
}

/* ---------- کیفیت سود (تفکیک سود عملیاتی) ---------- */
function renderOperatingQuality(v){
  const box = $('operatingQualityBox');
  const noteEl = $('operatingQualityNote');
  if(!box) return;

  const revenue = v.revenue;
  const cogs = v.cogs;
  const opEx = v.opEx;
  const opProfit = v.opProfit;

  if(revenue == null || opProfit == null){
    box.innerHTML = '<div class="err" style="display:block">برای محاسبه کیفیت سود، درآمد و سود عملیاتی لازم است.</div>';
    if(noteEl) noteEl.innerHTML = '';
    return;
  }

  const realOpProfit = (cogs != null && opEx != null)
    ? (revenue - Math.abs(cogs) - Math.abs(opEx))
    : null;

  const otherInc = (realOpProfit != null) ? (opProfit - realOpProfit) : null;

  const otherShare = (otherInc != null && opProfit !== 0)
    ? (otherInc / opProfit)
    : null;

  const otherToRev = (otherInc != null && revenue !== 0)
    ? (otherInc / revenue)
    : null;

  let otherClass = 'other';
  if(otherToRev != null && otherToRev > 0.5) otherClass = 'other bad';

  let html = '<div class="qual-grid">';
  html += `
    <div class="qual-box real">
      <h4>✅ سود عملیاتی خالص</h4>
      <div class="qual-val">${toman(realOpProfit)}</div>
      <div class="qual-sub">درآمد − بهای تمام شده − هزینه‌های عملیاتی<br>(فقط از عملیات اصلی)</div>
    </div>
    <div class="qual-box ${otherClass}">
      <h4>${otherToRev != null && otherToRev > 0.3 ? '⚠️' : '📊'} سایر درآمدها</h4>
      <div class="qual-val">${toman(otherInc)}</div>
      <div class="qual-sub">سود سهام، فروش دارایی، سود سپرده و...<br>(تکرارپذیری کمتر)</div>
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
          <div class="qual-bar-title">ترکیب سود عملیاتی (سهم از کل):</div>
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
  if(otherInc == null){
    note = 'اطلاعات کافی برای تفکیک سود عملیاتی موجود نیست.';
  } else if(otherToRev != null && otherToRev > 0.5){
    note = `🚨 <b>هشدار جدی:</b> سایر درآمدها (${toman(otherInc)}) بیش از <b>۵۰٪ درآمد عملیاتی</b> است. یعنی بخش عمده‌ای از سود شرکت از <b>فعالیت اصلی</b> نمیاد. احتمالاً سود سهام شرکت‌های تابعه، فروش دارایی‌ها یا سود سپرده‌های بانکی. این سود <b>پایدار نیست</b> و باید با احتیاط بررسی بشه.`;
  } else if(otherToRev != null && otherToRev > 0.3){
    note = `⚠️ <b>توجه:</b> سایر درآمدها (${toman(otherInc)}) حدود <b>${toFa((otherToRev*100).toFixed(0))}٪ درآمد عملیاتی</b> است. بخش قابل توجهی از سود از عملیات اصلی نمیاد. در تحلیل بنیادی، این سود باید جداگانه بررسی بشه.`;
  } else if(otherToRev != null && otherToRev > 0){
    note = `✅ بخش عمده سود عملیاتی (${toFa((100 - (otherShare||0)*100).toFixed(0))}٪) از <b>عملیات اصلی</b> میاد که نشون‌دهنده پایداری سود است.`;
  } else if(otherInc != null && otherInc < 0){
    note = `📊 سایر درآمدها منفی است (${toman(otherInc)}) که نشان می‌دهد شرکت هزینه‌های غیرعملیاتی داشته. این می‌تونه از فروش دارایی با زیان یا سایر موارد باشه.`;
  } else {
    note = 'اطلاعات کافی برای تحلیل کیفیت سود موجود نیست.';
  }

  noteEl.innerHTML = note;
}

/* ---------- EBITDA ---------- */
function renderEBITDA(v){
  const dep = v.deprec, op = v.opProfit;
  const ebitda = (op != null) ? (op + (dep != null ? Math.abs(dep) : 0)) : null;
  const margin = ratio(ebitda, v.revenue);
  let html = '<div class="grid">';
  html += `<div class="metric"><span>حاشیه EBITDA</span><b>${pct(margin)}</b></div>`;
  html += `<div class="metric"><span>EBITDA</span><b>${toman(ebitda)}</b></div>`;
  html += `<div class="metric"><span>سود عملیاتی</span><b>${toman(op)}</b></div>`;
  html += `<div class="metric"><span>استهلاک</span><b>${toman(dep)}</b></div>`;
  html += '</div>';
  $('ebitdaBox').innerHTML = html;

  const noteEl = $('ebitdaNote');
  if(!noteEl) return;

  let note = '';
  if(margin == null){
    note = 'اطلاعات کافی برای محاسبه EBITDA نیست.';
  } else if(margin > 0.25){
    note = `💚 حاشیه EBITDA ${pct(margin)} — سودآوری نقدی قوی. شرکت از هر ۱۰۰ تومان فروش، ${toFa((margin*100).toFixed(0))} تومان سود نقدی قبل از استهلاک می‌سازد.`;
  } else if(margin > 0.15){
    note = `💚 حاشیه EBITDA ${pct(margin)} — سودآوری نقدی مناسب.`;
  } else if(margin > 0.08){
    note = `🟡 حاشیه EBITDA ${pct(margin)} — سودآوری نقدی متوسط.`;
  } else if(margin > 0){
    note = `⚠️ حاشیه EBITDA ${pct(margin)} — پایین؛ ساختار هزینه‌ها سنگین است.`;
  } else {
    note = `🚨 حاشیه EBITDA منفی — شرکت حتی قبل از استهلاک هم ضرر می‌دهد.`;
  }

  if(dep == null){
    note += ' (استهلاک در فایل نبود؛ فقط با سود عملیاتی حساب شد.)';
  }

  noteEl.innerHTML = note;
}

/* ---------- Z-Score ---------- */
function renderZScore(v){
  const ta = v.ta;
  if(ta == null || ta === 0){
    $('zscoreBox').innerHTML = '<div class="err" style="display:block">جمع دارایی موجود نیست.</div>';
    return;
  }
  const wc = (v.ca != null && v.cl != null) ? (v.ca - v.cl) : null;
  const x1 = wc != null ? wc / ta : 0;
  const x2 = v.re != null ? v.re / ta : 0;
  const x3 = v.opProfit != null ? v.opProfit / ta : 0;
  const x4 = v.eq != null ? v.eq / Math.max(v.tl || 0, 1) : 0;
  const x5 = v.revenue != null ? v.revenue / ta : 0;
  const z = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;
  let zone, color, desc;
  if(z > 2.99){
    zone = 'منطقه امن ✅';
    color = '#16834a';
    desc = `💚 Z-Score ${num2(z)} — شرکت از نظر مالی سالم است و ریسک ورشکستگی پایینی دارد.`;
  } else if(z >= 1.81){
    zone = 'منطقه خاکستری 🟡';
    color = '#eab308';
    desc = `🟡 Z-Score ${num2(z)} — وضعیت شرکت نامشخص است؛ باید با احتیاط بررسی شود.`;
  } else {
    zone = 'منطقه خطر 🚨';
    color = '#c62828';
    desc = `🔴 Z-Score ${num2(z)} — ریسک ورشکستگی بالاست؛ نیاز به بررسی جدی ساختار مالی دارد.`;
  }
  const pos = Math.max(0, Math.min(100, (z / 4) * 100));

  $('zscoreBox').innerHTML = `
    <div class="zscore-wrap">
      <div class="zscore-num" style="color:${color}">${num2(z)}</div>
      <div class="zscore-zone" style="color:${color}">${zone}</div>
      <div class="zscore-bar">
        <div class="zscore-marker" style="left:${pos}%"></div>
      </div>
      <div class="zscore-ticks">
        <span>۰</span><span>۱.۸۱</span><span>۲.۹۹</span><span>۴+</span>
      </div>
      <div class="zscore-note" style="border-right-color:${color}">${desc}</div>
    </div>
  `;
}

/* ---------- Main ---------- */
const PERIOD_NAMES = ['دوره جاری','دوره مشابه سال قبل','سال مالی قبل','دوره ۴','دوره ۵'];
window.PERIOD_NAMES = PERIOD_NAMES;

if($('go')) $('go').onclick = async () => {
  try{
    if(!file){ return; }

    if(window.License){
      const status = window.License.getStatus();
      if(status.state !== 'active'){
        window.License.open();
        showToast('لایسنس فعال نیست یا اعتبار تموم شده', true);
        return;
      }
      const res = window.License.consumeUpload();
      if(res.error){
        showToast(res.error, true);
        window.License.open();
        return;
      }
      window.License.updateIndicator();
    }

    $('status').textContent = 'در حال خواندن و تجزیه فایل...';
    $('err').style.display = 'none';
    const lines = await getLines(file);
    if(!lines.length) throw Error('هیچ خطی استخراج نشد.');
    PARSED = parseItems(lines);
    const found = Object.keys(PARSED).length;
    if(!found) throw Error('هیچ قلمی شناسایی نشد.');
    PARSED._detectedInfo = detectPeriodFromLines(lines);
    PARSED._detectedPeriod = PARSED._detectedInfo.label;
    if(PARSED._detectedInfo.months){
      MARKET.periodMonths = PARSED._detectedInfo.months;
      saveMarketToStorage();
    }
    const maxPer = Math.max(...Object.values(PARSED).map(a => a.length));
    PARSED._periods = Math.min(Math.max(maxPer,1), 5);
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
    $('pdfBtn').style.display = 'inline-block';

    const watchBtn = $('sendToWatchBtn');
    if(watchBtn){
      watchBtn.style.display = 'inline-block';
      watchBtn.disabled = false;
    }

    if($('stockPrice') && ($('stockPrice').value || $('stockCount').value)){
      applyMarketInputs();
    }

    render(0);
    $('status').textContent = `تجزیه انجام شد ✅ (${toFa(found)} قلم شناسایی شد)`;
  }catch(e){
    console.error(e);
    $('err').style.display = 'block';
    $('err').textContent = 'خطا: ' + e.message;
    $('status').textContent = 'تحلیل انجام نشد.';
  }
};

function val(k, i){ return PARSED?.[k]?.[i] ?? null; }

function render(ci){
  const v = {
    revenue: val('revenue',ci), cogs: val('cogs',ci), gross: val('grossProfit',ci),
    opEx: val('opEx',ci), opProfit: val('opProfit',ci), financeCost: val('financeCost',ci),
    otherNonOp: val('otherNonOp',ci), pbt: val('profitBeforeTax',ci), tax: val('tax',ci),
    net: val('netProfit',ci), eps: val('eps',ci), capital: val('capital',ci),
    nonCA: val('nonCurrentAssets',ci), ca: val('currentAssets',ci), ta: val('totalAssets',ci),
    inv: val('inventory',ci), recv: val('receivables',ci), cash: val('cash',ci), sti: val('shortTermInv',ci),
    nonCL: val('nonCurrentLiab',ci), cl: val('currentLiab',ci), tl: val('totalLiab',ci),
    eq: val('equity',ci), re: val('retainedEarnings',ci), ltd: val('longTermDebt',ci),
    cfo: val('cfo',ci), cfi: val('cfi',ci), cff: val('cff',ci), capex: val('capex',ci),
    deprec: val('depreciation',ci),
  };
  $('metrics').innerHTML = [
    ['درآمد عملیاتی', toman(v.revenue)],
    ['سود ناخالص',   toman(v.gross)],
    ['سود عملیاتی',  toman(v.opProfit)],
    ['سود خالص',      toman(v.net)],
    ['جمع دارایی‌ها',  toman(v.ta)],
    ['جمع بدهی‌ها',    toman(v.tl)],
    ['حقوق مالکانه',  toman(v.eq)],
    ['جریان نقد عملیاتی', toman(v.cfo)],
  ].map(([k,val]) => `<div class="metric"><span>${k}</span><b>${val}</b></div>`).join('');
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
  const periods = PARSED._periods;
  const periodLabels = [];
  for(let i=0;i<periods;i++) periodLabels.push(PERIOD_NAMES[i]||('دوره '+(i+1)));
  $('barChart').innerHTML = buildBarChart([
    {name:'درآمد', color:'#1769e0', values: (PARSED.revenue||[]).slice(0,periods)},
    {name:'سود ناخالص', color:'#f59e0b', values: (PARSED.grossProfit||[]).slice(0,periods)},
    {name:'سود عملیاتی', color:'#8b5cf6', values: (PARSED.opProfit||[]).slice(0,periods)},
    {name:'سود خالص', color:'#10b981', values: (PARSED.netProfit||[]).slice(0,periods)},
  ], periodLabels);
  $('cfoChart').innerHTML = buildBarChart([
    {name:'CFO', color:'#0ea5e9', values: (PARSED.cfo||[]).slice(0,periods)},
  ], periodLabels);
  $('pieAssets').innerHTML = buildPieChart([
    {label:'دارایی جاری', value: v.ca, color:'#10b981'},
    {label:'دارایی غیرجاری', value: v.nonCA, color:'#ef4444'},
  ]);
  $('pieFunding').innerHTML = buildPieChart([
    {label:'بدهی‌ها', value: v.tl, color:'#ef4444'},
    {label:'حقوق مالکانه', value: v.eq, color:'#10b981'},
  ]);

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

  const eps = (netRial != null && shares != null && shares !== 0) ? netRial / shares : null;
  const pe = (price != null && eps != null && eps !== 0) ? price / eps : null;
  const pb = (marketCap != null && eqRial != null && eqRial !== 0) ? marketCap / eqRial : null;
  const ps = (marketCap != null && revRial != null && revRial !== 0) ? marketCap / revRial : null;
  const ev = (marketCap != null) ? (marketCap + (tlRial || 0) - (cashRial || 0)) : null;
  const evEbitda = (ev != null && ebitdaRial != null && ebitdaRial !== 0) ? ev / ebitdaRial : null;

  const R = {
    liq: [
      ['نسبت جاری',        ratio(v.ca, v.cl),                       x=>x<1, x=>x>=1&&x<2],
      ['نسبت آنی (Quick)', ratio((v.ca??0)-(v.inv??0), v.cl),        x=>x<0.7, x=>x>=0.7&&x<1],
      ['نسبت نقد',          ratio(v.cash, v.cl),                     x=>x<0.1, x=>x>=0.1&&x<0.3],
      ['سرمایه در گردش',   (v.ca!=null&&v.cl!=null)?(v.ca-v.cl):null, x=>x<0, ()=>false],
    ],
    lev: [
      ['بدهی به دارایی',              ratio(v.tl, v.ta),              x=>x>0.7, x=>x>0.5&&x<=0.7],
      ['بدهی به حقوق صاحبان سهام',   ratio(v.tl, v.eq),              x=>x>2,  x=>x>1&&x<=2],
      ['پوشش بهره',                   ratio(v.opProfit, Math.abs(v.financeCost||0)) || null, x=>x<2, x=>x>=2&&x<4],
      ['اهرم حقوق مالکانه',           ratio(v.ta, v.eq),              x=>x>4,  x=>x>2&&x<=4],
    ],
    prof: [
      ['حاشیه سود ناخالص',  ratio(v.gross, v.revenue),  x=>x<0.1, x=>x<0.2],
      ['حاشیه سود عملیاتی', ratio(v.opProfit, v.revenue), x=>x<0.05, x=>x<0.15],
      ['حاشیه سود خالص',    ratio(v.net, v.revenue),    x=>x<0.05, x=>x<0.1],
      ['ROA',               ratio(v.net, v.ta),          x=>x<0.02, x=>x<0.05],
      ['ROE',               ratio(v.net, v.eq),          x=>x<0.05, x=>x<0.15],
    ],
    eff: [
      ['گردش دارایی',       ratio(v.revenue, v.ta),       x=>x<0.3, x=>x<0.6],
      ['گردش موجودی',       ratio(v.cogs, v.inv),         x=>x<1,   x=>x<3],
      ['گردش مطالبات',      ratio(v.revenue, v.recv),     x=>x<2,   x=>x<4],
      ['دوره وصول مطالبات (روز)', (v.recv&&v.revenue)?(365*(v.recv/v.revenue)):null, x=>x>180, x=>x>90],
    ],
    cf: [
      ['جریان نقد عملیاتی / سود خالص', ratio(v.cfo, v.net), x=>x<0.5, x=>x<0.8],
      ['کیفیت سود (CFO/Net)',          ratio(v.cfo, v.net), x=>x<0.5, x=>x<0.8],
      ['آزاد FCF',                     (v.cfo!=null && v.capex!=null)?(v.cfo - Math.abs(v.capex)):null, x=>x<0, ()=>false],
      ['CFO به درآمد',                 ratio(v.cfo, v.revenue), x=>x<0.02, x=>x<0.05],
    ],
    val: [
      ['P/E',    pe,        x=>x>20, x=>x>12],
      ['P/B',    pb,        x=>x>5,  x=>x>3],
      ['P/S',    ps,        x=>x>5,  x=>x>3],
      ['EPS',    eps,       x=>x<0,  ()=>false],
      ['ارزش بازار', marketCap, x=>false, ()=>false],
      ['EV/EBITDA', evEbitda, x=>x>12, x=>x>8],
    ],
  };

  const fmt = (name, x) => {
    if(x==null) return '—';
    if(/حاشیه|ROA|ROE|CFO به درآمد|کیفیت سود/.test(name)) return pct(x);
    if(/روز/.test(name)) return toFa(x.toFixed(0))+' روز';
    if(/سرمایه در گردش|آزاد FCF|ارزش بازار|EPS/.test(name)) return toman(x);
    return num2(x);
  };
  const cls = (x, bad, warn) => {
    if(x==null) return '';
    if(bad(x)) return 'bad';
    if(warn(x)) return 'warn';
    return 'good';
  };
  function tableFor(list){
    return '<table><tr><th>نسبت</th><th>مقدار</th><th>وضعیت</th><th style="width:38%">این نسبت چی می‌گوید؟</th></tr>' + list.map(([name,x,bad,warn])=>{
      const c = cls(x,bad,warn);
      const label = c==='bad'?'ضعیف':c==='warn'?'قابل بررسی':c==='good'?'مطلوب':'—';
      const hint = HINTS[name] || '';
      return `<tr><td>${name}</td><td><b>${fmt(name,x)}</b></td><td><span class="${c}">${label}</span></td><td style="color:var(--sub);font-size:13px">${hint}</td></tr>`;
    }).join('') + '</table>';
  }
  document.querySelectorAll('#tabSingle .tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('#tabSingle .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      if(t.dataset.t === 'val' && price == null){
        $('ratios').innerHTML = '<div class="err" style="display:block">برای نمایش نسبت‌های ارزش‌گذاری، ابتدا <b>قیمت سهام</b> رو وارد کن.</div>';
      } else {
        $('ratios').innerHTML = tableFor(R[t.dataset.t]);
      }
    };
  });
  $('ratios').innerHTML = tableFor(R.liq);

  const A = [];
  const nm = ratio(v.net, v.revenue);
  if(nm != null){
    const faNm = toFa((nm * 100).toFixed(1));
    let label, type, hint;
    if(nm > 1){
      type = 'good';
      label = `${pct(nm)} — عالی (نکته: بیشتر از فروش)`;
      hint = `حاشیه سود ${faNm}٪ یعنی از هر ۱۰۰ تومان فروش، ${faNm} تومان سود ساخته شده. این عدد بالای ۱۰۰٪ غیرعادی‌ست و معمولاً یعنی شرکت سود زیادی از «سرمایه‌گذاری‌ها» یا «سایر درآمدها» (نه فروش) به دست آورده.`;
    } else if(nm > 0.2){
      type = 'good';
      label = `${pct(nm)} — قوی`;
      hint = `از هر ۱۰۰ تومان فروش، ${faNm} تومان سود خالص می‌مونه. این یعنی شرکت محصولاتش رو با سود خوبی می‌فروشه.`;
    } else if(nm > 0.08){
      type = 'good';
      label = `${pct(nm)} — متعارف`;
      hint = `از هر ۱۰۰ تومان فروش، ${faNm} تومان سود خالص می‌مونه. این محدوده معمولیه.`;
    } else {
      type = 'warn';
      label = `${pct(nm)} — پایین`;
      hint = `از هر ۱۰۰ تومان فروش، ${faNm} تومان سود خالص می‌مونه. یعنی هزینه‌های شرکت نسبت به فروشش زیاده.`;
    }
    A.push({t:type, x:`حاشیه سود خالص ${label}.`, hint});
  }

  const cr = ratio(v.ca, v.cl);
  if(cr != null){
    let label, type, hint;
    if(cr < 1){
      type = 'bad';
      label = `${num2(cr)} < ۱ — ریسک نقدینگی`;
      hint = `نسبت جاری ${num2(cr)} یعنی بدهی کوتاه‌مدت شرکت بیشتر از دارایی کوتاه‌مدتشه. ممکنه نتونه بدهی‌های این ماه و ماه بعدش رو بده.`;
    } else if(cr < 2){
      type = 'good';
      label = `${num2(cr)} — قابل قبول`;
      hint = `شرکت دارایی کوتاه‌مدتش از بدهی کوتاه‌مدتش بیشتره. یعنی پول کافی برای پرداخت بدهی‌های نزدیک داره.`;
    } else {
      type = 'good';
      label = `${num2(cr)} — مناسب`;
      hint = `شرکت بیش از ۲ برابر بدهی کوتاه‌مدتش، دارایی کوتاه‌مدت داره. یعنی نقدینگی خیلی خوبی داره.`;
    }
    A.push({t:type, x:`نسبت جاری ${label}.`, hint});
  }

  const de = ratio(v.tl, v.eq);
  if(de != null){
    let label, type, hint;
    if(de > 2){
      type = 'bad';
      label = `${num2(de)} — اهرم بالا`;
      hint = `شرکت بیش از ۲ برابر سرمایه سهامداران، بدهی داره. یعنی ریسک مالیش بالاست و به بانک‌ها وابسته‌ست.`;
    } else if(de > 1){
      type = 'warn';
      label = `${num2(de)} — متعادل`;
      hint = `بدهی شرکت ۱ تا ۲ برابر سرمایه سهامدارانه. یعنی هم از پول خودش استفاده می‌کنه هم از وام.`;
    } else {
      type = 'good';
      label = `${num2(de)} — محافظه‌کارانه`;
      hint = `بدهی شرکت کمتر از سرمایه سهامدارانه. یعنی بیشتر با پول خودش کار می‌کنه، نه با وام.`;
    }
    A.push({t:type, x:`بدهی/حقوق ${label}.`, hint});
  }

  const roe = ratio(v.net, v.eq);
  if(roe != null){
    const faRoe = toFa((roe * 100).toFixed(1));
    let label, type, hint;
    if(roe > 1){
      type = 'good';
      label = `${pct(roe)} — فوق‌العاده`;
      hint = `از هر ۱۰۰ تومان پول سهامداران، ${faRoe} تومان سود ساخته شده. این عدد بالای ۱۰۰٪ نشون می‌ده شرکت بازدهی فوق‌العاده‌ای داره (یا سرمایه‌ش کمه و سودش زیاده).`;
    } else if(roe > 0.2){
      type = 'good';
      label = `${pct(roe)} — قوی`;
      hint = `از هر ۱۰۰ تومان پول سهامداران، ${faRoe} تومان سود ساخته شده. یعنی شرکت پول سهامداران رو خیلی خوب به کار می‌گیره.`;
    } else if(roe > 0.1){
      type = 'good';
      label = `${pct(roe)} — متوسط`;
      hint = `از هر ۱۰۰ تومان پول سهامداران، ${faRoe} تومان سود ساخته شده. یعنی بازدهی معمولی داره.`;
    } else {
      type = 'warn';
      label = `${pct(roe)} — پایین`;
      hint = `از هر ۱۰۰ تومان پول سهامداران، ${faRoe} تومان سود ساخته شده. یعنی شرکت پول سهامداران رو خوب به کار نمی‌گیره.`;
    }
    A.push({t:type, x:`ROE ${label}.`, hint});
  }

  const cq = ratio(v.cfo, v.net);
  if(cq != null){
    const faCq = toFa((cq * 100).toFixed(0));
    let label, type, hint;
    if(cq < 0.5){
      type = 'bad';
      label = `${num2(cq)} — کیفیت پایین`;
      hint = `از سود دفتری شرکت، ${faCq}٪ به پول نقد تبدیل شده (کمتر از نصف). یعنی سود روی کاغذه — احتمالاً فروش نسیه یا انبار زیاد داره.`;
    } else if(cq < 1){
      type = 'warn';
      label = `${num2(cq)} — متوسط`;
      hint = `از سود دفتری شرکت، ${faCq}٪ به پول نقد تبدیل شده. یعنی سود نسبتاً واقعیه ولی همه‌ش نقد نشده.`;
    } else {
      type = 'good';
      label = `${num2(cq)} — مطلوب`;
      hint = `سود شرکت کاملاً به پول نقد تبدیل شده (یا حتی بیشتر). یعنی سود دفتری، پول نقد واقعی هم هست.`;
    }
    A.push({t:type, x:`CFO/Net ${label}.`, hint});
  }

  if(pe != null){
    let label, type, hint;
    if(pe < 5){
      type = 'good';
      label = `${num2(pe)} — ارزنده`;
      hint = `قیمت سهام کمتر از ۵ برابر سودشه. یعنی بازار سهام رو ارزون می‌دونه — فرصت خرید.`;
    } else if(pe < 12){
      type = 'good';
      label = `${num2(pe)} — متعارف`;
      hint = `قیمت سهام ۵ تا ۱۲ برابر سودشه. این محدوده معمولیه — نه ارزون نه گرون.`;
    } else {
      type = 'warn';
      label = `${num2(pe)} — گرون`;
      hint = `قیمت سهام بیش از ۱۲ برابر سودشه. یعنی بازار انتظار رشد زیادی داره یا سهام گرون معامله می‌شه.`;
    }
    A.push({t:type, x:`P/E ${label}.`, hint});
  }

  if(!A.length){
    A.push({t:'warn', x:'اطلاعات کافی نیست.', hint:'داده‌های کافی برای تحلیل خودکار پیدا نشد.'});
  }

  const iconFor = t => t==='good' ? '✅' : t==='bad' ? '🚨' : '⚠️';
  $('analysis').innerHTML = A.map(it=>`<div class="analysis-item ${it.t}-item"><span class="icon">${iconFor(it.t)}</span><span>${it.x}</span><span class="help" data-tip="${(it.hint||'').replace(/"/g,'&quot;').replace(/\n/g,'&#10;')}">?</span></div>`).join('');

  renderSummary(v, {pe, pb, ps, eps, marketCap});
  renderAlerts(v);
  updatePrintHeader();
}

function renderSummary(v, extras){
  const parts = [];
  if(MARKET.symbol){
    parts.push(`شرکت <b>${MARKET.symbol}</b>`);
  } else {
    parts.push('شرکت');
  }
  parts.push(`در دوره <b>${PARSED?._detectedPeriod || PERIOD_NAMES[0]}</b>`);
  if(v.revenue != null && v.net != null){
    const nm = ratio(v.net, v.revenue);
    parts.push(`با درآمد <span class="stat">${toman(v.revenue)}</span> و سود خالص <span class="stat">${toman(v.net)}</span>`);
    if(nm != null) parts.push(`حاشیه سود خالص <span class="stat">${pct(nm)}</span>`);
  }
  if(v.revenue != null && val('revenue',1) != null && val('revenue',1) !== 0){
    const g = (v.revenue - val('revenue',1)) / Math.abs(val('revenue',1));
    const word = g > 0 ? 'رشد' : 'افت';
    parts.push(`درآمد <b style="color:${g>0?'var(--good)':'var(--bad)'}">${word} ${pct(Math.abs(g))}</b>`);
  }
  if(v.net != null && val('netProfit',1) != null && val('netProfit',1) !== 0){
    const g = (v.net - val('netProfit',1)) / Math.abs(val('netProfit',1));
    const word = g > 0 ? 'رشد' : 'افت';
    parts.push(`سود خالص ${word} <b style="color:${g>0?'var(--good)':'var(--bad)'}">${pct(Math.abs(g))}</b>`);
  }
  const cr = ratio(v.ca, v.cl);
  if(cr != null){
    let desc = '';
    if(cr >= 2) desc = 'نقدینگی مناسب';
    else if(cr >= 1) desc = 'نقدینگی قابل قبول';
    else desc = 'ریسک نقدینگی';
    parts.push(`نسبت جاری <span class="stat">${num2(cr)}</span> (${desc})`);
  }
  const de = ratio(v.tl, v.eq);
  if(de != null){
    let desc = '';
    if(de > 2) desc = 'اهرم بالا';
    else if(de > 1) desc = 'اهرم متعادل';
    else desc = 'محافظه‌کارانه';
    parts.push(`بدهی به حقوق <span class="stat">${num2(de)}</span> (${desc})`);
  }
  const roe = ratio(v.net, v.eq);
  if(roe != null) parts.push(`ROE <span class="stat">${pct(roe)}</span>`);
  if(extras && extras.pe != null){
    parts.push(`P/E <span class="stat">${num2(extras.pe)}</span>`);
  }
  if(extras && extras.pb != null){
    parts.push(`P/B <span class="stat">${num2(extras.pb)}</span>`);
  }
  $('summary').innerHTML = parts.join('، ') + '.';
}

function renderAlerts(v){
  const alerts = [];

  const nm1 = ratio(v.net, v.revenue);
  const nm0 = ratio(val('netProfit',1), val('revenue',1));
  if(nm1 != null && nm0 != null){
    const change = nm1 - nm0;
    if(change < -0.03){
      alerts.push({type:'danger', icon:'🚨', text:`<b>افت شدید حاشیه سود خالص:</b> از <span class="num">${pct(nm0)}</span> به <span class="num">${pct(nm1)}</span>.`});
    } else if(change > 0.03){
      alerts.push({type:'success', icon:'✅', text:`<b>بهبود حاشیه سود خالص:</b> از <span class="num">${pct(nm0)}</span> به <span class="num">${pct(nm1)}</span>.`});
    }
  }

  const de1 = ratio(v.tl, v.eq);
  const de0 = ratio(val('totalLiab',1), val('equity',1));
  if(de1 != null && de0 != null){
    const change = de1 - de0;
    if(change > 0.5){
      alerts.push({type:'danger', icon:'🚨', text:`<b>رشد شدید اهرم:</b> بدهی/حقوق از <span class="num">${num2(de0)}</span> به <span class="num">${num2(de1)}</span>.`});
    } else if(change < -0.5){
      alerts.push({type:'success', icon:'✅', text:`<b>کاهش بدهی:</b> بدهی/حقوق از <span class="num">${num2(de0)}</span> به <span class="num">${num2(de1)}</span>.`});
    }
  }

  const cr = ratio(v.ca, v.cl);
  if(cr != null && cr < 1){
    alerts.push({type:'danger', icon:'🚨', text:`<b>ریسک نقدینگی:</b> نسبت جاری <span class="num">${num2(cr)}</span> کمتر از ۱.`});
  }

  const revG = (v.revenue != null && val('revenue',1) != null && val('revenue',1) !== 0)
    ? (v.revenue - val('revenue',1)) / Math.abs(val('revenue',1)) : null;
  if(revG != null && revG < -0.15){
    alerts.push({type:'danger', icon:'🚨', text:`<b>افت شدید درآمد:</b> <span class="num">${pct(Math.abs(revG))}</span> کمتر از دوره مشابه.`});
  } else if(revG != null && revG > 0.3){
    alerts.push({type:'success', icon:'✅', text:`<b>رشد چشمگیر درآمد:</b> <span class="num">${pct(revG)}</span>.`});
  }

  const cq = ratio(v.cfo, v.net);
  if(cq != null && cq < 0.5 && v.net > 0){
    alerts.push({type:'warning', icon:'⚠️', text:`<b>کیفیت سود پایین:</b> CFO/Net = <span class="num">${num2(cq)}</span>.`});
  }

  if(v.cfo != null && v.cfo < 0){
    alerts.push({type:'danger', icon:'🚨', text:`<b>CFO منفی:</b> شرکت پول از دست داده.`});
  }

  if(!alerts.length){
    alerts.push({type:'success', icon:'✅', text:`<b>هیچ هشدار مهمی نیست.</b>`});
  }

  $('alerts').innerHTML = alerts.map(a => `<div class="alert alert-${a.type}"><span class="alert-icon">${a.icon}</span><span>${a.text}</span></div>`).join('');
}

if($('copySummary')) $('copySummary').onclick = () => {
  const text = $('summary').innerText;
  if(!text){ showToast('خلاصه‌ای موجود نیست', true); return; }
  const title = MARKET.symbol ? `📊 تحلیل ${MARKET.symbol}` : '📊 تحلیل صورت‌های مالی';
  const fullText = `${title} — ${toFa(new Date().toLocaleString('fa-IR'))}\n\n${text}`;
  navigator.clipboard.writeText(fullText).then(() => {
    showToast('✅ خلاصه کپی شد!');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = fullText;
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); showToast('✅ خلاصه کپی شد!'); }
    catch(e){ showToast('خطا در کپی', true); }
    document.body.removeChild(ta);
  });
};

function updatePrintHeader(){
  const old = document.querySelector('.print-header');
  if(old) old.remove();
  const header = document.createElement('div');
  header.className = 'print-header';
  const periodName = PARSED?._detectedPeriod || (PERIOD_NAMES[0] || '');
  const title = MARKET.symbol ? `📊 گزارش تحلیل ${MARKET.symbol}` : '📊 گزارش تحلیل مالی';
  header.innerHTML = `
    <h2>${title}</h2>
    <p class="sub">تاریخ گزارش: ${toFa(new Date().toLocaleString('fa-IR'))} — ${periodName}</p>
  `;
  const out = $('out');
  if(out) out.insertBefore(header, out.firstChild);
}

if($('pdfBtn')) $('pdfBtn').onclick = () => {
  if(!PARSED){ showToast('اول یه فایل رو تحلیل کن!', true); return; }
  updatePrintHeader();
  setTimeout(() => window.print(), 100);
};

window.addEventListener('beforeprint', updatePrintHeader);

/* ============================================================
   Main Tabs Switcher
============================================================ */
document.querySelectorAll('.main-tab').forEach(tab => {
  tab.onclick = () => {
    const target = tab.dataset.maintab;
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panelId = target === 'compare' ? 'tabCompare'
                  : target === 'watchlist' ? 'tabWatchlist'
                  : 'tabSingle';
    const panel = document.getElementById(panelId);
    if(panel) panel.classList.add('active');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
});

/* ---------- Export helpers for compare.js / watchlist.js ---------- */
window.KodalHelpers = {
  getLines,
  parseItems,
  calcScore,
  scoreLevel,
  ratio,
  toman,
  tomanText,
  pct,
  num2,
  toFa,
  fa2en,
  toNum,
  PERIOD_NAMES,
  chartTextColor,
  chartLineColor,
  chartBaseColor,
  chartLabelColor,
};

/* ============================================================
   👁️ ارسال به دیدبان (برای تب تحلیل شرکت)
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
    if(!PARSED){
      showToast('اول یه فایل رو تحلیل کن!', true);
      return;
    }
    if(!window.Watchlist){
      showToast('سیستم دیدبان لود نشده', true);
      return;
    }

    const modal = document.getElementById('addWatchModal');
    if(!modal){
      const symbol = prompt('اسم نماد:', MARKET.symbol || '');
      if(!symbol) return;
      const period = prompt('دوره (۳/۶/۹/۱۲):', String(MARKET.periodMonths || 12));
      if(!period) return;
      const year = prompt('سال (مثلاً: ۱۴۰۳):', '');
      if(!year) return;
      window.Watchlist.add({
        type: 'analysis',
        symbol: symbol.trim(),
        industry: '',
        report: buildAnalysisSnapshot(),
        year: year.trim(),
        period: period.trim(),
      });
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

    if(hasExisting && radioExisting){
      radioExisting.checked = true;
      if(existingBox) existingBox.style.display = 'block';
      if(newBox) newBox.style.display = 'none';
    } else if(radioNew){
      radioNew.checked = true;
      if(existingBox) existingBox.style.display = 'none';
      if(newBox) newBox.style.display = 'block';
    }

    const select = document.getElementById('watchExistingSelect');
    if(select){
      const all = window.Watchlist.getAll('analysis') || [];
      select.innerHTML = '<option value="">-- انتخاب کن --</option>' +
        all.map(w => `<option value="${String(w.symbol).replace(/"/g,'&quot;')}">${w.symbol}${w.industry ? ' (' + w.industry + ')' : ''}</option>`).join('');
      if(hasExisting) select.value = symbolToCheck;
    }

    if(document.getElementById('watchNewSymbol')) document.getElementById('watchNewSymbol').value = symbolToCheck;
    if(document.getElementById('watchNewIndustry')) document.getElementById('watchNewIndustry').value = '';

    const periodLabel = document.getElementById('watchPeriodLabel');
    const periodFields = document.getElementById('watchPeriodFields');
    if(periodLabel) periodLabel.textContent = '📊 دوره و سال صورت مالی (استخراج خودکار از فایل)';

    const detectedYear = PARSED?._detectedInfo?.year || '';
    const detectedMonths = PARSED?._detectedInfo?.months || '';

    if(periodFields){
      if(detectedYear && detectedMonths){
        periodFields.innerHTML = `
          <div style="padding:12px 14px;background:rgba(16,185,129,.1);border-radius:10px;border-right:4px solid var(--good);font-size:13px;line-height:1.9">
            <div>📅 <b>دوره:</b> ${toFa(detectedMonths)} ماهه</div>
            <div>📆 <b>سال:</b> ${toFa(detectedYear)}</div>
            <div style="font-size:11.5px;color:var(--sub);margin-top:6px">این اطلاعات از خود فایل صورت مالی استخراج شد.</div>
          </div>
          <input type="hidden" id="watchPeriod" value="${detectedMonths}">
          <input type="hidden" id="watchYear" value="${detectedYear}">
        `;
      } else if(detectedYear && !detectedMonths){
        periodFields.innerHTML = `
          <div style="padding:10px 12px;background:rgba(245,158,11,.1);border-radius:10px;border-right:4px solid #f59e0b;font-size:12.5px;margin-bottom:8px">
            ⚠️ ماه دوره در فایل پیدا نشد — لطفاً انتخاب کن.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">دوره</label>
              <select id="watchPeriod" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="3">۳ ماهه</option>
                <option value="6">۶ ماهه</option>
                <option value="9">۹ ماهه</option>
                <option value="12" selected>سالانه (۱۲ ماهه)</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">سال</label>
              <input id="watchYear" type="text" value="${toFa(detectedYear)}" readonly style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit;opacity:.7">
            </div>
          </div>
        `;
      } else if(!detectedYear && detectedMonths){
        periodFields.innerHTML = `
          <div style="padding:10px 12px;background:rgba(245,158,11,.1);border-radius:10px;border-right:4px solid #f59e0b;font-size:12.5px;margin-bottom:8px">
            ⚠️ سال در فایل پیدا نشد — لطفاً انتخاب کن.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">دوره</label>
              <input id="watchPeriod" type="text" value="${toFa(detectedMonths)}" readonly style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit;opacity:.7">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">سال</label>
              <select id="watchYear" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="1402">۱۴۰۲</option>
                <option value="1403">۱۴۰۳</option>
                <option value="1404">۱۴۰۴</option>
                <option value="1405" selected>۱۴۰۵</option>
                <option value="1406">۱۴۰۶</option>
              </select>
            </div>
          </div>
        `;
      } else {
        periodFields.innerHTML = `
          <div style="padding:10px 12px;background:rgba(198,40,40,.1);border-radius:10px;border-right:4px solid var(--bad);font-size:12.5px;margin-bottom:8px">
            ⚠️ دوره و سال در فایل پیدا نشد — لطفاً انتخاب کن.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">دوره</label>
              <select id="watchPeriod" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="3">۳ ماهه</option>
                <option value="6">۶ ماهه</option>
                <option value="9">۹ ماهه</option>
                <option value="12" selected>سالانه (۱۲ ماهه)</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;color:var(--sub)">سال</label>
              <select id="watchYear" style="padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chart-bg);color:var(--txt);font:inherit">
                <option value="1402">۱۴۰۲</option>
                <option value="1403">۱۴۰۳</option>
                <option value="1404">۱۴۰۴</option>
                <option value="1405" selected>۱۴۰۵</option>
                <option value="1406">۱۴۰۶</option>
              </select>
            </div>
          </div>
        `;
      }
    }

    [radioExisting, radioNew].forEach(r => {
      if(!r) return;
      r.onchange = () => {
        if(radioExisting && radioExisting.checked){
          if(existingBox) existingBox.style.display = 'block';
          if(newBox) newBox.style.display = 'none';
        } else {
          if(existingBox) existingBox.style.display = 'none';
          if(newBox) newBox.style.display = 'block';
        }
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

          period = fa2en(period).replace(/[^\d]/g, '');
          year = fa2en(year).replace(/[^\d]/g, '');

          if(!period){ showErr('دوره رو انتخاب کن'); return; }
          if(!year){ showErr('سال رو انتخاب کن'); return; }

          const ok = window.Watchlist.add({
            type: 'analysis',
            symbol: symbol,
            industry: industry,
            report: buildAnalysisSnapshot(),
            year: year,
            period: period,
          });

          if(ok) modal.classList.remove('show');
        }catch(err){
          showErr(err.message || 'خطا');
        }
      };
    }

    modal.classList.add('show');
    setTimeout(() => document.getElementById('watchPeriod')?.focus(), 50);
  };

  function buildAnalysisSnapshot(){
    const ci = 0;
    const v = {
      revenue: val('revenue',ci),
      net: val('netProfit',ci),
      ta: val('totalAssets',ci),
      tl: val('totalLiab',ci),
      eq: val('equity',ci),
      ca: val('currentAssets',ci),
      cl: val('currentLiab',ci),
      cfo: val('cfo',ci),
      opProfit: val('opProfit',ci),
      grossProfit: val('grossProfit',ci),
      financeCost: val('financeCost',ci),
      inv: val('inventory',ci),
      cash: val('cash',ci),
      capex: val('capex',ci),
      deprec: val('depreciation',ci),
      opEx: val('opEx',ci),
      cogs: val('cogs',ci),
      otherOpInc: val('otherOpInc',ci),
    };
    const score = calcScore(v);
    return {
      metrics: v,
      score: score,
      period: PARSED?._detectedPeriod || PERIOD_NAMES[ci] || ('دوره ' + (ci+1)),
      parsedFull: JSON.parse(JSON.stringify(PARSED || {})),
      market: {...MARKET},
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
    modal.addEventListener('click', e => {
      if(e.target.id === 'addWatchModal') e.target.classList.remove('show');
    });
  }
})();

/* ============================================================
   بازیابی تحلیل از دیدبان (external)
============================================================ */
window.restoreFromExternal = function(reportData){
  try{
    if(!reportData) return;

    if(reportData.parsedFull){
      PARSED = JSON.parse(JSON.stringify(reportData.parsedFull));
    } else if(reportData.metrics){
      showToast('اطلاعات کامل تحلیل در دسترس نیست', true);
      return;
    } else {
      showToast('داده نامعتبر', true);
      return;
    }

    if(reportData.market){
      MARKET = {
        symbol: reportData.market.symbol || '',
        price: reportData.market.price || null,
        shares: reportData.market.shares || null,
        periodMonths: reportData.market.periodMonths || 12,
      };
      if($('symbolName')) $('symbolName').value = MARKET.symbol;
      if($('stockPrice')) $('stockPrice').value = MARKET.price ? formatNumberInput(MARKET.price) : '';
      if($('stockCount')) $('stockCount').value = MARKET.shares ? formatNumberInput(MARKET.shares) : '';
    }

    const infoBox = $('periodInfoBox');
    const infoText = $('periodInfoText');
    if(infoBox && infoText){
      infoBox.style.display = 'inline-flex';
      infoText.textContent = PARSED._detectedPeriod || 'نامشخص';
    }

    if($('out')) $('out').style.display = 'block';
    if($('saveBtn')){ $('saveBtn').style.display = 'inline-block'; $('saveBtn').disabled = false; }
    if($('pdfBtn')) $('pdfBtn').style.display = 'inline-block';
    if($('sendToWatchBtn')){ $('sendToWatchBtn').style.display = 'inline-block'; $('sendToWatchBtn').disabled = false; }

    render(0);
    if($('status')) $('status').textContent = '✅ تحلیل از دیدبان بازیابی شد';
    window.scrollTo({top: $('out').offsetTop - 20, behavior: 'smooth'});
  }catch(e){
    console.error(e);
    showToast('خطا در بازیابی: ' + e.message, true);
  }
};

/* ============================================================
   🔽 قابلیت باز/بسته کردن کارت‌ها
============================================================ */
(function initCollapsibleCards(){
  const STORAGE_KEY = 'kodal_collapsed_cards_v1';

  function loadCollapsed(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }

  function saveCollapsed(obj){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }catch(e){}
  }

  function getCardId(card){
    const h2 = card.querySelector('h2');
    if(!h2) return null;
    // از متن سرتیتر به عنوان شناسه استفاده می‌کنیم
    let text = (h2.textContent || '').trim();
    // حذف علامت سوال و کاراکترهای اضافه
    text = text.replace(/\?/g, '').replace(/\s+/g, ' ').slice(0, 60);
    return text;
  }

  function applyCollapseState(){
    const collapsed = loadCollapsed();
    document.querySelectorAll('.card').forEach(card => {
      const h2 = card.querySelector('h2');
      if(!h2) return;

      // فقط h2 که توی کارت هست و توی مودال نیست
      if(card.closest('#saveModal, #saveCompareModal, #addWatchModal')) return;

      // h2 رو کلیک‌پذیر کن
      if(!h2.classList.contains('collapsible-h2')){
        h2.classList.add('collapsible-h2');
        const icon = document.createElement('span');
        icon.className = 'collapse-icon';
        icon.textContent = '▼';
        h2.insertBefore(icon, h2.firstChild);
      }

      const id = getCardId(card);
      if(!id) return;

      // اگه در localStorage بسته ذخیره شده، اعمال کن
      if(collapsed[id]){
        card.classList.add('collapsed');
      } else {
        card.classList.remove('collapsed');
      }

      // فقط یه بار event listener اضافه کن
      if(!h2.dataset.collapseReady){
        h2.dataset.collapseReady = '1';
        h2.addEventListener('click', (e) => {
          // اگه روی دکمه یا لینک کلیک شده، نادیده بگیر
          if(e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
          if(e.target.closest('button') || e.target.closest('a')) return;

          const isCollapsed = card.classList.toggle('collapsed');
          const collapsedObj = loadCollapsed();
          const cardId = getCardId(card);
          if(cardId){
            if(isCollapsed){
              collapsedObj[cardId] = true;
            } else {
              delete collapsedObj[cardId];
            }
            saveCollapsed(collapsedObj);
          }
        });
      }
    });
  }

  // اجرا در بارگذاری اول
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyCollapseState);
  } else {
    applyCollapseState();
  }

  // با هر تغییر توی DOM (وقتی تحلیل جدید رندر می‌شه)، دوباره اعمال کن
  const observer = new MutationObserver(() => {
    applyCollapseState();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();