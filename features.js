// ============================================================
// FEATURES: Subscriptions, USD rate, Search, Theme, i18n, Voice, PDF, Compare
// Talab qiladi: db.js (window.DB) va app.js (state, fmt, today, etc.)
// ============================================================

// ============ I18N ============
const I18N = {
  uz: {
    'nav.credits': 'Kreditlar',
    'nav.debts': 'Qarzlar',
    'nav.subs': 'Obunalar',
    'nav.income': 'Daromad',
    'nav.expenses': 'Xarajatlar',
    'nav.budget': 'Byudjet',
    'nav.analytics': 'Tahlil',
    'nav.settings': 'Sozlamalar',
  },
  ru: {
    'nav.credits': 'Кредиты',
    'nav.debts': 'Долги',
    'nav.subs': 'Подписки',
    'nav.income': 'Доход',
    'nav.expenses': 'Расходы',
    'nav.budget': 'Бюджет',
    'nav.analytics': 'Аналитика',
    'nav.settings': 'Настройки',
  },
  en: {
    'nav.credits': 'Credits',
    'nav.debts': 'Debts',
    'nav.subs': 'Subscriptions',
    'nav.income': 'Income',
    'nav.expenses': 'Expenses',
    'nav.budget': 'Budget',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
  },
};

function applyLang(lang) {
  const dict = I18N[lang] || I18N.uz;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  localStorage.setItem('fin_lang', lang);
}

// ============ THEME ============
function applyTheme(theme, accent) {
  document.body.classList.toggle('light', theme === 'light');
  document.body.setAttribute('data-accent', accent || 'blue');
  localStorage.setItem('fin_theme', theme);
  localStorage.setItem('fin_accent', accent || 'blue');

  // update active buttons if on settings page
  document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  document.querySelectorAll('.accent-opt').forEach(b => b.classList.toggle('active', b.dataset.accent === (accent || 'blue')));
}

function initThemeAndLang() {
  const theme = localStorage.getItem('fin_theme') || 'dark';
  const accent = localStorage.getItem('fin_accent') || 'blue';
  const lang = localStorage.getItem('fin_lang') || 'uz';
  applyTheme(theme, accent);
  applyLang(lang);

  // Top bar theme toggle
  const btn = document.getElementById('themeBtn');
  if (btn) btn.addEventListener('click', () => {
    const now = document.body.classList.contains('light') ? 'dark' : 'light';
    applyTheme(now, localStorage.getItem('fin_accent') || 'blue');
  });

  // Settings bindings
  document.querySelectorAll('.theme-opt').forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.theme, localStorage.getItem('fin_accent') || 'blue'));
  });
  document.querySelectorAll('.accent-opt').forEach(b => {
    b.addEventListener('click', () => applyTheme(localStorage.getItem('fin_theme') || 'dark', b.dataset.accent));
  });
  const langSel = document.getElementById('langSelect');
  if (langSel) {
    langSel.value = lang;
    langSel.addEventListener('change', () => applyLang(langSel.value));
  }
  const usdT = document.getElementById('usdToggle');
  if (usdT) {
    usdT.checked = localStorage.getItem('fin_show_usd') === '1';
    usdT.addEventListener('change', () => {
      localStorage.setItem('fin_show_usd', usdT.checked ? '1' : '0');
      if (typeof renderAll === 'function') renderAll();
    });
  }
}

// ============ USD RATE (CBU API) ============
const USD_CACHE_KEY = 'fin_usd_rate';
const USD_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 soat

