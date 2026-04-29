// ============================================================
// KFinance Mobile-First App - Multi Wallet with Per-Wallet View
// ============================================================

let importedRows = [], columnMapping = {}, donutChart = null, barChart = null;
let selectedWallet = null; // null = "Tổng hợp" (all wallets)
let editingWalletId = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Auto-select primary wallet on load
  const primary = WalletStore.getPrimary();
  if (primary) selectedWallet = primary.id;

  document.getElementById('f-date').value = today();
  document.getElementById('trf-date').value = today();
  initCats(); initWalletSelects(); refresh();

  // Enable mouse wheel horizontal scroll on wallet strip
  const strip = document.getElementById('wallet-strip');
  strip.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Enable click-and-drag horizontal scroll
  let isDragging = false, startX = 0, scrollStart = 0, hasDragged = false;
  strip.addEventListener('mousedown', (e) => {
    isDragging = true; hasDragged = false;
    startX = e.pageX; scrollStart = strip.scrollLeft;
    strip.style.cursor = 'grabbing';
    strip.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 3) hasDragged = true;
    strip.scrollLeft = scrollStart - dx;
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    strip.style.cursor = '';
    strip.style.userSelect = '';
  });
  // Prevent click events when dragging
  strip.addEventListener('click', (e) => {
    if (hasDragged) { e.stopPropagation(); e.preventDefault(); }
  }, true);
});

function today() { return new Date().toISOString().split('T')[0]; }

function refresh() {
  renderWalletStrip(); renderSummary(); applyFilter(); renderCharts(); initWalletSelects();
}

