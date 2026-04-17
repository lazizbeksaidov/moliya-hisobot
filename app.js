// ============================================================
// MOLIYA — MAIN APP LOGIC
// ============================================================

const state = {
  credits: [],
  incomes: [],
  expenses: [],
  budgets: [],
  period: 'day',
  authMode: 'signin',
};

const CAT_ICONS = {
  'Oziq-ovqat': '🍔', 'Transport': '🚗', 'Kommunal': '💡', 'Kiyim': '👕',
  'Salomatlik': '💊', "Ta'lim": '📚', "Ko'ngilochar": '🎬', 'Uy': '🏠',
  'Kredit': '🏦', 'Boshqa': '📦',
  'Ish haqi': '💼', 'Biznes': '📊', 'Freelance': '💻',
  "Sovg'a": '🎁', 'Investitsiya': '📈',
};

// ============ UTILS ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().split('T')[0];

const fmt = (n) => {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('uz-UZ').format(Math.round(num)) + " so'm";
};

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const months = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const fmtDateLong = (d) => {
  const date = new Date(d);
  const days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  return `${days[date.getDay()]}, ${fmtDate(d)}`;
};

const toast = (msg, type = 'success') => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  setTimeout(() => el.classList.remove('show'), 2800);
};

const setLoading = (on) => {
  document.getElementById('loading').classList.toggle('active', on);
};

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek = (d = new Date()) => { const x = startOfDay(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x; };
const startOfMonth = (d = new Date()) => { const x = startOfDay(d); x.setDate(1); return x; };
const startOfYear = (d = new Date()) => { const x = startOfDay(d); x.setMonth(0,1); return x; };

const inRange = (dateStr, period) => {
  const d = new Date(dateStr);
  const now = new Date();
  if (period === 'all') return true;
  if (period === 'today') return startOfDay(d).getTime() === startOfDay(now).getTime();
  if (period === 'week') return d >= startOfWeek(now);
  if (period === 'month') return d >= startOfMonth(now);
  if (period === 'year') return d >= startOfYear(now);
  return true;
};

const escapeHtml = (s) => !s ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ============ INIT ============
async function init() {
  await window.DB.init();
  window.DB.onAuthChange = async (user) => {
    await afterAuth(user);
  };

  // Decide screen
  if (window.DB.isCloud()) {
    await afterAuth(window.DB.user);
  } else if (localStorage.getItem('fin_skip_auth') === '1' || !window.DB.isConfigured()) {
    showApp();
    await loadAll();
    renderAll();
  } else {
    showAuth();
  }
}

async function afterAuth(user) {
  if (user) {
    showApp();
    await loadAll();
    renderAll();
  }
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  updateUserBadge();
  updateAccountSection();
}

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
}

function showSetup() {
  document.getElementById('setupScreen').style.display = 'flex';
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
  const saved = JSON.parse(localStorage.getItem('fin_supabase_cfg') || '{}');
  document.getElementById('setupUrl').value = saved.url || '';
  document.getElementById('setupKey').value = saved.anonKey || '';
}

function hideSetup() {
  document.getElementById('setupScreen').style.display = 'none';
  if (window.DB.isCloud()) showApp();
  else if (localStorage.getItem('fin_skip_auth') === '1') showApp();
  else showAuth();
}

function useLocalMode() {
  localStorage.setItem('fin_skip_auth', '1');
  showApp();
  loadAll().then(renderAll);
}

// ============ AUTH ============
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.authMode = btn.dataset.auth;
    document.getElementById('authSubmit').textContent = state.authMode === 'signin' ? 'Kirish' : "Ro'yxatdan o'tish";
  });
});

async function doAuth(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!window.DB.isConfigured()) {
    showSetup();
    return;
  }
  setLoading(true);
  try {
    if (state.authMode === 'signup') {
      await window.DB.signUp(email, password);
      toast("Email tasdiqlash havolasi yuborildi. Tasdiqlab so'ng kiring.");
    } else {
      await window.DB.signIn(email, password);
      localStorage.removeItem('fin_skip_auth');
    }
  } catch (err) {
    toast(err.message || 'Xato', 'error');
  } finally {
    setLoading(false);
  }
}

async function signOut() {
  await window.DB.signOut();
  localStorage.removeItem('fin_skip_auth');
  showAuth();
}

function copySchema() {
  fetch('supabase-schema.sql').then(r => r.text()).then(txt => {
    navigator.clipboard.writeText(txt);
    toast("Schema nusxa olindi — Supabase SQL Editor'ga paste qiling");
  }).catch(() => toast("Nusxa olishda xato", 'error'));
}

function saveSetup() {
  const url = document.getElementById('setupUrl').value.trim();
  const key = document.getElementById('setupKey').value.trim();
  if (!url || !key) { toast('URL va key kerak', 'error'); return; }
  localStorage.setItem('fin_supabase_cfg', JSON.stringify({ url, anonKey: key }));
  toast('Saqlandi. Sahifa yangilanmoqda...');
  setTimeout(() => location.reload(), 800);
}