async function fetchUsdRate() {
  const cached = JSON.parse(localStorage.getItem(USD_CACHE_KEY) || 'null');
  if (cached && (Date.now() - cached.ts) < USD_CACHE_TTL) return cached.rate;
  try {
    const r = await fetch('https://cbu.uz/oz/arkhiv-kursov-valyut/json/USD/');
    if (!r.ok) throw new Error('fetch failed');
    const data = await r.json();
    const rate = parseFloat(data[0]?.Rate);
    if (!rate) throw new Error('no rate');
    localStorage.setItem(USD_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
    return rate;
  } catch {
    return cached?.rate || 12600; // fallback
  }
}

let USD_RATE = 12600;
async function initUsdRate() {
  USD_RATE = await fetchUsdRate();
  const el = document.getElementById('usdRate');
  if (el) el.textContent = `$1 = ${new Intl.NumberFormat('uz-UZ').format(USD_RATE)} UZS`;
}

function usdEq(sum) {
  if (!USD_RATE) return '';
  return '$' + (sum / USD_RATE).toFixed(2);
}

function shouldShowUsd() {
  return localStorage.getItem('fin_show_usd') === '1';
}

// ============ GLOBAL SEARCH ============
function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');
  if (!input) return;

  const search = (q) => {
    q = q.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); return; }
    const items = [];

    // Xarajatlar
    (state.expenses || []).forEach(e => {
      const text = `${e.category} ${e.note || ''} ${(e.tags||[]).join(' ')}`.toLowerCase();
      if (text.includes(q)) items.push({ type: 'expense', ...e });
    });
    // Daromadlar
    (state.incomes || []).forEach(i => {
      const text = `${i.source} ${i.note || ''} ${(i.tags||[]).join(' ')}`.toLowerCase();
      if (text.includes(q)) items.push({ type: 'income', ...i });
    });
    // Kreditlar
    (state.credits || []).forEach(c => {
      const text = `${c.bank} ${c.purpose || ''}`.toLowerCase();
      if (text.includes(q)) items.push({ type: 'credit', ...c });
    });
    // Qarzlar
    (state.debts || []).forEach(d => {
      const text = `${d.title} ${d.person || ''} ${d.note || ''}`.toLowerCase();
      if (text.includes(q)) items.push({ type: 'debt', ...d });
    });
    // Obunalar
    (state.subscriptions || []).forEach(s => {
      if (s.name.toLowerCase().includes(q)) items.push({ type: 'sub', ...s });
    });

    if (!items.length) {
      results.innerHTML = `<div class="empty" style="padding:20px">Hech narsa topilmadi</div>`;
      results.classList.add('active');
      return;
    }

    results.innerHTML = items.slice(0, 20).map(it => {
      let icon, title, meta, amount, tab;
      if (it.type === 'expense') {
        icon = CAT_ICONS[it.category] || '💸'; title = it.category; meta = `${it.note || ''} · ${fmtDate(it.date)}`;
        amount = `<span style="color:var(--danger)">-${fmt(it.amount)}</span>`; tab = 'expenses';
      } else if (it.type === 'income') {
        icon = CAT_ICONS[it.source] || '💰'; title = it.source; meta = `${it.note || ''} · ${fmtDate(it.date)}`;
        amount = `<span style="color:var(--success)">+${fmt(it.amount)}</span>`; tab = 'income';
      } else if (it.type === 'credit') {
        icon = '🏦'; title = it.bank; meta = it.purpose || 'Kredit';
        amount = fmt(it.monthly) + '/oy'; tab = 'credits';
      } else if (it.type === 'debt') {
        icon = '💳'; title = it.title; meta = it.person || '';
        amount = fmt(it.amount); tab = 'debts';
      } else {
        icon = it.icon || '📺'; title = it.name; meta = it.category;
        amount = fmt(it.amount); tab = 'subscriptions';
      }
      return `<div class="search-result" data-tab="${tab}">
        <div class="search-result-icon">${icon}</div>
        <div class="search-result-info">
          <div class="search-result-title">${escapeHtml(title)}</div>
          <div class="search-result-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="search-result-amount">${amount}</div>
      </div>`;
    }).join('');
    results.classList.add('active');

    results.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        switchTab(el.dataset.tab);
        input.value = '';
        results.classList.remove('active');
      });
    });
  };

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => search(input.value), 150);
  });
  input.addEventListener('blur', () => setTimeout(() => results.classList.remove('active'), 200));
  input.addEventListener('focus', () => { if (input.value) search(input.value); });
}

