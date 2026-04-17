// ============================================================
// DB LAYER — Supabase + localStorage offline cache
// ============================================================
// Agar Supabase sozlangan va user login bo'lgan bo'lsa → bulutga yozadi
// Aks holda → localStorage (demo/offline rejim)
// ============================================================

const TABLES = ['credits', 'incomes', 'expenses', 'budgets', 'debts', 'subscriptions'];

class DB {
  constructor() {
    this.sb = null;
    this.user = null;
    this.mode = 'local'; // 'local' | 'cloud'
    this.onAuthChange = null;
    this.profile = null;
  }

  async init() {
    const cfg = window.SUPABASE_CONFIG || {};
    if (cfg.url && cfg.anonKey && window.supabase) {
      this.sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      const { data } = await this.sb.auth.getSession();
      if (data?.session?.user) {
        this.user = data.session.user;
        this.mode = 'cloud';
        await this.loadProfile();
      }
      this.sb.auth.onAuthStateChange(async (event, session) => {
        this.user = session?.user || null;
        this.mode = this.user ? 'cloud' : 'local';
        if (this.user) await this.loadProfile();
        if (this.onAuthChange) this.onAuthChange(this.user);
      });
    }
    return this;
  }

  isCloud() { return this.mode === 'cloud' && this.sb && this.user; }
  isConfigured() { return !!(window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey); }

  // ===== AUTH =====
  async signUp(email, password) {
    if (!this.sb) throw new Error('Supabase sozlanmagan');
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    if (!this.sb) throw new Error('Supabase sozlanmagan');
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    if (!this.sb) return;
    await this.sb.auth.signOut();
    this.user = null;
    this.mode = 'local';
  }

  // ===== PROFILE =====
  async loadProfile() {
    if (!this.isCloud()) {
      this.profile = {
        start_balance: parseFloat(localStorage.getItem('fin_start') || '0'),
        currency: localStorage.getItem('fin_currency') || 'UZS',
        display_name: null,
      };
      return this.profile;
    }
    const { data } = await this.sb.from('profiles').select('*').eq('id', this.user.id).single();
    this.profile = data || { start_balance: 0, currency: 'UZS' };
    return this.profile;
  }

  async saveProfile(patch) {
    if (!this.isCloud()) {
      if ('start_balance' in patch) localStorage.setItem('fin_start', String(patch.start_balance));
      if ('currency' in patch) localStorage.setItem('fin_currency', patch.currency);
      this.profile = { ...this.profile, ...patch };
      return;
    }
    const { error } = await this.sb.from('profiles').upsert({ id: this.user.id, ...patch });
    if (error) throw error;
    this.profile = { ...this.profile, ...patch };
  }

  // ===== CRUD =====
  _lsKey(table) { return `fin_${table}`; }
  _readLocal(table) { return JSON.parse(localStorage.getItem(this._lsKey(table)) || '[]'); }
  _writeLocal(table, rows) { localStorage.setItem(this._lsKey(table), JSON.stringify(rows)); }

  async list(table) {
    if (!this.isCloud()) return this._readLocal(table);
    const { data, error } = await this.sb.from(table).select('*').eq('user_id', this.user.id).order('created_at', { ascending: false });
    if (error) { console.error(error); return this._readLocal(table); }
    // Normalize: Supabase returns start_date, app uses start
    const normalized = (data || []).map(r => {
      if (table === 'credits' && r.start_date) return { ...r, start: r.start_date };
      return r;
    });
    this._writeLocal(table, normalized); // cache
    return normalized;
  }

  async insert(table, row) {
    if (!this.isCloud()) {
      const rows = this._readLocal(table);
      const newRow = { ...row, id: row.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)) };
      rows.push(newRow);
      this._writeLocal(table, rows);
      return newRow;
    }
    const payload = { ...row, user_id: this.user.id };
    delete payload.id;
    // Rename start → start_date for credits
    if (table === 'credits' && payload.start) { payload.start_date = payload.start; delete payload.start; }
    const { data, error } = await this.sb.from(table).insert(payload).select().single();
    if (error) throw error;
    const normalized = table === 'credits' && data.start_date ? { ...data, start: data.start_date } : data;
    return normalized;
  }

  async update(table, id, patch) {
    if (!this.isCloud()) {
      const rows = this._readLocal(table);
      const i = rows.findIndex(r => r.id === id);
      if (i >= 0) { rows[i] = { ...rows[i], ...patch }; this._writeLocal(table, rows); }
      return rows[i];
    }
    const payload = { ...patch };
    delete payload.id;
    delete payload.user_id;
    if (table === 'credits' && payload.start) { payload.start_date = payload.start; delete payload.start; }
    const { data, error } = await this.sb.from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return table === 'credits' && data.start_date ? { ...data, start: data.start_date } : data;
  }

  async remove(table, id) {
    if (!this.isCloud()) {
      const rows = this._readLocal(table).filter(r => r.id !== id);
      this._writeLocal(table, rows);
      return;
    }
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw error;
  }

  async clearAll() {
    if (!this.isCloud()) {
      TABLES.forEach(t => localStorage.removeItem(this._lsKey(t)));
      localStorage.removeItem('fin_start');
      localStorage.removeItem('fin_currency');
      return;
    }
    for (const t of TABLES) {
      await this.sb.from(t).delete().eq('user_id', this.user.id);
    }
    await this.sb.from('profiles').update({ start_balance: 0 }).eq('id', this.user.id);
  }

  async exportAll() {
    const out = { exportDate: new Date().toISOString(), mode: this.mode };
    for (const t of TABLES) out[t] = await this.list(t);
    out.profile = this.profile;
    return out;
  }

  async importAll(data) {
    for (const t of TABLES) {
      if (!Array.isArray(data[t])) continue;
      for (const row of data[t]) {
        try {
          const { id, user_id, created_at, ...clean } = row;
          await this.insert(t, clean);
        } catch (e) { console.warn('Import skip:', e.message); }
      }
    }
    if (data.profile) await this.saveProfile({
      start_balance: data.profile.start_balance || 0,
      currency: data.profile.currency || 'UZS',
    });
  }
}

window.DB = new DB();