// ---- WALLET STRIP (with selection) ----
function renderWalletStrip() {
  const ws = WalletStore.getAllBalances();
  const totalBal = ws.reduce((s, w) => s + w.balance, 0);
  const strip = document.getElementById('wallet-strip');

  // "Tổng hợp" card first
  let html = `<div class="wcard ${selectedWallet === null ? 'selected' : ''}" data-wid="all" onclick="selectWallet(null)">
    <div class="wname"><span class="mi" style="font-size:14px;color:var(--p)">dashboard</span>Tổng hợp</div>
    <div class="wbal" style="color:var(--t)">${formatVND(totalBal)}</div>
    <div class="wbank">${ws.length} ví</div></div>`;

  // Individual wallets
  html += ws.map(w => {
    return `<div class="wcard ${selectedWallet === w.id ? 'selected' : ''}"
         data-wid="${w.id}" onclick="selectWallet('${w.id}')"
         style="border-color:${selectedWallet === w.id ? w.color : 'transparent'}">
      <div class="wname"><span class="mi" style="font-size:14px;color:${w.color}">${w.icon}</span>${w.name}</div>
      <div class="wbal" style="color:var(--t)">${formatVND(w.balance)}</div>
      ${w.bank ? `<div class="wbank">${w.bank}</div>` : ''}
    </div>`;
  }).join('');

  html += `<div class="wcard-add" style="border-radius:24px;border-color:var(--glass-border);background:var(--c)" onclick="openWalletForm()"><span class="mi">add</span><span>Thêm ví</span></div>`;
  strip.innerHTML = html;

  // Auto-scroll to selected wallet
  requestAnimationFrame(() => {
    const sel = strip.querySelector('.wcard.selected');
    if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function selectWallet(id) {
  // Tapping already-selected wallet opens edit form
  if (id !== null && selectedWallet === id) { openWalletForm(id); return; }
  selectedWallet = id;
  renderWalletStrip();
  renderSummary();
  applyFilter();
  renderCharts();
  // Auto-set wallet in transaction form if specific wallet selected
  if (id) {
    const el = document.getElementById('f-wallet');
    if (el) el.value = id;
  }
  // Show wallet name in header subtitle
  const sub = document.getElementById('hdr-sub');
  if (sub) {
    if (id) {
      const w = WalletStore.getById(id);
      sub.textContent = w ? w.name : '';
      sub.style.display = '';
    } else {
      sub.style.display = 'none';
    }
  }
}

// ---- SUMMARY (filtered by selected wallet) ----
function renderSummary() {
  const m = new Date().toISOString().slice(0, 7);
  const s = Store.getSummary(m, selectedWallet);
  document.getElementById('summary').innerHTML = `
    <div class="sitem"><div class="sl">Thu tháng này</div><div class="sv inc">${formatVND(s.income)}</div></div>
    <div class="sitem"><div class="sl">Chi tháng này</div><div class="sv exp">${formatVND(s.expense)}</div></div>`;
}

// ---- TABS ----
function switchTab(t) {
  ['excel', 'text', 'transfer'].forEach(id => {
    document.getElementById('tab-' + id).classList.toggle('act', id === t);
    document.getElementById('body-' + id).classList.toggle('hid', id !== t);
  });
  if (t === 'transfer') initTransferSelects();
}

// ---- WALLET SELECTS ----
function initWalletSelects() {
  const ws = WalletStore.getAll();
  const defId = selectedWallet || (ws.find(w => w.isPrimary) || ws[0])?.id;
  const opts = ws.map(w => `<option value="${w.id}" ${w.id === defId ? 'selected' : ''}>${w.name}</option>`).join('');
  const el = document.getElementById('f-wallet');
  if (el) el.innerHTML = opts;
}

function initTransferSelects() {
  const ws = WalletStore.getAllBalances();
  const fromOpts = ws.map(w => `<option value="${w.id}">${w.name} (${formatVND(w.balance)})</option>`).join('');
  const toOpts = ws.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
  document.getElementById('trf-from').innerHTML = fromOpts;
  document.getElementById('trf-to').innerHTML = toOpts;
  if (ws.length > 1) document.getElementById('trf-to').selectedIndex = 1;
}

// ---- CHARTS (filtered by selected wallet) ----
function toggleCharts(el) { el.classList.toggle('open'); document.getElementById('chart-body').classList.toggle('open'); if (document.getElementById('chart-body').classList.contains('open')) renderCharts(); }

function renderCharts() {
  const m = new Date().toISOString().slice(0, 7);
  const bd = Store.getCategoryBreakdown('expense', m, selectedWallet);
  const tr = Store.getDailyTrend(7, selectedWallet);
  const dc = document.getElementById('donut'), leg = document.getElementById('donut-leg');
  if (donutChart) donutChart.destroy();
  if (!bd.length) { dc.style.display = 'none'; leg.innerHTML = '<p style="text-align:center;color:var(--t3);font-size:11px;padding:15px">Chưa có dữ liệu tháng này</p>'; }
  else { dc.style.display = ''; donutChart = new Chart(dc, { type: 'doughnut', data: { labels: bd.map(d => d.name), datasets: [{ data: bd.map(d => d.total), backgroundColor: bd.map(d => d.color), borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a2e', titleFont: { family: 'Nunito' }, bodyFont: { family: 'Nunito' }, callbacks: { label: c => ` ${c.label}: ${formatVND(c.raw)}` } } } } }); leg.innerHTML = bd.slice(0, 5).map(c => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;color:var(--t2)"><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:${c.color};box-shadow:0 0 10px ${c.color}66"></div>${c.name}</div><b style="color:var(--t)">${formatVND(c.total)}</b></div>`).join(''); }
  const bc = document.getElementById('bar');
  if (barChart) barChart.destroy();
  barChart = new Chart(bc, { type: 'bar', data: { labels: tr.map(d => d.label), datasets: [{ label: 'Thu', data: tr.map(d => d.income), backgroundColor: '#55efc4', borderRadius: 6 }, { label: 'Chi', data: tr.map(d => d.expense), backgroundColor: '#fab1a0', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { color: '#8e8ca0', font: { family: 'Nunito', size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#8e8ca0', font: { family: 'Nunito', size: 9 }, callback: v => v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'K' : v } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a2e', titleFont: { family: 'Nunito' }, bodyFont: { family: 'Nunito' }, callbacks: { label: c => ` ${c.dataset.label}: ${formatVND(c.raw)}` } } } } });
}

// ---- CATEGORIES ----
function initCats() { buildCatGrid(CATEGORIES.expense); }
function buildCatGrid(cats) {
  document.getElementById('cat-grid').innerHTML = cats.map((c, i) => `<div class="ci ${i === 0 ? 'sel' : ''}" data-c="${c.id}" onclick="pickCat('${c.id}')"><span class="mi" style="color:${c.color}">${c.icon}</span><span>${c.name}</span></div>`).join('');
  document.getElementById('f-cat').value = cats[0].id;
}
function setType(t) {
  document.getElementById('f-type').value = t;
  document.querySelectorAll('.tbtn').forEach(b => { b.className = `tbtn ${b.dataset.t === t ? (t === 'expense' ? 'aexp' : 'ainc') : ''}`; });
  buildCatGrid(t === 'expense' ? CATEGORIES.expense : CATEGORIES.income);
}
function pickCat(id) {
  document.querySelectorAll('.ci').forEach(el => el.classList.toggle('sel', el.dataset.c === id));
  document.getElementById('f-cat').value = id;
}

// ---- ADD/EDIT TXN ----
function saveTxn(e) {
  e.preventDefault();
  const type = document.getElementById('f-type').value, amount = parseInt(document.getElementById('f-amount').value);
  if (!amount || amount <= 0) { showToast('Nhập số tiền hợp lệ', 'error'); return; }
  const cat = document.getElementById('f-cat').value, ci = getCategoryInfo(cat, type);
  const data = { type, amount, category: cat, categoryName: ci.name, date: document.getElementById('f-date').value, note: document.getElementById('f-note').value, wallet: document.getElementById('f-wallet').value };
  const eid = document.getElementById('f-edit').value;
  if (eid) { Store.updateTransaction(eid, data); showToast('Đã cập nhật'); cancelEdit(); }
  else { Store.addTransaction(data); showToast('Đã thêm giao dịch'); }
  document.getElementById('txn-form').reset(); document.getElementById('f-date').value = today(); setType('expense'); refresh();
}

function startEdit(id) {
  const t = Store.getAll().find(x => x.id === id);
  if (!t || t.type === 'transfer') return;
  switchTab('text');
  document.getElementById('f-edit').value = id; document.getElementById('f-amount').value = t.amount;
  document.getElementById('f-date').value = t.date; document.getElementById('f-note').value = t.note || '';
  document.getElementById('f-wallet').value = t.wallet; setType(t.type);
  setTimeout(() => pickCat(t.category), 50);
  document.getElementById('edit-actions').style.display = 'grid';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  document.getElementById('f-edit').value = ''; 
  document.getElementById('edit-actions').style.display = 'none';
  document.getElementById('txn-form').reset(); document.getElementById('f-date').value = today(); setType('expense');
}

function deleteEditingTxn() {
  const id = document.getElementById('f-edit').value;
  if (id) deleteTxn(id);
}

// ---- DELETE TXN (custom confirm dialog) ----
let pendingDeleteId = null;

function deleteTxn(id) {
  pendingDeleteId = id;
  const txn = Store.getAll().find(x => x.id === id) || Store._getAll().find(x => x.id === id);
  const preview = document.getElementById('delete-preview');
  if (txn) {
    let iconHtml, nameHtml, metaHtml, amountHtml;
    if (txn.type === 'transfer') {
      const fw = getWalletInfo(txn.fromWallet), tw = getWalletInfo(txn.toWallet);
      iconHtml = `<span class="mi" style="color:var(--ps);font-size:18px">swap_horiz</span>`;
      nameHtml = txn.note || 'Chuyển tiền';
      metaHtml = `${fw.name} → ${tw.name} · ${formatDate(txn.date)}`;
      amountHtml = `<div class="cp-amount" style="color:var(--ps)">${formatVND(txn.amount)}</div>`;
    } else {
      const c = getCategoryInfo(txn.category, txn.type);
      iconHtml = `<span class="mi" style="color:${c.color};font-size:18px">${c.icon}</span>`;
      nameHtml = txn.note || c.name;
      metaHtml = `${c.name} · ${getWalletName(txn.wallet)} · ${formatDate(txn.date)}`;
      const color = txn.type === 'income' ? 'var(--gs)' : 'var(--rs)';
      amountHtml = `<div class="cp-amount" style="color:${color}">${txn.type === 'income' ? '+' : '-'}${formatVND(txn.amount)}</div>`;
    }
    preview.innerHTML = `<div class="confirm-preview">
      <div class="cp-icon">${iconHtml}</div>
      <div class="cp-info"><div class="cp-name">${nameHtml}</div><div class="cp-meta">${metaHtml}</div></div>
      ${amountHtml}
    </div>`;
  } else {
    preview.innerHTML = '';
  }
  document.getElementById('delete-confirm').classList.add('show');
}

function confirmDeleteTxn() {
  if (pendingDeleteId) {
    Store.deleteTransaction(pendingDeleteId);
    showToast('Đã xóa giao dịch');
    pendingDeleteId = null;
    document.getElementById('delete-confirm').classList.remove('show');
    cancelEdit();
    refresh();
  }
}

function cancelDeleteConfirm() {
  pendingDeleteId = null;
  document.getElementById('delete-confirm').classList.remove('show');
}

// ---- TRANSFER ----
function doTransfer(e) {
  e.preventDefault();
  const amount = parseInt(document.getElementById('trf-amount').value);
  const from = document.getElementById('trf-from').value;
  const to = document.getElementById('trf-to').value;
  const note = document.getElementById('trf-note').value;
  const date = document.getElementById('trf-date').value;
  if (!amount || amount <= 0) { showToast('Nhập số tiền hợp lệ', 'error'); return; }
  if (from === to) { showToast('Chọn 2 ví khác nhau', 'error'); return; }
  Store.addTransfer(from, to, amount, note, date);
  const fromW = WalletStore.getById(from), toW = WalletStore.getById(to);
  showToast(`Đã chuyển ${formatVND(amount)} từ ${fromW.name} → ${toW.name}`);
  document.getElementById('trf-form').reset(); document.getElementById('trf-date').value = today();
  refresh(); initTransferSelects();
}

// ---- FILTER (respects selected wallet) ----
function applyFilter() {
  const s = document.getElementById('f-search')?.value || '';
  const t = document.getElementById('f-filter')?.value || '';
  const filters = { search: s };
  if (t) filters.type = t;
  if (selectedWallet) filters.wallet = selectedWallet;
  renderList(Store.getAll(filters));
}

// ---- TXN LIST ----
function renderList(txns) {
  const el = document.getElementById('txn-list');
  document.getElementById('count').textContent = txns.length;
  if (!txns.length) { el.innerHTML = '<div class="empty"><span class="mi">receipt_long</span><p>Chưa có giao dịch</p></div>'; return; }
  const g = {}; txns.forEach(t => { if (!g[t.date]) g[t.date] = []; g[t.date].push(t); });
  el.innerHTML = Object.entries(g).map(([d, items]) => {
    let di = 0, de = 0; items.forEach(t => { if (t.type === 'income') di += t.amount; else if (t.type === 'expense') de += t.amount; });
    return `<div class="tg"><div class="td"><span>${formatDate(d)}</span><span style="color:${di - de >= 0 ? 'var(--gs)' : 'var(--rs)'}">${di - de >= 0 ? '+' : '-'}${formatVND(Math.abs(di - de))}</span></div>
    ${items.map(t => {
      if (t.type === 'transfer') {
        const fw = getWalletInfo(t.fromWallet), tw = getWalletInfo(t.toWallet);
        return `<div class="ti">
          <div class="tic"><span class="mi" style="color:var(--ps);font-size:18px">swap_horiz</span></div>
          <div class="tii"><div class="nm">${t.note || 'Chuyển tiền'}</div><div class="mt">${fw.name} → ${tw.name}</div></div>
          <div class="ta trf">${formatVND(t.amount)}</div>
          </div>`;
      }
      const c = getCategoryInfo(t.category, t.type);
      const showWallet = !selectedWallet;
      return `<div class="ti" onclick="startEdit('${t.id}')">
        <div class="tic"><span class="mi" style="color:${c.color};font-size:18px">${c.icon}</span></div>
        <div class="tii"><div class="nm">${t.note || c.name}</div><div class="mt">${c.name}${showWallet ? ' · ' + getWalletName(t.wallet) : ''}</div></div>
        <div class="ta ${t.type === 'income' ? 'inc' : 'exp'}">${t.type === 'income' ? '+' : '-'}${formatVND(t.amount)}</div>
        </div>`;
    }).join('')}</div>`;
  }).join('');
}

// ---- EXCEL IMPORT (imports to selected wallet or primary) ----
function handleDrop(e) { e.preventDefault(); e.currentTarget.classList.remove('drag'); processFile(e.dataTransfer.files[0]); }
function handleFile(e) { processFile(e.target.files[0]); }
function processFile(f) {
  if (!f) return; if (f.size > 10 * 1024 * 1024) { showToast('File quá lớn', 'error'); return; }
  const r = new FileReader();
  r.onload = ev => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
      if (json.length < 2) { showToast('File rỗng', 'error'); return; }

      // Auto-detect bank statement format
      const bankTxns = parseBankStatement(json);
      if (bankTxns) {
        bankImportedTxns = bankTxns;
        showBankImportPreview(bankTxns);
        return;
      }

      // Fallback to generic Excel import
      importedRows = json.slice(1).filter(r => r.some(c => c !== ''));
      showToast(`Đọc ${importedRows.length} dòng`);
      showMapping(json[0].map(String));
    } catch (e) { showToast('Lỗi đọc file', 'error'); console.error(e); }
  };
  r.readAsArrayBuffer(f);
}

// ---- BANK STATEMENT AUTO-DETECT & PARSE ----
let bankImportedTxns = [];

function parseBankStatement(json) {
  // Detect Techcombank by scanning first 20 rows
  let isTechcombank = false;
  for (let i = 0; i < Math.min(json.length, 20); i++) {
    const rowText = json[i].filter(c => c !== '').join(' ').toLowerCase();
    if (rowText.includes('techcombank') || rowText.includes('kỹ thương') || rowText.includes('ky thuong')) {
      isTechcombank = true; break;
    }
  }
  if (!isTechcombank) return null;

  // Find header row(s) — contains "Ngày giao dịch" or "Transaction Date"
  const formats = [];
  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    for (let j = 0; j < row.length; j++) {
      const v = String(row[j] || '');
      if (v.includes('Ngày giao dịch') || v.includes('Transaction Date')) {
        // Determine column positions from this header row
        const cols = {};
        row.forEach((cell, idx) => {
          const s = String(cell || '');
          if (s.includes('Ngày giao dịch') || s.includes('Transaction Date')) cols.date = idx;
          else if (s.includes('Đối tác') || s.includes('Remitter')) cols.partner = idx;
          else if (s.includes('NH Đối tác') || s.includes('Remitter Bank')) cols.bank = idx;
          else if (s.includes('Diễn giải') || s.includes('Details')) cols.note = idx;
          else if (s.includes('Số bút toán') || s.includes('Transaction No')) cols.txnNo = idx;
          else if (s.includes('Nợ TKTT') || s.includes('Debit')) cols.debit = idx;
          else if (s.includes('Có TKTT') || s.includes('Credit')) cols.credit = idx;
          else if (s.includes('Số dư') || s.includes('Balance')) cols.balance = idx;
          else if (s.includes('Biến động TKTT') || s.includes('Account Balance Update')) cols.debit = idx;
          else if (s.includes('Giá trị CCTG') || s.includes('Allocated Value')) cols.cctg = idx;
        });
        // Only use formats that have date + (debit or credit)
        if (cols.date !== undefined && (cols.debit !== undefined || cols.credit !== undefined)) {
          formats.push({ headerRow: i, cols, isCCTG: !!cols.cctg });
        }
        break;
      }
    }
  }

  if (!formats.length) return null;

  // Parse transactions from the main (non-CCTG) format
  const mainFormat = formats.find(f => !f.isCCTG) || formats[0];
  if (mainFormat.isCCTG) return null; // Only CCTG section, skip

  const { cols } = mainFormat;
  const endRow = formats.length > 1 ? formats.find(f => f.isCCTG)?.headerRow || json.length : json.length;
  const txns = [];

  for (let i = mainFormat.headerRow + 1; i < endRow; i++) {
    const row = json[i];
    if (!row || !row.length) continue;

    // Get date cell
    const dateRaw = String(row[cols.date] || '').trim();
    if (!dateRaw) continue;

    // Must be DD/MM/YYYY format
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) {
      // Skip "Số dư đầu kỳ", page footers, etc
      continue;
    }

    // Skip page footers (contain "Phiếu này được in")
    const rowText = row.filter(c => c !== '').join(' ');
    if (rowText.includes('Phiếu này') || rowText.includes('được in')) continue;

    // Parse date DD/MM/YYYY → YYYY-MM-DD
    const [dd, mm, yyyy] = dateRaw.split('/');
    const date = `${yyyy}-${mm}-${dd}`;

    // Parse amounts
    const debitRaw = cols.debit !== undefined ? String(row[cols.debit] || '') : '';
    const creditRaw = cols.credit !== undefined ? String(row[cols.credit] || '') : '';
    const debitAmt = parseBankAmount(debitRaw);
    const creditAmt = parseBankAmount(creditRaw);

    if (!debitAmt && !creditAmt) continue;

    const type = creditAmt > 0 ? 'income' : 'expense';
    const amount = type === 'income' ? creditAmt : debitAmt;
    if (!amount || amount <= 0) continue;

    // Get note/details
    const partner = String(row[cols.partner] || '').trim();
    const bank = cols.bank !== undefined ? String(row[cols.bank] || '').trim() : '';
    const note = cols.note !== undefined ? String(row[cols.note] || '').trim() : '';

    // Build a readable note
    let displayNote = note || partner || '';
    // Truncate very long notes
    if (displayNote.length > 60) displayNote = displayNote.substring(0, 57) + '...';

    // Auto-categorize
    const cat = guessCatFromBank(partner, bank, note, type);
    const ci = getCategoryInfo(cat, type);

    txns.push({ type, amount, category: cat, categoryName: ci.name, date, note: displayNote, wallet: '' });
  }

  if (!txns.length) return null;
  showToast(`Phát hiện sao kê Techcombank: ${txns.length} giao dịch`);
  return txns;
}

function parseBankAmount(s) {
  if (!s || s === '') return 0;
  s = String(s).trim();
  // Handle negative values in parentheses: (15,600,000) → -15600000
  const isNeg = s.startsWith('(') && s.endsWith(')');
  s = s.replace(/[()]/g, '');
  // Remove commas
  s = s.replace(/,/g, '');
  const val = parseFloat(s) || 0;
  return isNeg ? -val : Math.abs(val);
}

function guessCatFromBank(partner, bank, note, type) {
  const all = (partner + ' ' + bank + ' ' + note).toLowerCase();

  if (type === 'income') {
    if (all.includes('luong') || all.includes('salary') || all.includes('patient')) return 'salary';
    if (all.includes('loi nhuan') || all.includes('tra lai') || all.includes('sinh loi') || all.includes('interest')) return 'invest';
    if (all.includes('thuong') || all.includes('bonus')) return 'bonus';
    if (all.includes('ban') || all.includes('sell')) return 'selling';
    return 'other_income';
  }

  // Expense categories
  if (all.includes('xang') || all.includes('xăng') || all.includes('petro') || all.includes('grab') || all.includes('taxi') || all.includes('xe') || all.includes('fuel')) return 'transport';
  if (all.includes('mart') || all.includes('shopee') || all.includes('lazada') || all.includes('tiki') || all.includes('wincommerce') || all.includes('martstores') || all.includes('store') || all.includes('bach hoa')) return 'shopping';
  if (all.includes('vnvc') || all.includes('vaccine') || all.includes('y te') || all.includes('thuoc') || all.includes('nha thuoc') || all.includes('pharmac') || all.includes('benh vien') || all.includes('hospital')) return 'health';
  if (all.includes('dien') || all.includes('nuoc') || all.includes('internet') || all.includes('fpt') || all.includes('viettel') || all.includes('vnpt') || all.includes('electric') || all.includes('water')) return 'bills';
  if (all.includes('hoc') || all.includes('school') || all.includes('truong') || all.includes('education') || all.includes('udemy') || all.includes('course')) return 'education';
  if (all.includes('rau') || all.includes('com') || all.includes('cafe') || all.includes('banh') || all.includes('food') || all.includes('eat') || all.includes('bep') || all.includes('an uong') || all.includes('huong huong')) return 'food';
  if (all.includes('chung chi') || all.includes('cctg') || all.includes('chung khoan') || all.includes('ck') || all.includes('tkck') || all.includes('dau tu')) return 'other_expense';

  return 'other_expense';
}

function showBankImportPreview(txns) {
  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('map-section').style.display = '';

  const ws = WalletStore.getAll();
  const importWallet = selectedWallet || WalletStore.getPrimary().id;

  // Show summary instead of column mapping
  let it = 0, et = 0;
  txns.forEach(t => { if (t.type === 'income') it += t.amount; else et += t.amount; });

  document.getElementById('col-mappers').innerHTML = `
    <div style="grid-column:1/-1;padding:8px;background:rgba(108,92,231,0.1);border-radius:9px;border:1px solid rgba(108,92,231,0.25);margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
        <span class="mi" style="font-size:16px;color:var(--ps)">account_balance</span>
        <b style="font-size:12px;color:var(--ps)">Sao kê Techcombank</b>
      </div>
      <div style="font-size:10px;color:var(--t2)">Đã tự nhận diện format sao kê. Không cần chọn cột thủ công.</div>
    </div>
    <div><label>Nhập vào ví</label><select id="imp-wallet" class="fi" style="font-size:11px;padding:7px">${ws.map(w => `<option value="${w.id}" ${w.id === importWallet ? 'selected' : ''}>${w.name}</option>`).join('')}</select></div>`;

  // Hide table preview, show txn list preview
  document.getElementById('pv-head').innerHTML = '<th>Ngày</th><th>Diễn giải</th><th>Thu/Chi</th><th>Số tiền</th>';
  document.getElementById('pv-body').innerHTML = txns.slice(0, 5).map(t => {
    const color = t.type === 'income' ? 'var(--gs)' : 'var(--rs)';
    return `<tr><td>${t.date}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">${t.note}</td><td>${t.type === 'income' ? 'Thu' : 'Chi'}</td><td style="color:${color};font-weight:700">${t.type === 'income' ? '+' : '-'}${formatVND(t.amount)}</td></tr>`;
  }).join('');

  document.getElementById('imp-summary').textContent = `${txns.length} giao dịch · Thu: ${formatVND(it)} · Chi: ${formatVND(et)}`;
  document.getElementById('imp-list').innerHTML = txns.slice(0, 12).map(t => {
    const c = getCategoryInfo(t.category, t.type);
    return `<div class="ipi"><div><span class="mi" style="color:${c.color};font-size:14px;margin-right:3px">${c.icon}</span>${t.note || c.name}<div class="mt">${t.date} · ${c.name}</div></div><b style="color:${t.type === 'income' ? 'var(--gs)' : 'var(--rs)'}">${t.type === 'income' ? '+' : '-'}${formatVND(t.amount)}</b></div>`;
  }).join('') + (txns.length > 12 ? `<p style="text-align:center;font-size:9px;color:var(--t3);padding:3px">...${txns.length - 12} giao dịch khác</p>` : '');
}

// Generic Excel import functions
function showMapping(headers) {
  document.getElementById('upload-zone').style.display = 'none'; document.getElementById('map-section').style.display = '';
  const fields = [{ k: 'date', l: 'Ngày', a: ['ngày', 'date', 'ngay'] }, { k: 'amount', l: 'Số tiền', a: ['số tiền', 'tiền', 'amount', 'giá'] }, { k: 'category', l: 'Danh mục', a: ['danh mục', 'loại', 'category'] }, { k: 'note', l: 'Ghi chú', a: ['ghi chú', 'mô tả', 'note', 'nội dung'] }, { k: 'type', l: 'Thu/Chi', a: ['thu/chi', 'thu chi', 'direction'] }];
  document.getElementById('col-mappers').innerHTML = fields.map(f => { const ai = headers.findIndex(h => f.a.some(a => h.toLowerCase().includes(a))); columnMapping[f.k] = ai >= 0 ? ai : -1; return `<div><label>${f.l}</label><select class="fi" style="font-size:11px;padding:7px" onchange="columnMapping['${f.k}']=+this.value;updatePreview()"><option value="-1">--</option>${headers.map((h, i) => `<option value="${i}" ${ai === i ? 'selected' : ''}>${h}</option>`).join('')}</select></div>`; }).join('');
  // Add wallet selector for import
  const ws = WalletStore.getAll();
  const importWallet = selectedWallet || WalletStore.getPrimary().id;
  document.getElementById('col-mappers').innerHTML += `<div><label>Nhập vào ví</label><select id="imp-wallet" class="fi" style="font-size:11px;padding:7px">${ws.map(w => `<option value="${w.id}" ${w.id === importWallet ? 'selected' : ''}>${w.name}</option>`).join('')}</select></div>`;
  document.getElementById('pv-head').innerHTML = headers.map(h => `<th>${h}</th>`).join('');
  document.getElementById('pv-body').innerHTML = importedRows.slice(0, 3).map(r => `<tr>${r.map(c => `<td>${c instanceof Date ? c.toLocaleDateString('vi-VN') : c}</td>`).join('')}</tr>`).join('');
  updatePreview();
}
function updatePreview() {
  const p = parseRows(); let it = 0, et = 0; p.forEach(t => { if (t.type === 'income') it += t.amount; else et += t.amount; });
  document.getElementById('imp-summary').textContent = `${p.length} giao dịch · Thu: ${formatVND(it)} · Chi: ${formatVND(et)}`;
  document.getElementById('imp-list').innerHTML = p.slice(0, 8).map(t => { const c = getCategoryInfo(t.category, t.type); return `<div class="ipi"><div><span class="mi" style="color:${c.color};font-size:14px;margin-right:3px">${c.icon}</span>${t.note || c.name}<div class="mt">${t.date}</div></div><b style="color:${t.type === 'income' ? 'var(--gs)' : 'var(--rs)'}">${t.type === 'income' ? '+' : '-'}${formatVND(t.amount)}</b></div>`; }).join('') + (p.length > 8 ? `<p style="text-align:center;font-size:9px;color:var(--t3);padding:3px">...${p.length - 8} giao dịch khác</p>` : '');
}
function parseRows() {
  const walletEl = document.getElementById('imp-wallet');
  const walletId = walletEl ? walletEl.value : (selectedWallet || WalletStore.getPrimary().id);
  return importedRows.map(row => {
    let date = columnMapping.date >= 0 ? row[columnMapping.date] : today();
    if (date instanceof Date) date = date.toISOString().split('T')[0]; else if (typeof date === 'number') { const d = new Date((date - 25569) * 86400000); date = d.toISOString().split('T')[0]; } else date = String(date).trim() || today();
    let amount = columnMapping.amount >= 0 ? row[columnMapping.amount] : 0; amount = Math.abs(parseFloat(String(amount).replace(/[^\d.-]/g, '')) || 0); if (!amount) return null;
    let note = columnMapping.note >= 0 ? String(row[columnMapping.note]) : '';
    let ts = columnMapping.type >= 0 ? String(row[columnMapping.type]).toLowerCase() : '';
    let type = ts.includes('thu') || ts.includes('income') || ts.includes('+') ? 'income' : 'expense';
    let cs = columnMapping.category >= 0 ? String(row[columnMapping.category]).toLowerCase() : '';
    let cat = guessCat(cs, type); const ci = getCategoryInfo(cat, type);
    return { type, amount, category: cat, categoryName: ci.name, date, note, wallet: walletId };
  }).filter(Boolean);
}
function guessCat(s, type) {
  if (!s) return type === 'income' ? 'salary' : 'food';
  const cats = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
  for (const c of cats) if (s.includes(c.name.toLowerCase()) || s.includes(c.id)) return c.id;
  const m = { 'ăn': 'food', 'cafe': 'food', 'cà phê': 'food', 'grab': 'transport', 'taxi': 'transport', 'xăng': 'transport', 'shopee': 'shopping', 'tiki': 'shopping', 'lazada': 'shopping', 'siêu thị': 'shopping', 'điện': 'bills', 'nước': 'bills', 'internet': 'bills', 'thuê': 'bills', 'lương': 'salary', 'thưởng': 'bonus', 'đầu tư': 'invest', 'bán': 'selling', 'freelance': 'freelance' };
  for (const [k, v] of Object.entries(m)) if (s.includes(k)) return v;
  return type === 'income' ? 'other_income' : 'other_expense';
}
function confirmImport() {
  let p;
  if (bankImportedTxns.length) {
    const walletEl = document.getElementById('imp-wallet');
    const walletId = walletEl ? walletEl.value : (selectedWallet || WalletStore.getPrimary().id);
    p = bankImportedTxns.map(t => ({ ...t, wallet: walletId }));
  } else {
    p = parseRows();
  }
  if (!p.length) { showToast('Không có dữ liệu', 'error'); return; }
  Store.addMany(p); showToast(`Nhập ${p.length} giao dịch!`); cancelImport(); refresh();
}
function cancelImport() { importedRows = []; bankImportedTxns = []; columnMapping = {}; document.getElementById('map-section').style.display = 'none'; document.getElementById('upload-zone').style.display = ''; const fi = document.getElementById('file-input'); if (fi) fi.value = ''; }

// ---- WALLET FORM ----
function openWalletForm(wId) {
  editingWalletId = wId || null;
  const w = wId ? WalletStore.getById(wId) : null;
  document.getElementById('wf-title').textContent = w ? 'Chỉnh sửa ví' : 'Thêm ví mới';
  document.getElementById('wallet-form-body').innerHTML = `
    <div><div class="fl">Tên ví / Tài khoản</div><input type="text" id="wf-name" class="fi" value="${w ? w.name : ''}" placeholder="VD: Vietcombank, Tiền mặt..." required/></div>
    <div style="margin-top:10px"><div class="fl">Ngân hàng (tùy chọn)</div><input type="text" id="wf-bank" class="fi" value="${w ? w.bank || '' : ''}" placeholder="VD: VCB, MB Bank, Techcombank..."/></div>
    <div style="margin-top:10px"><div class="fl">Biểu tượng</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
        ${WALLET_ICONS.map(ic => `<div style="padding:10px;border-radius:14px;background:${(w ? w.icon : WALLET_ICONS[0].id) === ic.id ? 'rgba(180,173,234,0.15)' : 'rgba(255,255,255,0.03)'};cursor:pointer;border:2px solid ${(w ? w.icon : WALLET_ICONS[0].id) === ic.id ? 'var(--p)' : 'var(--glass-border)'}" onclick="document.querySelectorAll('[data-wicon]').forEach(el=>{el.style.background='rgba(255,255,255,0.03)';el.style.borderColor='var(--glass-border)'});this.style.background='rgba(180,173,234,0.15)';this.style.borderColor='var(--p)';document.getElementById('wf-icon').value='${ic.id}'" data-wicon="${ic.id}"><span class="mi" style="font-size:20px;color:${(w ? w.icon : WALLET_ICONS[0].id) === ic.id ? 'var(--p)' : 'var(--t3)'}">${ic.id}</span></div>`).join('')}
      </div><input type="hidden" id="wf-icon" value="${w ? w.icon : WALLET_ICONS[0].id}"/></div>
    <div style="margin-top:10px"><div class="fl">Màu sắc</div>
      <div class="color-row">
        ${BANK_COLORS.map(c => `<div class="cpick ${(w ? w.color : BANK_COLORS[0]) === c ? 'sel' : ''}" style="background:${c};box-shadow:0 0 10px ${c}44" onclick="document.querySelectorAll('.cpick').forEach(el=>el.classList.remove('sel'));this.classList.add('sel');document.getElementById('wf-color').value='${c}'"></div>`).join('')}
      </div><input type="hidden" id="wf-color" value="${w ? w.color : BANK_COLORS[0]}"/></div>
    <button class="bp" style="margin-top:16px" onclick="saveWallet()">Lưu thông tin ví</button>
    ${w && !w.isPrimary ? `<button class="bg" onclick="setWalletPrimary('${w.id}')" style="margin-top:8px"><span class="mi" style="font-size:18px;margin-right:8px">star_rate</span> Đặt làm ví chính</button>` : ''}
    ${w && !w.isPrimary ? `<button class="bg bd" onclick="deleteWallet('${w.id}', this)" style="margin-top:8px"><span class="mi" style="font-size:18px;margin-right:8px">delete_outline</span> Xóa ví này</button>` : ''}
    <button class="bg" onclick="closeWalletForm()" style="margin-top:8px;border:none">Quay lại</button>`;
  document.getElementById('wallet-ov').classList.add('show');
}

function closeWalletForm() { document.getElementById('wallet-ov').classList.remove('show'); editingWalletId = null; }

function saveWallet() {
  const name = document.getElementById('wf-name').value.trim();
  if (!name) { showToast('Nhập tên ví', 'error'); return; }
  const data = { name, bank: document.getElementById('wf-bank').value.trim(), icon: document.getElementById('wf-icon').value, color: document.getElementById('wf-color').value };
  if (editingWalletId) { WalletStore.update(editingWalletId, data); showToast('Đã cập nhật ví'); }
  else { WalletStore.add(data); showToast('Đã thêm ví mới'); }
  closeWalletForm(); refresh();
}

function setWalletPrimary(id) { WalletStore.setPrimary(id); showToast('Đã đặt ví chính'); closeWalletForm(); refresh(); }

function deleteWallet(id, btn) {
  if (!btn.dataset.confirmed) {
    btn.dataset.confirmed = 'yes';
    btn.innerHTML = '<span class="mi" style="font-size:14px;margin-right:3px">warning</span> Xác nhận xóa?';
    btn.style.background = 'rgba(231,76,60,0.3)';
    setTimeout(() => { if (btn) { delete btn.dataset.confirmed; btn.innerHTML = '<span class="mi" style="font-size:14px;margin-right:3px">delete</span> Xóa ví'; btn.style.background = ''; } }, 3000);
    return;
  }
  const w = WalletStore.getById(id);
  if (WalletStore.delete(id)) {
    showToast(`Đã xóa ví "${w?.name}". Giao dịch chuyển về Tiền mặt.`);
    closeWalletForm();
    if (selectedWallet === id) selectedWallet = null;
    refresh();
  } else {
    showToast('Không thể xóa ví chính', 'error');
  }
}

// ---- SETTINGS ----
function openSettings() { document.getElementById('settings-ov').classList.add('show'); renderSettings(); }
function closeSettings() { document.getElementById('settings-ov').classList.remove('show'); }
function renderSettings() {
  const s = Store.getSummary();
  document.getElementById('settings-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;text-align:center">
      <div style="background:rgba(180,173,234,0.15);padding:12px 8px;border-radius:18px;border:1px solid rgba(180,173,234,0.2)">
        <div style="font-size:20px;font-weight:900;color:#b4adea">${s.count}</div>
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Lượt giao dịch</div>
      </div>
      <div style="background:rgba(168,230,207,0.15);padding:12px 8px;border-radius:18px;border:1px solid rgba(168,230,207,0.2)">
        <div style="font-size:14px;font-weight:900;color:#a8e6cf">${formatVND(s.income)}</div>
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Tổng thu</div>
      </div>
      <div style="background:rgba(255,200,180,0.15);padding:12px 8px;border-radius:18px;border:1px solid rgba(255,200,180,0.2)">
        <div style="font-size:14px;font-weight:900;color:#ffc8b4">${formatVND(s.expense)}</div>
        <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Tổng chi</div>
      </div>
    </div>
    <div style="background:var(--c);border-radius:24px;border:1px solid var(--glass-border);padding:8px;margin-bottom:16px">
      <button class="bp" onclick="exportJSON()" style="margin-bottom:8px;background:linear-gradient(135deg, var(--p), #8e85f0)">
        <span class="mi" style="font-size:18px;margin-right:8px">cloud_download</span> Sao lưu dữ liệu (JSON)
      </button>
      <button class="bg" onclick="document.getElementById('imp-json').click()" style="margin-top:0">
        <span class="mi" style="font-size:18px;margin-right:8px">cloud_upload</span> Khôi phục từ file
      </button>
      <input type="file" id="imp-json" accept=".json" style="display:none" onchange="importJSON(event)"/>
    </div>

    <button class="bg bd" onclick="clearAllData(this)" style="border-radius:18px;opacity:0.8">
      <span class="mi" style="font-size:18px;margin-right:8px">delete_sweep</span> Xóa toàn bộ dữ liệu
    </button>
    
    <div style="text-align:center;margin-top:24px">
      <p style="font-size:11px;color:var(--t3);font-weight:700;letter-spacing:1px">KFINANCE PREMIUM</p>
      <p style="font-size:9px;color:var(--t3);opacity:0.6;margin-top:2px">Version 3.0 • Ethereal Wealth Edition</p>
    </div>`;
}
function exportJSON() { const b = new Blob([Store.exportData()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'kfinance_' + today() + '.json'; a.click(); showToast('Đã xuất JSON'); }
function importJSON(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { if (Store.importData(ev.target.result)) { showToast('Đã nhập'); refresh(); renderSettings(); } else showToast('File lỗi', 'error'); }; r.readAsText(f); }


function clearAllData(btn) {
  if (!btn.dataset.confirmed) {
    btn.dataset.confirmed = 'yes';
    btn.innerHTML = '<span class="mi" style="font-size:14px;margin-right:3px">report_problem</span> Xác nhận xóa hết?';
    btn.style.background = 'rgba(231,76,60,0.3)';
    setTimeout(() => { if (btn) { delete btn.dataset.confirmed; btn.innerHTML = '<span class="mi" style="font-size:18px;margin-right:8px">delete_sweep</span> Xóa toàn bộ dữ liệu'; btn.style.background = ''; } }, 3000);
    return;
  }
  Store.clearAll();
  selectedWallet = null;
  showToast('Đã xóa toàn bộ dữ liệu');
  refresh();
  renderSettings();
}
