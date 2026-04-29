// ============================================================
// KFinance Store - Data Management with localStorage
// ============================================================

const CATEGORIES = {
  expense: [
    { id: 'food', name: 'Ăn uống', icon: 'restaurant', color: '#ffc8b4' },
    { id: 'transport', name: 'Di chuyển', icon: 'directions_car', color: '#add8e6' },
    { id: 'shopping', name: 'Mua sắm', icon: 'shopping_cart', color: '#b4adea' },
    { id: 'entertainment', name: 'Giải trí', icon: 'movie', color: '#fff4bd' },
    { id: 'bills', name: 'Hóa đơn', icon: 'receipt', color: '#ffaaa5' },
    { id: 'health', name: 'Sức khỏe', icon: 'medical_services', color: '#a8e6cf' },
    { id: 'education', name: 'Giáo dục', icon: 'school', color: '#c1f0f0' },
    { id: 'other_expense', name: 'Khác', icon: 'more_horiz', color: '#dcdde1' }
  ],
  income: [
    { id: 'salary', name: 'Lương', icon: 'payments', color: '#a8e6cf' },
    { id: 'bonus', name: 'Thưởng', icon: 'redeem', color: '#fff4bd' },
    { id: 'invest', name: 'Đầu tư', icon: 'trending_up', color: '#b4adea' },
    { id: 'selling', name: 'Bán hàng', icon: 'sell', color: '#ffc8b4' },
    { id: 'freelance', name: 'Freelance', icon: 'computer', color: '#add8e6' },
    { id: 'other_income', name: 'Khác', icon: 'more_horiz', color: '#dcdde1' }
  ]
};

const WALLET_ICONS = [
  { id: 'account_balance', label: 'Ngân hàng' },
  { id: 'wallet', label: 'Ví' },
  { id: 'credit_card', label: 'Thẻ' },
  { id: 'phone_android', label: 'E-wallet' },
  { id: 'savings', label: 'Tiết kiệm' },
  { id: 'attach_money', label: 'Tiền mặt' }
];

const BANK_COLORS = [
  '#b4adea', '#a8e6cf', '#ffc8b4', '#add8e6', '#fff4bd',
  '#ffaaa5', '#c1f0f0', '#dcdde1', '#81ecec', '#fab1a0'
];

// ---- WALLET STORE ----
const WalletStore = {
  _key: 'kfinance_wallets',

  _defaults() {
    return [
      { id: 'main', name: 'Tiền mặt', icon: 'wallet', color: '#6c5ce7', bank: '', isPrimary: true, createdAt: new Date().toISOString() }
    ];
  },

  getAll() {
    try {
      const data = JSON.parse(localStorage.getItem(this._key));
      if (!data || !data.length) { this._save(this._defaults()); return this._defaults(); }
      return data;
    } catch { this._save(this._defaults()); return this._defaults(); }
  },

  _save(wallets) { localStorage.setItem(this._key, JSON.stringify(wallets)); },

  add(wallet) {
    const all = this.getAll();
    wallet.id = 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    wallet.createdAt = new Date().toISOString();
    wallet.isPrimary = false;
    all.push(wallet);
    this._save(all);
    return wallet;
  },

  update(id, updates) {
    const all = this.getAll();
    const idx = all.findIndex(w => w.id === id);
    if (idx >= 0) { Object.assign(all[idx], updates); this._save(all); }
  },

  delete(id) {
    const all = this.getAll();
    const w = all.find(w => w.id === id);
    if (!w) return false;
    if (w.isPrimary) return false; // Can't delete primary
    // Move any transactions to Tiền mặt (id='main')
    const cashId = 'main';
    const txns = Store._getAll();
    let changed = false;
    txns.forEach(t => {
      if (t.wallet === id) { t.wallet = cashId; changed = true; }
      if (t.fromWallet === id) { t.fromWallet = cashId; changed = true; }
      if (t.toWallet === id) { t.toWallet = cashId; changed = true; }
    });
    if (changed) Store._save(txns);
    this._save(all.filter(w => w.id !== id));
    return true;
  },

  setPrimary(id) {
    const all = this.getAll();
    all.forEach(w => w.isPrimary = (w.id === id));
    this._save(all);
  },

  getPrimary() {
    return this.getAll().find(w => w.isPrimary) || this.getAll()[0];
  },

  getById(id) {
    return this.getAll().find(w => w.id === id);
  },

  getBalance(walletId) {
    const txns = Store._getAll();
    let balance = 0;
    txns.forEach(t => {
      if (t.type === 'transfer') {
        if (t.fromWallet === walletId) balance -= t.amount;
        if (t.toWallet === walletId) balance += t.amount;
      } else if (t.wallet === walletId) {
        if (t.type === 'income') balance += t.amount;
        else balance -= t.amount;
      }
    });
    return balance;
  },

  getAllBalances() {
    const wallets = this.getAll();
    return wallets.map(w => ({ ...w, balance: this.getBalance(w.id) }));
  },

  getTotalBalance() {
    return this.getAll().reduce((sum, w) => sum + this.getBalance(w.id), 0);
  }
};