// Load user-saved Supabase config if exists
(function loadSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('fin_supabase_cfg') || '{}');
    if (saved.url && saved.anonKey) {
      window.SUPABASE_CONFIG = { url: saved.url, anonKey: saved.anonKey };
    }
  } catch {}
})();

// ============ DATA LOAD ============
async function loadAll() {
  try {
    const [credits, incomes, expenses, budgets] = await Promise.all([
      window.DB.list('credits'),
      window.DB.list('incomes'),
      window.DB.list('expenses'),
      window.DB.list('budgets'),
    ]);
    state.credits = credits;
    state.incomes = incomes;
    state.expenses = expenses;
    state.budgets = budgets;
    await window.DB.loadProfile();

    // Process recurring
    await processRecurring();
  } catch (err) {
    toast('Yuklashda xato: ' + err.message, 'error');
  }
}

async function processRecurring() {
  const nowKey = today();
  const lastRun = localStorage.getItem('fin_recurring_last');
  if (lastRun === nowKey) return;

  const now = new Date();
  const advance = async (items, table) => {
    const added = [];
    for (const item of items) {
      if (!item.recurring) continue;
      let last = new Date(item.date);
      while (true) {
        const next = new Date(last);
        if (item.recurring === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (item.recurring === 'weekly') next.setDate(next.getDate() + 7);
        else break;
        if (next > now) break;
        const existing = items.find(x => x.date === next.toISOString().split('T')[0] &&
          x.amount === item.amount &&
          ((table === 'incomes' && x.source === item.source) || (table === 'expenses' && x.category === item.category)));
        if (!existing) {
          const newRow = { ...item };
          delete newRow.id;
          delete newRow.created_at;
          delete newRow.user_id;
          newRow.date = next.toISOString().split('T')[0];
          newRow.note = (item.note || '') + ' (avto)';
          newRow.recurring = null; // only original is source
          added.push(await window.DB.insert(table, newRow));
        }
        last = next;
      }
    }
    return added;
  };

  const newIncomes = await advance(state.incomes.filter(x => x.recurring), 'incomes');
  const newExpenses = await advance(state.expenses.filter(x => x.recurring), 'expenses');
  if (newIncomes.length || newExpenses.length) {
    state.incomes = [...state.incomes, ...newIncomes];
    state.expenses = [...state.expenses, ...newExpenses];
    toast(`${newIncomes.length + newExpenses.length} ta takrorlanuvchi yozuv avto qo'shildi`);
  }
  localStorage.setItem('fin_recurring_last', nowKey);
}

// ============ RENDER ALL ============
function renderAll() {
  renderDashboard();
  renderCredits();
  renderIncome();
  renderExpenses();
  renderBudget();
  renderAnalytics();
}

function updateUserBadge() {
  const badge = document.getElementById('userBadge');
  if (window.DB.isCloud()) {
    badge.textContent = '☁️ Bulut · ' + (window.DB.user.email || '').split('@')[0];
  } else {
    badge.textContent = '💾 Lokal rejim';
  }
}

function updateAccountSection() {
  const status = document.getElementById('modeStatus');
  const email = document.getElementById('modeEmail');
  const actions = document.getElementById('accountActions');
  if (window.DB.isCloud()) {
    status.textContent = '☁️ Bulut (Supabase) — sinxron';
    email.textContent = window.DB.user.email;
    actions.innerHTML = `<button class="btn btn-secondary" onclick="signOut()">Chiqish</button>`;
  } else {
    status.textContent = '💾 Lokal rejim — faqat shu qurilmada';
    email.textContent = window.DB.isConfigured() ? 'Supabase sozlangan, lekin kirish qilinmagan' : 'Supabase sozlanmagan';
    actions.innerHTML = window.DB.isConfigured()
      ? `<button class="btn btn-primary" onclick="showAuth()">Bulutga kirish</button>`
      : `<button class="btn btn-primary" onclick="showSetup()">Supabase sozlash</button>`;
  }
}

// ============ TABS ============
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.nav-item, .mnav').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
  if (name === 'settings') {
    document.getElementById('startBalance').value = window.DB.profile?.start_balance || '';
    updateAccountSection();
  }
  if (name === 'dashboard') renderDashboard();
  if (name === 'budget') renderBudget();
  if (name === 'analytics') renderAnalytics();
}

// ============ MODAL ============
function openModal(id) {
  if (id === 'incomeModal') {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeId').value = '';
    document.getElementById('incomeDate').value = today();
  }
  if (id === 'expenseModal') {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseDate').value = today();
  }
  if (id === 'creditModal') {
    document.getElementById('creditForm').reset();
    document.getElementById('creditId').value = '';
    document.getElementById('creditStart').value = today();
    document.getElementById('creditRate').value = 0;
    document.getElementById('creditMonths').value = 12;
    document.getElementById('creditPaid').value = 0;
    document.getElementById('creditModalTitle').textContent = 'Yangi kredit';
  }
  if (id === 'budgetModal') {
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetId').value = '';
  }
  document.getElementById(id).classList.add('active');
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
});