// ============ SUBSCRIPTIONS ============
const SUB_PRESETS = [
  { name: 'Netflix', icon: '📺', amount: 180000, cycle: 'monthly' },
  { name: 'Spotify', icon: '🎵', amount: 105000, cycle: 'monthly' },
  { name: 'YouTube Premium', icon: '▶️', amount: 90000, cycle: 'monthly' },
  { name: 'Telegram Premium', icon: '✈️', amount: 65000, cycle: 'monthly' },
  { name: 'iCloud+', icon: '☁️', amount: 12000, cycle: 'monthly' },
  { name: 'ChatGPT Plus', icon: '🤖', amount: 250000, cycle: 'monthly' },
  { name: 'Claude Pro', icon: '🧠', amount: 250000, cycle: 'monthly' },
  { name: 'Apple Music', icon: '🎧', amount: 119000, cycle: 'monthly' },
  { name: 'Kinoteatr.uz', icon: '🎬', amount: 49000, cycle: 'monthly' },
  { name: 'Adobe CC', icon: '🎨', amount: 650000, cycle: 'monthly' },
];

function renderSubPresets() {
  const box = document.getElementById('subPresets');
  if (!box) return;
  box.innerHTML = SUB_PRESETS.map((p, i) =>
    `<button class="preset-btn" data-preset="${i}">${p.icon} ${p.name}</button>`
  ).join('');
  box.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = SUB_PRESETS[btn.dataset.preset];
      openSubModal();
      document.getElementById('subName').value = p.name;
      document.getElementById('subIcon').value = p.icon;
      document.getElementById('subAmount').value = p.amount;
      document.getElementById('subCycle').value = p.cycle;
      document.getElementById('subNext').value = nextMonthSame();
    });
  });
}

function nextMonthSame() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function openSubModal(id) {
  document.getElementById('subForm').reset();
  document.getElementById('subId').value = '';
  document.getElementById('subCurrency').value = 'UZS';
  document.getElementById('subCycle').value = 'monthly';
  document.getElementById('subNext').value = nextMonthSame();
  document.getElementById('subModalTitle').textContent = 'Yangi obuna';
  if (id) {
    const s = state.subscriptions.find(x => x.id === id);
    if (s) {
      document.getElementById('subId').value = s.id;
      document.getElementById('subName').value = s.name;
      document.getElementById('subIcon').value = s.icon || '';
      document.getElementById('subAmount').value = s.amount;
      document.getElementById('subCurrency').value = s.currency || 'UZS';
      document.getElementById('subCycle').value = s.cycle || 'monthly';
      document.getElementById('subNext').value = s.next_date || '';
      document.getElementById('subCard').value = s.card || '';
      document.getElementById('subLastUsed').value = s.last_used || '';
      document.getElementById('subNote').value = s.note || '';
      document.getElementById('subModalTitle').textContent = 'Obunani tahrirlash';
    }
  }
  document.getElementById('subModal').classList.add('active');
}

