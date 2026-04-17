// ============================================================
// MOLIYA — MAIN APP LOGIC
// ============================================================

const state = {
  credits: [],
  incomes: [],
  expenses: [],
  budgets: [],
  debts: [],
  period: 'day',
  authMode: 'signin',
  debtFilter: 'all',
  scheduleOpen: {},
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

  // Decide screen — Auth majburiy
  if (window.DB.isCloud()) {
    await afterAuth(window.DB.user);
  } else if (!window.DB.isConfigured()) {
    showSetup();
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
  else showAuth();
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
    const [credits, incomes, expenses, budgets, debts] = await Promise.all([
      window.DB.list('credits'),
      window.DB.list('incomes'),
      window.DB.list('expenses'),
      window.DB.list('budgets'),
      window.DB.list('debts').catch(() => []),
    ]);
    state.credits = credits;
    state.incomes = incomes;
    state.expenses = expenses;
    state.budgets = budgets;
    state.debts = debts;
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
  renderDebts();
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
  if (name === 'debts') renderDebts();
  if (name === 'credits') renderCredits();
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
    document.getElementById('creditPaidMonths').value = 0;
    document.getElementById('creditPaymentDay').value = '';
    document.getElementById('creditModalTitle').textContent = 'Yangi kredit';
  }
  if (id === 'debtModal') {
    document.getElementById('debtForm').reset();
    document.getElementById('debtId').value = '';
    document.getElementById('debtPaid').value = 0;
    document.getElementById('debtPaidMonths').value = 0;
    toggleDebtFields();
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
  const monthly = parseFloat(document.getElementById('creditMonthly').value);
  const paidMonths = parseInt(document.getElementById('creditPaidMonths').value) || 0;
  const payDay = parseInt(document.getElementById('creditPaymentDay').value);
  const data = {
    bank: document.getElementById('creditBank').value.trim(),
    purpose: document.getElementById('creditPurpose').value.trim(),
    amount: parseFloat(document.getElementById('creditAmount').value),
    rate: parseFloat(document.getElementById('creditRate').value) || 0,
    months: parseInt(document.getElementById('creditMonths').value) || 12,
    monthly: monthly,
    start: document.getElementById('creditStart').value,
    paid_months: paidMonths,
    paid: paidMonths * monthly,
    payment_day: (payDay && payDay >= 1 && payDay <= 31) ? payDay : null,
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
  document.getElementById('creditPaidMonths').value = c.paid_months || Math.round((c.paid || 0) / (c.monthly || 1));
  document.getElementById('creditPaymentDay').value = c.payment_day || '';
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

// Manual to'lov (custom miqdor bilan)
async function payCredit(id) {
  const c = state.credits.find(x => x.id === id);
  if (!c) return;
  const amt = prompt(`Qancha to'lov? (oylik: ${fmt(c.monthly)})`, c.monthly);
  if (!amt) return;
  const sum = parseFloat(amt);
  if (isNaN(sum) || sum <= 0) return;
  setLoading(true);
  try {
    const newPaid = (c.paid || 0) + sum;
    const newPaidMonths = Math.floor(newPaid / Number(c.monthly || 1));
    const updated = await window.DB.update('credits', id, { paid: newPaid, paid_months: newPaidMonths });
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

// 1 oy to'lovini ✓ qilish
async function markCreditMonthPaid(id) {
  const c = state.credits.find(x => x.id === id);
  if (!c) return;
  const currentPaidMonths = c.paid_months || 0;
  if (currentPaidMonths >= c.months) { toast('Kredit allaqachon to\'liq to\'langan'); return; }
  setLoading(true);
  try {
    const newPaidMonths = currentPaidMonths + 1;
    const newPaid = newPaidMonths * Number(c.monthly);
    const updated = await window.DB.update('credits', id, { paid: newPaid, paid_months: newPaidMonths });
    const i = state.credits.findIndex(x => x.id === id);
    if (i >= 0) state.credits[i] = updated;
    const expense = await window.DB.insert('expenses', {
      category: 'Kredit', amount: Number(c.monthly), date: today(),
      note: `${c.bank} ${newPaidMonths}-oy to'lovi`, recurring: null
    });
    state.expenses.push(expense);
    toast(`✓ ${newPaidMonths}-oy to'lovi belgilandi`);
    renderCredits();
    renderDashboard();
    renderExpenses();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function toggleSchedule(id) {
  state.scheduleOpen[id] = !state.scheduleOpen[id];
  renderCredits();
}

// Boshlanish sanasidan N oy keyingi sanani hisoblash
function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

// payment_day berilgan bo'lsa shu kunga to'g'rilaydi (oy oxiridan oshmasdan)
function withPaymentDay(dateStr, paymentDay) {
  if (!paymentDay) return dateStr;
  const d = new Date(dateStr);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(paymentDay, lastDay));
  return d.toISOString().split('T')[0];
}

function renderCredits() {
  const list = document.getElementById('creditsList');
  if (!state.credits.length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🏦</div><div>Hozircha kredit qo'shilmagan</div></div>`;
  } else {
    list.innerHTML = state.credits.map(c => renderCreditCard(c)).join('');
  }
  const totalRemaining = state.credits.reduce((s,c) => s + Math.max(0, c.amount - (c.paid||0)), 0);
  const monthlySum = state.credits.reduce((s,c) => s + (Math.max(0, c.amount - (c.paid||0)) > 0 ? Number(c.monthly) : 0), 0);
  const paidSum = state.credits.reduce((s,c) => s + Number(c.paid || 0), 0);
  document.getElementById('creditTotalRemaining').textContent = fmt(totalRemaining);
  document.getElementById('creditMonthlySum').textContent = fmt(monthlySum);
  document.getElementById('creditTotalPaid').textContent = fmt(paidSum);
}

function renderCreditCard(c) {
  const monthly = Number(c.monthly);
  const totalMonths = Number(c.months);
  const paidMonths = Number(c.paid_months || Math.round((c.paid || 0) / (monthly || 1)));
  const remainingMonths = Math.max(0, totalMonths - paidMonths);
  const remaining = Math.max(0, c.amount - (c.paid || 0));
  const progress = totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0;
  const startDate = c.start || c.start_date;

  let nextPaymentHtml = '';
  if (paidMonths < totalMonths) {
    const nextDate = withPaymentDay(addMonths(startDate, paidMonths + 1), c.payment_day);
    const today_d = today();
    const dueClass = nextDate < today_d ? 'overdue' : (nextDate === today_d ? 'due' : '');
    const dueLabel = nextDate < today_d ? '⚠️ Muddat o\'tdi' : nextDate === today_d ? '🔔 Bugun to\'lash' : 'Keyingi to\'lov';
    nextPaymentHtml = `
      <div class="next-payment ${dueClass}">
        <div class="next-payment-info">
          <div class="next-payment-label">${dueLabel} · ${paidMonths + 1}/${totalMonths}-oy</div>
          <div class="next-payment-date">${fmtDate(nextDate)}</div>
        </div>
        <div class="next-payment-amount">${fmt(monthly)}</div>
        <button class="btn-pay" onclick="markCreditMonthPaid('${c.id}')">✓ To'ladim</button>
      </div>`;
  } else {
    nextPaymentHtml = `<div class="next-payment done">
      <div class="next-payment-info">
        <div class="next-payment-label">🎉 Tabriklayman!</div>
        <div class="next-payment-date">Kredit to'liq to'landi</div>
      </div>
    </div>`;
  }

  // Schedule rows
  const isOpen = state.scheduleOpen[c.id];
  let scheduleHtml = '';
  if (isOpen) {
    const rows = [];
    for (let i = 1; i <= totalMonths; i++) {
      const date = withPaymentDay(addMonths(startDate, i), c.payment_day);
      const isPaid = i <= paidMonths;
      rows.push(`
        <div class="schedule-row ${isPaid ? 'paid' : ''}">
          <div class="schedule-month">${i}-oy</div>
          <div class="schedule-date">${fmtDate(date)}</div>
          <div class="schedule-amount">${fmt(monthly)}</div>
          <div class="schedule-status">${isPaid ? '✅' : '⬜'}</div>
        </div>`);
    }
    scheduleHtml = `<div class="schedule open">${rows.join('')}</div>`;
  }

  return `
    <div class="credit-card">
      <div class="credit-top">
        <div>
          <div class="credit-bank">🏦 ${escapeHtml(c.bank)}</div>
          ${c.purpose ? `<div class="credit-purpose">${escapeHtml(c.purpose)}</div>` : ''}
        </div>
      </div>
      <div class="credit-label">Qoldiq qarz · ${remainingMonths} oy qoldi</div>
      <div class="credit-amount-main">${fmt(remaining)}</div>
      <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="credit-progress-info">
        <span><b>${paidMonths}/${totalMonths}</b> oy to'langan (${progress.toFixed(0)}%)</span>
        <span>${fmt(c.paid || 0)} / ${fmt(c.amount)}</span>
      </div>

      ${nextPaymentHtml}

      <button class="schedule-toggle" onclick="toggleSchedule('${c.id}')">${isOpen ? '▲ Jadvalni yashirish' : '▼ To\'lov jadvalini ko\'rish'}</button>
      ${scheduleHtml}

      <div class="credit-details">
        <div><div class="credit-detail-label">Oylik</div><div class="credit-detail-value">${fmt(monthly)}</div></div>
        <div><div class="credit-detail-label">Foiz</div><div class="credit-detail-value">${c.rate}%</div></div>
        <div><div class="credit-detail-label">Muddat</div><div class="credit-detail-value">${totalMonths} oy</div></div>
        <div><div class="credit-detail-label">Boshlandi</div><div class="credit-detail-value">${fmtDate(startDate)}</div></div>
        ${c.payment_day ? `<div style="grid-column:1/-1"><div class="credit-detail-label">To'lov kuni</div><div class="credit-detail-value">Har oyning ${c.payment_day}-sanasi</div></div>` : ''}
      </div>
      <div class="credit-actions">
        <button class="btn btn-secondary" style="flex:1" onclick="payCredit('${c.id}')">💵 Boshqa miqdorda to'lash</button>
        <button class="icon-btn" onclick="editCredit('${c.id}')">✏️</button>
        <button class="icon-btn danger" onclick="deleteCredit('${c.id}')">🗑️</button>
      </div>
    </div>`;
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

// ============ DEBTS / INSTALLMENTS ============
function toggleDebtFields() {
  const kind = document.getElementById('debtKind').value;
  const isInst = kind === 'installment';
  document.getElementById('debtInstallmentBlock').style.display = isInst ? 'block' : 'none';
  document.getElementById('debtSimpleBlock').style.display = isInst ? 'none' : 'block';
  // For installments, monthly + months become required
  document.getElementById('debtMonthly').required = isInst;
  document.getElementById('debtMonths').required = isInst;
}

document.querySelectorAll('[data-debt-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-debt-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.debtFilter = btn.dataset.debtFilter;
    renderDebts();
  });
});

async function saveDebt(e) {
  e.preventDefault();
  const id = document.getElementById('debtId').value;
  const kind = document.getElementById('debtKind').value;
  const isInst = kind === 'installment';
  const data = {
    title: document.getElementById('debtTitle').value.trim(),
    kind,
    person: document.getElementById('debtPerson').value.trim(),
    amount: parseFloat(document.getElementById('debtAmount').value),
    due_date: document.getElementById('debtDueDate').value || null,
    note: document.getElementById('debtNote').value.trim(),
    monthly: isInst ? parseFloat(document.getElementById('debtMonthly').value) : null,
    months: isInst ? parseInt(document.getElementById('debtMonths').value) : null,
  };
  if (isInst) {
    const pm = parseInt(document.getElementById('debtPaidMonths').value) || 0;
    data.paid_months = pm;
    data.paid = pm * (data.monthly || 0);
  } else {
    data.paid = parseFloat(document.getElementById('debtPaid').value) || 0;
    data.paid_months = 0;
  }
  setLoading(true);
  try {
    if (id) {
      const updated = await window.DB.update('debts', id, data);
      const i = state.debts.findIndex(x => x.id === id);
      if (i >= 0) state.debts[i] = updated;
    } else {
      const newRow = await window.DB.insert('debts', data);
      state.debts.push(newRow);
    }
    closeModal('debtModal');
    toast('Qarz saqlandi');
    renderDebts();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function editDebt(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  document.getElementById('debtId').value = d.id;
  document.getElementById('debtKind').value = d.kind;
  document.getElementById('debtTitle').value = d.title;
  document.getElementById('debtPerson').value = d.person || '';
  document.getElementById('debtAmount').value = d.amount;
  document.getElementById('debtDueDate').value = d.due_date || '';
  document.getElementById('debtNote').value = d.note || '';
  document.getElementById('debtMonthly').value = d.monthly || '';
  document.getElementById('debtMonths').value = d.months || '';
  document.getElementById('debtPaidMonths').value = d.paid_months || 0;
  document.getElementById('debtPaid').value = d.paid || 0;
  toggleDebtFields();
  document.getElementById('debtModal').classList.add('active');
}

async function deleteDebt(id) {
  if (!confirm("Qarzni o'chirishni tasdiqlaysizmi?")) return;
  setLoading(true);
  try {
    await window.DB.remove('debts', id);
    state.debts = state.debts.filter(x => x.id !== id);
    toast("O'chirildi");
    renderDebts();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function markDebtPaid(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  setLoading(true);
  try {
    const updated = await window.DB.update('debts', id, { paid: Number(d.amount) });
    const i = state.debts.findIndex(x => x.id === id);
    if (i >= 0) state.debts[i] = updated;
    toast("To'liq to'landi deb belgilandi");
    renderDebts();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

async function markDebtMonthPaid(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  const currentPaidMonths = d.paid_months || 0;
  if (currentPaidMonths >= d.months) { toast("Allaqachon to'liq to'langan"); return; }
  setLoading(true);
  try {
    const newPaidMonths = currentPaidMonths + 1;
    const newPaid = newPaidMonths * Number(d.monthly);
    const updated = await window.DB.update('debts', id, { paid: newPaid, paid_months: newPaidMonths });
    const i = state.debts.findIndex(x => x.id === id);
    if (i >= 0) state.debts[i] = updated;
    // Auto-add expense for installment payments (only if it's something I bought, i.e. installment is "i_owe" type by nature)
    if (d.kind === 'installment') {
      const expense = await window.DB.insert('expenses', {
        category: 'Boshqa', amount: Number(d.monthly), date: today(),
        note: `${d.title} ${newPaidMonths}-oy to'lovi`, recurring: null
      });
      state.expenses.push(expense);
    }
    toast(`✓ ${newPaidMonths}-oy to'lovi belgilandi`);
    renderDebts();
    renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderDebts() {
  const list = document.getElementById('debtsList');
  if (!list) return;
  const filtered = state.debts.filter(d => state.debtFilter === 'all' || d.kind === state.debtFilter);

  // Stats
  const iOweTotal = state.debts.filter(d => d.kind === 'i_owe').reduce((s,d) => s + Math.max(0, Number(d.amount) - Number(d.paid||0)), 0);
  const owedToMeTotal = state.debts.filter(d => d.kind === 'owed_to_me').reduce((s,d) => s + Math.max(0, Number(d.amount) - Number(d.paid||0)), 0);
  const instTotal = state.debts.filter(d => d.kind === 'installment').reduce((s,d) => s + Math.max(0, Number(d.amount) - Number(d.paid||0)), 0);
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('debtIOweTotal', fmt(iOweTotal));
  setText('debtOwedToMe', fmt(owedToMeTotal));
  setText('debtInstallmentTotal', fmt(instTotal));

  if (!filtered.length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">💳</div><div>Qarzlar yo'q</div><div style="margin-top:8px;font-size:12px;">Yangi qarz yoki muddatli to'lov qo'shing</div></div>`;
    return;
  }

  list.innerHTML = filtered.map(d => renderDebtCard(d)).join('');
}

function renderDebtCard(d) {
  const kindLabel = { i_owe: '⬇️ Men qarzdorman', owed_to_me: '⬆️ Menga qarzdor', installment: '📅 Muddatli to\'lov' }[d.kind];
  const remaining = Math.max(0, Number(d.amount) - Number(d.paid || 0));
  const progress = d.amount > 0 ? (Number(d.paid || 0) / Number(d.amount)) * 100 : 0;
  const isFullyPaid = remaining === 0;

  let dueDateHtml = '';
  if (d.due_date && !isFullyPaid && d.kind !== 'installment') {
    const today_d = today();
    const cls = d.due_date < today_d ? 'due-date-overdue' : (d.due_date <= addMonths(today_d, 0).split('T')[0] ? 'due-date-warn' : '');
    const label = d.due_date < today_d ? '⚠️ Muddat o\'tdi: ' : '📅 Muddat: ';
    dueDateHtml = `<div class="${cls}" style="font-size:12px;margin-bottom:8px">${label}${fmtDate(d.due_date)}</div>`;
  }

  let actionHtml = '';
  if (d.kind === 'installment') {
    const monthly = Number(d.monthly || 0);
    const totalMonths = Number(d.months || 0);
    const paidMonths = Number(d.paid_months || 0);
    if (paidMonths < totalMonths) {
      const nextDate = d.due_date ? addMonths(d.due_date, paidMonths) : addMonths(d.created_at || today(), paidMonths + 1);
      actionHtml = `
        <div class="next-payment">
          <div class="next-payment-info">
            <div class="next-payment-label">Keyingi · ${paidMonths + 1}/${totalMonths}-oy</div>
            <div class="next-payment-date">${fmtDate(nextDate)}</div>
          </div>
          <div class="next-payment-amount">${fmt(monthly)}</div>
          <button class="btn-pay" onclick="markDebtMonthPaid('${d.id}')">✓ To'ladim</button>
        </div>`;
    } else {
      actionHtml = `<div class="next-payment done"><div class="next-payment-info"><div class="next-payment-label">🎉 Tabriklayman!</div><div class="next-payment-date">To'liq to'landi</div></div></div>`;
    }
  } else if (!isFullyPaid) {
    actionHtml = `<div class="next-payment"><div class="next-payment-info"><div class="next-payment-label">Holat</div><div class="next-payment-date">To'lanmadi</div></div><button class="btn-pay" onclick="markDebtPaid('${d.id}')">✓ To'liq to'landi</button></div>`;
  } else {
    actionHtml = `<div class="next-payment done"><div class="next-payment-info"><div class="next-payment-label">✅</div><div class="next-payment-date">To'liq to'landi</div></div></div>`;
  }

  return `
    <div class="credit-card">
      <div class="credit-top">
        <div>
          <div class="credit-bank">${escapeHtml(d.title)}</div>
          ${d.person ? `<div class="credit-purpose">${escapeHtml(d.person)}</div>` : ''}
        </div>
        <span class="debt-badge ${d.kind}">${kindLabel}</span>
      </div>
      <div class="credit-label">Qoldiq</div>
      <div class="credit-amount-main">${fmt(remaining)}</div>
      <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="credit-progress-info">
        <span>${progress.toFixed(0)}% to'langan</span>
        <span>${fmt(d.paid || 0)} / ${fmt(d.amount)}</span>
      </div>
      ${dueDateHtml}
      ${actionHtml}
      ${d.note ? `<div class="muted" style="font-size:12px;margin-top:8px">${escapeHtml(d.note)}</div>` : ''}
      <div class="credit-actions">
        <button class="icon-btn" onclick="editDebt('${d.id}')">✏️ Tahrirlash</button>
        <button class="icon-btn danger" onclick="deleteDebt('${d.id}')">🗑️</button>
      </div>
    </div>`;
}

// ============ START ============
init();