// ---- TRANSACTION STORE ----
const Store = {
  _key: 'kfinance_data',

  _getAll() {
    try { return JSON.parse(localStorage.getItem(this._key)) || []; }
    catch { return []; }
  },

  _saveAll(txns) { localStorage.setItem(this._key, JSON.stringify(txns)); },

  addTransaction(txn) {
    const all = this._getAll();
    txn.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    txn.createdAt = new Date().toISOString();
    all.unshift(txn);
    this._saveAll(all);
    return txn;
  },

  addTransfer(fromWallet, toWallet, amount, note, date) {
    const txn = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type: 'transfer',
      amount,
      fromWallet,
      toWallet,
      note: note || 'Chuyển tiền',
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    const all = this._getAll();
    all.unshift(txn);
    this._saveAll(all);
    return txn;
  },

  addMany(txns) {
    const all = this._getAll();
    txns.forEach(t => {
      t.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 4);
      t.createdAt = new Date().toISOString();
      all.unshift(t);
    });
    this._saveAll(all);
  },

  deleteTransaction(id) {
    const all = this._getAll().filter(t => t.id !== id);
    this._saveAll(all);
  },

  updateTransaction(id, updates) {
    const all = this._getAll();
    const idx = all.findIndex(t => t.id === id);
    if (idx >= 0) { Object.assign(all[idx], updates); this._saveAll(all); }
  },

  getAll(filters = {}) {
    let txns = this._getAll();
    if (filters.type) txns = txns.filter(t => t.type === filters.type);
    if (filters.category) txns = txns.filter(t => t.category === filters.category);
    if (filters.wallet) txns = txns.filter(t => t.wallet === filters.wallet || t.fromWallet === filters.wallet || t.toWallet === filters.wallet);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      txns = txns.filter(t => (t.note || '').toLowerCase().includes(q) || (t.categoryName || '').toLowerCase().includes(q));
    }
    if (filters.dateFrom) txns = txns.filter(t => t.date >= filters.dateFrom);
    if (filters.dateTo) txns = txns.filter(t => t.date <= filters.dateTo);
    if (filters.excludeTransfers) txns = txns.filter(t => t.type !== 'transfer');
    return txns.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  getSummary(month, walletId) {
    const txns = this._getAll().filter(t => {
      if (t.type === 'transfer') return false;
      if (walletId && t.wallet !== walletId) return false;
      if (month) return t.date && t.date.startsWith(month);
      return true;
    });
    let income = 0, expense = 0;
    txns.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    const balance = walletId ? WalletStore.getBalance(walletId) : WalletStore.getTotalBalance();
    return { income, expense, balance, count: txns.length };
  },

  getCategoryBreakdown(type = 'expense', month, walletId) {
    const txns = this._getAll().filter(t => {
      if (t.type !== type) return false;
      if (walletId && t.wallet !== walletId) return false;
      if (month) return t.date && t.date.startsWith(month);
      return true;
    });
    const map = {};
    txns.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    const cats = type === 'expense' ? CATEGORIES.expense : CATEGORIES.income;
    return Object.entries(map).map(([id, total]) => {
      const cat = cats.find(c => c.id === id) || { name: id, icon: 'category', color: '#928ea0' };
      return { id, name: cat.name, icon: cat.icon, color: cat.color, total };
    }).sort((a, b) => b.total - a.total);
  },

  getDailyTrend(days = 7, walletId) {
    const result = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayTxns = this._getAll().filter(t => {
        if (t.date !== ds || t.type === 'transfer') return false;
        if (walletId && t.wallet !== walletId) return false;
        return true;
      });
      let inc = 0, exp = 0;
      dayTxns.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      result.push({ date: ds, label: dayNames[d.getDay()], income: inc, expense: exp });
    }
    return result;
  },

  clearAll() {
    localStorage.removeItem(this._key);
    localStorage.removeItem(WalletStore._key);
  },

  exportData() {
    return JSON.stringify({ transactions: this._getAll(), wallets: WalletStore.getAll() }, null, 2);
  },

  importData(json) {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data)) { this._saveAll(data); return true; }
      if (data.transactions) { this._saveAll(data.transactions); }
      if (data.wallets) { WalletStore._save(data.wallets); }
      return true;
    } catch { return false; }
  }
};

// ---- UTILITIES ----
function formatVND(amount) { return new Intl.NumberFormat('vi-VN').format(amount) + '₫'; }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Hôm nay';
  if (d.getTime() === yesterday.getTime()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function getCategoryInfo(catId, type = 'expense') {
  const list = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
  return list.find(c => c.id === catId) || { name: catId, icon: 'category', color: '#928ea0' };
}

function getWalletName(wId) {
  const w = WalletStore.getById(wId);
  return w ? w.name : (wId || '—');
}

function getWalletInfo(wId) {
  return WalletStore.getById(wId) || { name: wId || '—', icon: 'wallet', color: '#928ea0' };
}