async function saveSub(e) {
  e.preventDefault();
  const id = document.getElementById('subId').value;
  const data = {
    name: document.getElementById('subName').value.trim(),
    icon: document.getElementById('subIcon').value.trim() || '📺',
    amount: parseFloat(document.getElementById('subAmount').value),
    currency: document.getElementById('subCurrency').value,
    cycle: document.getElementById('subCycle').value,
    next_date: document.getElementById('subNext').value,
    card: document.getElementById('subCard').value.trim(),
    last_used: document.getElementById('subLastUsed').value || null,
    note: document.getElementById('subNote').value.trim(),
    active: true,
    category: 'Obuna',
  };
  setLoading(true);
  try {
    if (id) {
      const updated = await window.DB.update('subscriptions', id, data);
      const i = state.subscriptions.findIndex(x => x.id === id);
      if (i >= 0) state.subscriptions[i] = updated;
    } else {
      const row = await window.DB.insert('subscriptions', data);
      state.subscriptions.push(row);
    }
    closeModal('subModal');
    toast('Obuna saqlandi');
    renderSubs();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function deleteSub(id) {
  if (!confirm("Obunani o'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('subscriptions', id);
    state.subscriptions = state.subscriptions.filter(x => x.id !== id);
    toast("O'chirildi");
    renderSubs();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function payAndRollSub(id) {
  // Obuna to'landi deb: next_date ni keyingi davrga suradi + xarajat yozadi
  const s = state.subscriptions.find(x => x.id === id);
  if (!s) return;
  setLoading(true);
  try {
    const nd = new Date(s.next_date);
    if (s.cycle === 'yearly') nd.setFullYear(nd.getFullYear() + 1);
    else if (s.cycle === 'weekly') nd.setDate(nd.getDate() + 7);
    else nd.setMonth(nd.getMonth() + 1);
    const newNext = nd.toISOString().split('T')[0];
    const updated = await window.DB.update('subscriptions', id, { next_date: newNext });
    const i = state.subscriptions.findIndex(x => x.id === id);
    if (i >= 0) state.subscriptions[i] = updated;

    // Xarajatga qo'shish
    const amtUzs = s.currency === 'USD' ? s.amount * USD_RATE : s.amount;
    const ex = await window.DB.insert('expenses', {
      category: 'Obuna', amount: amtUzs, date: today(),
      note: `${s.name} obunasi`, tags: ['#obuna']
    });
    state.expenses.push(ex);

    toast(`${s.name} to'landi, keyingi: ${fmtDate(newNext)}`);
    renderSubs();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderSubs() {
  const list = document.getElementById('subsList');
  if (!list) return;

  // Statlar
  let monthlyTotal = 0, yearlyTotal = 0, activeCount = 0;
  (state.subscriptions || []).forEach(s => {
    if (!s.active) return;
    activeCount++;
    const amtUzs = s.currency === 'USD' ? s.amount * USD_RATE : Number(s.amount);
    if (s.cycle === 'yearly') { monthlyTotal += amtUzs / 12; yearlyTotal += amtUzs; }
    else if (s.cycle === 'weekly') { monthlyTotal += amtUzs * 4.33; yearlyTotal += amtUzs * 52; }
    else { monthlyTotal += amtUzs; yearlyTotal += amtUzs * 12; }
  });
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setT('subsMonthly', fmt(monthlyTotal));
  setT('subsYearly', fmt(yearlyTotal));
  setT('subsActive', activeCount + ' ta');

  if (!(state.subscriptions || []).length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📺</div><div>Hozircha obunalar yo'q</div><div style="margin-top:8px;font-size:12px;">Yuqoridagi taklif tugmalaridan tanlang yoki "+ Obuna qo'shish"</div></div>`;
    return;
  }

  const todayStr = today();
  list.innerHTML = state.subscriptions.map(s => {
    const amtUzs = s.currency === 'USD' ? s.amount * USD_RATE : Number(s.amount);
    const cycleUz = { monthly: 'har oy', yearly: 'har yil', weekly: 'har hafta' }[s.cycle] || 'har oy';
    const daysTo = s.next_date ? Math.ceil((new Date(s.next_date) - new Date(todayStr)) / 86400000) : 999;
    const nextCls = daysTo <= 0 ? 'today' : (daysTo <= 3 ? 'soon' : '');
    const nextLabel = daysTo <= 0 ? 'Bugun/muddat o\'tdi' : daysTo === 1 ? 'Ertaga' : daysTo <= 7 ? `${daysTo} kun ichida` : fmtDate(s.next_date);

    // Unused detection
    const unused = s.last_used && ((new Date(todayStr) - new Date(s.last_used)) / 86400000) > 90;

    return `
      <div class="sub-card ${unused ? 'unused' : ''} ${s.active ? '' : 'inactive'}">
        <div class="sub-top">
          <div class="sub-icon">${s.icon || '📺'}</div>
          <div style="flex:1">
            <div class="sub-name">${escapeHtml(s.name)}</div>
            <div class="sub-card-meta">${cycleUz}${s.card ? ' · ' + escapeHtml(s.card) : ''}</div>
          </div>
        </div>
        <div>
          <div class="sub-amount">${fmt(amtUzs)}</div>
          ${s.currency === 'USD' ? `<div class="sub-cycle">$${s.amount} · kurs: ${fmt(USD_RATE)}</div>` : ''}
          ${shouldShowUsd() && s.currency !== 'USD' ? `<div class="sub-cycle">${usdEq(amtUzs)}</div>` : ''}
        </div>
        <div class="sub-next ${nextCls}">
          <span>Keyingi to'lov:</span>
          <b>${nextLabel}</b>
        </div>
        ${s.note ? `<div class="muted" style="font-size:12px;margin:0">${escapeHtml(s.note)}</div>` : ''}
        <div class="sub-actions">
          <button class="btn btn-success" style="flex:1" onclick="payAndRollSub('${s.id}')">✓ To'landi</button>
          <button class="icon-btn" onclick="openSubModal('${s.id}')">✏️</button>
          <button class="icon-btn danger" onclick="deleteSub('${s.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ============ TAGS HELPERS ============
function parseTags(str) {
  if (!str) return null;
  return str.split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);
}

function formatTags(arr) {
  if (!arr || !arr.length) return '';
  return arr.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
}

// ============ VOICE INPUT ============
function initVoiceButtons() {
  document.querySelectorAll('.voice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { toast('Brauzeringiz ovoz kiritishni qo\'llamaydi', 'error'); return; }
      const rec = new SpeechRecognition();
      rec.lang = 'uz-UZ';
      rec.continuous = false;
      rec.interimResults = false;
      btn.classList.add('listening');
      btn.textContent = '🔴';
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        // Find input near this button
        const input = btn.closest('.form-group').querySelector('input');
        if (input) input.value = text;
        // Try to detect amount in text and fill expense amount
        const m = text.match(/(\d+)\s*(ming|мин|thousand|minged)/i);
        const amtInput = document.getElementById('expenseAmount') || document.getElementById('incomeAmount');
        if (m && amtInput && !amtInput.value) amtInput.value = parseInt(m[1]) * 1000;
        toast(`Eshitildi: "${text}"`);
      };
      rec.onerror = () => toast('Eshita olmadim', 'error');
      rec.onend = () => {
        btn.classList.remove('listening');
        btn.textContent = '🎤';
      };
      rec.start();
    });
  });
}

// ============ PDF EXPORT ============
async function exportMonthlyPdf() {
  if (!window.jspdf) { toast('PDF kutubxonasi yuklanmagan', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName = UZ_MONTHS ? UZ_MONTHS[now.getMonth()] : now.toLocaleString('uz', { month: 'long' });

  // Title
  doc.setFontSize(20);
  doc.text('Moliyaviy hisobot', 14, 20);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`${monthName} ${now.getFullYear()}`, 14, 28);

  // Umumiy
  const monthIncomes = state.incomes.filter(x => x.date?.startsWith(monthKey));
  const monthExpenses = state.expenses.filter(x => x.date?.startsWith(monthKey));
  const incSum = monthIncomes.reduce((s,x) => s + Number(x.amount), 0);
  const expSum = monthExpenses.reduce((s,x) => s + Number(x.amount), 0);

  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`Daromad: ${fmt(incSum)}`, 14, 44);
  doc.text(`Xarajat: ${fmt(expSum)}`, 14, 52);
  doc.text(`Balans: ${fmt(incSum - expSum)}`, 14, 60);

  // Xarajat kategoriyalari
  const byCat = {};
  monthExpenses.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
  const catRows = Object.entries(byCat).sort((a,b) => b[1] - a[1]).map(([c,v]) => [c, fmt(v)]);
  if (catRows.length && doc.autoTable) {
    doc.autoTable({ head: [['Kategoriya', 'Summa']], body: catRows, startY: 70, theme: 'grid' });
  }

  // Tranzaktsiyalar
  if (doc.autoTable) {
    const txRows = [...monthIncomes.map(x => [x.date, x.source, '+' + fmt(x.amount), x.note || '']),
                    ...monthExpenses.map(x => [x.date, x.category, '-' + fmt(x.amount), x.note || ''])]
      .sort((a,b) => a[0].localeCompare(b[0]));
    if (txRows.length) {
      const y = doc.lastAutoTable?.finalY || 100;
      doc.autoTable({ head: [['Sana', 'Nom', 'Summa', 'Izoh']], body: txRows, startY: y + 10, theme: 'striped', styles: { fontSize: 9 } });
    }
  }

  doc.save(`Moliya-${monthKey}.pdf`);
  toast('PDF eksport qilindi');
}

// ============ COMPARE CHART ============
let compareChartInst, yearTrendChartInst;

function renderCompareCharts() {
  const ctx1 = document.getElementById('compareChart');
  const ctx2 = document.getElementById('yearTrendChart');
  if (!ctx1 || !ctx2) return;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  const thisExp = state.expenses.filter(x => x.date?.startsWith(thisMonth));
  const prevExp = state.expenses.filter(x => x.date?.startsWith(prevMonth));

  // Group by category
  const gatherCat = (arr) => { const o = {}; arr.forEach(x => { o[x.category] = (o[x.category] || 0) + Number(x.amount); }); return o; };
  const thisCat = gatherCat(thisExp);
  const prevCat = gatherCat(prevExp);
  const allCats = [...new Set([...Object.keys(thisCat), ...Object.keys(prevCat)])];

  if (compareChartInst) compareChartInst.destroy();
  compareChartInst = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: allCats,
      datasets: [
        { label: 'O\'tgan oy', data: allCats.map(c => prevCat[c] || 0), backgroundColor: '#64748b', borderRadius: 6 },
        { label: 'Shu oy', data: allCats.map(c => thisCat[c] || 0), backgroundColor: '#4f8cff', borderRadius: 6 },
      ]
    },
    options: chartOpts()
  });

  // Insights
  const insightsBox = document.getElementById('compareInsights');
  if (insightsBox) {
    const tips = [];
    allCats.forEach(c => {
      const t = thisCat[c] || 0, p = prevCat[c] || 0;
      if (p === 0 && t > 0) tips.push({ type: 'info', icon: '🆕', text: `<b>${c}</b> — yangi kategoriya: ${fmt(t)}` });
      else if (p > 0) {
        const diff = ((t - p) / p) * 100;
        if (diff > 20) tips.push({ type: 'warn', icon: '📈', text: `<b>${c}</b> — o'tgan oyga nisbatan ${diff.toFixed(0)}% ko'p (${fmt(t)} vs ${fmt(p)})` });
        else if (diff < -20) tips.push({ type: 'good', icon: '📉', text: `<b>${c}</b> — ${Math.abs(diff).toFixed(0)}% kam sarfladingiz! (${fmt(t)} vs ${fmt(p)})` });
      }
    });
    if (!tips.length) tips.push({ type: 'info', icon: '📊', text: 'O\'tgan oy bilan taqqoslash uchun yetarli ma\'lumot yo\'q' });
    insightsBox.innerHTML = tips.slice(0, 5).map(t =>
      `<div class="insight ${t.type}"><div class="insight-icon">${t.icon}</div><div class="insight-text">${t.text}</div></div>`
    ).join('');
  }

  // 12 month trend
  const labels12 = [], incData = [], expData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    labels12.push(UZ_MONTHS[d.getMonth()].slice(0, 3));
    incData.push(state.incomes.filter(x => x.date?.startsWith(key)).reduce((s,x) => s + Number(x.amount), 0));
    expData.push(state.expenses.filter(x => x.date?.startsWith(key)).reduce((s,x) => s + Number(x.amount), 0));
  }
  if (yearTrendChartInst) yearTrendChartInst.destroy();
  yearTrendChartInst = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: labels12,
      datasets: [
        { label: 'Daromad', data: incData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true },
        { label: 'Xarajat', data: expData, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', tension: 0.4, fill: true },
      ]
    },
    options: chartOpts()
  });
}

// Export globally
window.openSubModal = openSubModal;
window.saveSub = saveSub;
window.deleteSub = deleteSub;
window.payAndRollSub = payAndRollSub;
window.renderSubs = renderSubs;
window.exportMonthlyPdf = exportMonthlyPdf;
window.renderCompareCharts = renderCompareCharts;
window.initThemeAndLang = initThemeAndLang;
window.initUsdRate = initUsdRate;
window.initGlobalSearch = initGlobalSearch;
window.initVoiceButtons = initVoiceButtons;
window.renderSubPresets = renderSubPresets;
window.USD_RATE = USD_RATE;
window.usdEq = usdEq;
window.shouldShowUsd = shouldShowUsd;
window.parseTags = parseTags;
window.formatTags = formatTags;