// ============ CREDITS ============
async function saveCredit(e) {
  e.preventDefault();
  const id = document.getElementById('creditId').value;
  const data = {
    bank: document.getElementById('creditBank').value.trim(),
    purpose: document.getElementById('creditPurpose').value.trim(),
    amount: parseFloat(document.getElementById('creditAmount').value),
    rate: parseFloat(document.getElementById('creditRate').value) || 0,
    months: parseInt(document.getElementById('creditMonths').value) || 12,
    monthly: parseFloat(document.getElementById('creditMonthly').value),
    start: document.getElementById('creditStart').value,
    paid: parseFloat(document.getElementById('creditPaid').value) || 0,
  };
  setLoading(true);
  try {
    if (id) {
      const updated = await window.DB.update('credits', id, data);
      const i = state.credits.findIndex(c => c.id === id);
      if (i >= 0) state.credits[i] = updated;
    } else {
      const newRow = await window.DB.insert('credits', data);
      state.credits.push(newRow);
    }
    closeModal('creditModal');
    toast('Kredit saqlandi');
    renderCredits();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function editCredit(id) {
  const c = state.credits.find(x => x.id === id);
  if (!c) return;
  document.getElementById('creditId').value = c.id;
  document.getElementById('creditBank').value = c.bank;
  document.getElementById('creditPurpose').value = c.purpose || '';
  document.getElementById('creditAmount').value = c.amount;
  document.getElementById('creditRate').value = c.rate;
  document.getElementById('creditMonths').value = c.months;
  document.getElementById('creditMonthly').value = c.monthly;
  document.getElementById('creditStart').value = c.start || c.start_date;
  document.getElementById('creditPaid').value = c.paid || 0;
  document.getElementById('creditModalTitle').textContent = 'Kreditni tahrirlash';
  document.getElementById('creditModal').classList.add('active');
}

async function deleteCredit(id) {
  if (!confirm("Kreditni o'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('credits', id);
    state.credits = state.credits.filter(c => c.id !== id);
    toast("O'chirildi");
    renderCredits();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function payCredit(id) {
  const c = state.credits.find(x => x.id === id);
  if (!c) return;
  const amt = prompt(`Qancha to'lov? (oylik: ${fmt(c.monthly)})`, c.monthly);
  if (!amt) return;
  const sum = parseFloat(amt);
  if (isNaN(sum) || sum <= 0) return;
  setLoading(true);
  try {
    const updated = await window.DB.update('credits', id, { paid: (c.paid || 0) + sum });
    const i = state.credits.findIndex(x => x.id === id);
    if (i >= 0) state.credits[i] = updated;
    const expense = await window.DB.insert('expenses', {
      category: 'Kredit', amount: sum, date: today(), note: `${c.bank} kreditga to'lov`, recurring: null
    });
    state.expenses.push(expense);
    toast(`${fmt(sum)} to'lov qayd etildi`);
    renderCredits();
    renderDashboard();
    renderExpenses();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderCredits() {
  const list = document.getElementById('creditsList');
  if (!state.credits.length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🏦</div><div>Hozircha kredit qo'shilmagan</div></div>`;
  } else {
    list.innerHTML = state.credits.map(c => {
      const remaining = Math.max(0, c.amount - (c.paid || 0));
      const progress = c.amount > 0 ? ((c.paid || 0) / c.amount) * 100 : 0;
      return `
        <div class="credit-card">
          <div class="credit-top">
            <div>
              <div class="credit-bank">🏦 ${escapeHtml(c.bank)}</div>
              ${c.purpose ? `<div class="credit-purpose">${escapeHtml(c.purpose)}</div>` : ''}
            </div>
          </div>
          <div class="credit-label">Qoldiq qarz</div>
          <div class="credit-amount-main">${fmt(remaining)}</div>
          <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="credit-progress-info">
            <span>${progress.toFixed(1)}% to'langan</span>
            <span>${fmt(c.paid || 0)} / ${fmt(c.amount)}</span>
          </div>
          <div class="credit-details">
            <div><div class="credit-detail-label">Oylik</div><div class="credit-detail-value">${fmt(c.monthly)}</div></div>
            <div><div class="credit-detail-label">Foiz</div><div class="credit-detail-value">${c.rate}%</div></div>
            <div><div class="credit-detail-label">Muddat</div><div class="credit-detail-value">${c.months} oy</div></div>
            <div><div class="credit-detail-label">Boshlandi</div><div class="credit-detail-value">${fmtDate(c.start || c.start_date)}</div></div>
          </div>
          <div class="credit-actions">
            <button class="btn btn-primary" style="flex:1" onclick="payCredit('${c.id}')">💵 To'lov</button>
            <button class="icon-btn" onclick="editCredit('${c.id}')">✏️</button>
            <button class="icon-btn danger" onclick="deleteCredit('${c.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  }
  const totalRemaining = state.credits.reduce((s,c) => s + Math.max(0, c.amount - (c.paid||0)), 0);
  const monthlySum = state.credits.reduce((s,c) => s + (Math.max(0, c.amount - (c.paid||0)) > 0 ? Number(c.monthly) : 0), 0);
  const paidSum = state.credits.reduce((s,c) => s + Number(c.paid || 0), 0);
  document.getElementById('creditTotalRemaining').textContent = fmt(totalRemaining);
  document.getElementById('creditMonthlySum').textContent = fmt(monthlySum);
  document.getElementById('creditTotalPaid').textContent = fmt(paidSum);
}

// ============ INCOME ============
async function saveIncome(e) {
  e.preventDefault();
  const id = document.getElementById('incomeId').value;
  const data = {
    source: document.getElementById('incomeSource').value,
    amount: parseFloat(document.getElementById('incomeAmount').value),
    date: document.getElementById('incomeDate').value,
    note: document.getElementById('incomeNote').value.trim(),
    recurring: document.getElementById('incomeRecurring').value || null,
  };
  setLoading(true);
  try {
    if (id) {
      const updated = await window.DB.update('incomes', id, data);
      const i = state.incomes.findIndex(x => x.id === id);
      if (i >= 0) state.incomes[i] = updated;
    } else {
      const newRow = await window.DB.insert('incomes', data);
      state.incomes.push(newRow);
    }
    closeModal('incomeModal');
    toast('Daromad qayd etildi');
    renderIncome();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function editIncome(id) {
  const x = state.incomes.find(i => i.id === id);
  if (!x) return;
  document.getElementById('incomeId').value = x.id;
  document.getElementById('incomeSource').value = x.source;
  document.getElementById('incomeAmount').value = x.amount;
  document.getElementById('incomeDate').value = x.date;
  document.getElementById('incomeNote').value = x.note || '';
  document.getElementById('incomeRecurring').value = x.recurring || '';
  document.getElementById('incomeModal').classList.add('active');
}

async function deleteIncome(id) {
  if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('incomes', id);
    state.incomes = state.incomes.filter(x => x.id !== id);
    toast("O'chirildi");
    renderIncome();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderIncome() {
  const filter = document.getElementById('incomeFilter').value;
  const q = document.getElementById('incomeSearch').value.toLowerCase().trim();
  const list = state.incomes
    .filter(x => inRange(x.date, filter))
    .filter(x => !q || (x.source + ' ' + (x.note||'')).toLowerCase().includes(q))
    .sort((a,b) => b.date.localeCompare(a.date));
  const el = document.getElementById('incomeList');
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">💰</div><div>Daromadlar topilmadi</div></div>`;
    return;
  }
  el.innerHTML = list.map(x => `
    <div class="transaction">
      <div class="trans-icon ${x.recurring ? 'recurring' : ''}">${CAT_ICONS[x.source] || '💰'}</div>
      <div class="trans-info">
        <div class="trans-title">${escapeHtml(x.source)}</div>
        ${x.note ? `<div class="trans-note">${escapeHtml(x.note)}</div>` : ''}
      </div>
      <div>
        <div class="trans-amount income">+${fmt(x.amount)}</div>
        <div class="trans-date">${fmtDate(x.date)}</div>
      </div>
      <div class="trans-actions">
        <button class="icon-btn" onclick="editIncome('${x.id}')">✏️</button>
        <button class="icon-btn danger" onclick="deleteIncome('${x.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

// ============ EXPENSES ============
async function saveExpense(e) {
  e.preventDefault();
  const id = document.getElementById('expenseId').value;
  const data = {
    category: document.getElementById('expenseCategory').value,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    date: document.getElementById('expenseDate').value,
    note: document.getElementById('expenseNote').value.trim(),
    recurring: document.getElementById('expenseRecurring').value || null,
  };
  setLoading(true);
  try {
    if (id) {
      const updated = await window.DB.update('expenses', id, data);
      const i = state.expenses.findIndex(x => x.id === id);
      if (i >= 0) state.expenses[i] = updated;
    } else {
      const newRow = await window.DB.insert('expenses', data);
      state.expenses.push(newRow);
    }
    closeModal('expenseModal');
    toast('Xarajat qayd etildi');

    // Budget warning
    checkBudgetAlert(data.category);

    renderExpenses();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function checkBudgetAlert(category) {
  const b = state.budgets.find(x => x.category === category);
  if (!b) return;
  const spent = state.expenses
    .filter(x => x.category === category && inRange(x.date, 'month'))
    .reduce((s,x) => s + Number(x.amount), 0);
  const pct = spent / Number(b.monthly_limit) * 100;
  if (pct >= 100) toast(`⚠️ ${category} byudjeti oshib ketdi!`, 'error');
  else if (pct >= 80) toast(`⚡ ${category} byudjeti ${pct.toFixed(0)}% foydalanildi`, 'warn');
}

function editExpense(id) {
  const x = state.expenses.find(i => i.id === id);
  if (!x) return;
  document.getElementById('expenseId').value = x.id;
  document.getElementById('expenseCategory').value = x.category;
  document.getElementById('expenseAmount').value = x.amount;
  document.getElementById('expenseDate').value = x.date;
  document.getElementById('expenseNote').value = x.note || '';
  document.getElementById('expenseRecurring').value = x.recurring || '';
  document.getElementById('expenseModal').classList.add('active');
}

async function deleteExpense(id) {
  if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('expenses', id);
    state.expenses = state.expenses.filter(x => x.id !== id);
    toast("O'chirildi");
    renderExpenses();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderExpenses() {
  const filter = document.getElementById('expenseFilter').value;
  const cat = document.getElementById('expenseCatFilter').value;
  const q = document.getElementById('expenseSearch').value.toLowerCase().trim();
  const list = state.expenses
    .filter(x => inRange(x.date, filter))
    .filter(x => cat === 'all' || x.category === cat)
    .filter(x => !q || (x.category + ' ' + (x.note||'')).toLowerCase().includes(q))
    .sort((a,b) => b.date.localeCompare(a.date));
  const el = document.getElementById('expensesList');
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">💸</div><div>Xarajatlar topilmadi</div></div>`;
    return;
  }
  el.innerHTML = list.map(x => `
    <div class="transaction">
      <div class="trans-icon ${x.recurring ? 'recurring' : ''}">${CAT_ICONS[x.category] || '📦'}</div>
      <div class="trans-info">
        <div class="trans-title">${escapeHtml(x.category)}</div>
        ${x.note ? `<div class="trans-note">${escapeHtml(x.note)}</div>` : ''}
      </div>
      <div>
        <div class="trans-amount expense">-${fmt(x.amount)}</div>
        <div class="trans-date">${fmtDate(x.date)}</div>
      </div>
      <div class="trans-actions">
        <button class="icon-btn" onclick="editExpense('${x.id}')">✏️</button>
        <button class="icon-btn danger" onclick="deleteExpense('${x.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

// ============ BUDGET ============
async function saveBudget(e) {
  e.preventDefault();
  const id = document.getElementById('budgetId').value;
  const data = {
    category: document.getElementById('budgetCategory').value,
    monthly_limit: parseFloat(document.getElementById('budgetLimit').value),
  };
  setLoading(true);
  try {
    // If category already has budget, update it
    const existing = state.budgets.find(b => b.category === data.category && b.id !== id);
    if (existing && !id) {
      const updated = await window.DB.update('budgets', existing.id, data);
      const i = state.budgets.findIndex(b => b.id === existing.id);
      state.budgets[i] = updated;
    } else if (id) {
      const updated = await window.DB.update('budgets', id, data);
      const i = state.budgets.findIndex(b => b.id === id);
      state.budgets[i] = updated;
    } else {
      const newRow = await window.DB.insert('budgets', data);
      state.budgets.push(newRow);
    }
    closeModal('budgetModal');
    toast('Byudjet saqlandi');
    renderBudget();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function editBudget(id) {
  const b = state.budgets.find(x => x.id === id);
  if (!b) return;
  document.getElementById('budgetId').value = b.id;
  document.getElementById('budgetCategory').value = b.category;
  document.getElementById('budgetLimit').value = b.monthly_limit;
  document.getElementById('budgetModal').classList.add('active');
}

async function deleteBudget(id) {
  if (!confirm("Byudjetni o'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('budgets', id);
    state.budgets = state.budgets.filter(b => b.id !== id);
    toast("O'chirildi");
    renderBudget();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderBudget() {
  const list = document.getElementById('budgetList');
  if (!state.budgets.length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🎯</div><div>Byudjet limitlari o'rnatilmagan</div><div style="margin-top:8px;font-size:12px;">Oylik xarajat chegarasi belgilang</div></div>`;
    renderBudgetMini();
    return;
  }
  list.innerHTML = state.budgets.map(b => {
    const spent = state.expenses
      .filter(x => x.category === b.category && inRange(x.date, 'month'))
      .reduce((s,x) => s + Number(x.amount), 0);
    const limit = Number(b.monthly_limit);
    const pct = limit > 0 ? (spent / limit * 100) : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'safe';
    const remaining = Math.max(0, limit - spent);
    return `
      <div class="budget-card">
        <div class="budget-top">
          <div class="budget-cat">${CAT_ICONS[b.category] || '📦'} ${escapeHtml(b.category)}</div>
          <div class="trans-actions">
            <button class="icon-btn" onclick="editBudget('${b.id}')">✏️</button>
            <button class="icon-btn danger" onclick="deleteBudget('${b.id}')">🗑️</button>
          </div>
        </div>
        <div class="budget-amount">${fmt(spent)} / ${fmt(limit)}</div>
        <div class="budget-info"><span>${pct.toFixed(1)}% foydalanildi</span><span>Qoldiq: ${fmt(remaining)}</span></div>
        <div class="budget-progress"><div class="budget-progress-fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div>
      </div>`;
  }).join('');
  renderBudgetMini();
}

function renderBudgetMini() {
  const el = document.getElementById('budgetMini');
  if (!state.budgets.length) {
    el.innerHTML = `<div class="empty" style="padding:20px"><div>Byudjet belgilang va oylik xarajatni nazorat qiling</div></div>`;
    return;
  }
  el.innerHTML = state.budgets.slice(0, 4).map(b => {
    const spent = state.expenses
      .filter(x => x.category === b.category && inRange(x.date, 'month'))
      .reduce((s,x) => s + Number(x.amount), 0);
    const limit = Number(b.monthly_limit);
    const pct = limit > 0 ? (spent / limit * 100) : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'safe';
    return `
      <div class="budget-mini-item">
        <div class="budget-mini-top">
          <span>${CAT_ICONS[b.category] || '📦'} ${escapeHtml(b.category)}</span>
          <span style="font-weight:600">${pct.toFixed(0)}%</span>
        </div>
        <div class="budget-mini-bar"><div class="budget-progress-fill ${cls} budget-mini-fill" style="width:${Math.min(100, pct)}%"></div></div>
      </div>`;
  }).join('');
}

// ============ DASHBOARD ============
let weekChartInst, categoryChartInst, trendChartInst, catPieChartInst;

function renderDashboard() {
  const d = new Date();
  document.getElementById('todayDate').textContent = fmtDateLong(d);

  const monthIncome = state.incomes.filter(x => inRange(x.date, 'month')).reduce((s,x) => s+Number(x.amount), 0);
  const monthExpense = state.expenses.filter(x => inRange(x.date, 'month')).reduce((s,x) => s+Number(x.amount), 0);
  const monthIncomeCount = state.incomes.filter(x => inRange(x.date, 'month')).length;
  const monthExpenseCount = state.expenses.filter(x => inRange(x.date, 'month')).length;

  const totalIncome = state.incomes.reduce((s,x) => s+Number(x.amount), 0);
  const totalExpense = state.expenses.reduce((s,x) => s+Number(x.amount), 0);
  const start = Number(window.DB.profile?.start_balance || 0);
  const balance = start + totalIncome - totalExpense;

  const totalCredit = state.credits.reduce((s,c) => s + Math.max(0, c.amount - (c.paid||0)), 0);
  const monthlyPayment = state.credits.reduce((s,c) => s + (Math.max(0, c.amount - (c.paid||0)) > 0 ? Number(c.monthly) : 0), 0);

  const saving = monthIncome - monthExpense;
  const savingPct = monthIncome > 0 ? (saving / monthIncome * 100) : 0;

  document.getElementById('totalBalance').textContent = fmt(balance);
  document.getElementById('monthIncome').textContent = fmt(monthIncome);
  document.getElementById('monthExpense').textContent = fmt(monthExpense);
  document.getElementById('monthIncomeCount').textContent = `${monthIncomeCount} ta kirim`;
  document.getElementById('monthExpenseCount').textContent = `${monthExpenseCount} ta chiqim`;
  document.getElementById('totalCredit').textContent = fmt(totalCredit);
  document.getElementById('monthlyPayment').textContent = `Oylik to'lov: ${fmt(monthlyPayment)}`;
  document.getElementById('monthSaving').textContent = fmt(saving);
  document.getElementById('savingPercent').textContent = `${savingPct.toFixed(1)}% daromaddan`;

  renderRecent();
  renderWeekChart();
  renderCategoryChart();
  renderBudgetMini();
}

function renderRecent() {
  const all = [
    ...state.incomes.map(x => ({...x, type: 'income', title: x.source})),
    ...state.expenses.map(x => ({...x, type: 'expense', title: x.category})),
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6);

  const el = document.getElementById('recentTransactions');
  if (!all.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📝</div><div>Hali tranzaktsiyalar yo'q</div></div>`;
    return;
  }
  el.innerHTML = all.map(x => `
    <div class="transaction">
      <div class="trans-icon ${x.recurring ? 'recurring' : ''}">${CAT_ICONS[x.title] || (x.type === 'income' ? '💰' : '📦')}</div>
      <div class="trans-info">
        <div class="trans-title">${escapeHtml(x.title)}</div>
        ${x.note ? `<div class="trans-note">${escapeHtml(x.note)}</div>` : ''}
      </div>
      <div>
        <div class="trans-amount ${x.type}">${x.type === 'income' ? '+' : '-'}${fmt(x.amount)}</div>
        <div class="trans-date">${fmtDate(x.date)}</div>
      </div>
      <div></div>
    </div>`).join('');
}

function renderWeekChart() {
  const days = [], incomeData = [], expenseData = [];
  const dayNames = ['Yak','Du','Se','Chor','Pay','Ju','Sh'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push(dayNames[d.getDay()]);
    incomeData.push(state.incomes.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
    expenseData.push(state.expenses.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
  }
  const ctx = document.getElementById('weekChart').getContext('2d');
  if (weekChartInst) weekChartInst.destroy();
  weekChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label: 'Daromad', data: incomeData, backgroundColor: '#10b981', borderRadius: 8 },
        { label: 'Xarajat', data: expenseData, backgroundColor: '#f43f5e', borderRadius: 8 },
      ]
    },
    options: chartOpts()
  });
}

function renderCategoryChart() {
  const monthExp = state.expenses.filter(x => inRange(x.date, 'month'));
  const byCat = {};
  monthExp.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
  const labels = Object.keys(byCat);
  const data = Object.values(byCat);
  const colors = ['#4f8cff','#f43f5e','#f59e0b','#10b981','#a855f7','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInst) categoryChartInst.destroy();
  if (!labels.length) {
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("Ma'lumot yo'q", ctx.canvas.width/2, ctx.canvas.height/2);
    return;
  }
  categoryChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'right', labels: { color: '#e8eef7', font: { size: 12 }, padding: 10, boxWidth: 12 } } }
    }
  });
}

// ============ ANALYTICS ============
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.period = btn.dataset.period;
    renderAnalytics();
  });
});

