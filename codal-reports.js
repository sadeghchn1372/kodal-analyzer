(() => {
  'use strict';
  const API = 'https://codalpro-backend.onrender.com';
  if (document.getElementById('codalReportsWidget')) return;

  const style = document.createElement('style');
  style.textContent = `
    #codalReportsWidget{position:fixed;left:16px;bottom:16px;z-index:99999;font-family:inherit;color:#1f2937}
    #codalReportsWidget *{box-sizing:border-box}
    #codalReportsToggle{border:0;border-radius:999px;padding:12px 17px;background:#1769e0;color:#fff;font:inherit;font-weight:700;box-shadow:0 5px 22px #0002;cursor:pointer}
    #codalReportsPanel{display:none;width:min(440px,calc(100vw - 24px));max-height:min(75vh,680px);overflow:auto;background:#fff;border:1px solid #dbe3ef;border-radius:16px;box-shadow:0 12px 40px #0003;margin-bottom:10px;padding:16px;direction:rtl}
    #codalReportsPanel.open{display:block}
    #codalReportsPanel h3{font-size:17px;margin:0 0 8px}
    #codalReportsPanel .cr-muted{font-size:12px;color:#64748b;margin:0 0 12px;line-height:1.8}
    #codalReportsForm{display:flex;gap:8px;margin-bottom:12px}
    #codalReportsForm input{min-width:0;flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:10px;font:inherit;background:#fff;color:#111827}
    #codalReportsForm button,.cr-download{border:0;border-radius:9px;padding:9px 12px;background:#1769e0;color:#fff;font:inherit;cursor:pointer;text-decoration:none;display:inline-block}
    #codalReportsStatus{font-size:13px;color:#475569;margin:8px 0}
    .cr-item{border:1px solid #e2e8f0;border-radius:11px;padding:11px;margin-top:9px}
    .cr-title{font-size:13px;font-weight:700;line-height:1.8;margin-bottom:5px;overflow-wrap:anywhere}
    .cr-meta{font-size:11px;color:#64748b;margin-bottom:9px}
    .cr-actions{display:flex;gap:7px;flex-wrap:wrap}
    .cr-view{display:inline-block;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;color:#334155;text-decoration:none;font-size:12px}
    @media(max-width:480px){#codalReportsWidget{left:10px;bottom:10px}#codalReportsPanel{padding:12px}}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'codalReportsWidget';
  root.innerHTML = `
    <section id="codalReportsPanel" aria-label="جست‌وجوی گزارش‌های کدال">
      <h3>📄 جست‌وجوی گزارش‌های کدال</h3>
      <p class="cr-muted">نماد شرکت را وارد کن؛ گزارش‌ها را ببین و فایل اکسل هر گزارش را دریافت کن.</p>
      <form id="codalReportsForm">
        <input id="codalReportsSymbol" type="text" placeholder="مثلاً فولاد" aria-label="نماد شرکت" required>
        <button type="submit">جست‌وجو</button>
      </form>
      <div id="codalReportsStatus" role="status">برای شروع، نماد شرکت را وارد کن.</div>
      <div id="codalReportsResults"></div>
    </section>
    <button id="codalReportsToggle" type="button" aria-expanded="false">📄 گزارش‌های کدال</button>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector('#codalReportsPanel');
  const toggle = root.querySelector('#codalReportsToggle');
  const form = root.querySelector('#codalReportsForm');
  const input = root.querySelector('#codalReportsSymbol');
  const status = root.querySelector('#codalReportsStatus');
  const results = root.querySelector('#codalReportsResults');

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  });

  function safeText(value, fallback = '') {
    return value == null || value === '' ? fallback : String(value);
  }
  function getSerial(report) {
    const direct = report.serial ?? report.letterSerial ?? report.LetterSerial ?? report.letter_serial;
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const candidates = [];
    if (Array.isArray(report.links)) candidates.push(...report.links);
    else if (report.links && typeof report.links === 'object') candidates.push(...Object.values(report.links));
    for (const item of candidates) {
      const url = typeof item === 'string' ? item : (item && (item.url || item.href || item.download || item.view));
      if (url) {
        try {
          const parsed = new URL(url, 'https://codal.ir');
          const serial = parsed.searchParams.get('LetterSerial') || parsed.searchParams.get('letterSerial') || parsed.searchParams.get('serial');
          if (serial) return serial;
        } catch (_) {}
      }
    }
    const url = report.url || report.href || report.Url;
    if (url) {
      try {
        const parsed = new URL(url, 'https://codal.ir');
        return parsed.searchParams.get('LetterSerial') || parsed.searchParams.get('letterSerial') || parsed.searchParams.get('serial') || '';
      } catch (_) {}
    }
    return '';
  }
  function getCodalUrl(report, serial) {
    const links = report.links;
    const candidates = Array.isArray(links) ? links : (links && typeof links === 'object' ? Object.values(links) : []);
    for (const item of candidates) {
      const url = typeof item === 'string' ? item : (item && (item.url || item.href || item.view));
      if (url && /codal\.ir/i.test(url)) return url;
    }
    const url = report.url || report.href || report.Url;
    if (url && /codal\.ir/i.test(url)) return url;
    return serial ? 'https://codal.ir/ReportList.aspx?LetterSerial=' + encodeURIComponent(serial) : '';
  }
  function renderReports(data) {
    const reports = Array.isArray(data) ? data : (data && (data.reports || data.data || data.items));
    if (!Array.isArray(reports) || reports.length === 0) {
      status.textContent = 'گزارشی برای این نماد پیدا نشد. املای نماد را بررسی کن و دوباره تلاش کن.';
      results.replaceChildren();
      return;
    }
    status.textContent = reports.length + ' گزارش پیدا شد.';
    results.replaceChildren();
    for (const report of reports) {
      const card = document.createElement('article');
      card.className = 'cr-item';
      const title = document.createElement('div');
      title.className = 'cr-title';
      title.textContent = safeText(report.title || report.Title || report.name, 'گزارش بدون عنوان');
      const meta = document.createElement('div');
      meta.className = 'cr-meta';
      meta.textContent = [safeText(report.company || report.companyName || report.CompanyName), safeText(report.date || report.publishDate || report.PublishDate)].filter(Boolean).join(' · ');
      const actions = document.createElement('div');
      actions.className = 'cr-actions';
      const serial = getSerial(report);
      const codalUrl = getCodalUrl(report, serial);
      if (codalUrl) {
        const view = document.createElement('a');
        view.className = 'cr-view';
        view.href = codalUrl;
        view.target = '_blank';
        view.rel = 'noopener noreferrer';
        view.textContent = 'مشاهده در کدال';
        actions.appendChild(view);
      }
      if (serial) {
        const download = document.createElement('a');
        download.className = 'cr-download';
        download.href = API + '/api/download?serial=' + encodeURIComponent(serial);
        download.textContent = 'دانلود اکسل';
        download.setAttribute('download', '');
        download.addEventListener('click', () => {
          status.textContent = 'در حال آماده‌سازی فایل اکسل…';
          window.setTimeout(() => { status.textContent = reports.length + ' گزارش پیدا شد.'; }, 3500);
        });
        actions.appendChild(download);
      }
      if (!serial) {
        const note = document.createElement('span');
        note.className = 'cr-meta';
        note.textContent = 'لینک دانلود این گزارش از پاسخ سرور دریافت نشد.';
        actions.appendChild(note);
      }
      card.append(title, meta, actions);
      results.appendChild(card);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const symbol = input.value.trim();
    if (!symbol) return;
    status.textContent = 'در حال جست‌وجوی گزارش‌ها…';
    results.replaceChildren();
    const submit = form.querySelector('button');
    submit.disabled = true;
    try {
      // Try Codal directly first; this avoids the Render-to-Codal timeout when browser CORS permits it.
      const params = new URLSearchParams({
        Symbol: symbol, LetterType: '6', Category: '1', PageNumber: '1',
        FromDate: '', ToDate: '', Audited: 'true', NotAudited: 'true',
        Consolidatable: 'true', NotConsolidatable: 'true', Childs: 'false',
        Mains: 'true', Publisher: 'false', search: 'true'
      });
      let data;
      try {
        const direct = await fetch('https://search.codal.ir/api/search/v2/q?' + params.toString(), {
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        if (!direct.ok) throw new Error('Codal HTTP ' + direct.status);
        const raw = await direct.json();
        const letters = raw.Letters || raw.letters || [];
        data = {
          reports: letters.map((letter) => {
            const url = letter.Url || letter.url || '';
            const match = url.match(/LetterSerial=([^&]+)/i);
            const serial = match ? match[1] : (letter.LetterSerial || letter.letterSerial || '');
            return {
              title: letter.Title || letter.title || 'گزارش بدون عنوان',
              company: letter.CompanyName || letter.companyName || '',
              date: letter.PublishDateTime || letter.SentDateTime || letter.publishDate || '',
              serial,
              links: {
                html: serial ? 'https://www.codal.ir/Reports/Decision.aspx?LetterSerial=' + encodeURIComponent(serial) + '&rt=0&let=6&ct=0&ft=-1' : url
              }
            };
          }),
          total: raw.Total || raw.total || letters.length
        };
      } catch (directError) {
        console.warn('[Codal reports] Direct Codal request unavailable; trying backend.', directError);
        const response = await fetch(API + '/api/search?symbol=' + encodeURIComponent(symbol), {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Backend HTTP ' + response.status);
        data = await response.json();
      }
      renderReports(data);
    } catch (error) {
      status.textContent = 'جست‌وجو از مرورگر و سرور انجام نشد. احتمالاً اتصال کدال از این مسیر محدود است.';
      console.error('[Codal reports]', error);
    } finally {
      submit.disabled = false;
    }
  });
})();