// ─── CONFIGURATION (edit these) ───────────────────────────
const CONFIG = {
  SPREADSHEET_ID: '1Cug8L_h_Cra59h-U-N_6axPsHEr1DJgf-PavAxICLOc',
  API_KEY: 'AIzaSyBeGYgk-C3r1PPlvVUTz541LIJV3DyoRYI',
  // Sheet columns: A=ID, B=Name, C=Category, D=Quantity, E=Price, F=Notes
  SHEET_NAME: 'Sheet1',
  RANGE: 'Sheet1!A2:F',
  PIN: '1234', // Change this to your PIN
};
// ──────────────────────────────────────────────────────────

const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`;

// ─── AUTH ──────────────────────────────────────────────────
let authenticated = false;

function checkAuth() {
  const saved = sessionStorage.getItem('inv_auth');
  if (saved === 'true') { authenticated = true; showApp(); }
  else showPin();
}

function showPin() {
  document.getElementById('pin-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
  document.getElementById('pin-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  loadInventory();
}

let pinInput = '';
function handlePin(val) {
  if (val === 'del') { pinInput = pinInput.slice(0, -1); }
  else if (val === 'ok') {
    if (pinInput === CONFIG.PIN) {
      sessionStorage.setItem('inv_auth', 'true');
      authenticated = true;
      showApp();
    } else {
      pinInput = '';
      shakePin();
    }
    return;
  } else { pinInput += val; }
  renderPinDots();
}

function renderPinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinInput.length));
}

function shakePin() {
  const dots = document.querySelector('.pin-dots');
  dots.classList.add('shake');
  setTimeout(() => dots.classList.remove('shake'), 500);
}

// ─── GOOGLE SHEETS ─────────────────────────────────────────
let items = [];
let editingId = null;

async function loadInventory() {
  showLoading(true);
  try {
    const res = await fetch(
      `${BASE_URL}/values/${CONFIG.RANGE}?key=${CONFIG.API_KEY}`
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    items = (data.values || []).map((row, i) => ({
      _row: i + 2,
      id: row[0] || '',
      name: row[1] || '',
      category: row[2] || '',
      quantity: row[3] || '0',
      price: row[4] || '',
      notes: row[5] || '',
    }));
    renderList();
  } catch (err) {
    showToast('Error loading: ' + err.message, 'error');
  }
  showLoading(false);
}

async function saveItem(item) {
  // For write ops you need OAuth2 — guide user to use Apps Script web app as proxy
  // This calls the Apps Script endpoint set in CONFIG.APPS_SCRIPT_URL
  if (!CONFIG.APPS_SCRIPT_URL) {
    showToast('Set APPS_SCRIPT_URL in CONFIG to enable writes', 'error');
    return false;
  }
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return true;
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
    return false;
  }
}

// ─── UI ────────────────────────────────────────────────────
let searchQuery = '';
let filterCat = 'All';

function renderList() {
  const list = document.getElementById('item-list');
  const cats = ['All', ...new Set(items.map(i => i.category).filter(Boolean))];
  renderCategories(cats);

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCat === 'All' || item.category === filterCat;
    return matchSearch && matchCat;
  });

  list.innerHTML = filtered.length === 0
    ? `<div class="empty">No items found</div>`
    : filtered.map(item => `
      <div class="item-card" data-id="${item.id}">
        <div class="item-main">
          <span class="item-name">${item.name}</span>
          <span class="item-qty ${parseInt(item.quantity) <= 0 ? 'qty-zero' : ''}">×${item.quantity}</span>
        </div>
        <div class="item-sub">
          <span class="item-cat">${item.category || '—'}</span>
          ${item.price ? `<span class="item-price">₱${item.price}</span>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-icon" onclick="quickQty('${item.id}', -1)">−</button>
          <button class="btn-icon" onclick="quickQty('${item.id}', 1)">+</button>
          <button class="btn-icon btn-edit" onclick="openEdit('${item.id}')">✎</button>
          <button class="btn-icon btn-del" onclick="deleteItem('${item.id}')">✕</button>
        </div>
      </div>
    `).join('');
}

function renderCategories(cats) {
  const bar = document.getElementById('cat-bar');
  bar.innerHTML = cats.map(c => `
    <button class="cat-btn ${filterCat === c ? 'active' : ''}" onclick="setFilter('${c}')">${c}</button>
  `).join('');
}

function setFilter(cat) {
  filterCat = cat;
  renderList();
}

function quickQty(id, delta) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  const newQty = Math.max(0, parseInt(item.quantity) + delta);
  item.quantity = String(newQty);
  renderList();
  saveItem({ action: 'update', row: item._row, col: 'D', value: String(newQty) });
  showToast(`${item.name}: ${newQty}`, 'ok');
}

function openEdit(id) {
  const item = id ? items.find(i => i.id === id) : null;
  editingId = id || null;
  const modal = document.getElementById('modal');
  document.getElementById('f-id').value = item?.id || generateId();
  document.getElementById('f-name').value = item?.name || '';
  document.getElementById('f-cat').value = item?.category || '';
  document.getElementById('f-qty').value = item?.quantity || '0';
  document.getElementById('f-price').value = item?.price || '';
  document.getElementById('f-notes').value = item?.notes || '';
  document.getElementById('modal-title').textContent = id ? 'Edit Item' : 'Add Item';
  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

async function submitForm() {
  const payload = {
    id: document.getElementById('f-id').value.trim(),
    name: document.getElementById('f-name').value.trim(),
    category: document.getElementById('f-cat').value.trim(),
    quantity: document.getElementById('f-qty').value.trim(),
    price: document.getElementById('f-price').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
  };
  if (!payload.name) { showToast('Name is required', 'error'); return; }

  if (editingId) {
    const item = items.find(i => i.id === editingId);
    Object.assign(item, payload);
    await saveItem({ action: 'updateRow', row: item._row, values: Object.values(payload) });
    showToast('Updated', 'ok');
  } else {
    items.push({ ...payload, _row: items.length + 2 });
    await saveItem({ action: 'append', values: Object.values(payload) });
    showToast('Added', 'ok');
  }
  closeModal();
  renderList();
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const item = items[idx];
  await saveItem({ action: 'delete', row: item._row });
  items.splice(idx, 1);
  renderList();
  showToast('Deleted', 'ok');
}

function generateId() {
  return 'ID' + Date.now().toString(36).toUpperCase();
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── INIT ──────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

document.addEventListener('DOMContentLoaded', checkAuth);