function renderAnalytics() {
  const p = state.period;
  const labelMap = { day: 'Bugun', week: 'Shu hafta', month: 'Shu oy' };
  const rangeMap = { day: 'today', week: 'week', month: 'month' };
  const range = rangeMap[p];

  const incomes = state.incomes.filter(x => inRange(x.date, range));
  const expenses = state.expenses.filter(x => inRange(x.date, range));
  const incomeSum = incomes.reduce((s,x) => s+Number(x.amount), 0);
  const expenseSum = expenses.reduce((s,x) => s+Number(x.amount), 0);
  const balance = incomeSum - expenseSum;

  let days = 1;
  if (p === 'week') days = 7;
  if (p === 'month') days = new Date().getDate();
  const avgDay = expenseSum / Math.max(days, 1);

  document.getElementById('anaIncomeLabel').textContent = `${labelMap[p]} daromad`;
  document.getElementById('anaExpenseLabel').textContent = `${labelMap[p]} xarajat`;
  document.getElementById('anaIncome').textContent = fmt(incomeSum);
  document.getElementById('anaExpense').textContent = fmt(expenseSum);
  document.getElementById('anaBalance').textContent = fmt(balance);
  document.getElementById('anaAvgDay').textContent = fmt(avgDay);

  renderTrendChart(p);
  renderCatPieChart(expenses);
  renderInsights(incomeSum, expenseSum, expenses);
}

function renderTrendChart(period) {
  let labels = [], incomeData = [], expenseData = [];
  const now = new Date();
  if (period === 'day') {
    const todayKey = now.toISOString().split('T')[0];
    // Show hourly buckets for today; since we don't track time, show by hour of creation unknown — fallback: one bar
    labels = ['Bugun'];
    incomeData = [state.incomes.filter(x => x.date === todayKey).reduce((s,x) => s+Number(x.amount), 0)];
    expenseData = [state.expenses.filter(x => x.date === todayKey).reduce((s,x) => s+Number(x.amount), 0)];
  } else if (period === 'week') {
    const dayNames = ['Yak','Du','Se','Chor','Pay','Ju','Sh'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      labels.push(dayNames[d.getDay()]);
      incomeData.push(state.incomes.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
      expenseData.push(state.expenses.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
    }
  } else {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      const key = d.toISOString().split('T')[0];
      labels.push(i.toString());
      incomeData.push(state.incomes.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
      expenseData.push(state.expenses.filter(x => x.date === key).reduce((s,x) => s+Number(x.amount), 0));
    }
  }

  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChartInst) trendChartInst.destroy();
  trendChartInst = new Chart(ctx, {
    type: period === 'day' ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        { label: 'Daromad', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', tension: 0.4, fill: true, borderRadius: 8 },
        { label: 'Xarajat', data: expenseData, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.15)', tension: 0.4, fill: true, borderRadius: 8 },
      ]
    },
    options: chartOpts()
  });
}

function renderCatPieChart(expenses) {
  const byCat = {};
  expenses.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
  const labels = Object.keys(byCat);
  const data = Object.values(byCat);
  const colors = ['#4f8cff','#f43f5e','#f59e0b','#10b981','#a855f7','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
  const ctx = document.getElementById('catPieChart').getContext('2d');
  if (catPieChartInst) catPieChartInst.destroy();
  if (!labels.length) {
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("Ma'lumot yo'q", ctx.canvas.width/2, ctx.canvas.height/2);
    return;
  }
  catPieChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '55%',
      plugins: { legend: { position: 'right', labels: { color: '#e8eef7', font: { size: 12 }, padding: 10 } } }
    }
  });
}

function renderInsights(income, expense, expenses) {
  const el = document.getElementById('insights');
  const tips = [];

  if (income > 0 && expense > 0) {
    const ratio = expense / income;
    if (ratio > 1) tips.push({ type: 'bad', icon: '⚠️', text: `Xarajatingiz daromadingizdan <b>${((ratio-1)*100).toFixed(0)}% ko'p</b>. Byudjetni qayta ko'rib chiqing.` });
    else if (ratio > 0.8) tips.push({ type: 'warn', icon: '⚡', text: `Daromadingizning <b>${(ratio*100).toFixed(0)}%</b> xarajat qilinmoqda. Jamg'arma kam.` });
    else if (ratio < 0.5) tips.push({ type: 'good', icon: '🎉', text: `Zo'r! Daromadingizning <b>${(ratio*100).toFixed(0)}%</b> sarflanyapti. Jamg'arma a'lo.` });
    else tips.push({ type: 'good', icon: '✅', text: `Xarajat/daromad: <b>${(ratio*100).toFixed(0)}%</b> — yaxshi balans.` });
  }

  const byCat = {};
  expenses.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
  const sorted = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  if (sorted.length) {
    const [cat, amt] = sorted[0];
    const pct = expense > 0 ? (amt/expense*100).toFixed(0) : 0;
    tips.push({ type: 'info', icon: CAT_ICONS[cat] || '📊', text: `Eng ko'p xarajat: <b>${cat}</b> — ${fmt(amt)} (${pct}%)` });
  }

  // Budget breaches
  state.budgets.forEach(b => {
    const spent = state.expenses
      .filter(x => x.category === b.category && inRange(x.date, 'month'))
      .reduce((s,x) => s + Number(x.amount), 0);
    const limit = Number(b.monthly_limit);
    if (limit > 0 && spent >= limit) {
      tips.push({ type: 'bad', icon: '🚨', text: `<b>${b.category}</b> byudjeti oshib ketdi: ${fmt(spent)} / ${fmt(limit)}` });
    }
  });

  const monthlyCreditPayment = state.credits.reduce((s,c) => s + (Math.max(0, c.amount-(c.paid||0))>0 ? Number(c.monthly) : 0), 0);
  const monthIncomeAll = state.incomes.filter(x => inRange(x.date, 'month')).reduce((s,x) => s+Number(x.amount), 0);
  if (monthIncomeAll > 0 && monthlyCreditPayment > 0) {
    const creditRatio = monthlyCreditPayment / monthIncomeAll;
    if (creditRatio > 0.5) tips.push({ type: 'bad', icon: '🚨', text: `Kredit to'lovi daromadingizning <b>${(creditRatio*100).toFixed(0)}%</b> ini tashkil qilyapti. Bu juda yuqori!` });
    else if (creditRatio > 0.3) tips.push({ type: 'warn', icon: '💳', text: `Kredit to'lovi daromadingizning <b>${(creditRatio*100).toFixed(0)}%</b>. Ehtiyot bo'ling.` });
  }

  if (!tips.length) tips.push({ type: 'info', icon: '💡', text: `Tahlil uchun daromad va xarajatlaringizni kiriting.` });

  el.innerHTML = tips.map(t => `<div class="insight ${t.type}"><div class="insight-icon">${t.icon}</div><div class="insight-text">${t.text}</div></div>`).join('');
}

// ============ SETTINGS ============
async function saveStartBalance() {
  const v = parseFloat(document.getElementById('startBalance').value) || 0;
  setLoading(true);
  try {
    await window.DB.saveProfile({ start_balance: v });
    toast("Saqlandi");
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function exportData() {
  const data = await window.DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moliya-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Eksport qilindi');
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    setLoading(true);
    try {
      const data = JSON.parse(ev.target.result);
      await window.DB.importAll(data);
      await loadAll();
      renderAll();
      toast('Import muvaffaqiyatli');
    } catch (err) { toast('Fayl formati xato: ' + err.message, 'error'); }
    finally { setLoading(false); }
  };
  reader.readAsText(file);
}

async function clearAll() {
  if (!confirm("HAMMA ma'lumotlarni o'chirishni tasdiqlaysizmi?")) return;
  if (!confirm("Haqiqatan ishonchingiz komilmi?")) return;
  setLoading(true);
  try {
    await window.DB.clearAll();
    state.credits = []; state.incomes = []; state.expenses = []; state.budgets = [];
    window.DB.profile = { start_balance: 0, currency: 'UZS' };
    toast("O'chirildi");
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

// ============ HELPERS ============
function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e8eef7', boxWidth: 12, padding: 12 } },
      tooltip: {
        backgroundColor: '#1a2332',
        titleColor: '#e8eef7',
        bodyColor: '#e8eef7',
        borderColor: '#2a3548',
        borderWidth: 1,
        padding: 10,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y || ctx.parsed)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: {
        ticks: {
          color: '#94a3b8',
          callback: (v) => {
            if (v >= 1e9) return (v/1e9).toFixed(1) + 'B';
            if (v >= 1e6) return (v/1e6).toFixed(1) + 'M';
            if (v >= 1e3) return (v/1e3).toFixed(0) + 'K';
            return v;
          }
        },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };
}

// ============ START ============
init();
