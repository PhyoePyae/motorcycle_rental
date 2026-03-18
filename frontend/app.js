/**
 * app.js - Motorcycle Rent Motorcycle Rental SPA
 * Single-page application controller for the admin dashboard.
 */

'use strict';

const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ? window.APP_CONFIG.API_BASE : '/api';

//  UTILS

const fmt = {
  number : (n) => Number(n || 0).toLocaleString('en-GB'),
  currency: (n) => new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n || 0)),
  date   : (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '-',
  dateShort: (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '-',
};

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  t.innerHTML = `<i data-lucide="${icon}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  lucide.createIcons({ nodes: [t] });
  setTimeout(() => { t.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => t.remove(), 320); }, 3200);
}

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}

function detailRow(label, value) {
  return `<div class="detail-row"><span>${label}</span><span>${value}</span></div>`;
}

function openDetailModal(title, rowsHtml, actionsHtml) {
  const body = `<div class="detail-list">${rowsHtml}</div>`;
  const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    ${actionsHtml || ''}
  `;
  openModal(title, body, footer);
}

function addressCell(addr) {
  if (!addr) return '-';
  if (addr.startsWith('http')) return `<a class="address-link" href="${addr}" target="_blank" rel="noopener"><i data-lucide="map-pin"></i> Map</a>`;
  return addr;
}

function paymentStatus(totalPaid, monthlyFee) {
  if (totalPaid <= 0) return badge('Unpaid', 'unpaid');
  if (totalPaid >= monthlyFee) return badge('Paid', 'paid');
  return badge('Partial', 'partial');
}

function oilChangeStatus(lastChange) {
  if (!lastChange) return '<span class="text-warning">No record</span>';
  const next = new Date(lastChange);
  next.setDate(next.getDate() + 30);
  const today = new Date();
  const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `<span class="text-danger">Overdue (${Math.abs(diffDays)}d ago)</span>`;
  if (diffDays <= 7)  return `<span class="text-warning">Due in ${diffDays}d</span>`;
  return `<span class="text-success">OK (${diffDays}d left)</span>`;
}

// Generic confirm dialog
function confirmDialog(title, msg, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = msg;
  document.getElementById('confirmOverlay').classList.add('open');
  const okBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');
  const close = () => document.getElementById('confirmOverlay').classList.remove('open');
  okBtn.onclick = () => { close(); onOk(); };
  cancelBtn.onclick = close;
}

//  MODAL SYSTEM

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  document.getElementById('modalOverlay').classList.add('open');
  lucide.createIcons({ nodes: [document.getElementById('modal')] });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalClose').onclick = closeModal;
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

//  NAVIGATION

const pageTitles = {
  dashboard: 'Dashboard', customers: 'Customers', motorcycles: 'Motorcycles',
  rentals: 'Rentals', payments: 'Payments', maintenance: 'Maintenance',
  calendar: 'Calendar', reports: 'Reports & Profit',
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.remove('hidden');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page];
  closeSidebar();
  pageLoaders[page]?.();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => { e.preventDefault(); navigate(item.dataset.page); });
});

function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('open'); }
document.getElementById('menuToggle').onclick = openSidebar;
document.getElementById('sidebarClose').onclick = closeSidebar;
document.getElementById('sidebarOverlay').onclick = closeSidebar;

function updateClock() {
  const now = new Date();
  document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}
updateClock();
setInterval(updateClock, 30000);

//  DASHBOARD

async function loadDashboard() {
  try {
    const d = await api('GET', '/dashboard/stats');
    const { summary, alerts, recent } = d;

    const cards = [
      { label: 'Total Bikes',     value: summary.total_motorcycles || 0,     icon: 'bike',          color: '#6c63ff' },
      { label: 'Rented',          value: summary.rented_motorcycles || 0,    icon: 'key',           color: '#00d4aa' },
      { label: 'Available',       value: summary.available_motorcycles || 0, icon: 'check-circle',  color: '#10b981' },
      { label: 'In Maintenance',  value: summary.in_maintenance || 0,        icon: 'wrench',        color: '#f59e0b' },
      { label: 'Customers',       value: summary.total_customers || 0,       icon: 'users',         color: '#3b82f6' },
      { label: 'Monthly Income',  value: fmt.currency(summary.monthly_income || 0),   icon: 'trending-up',  color: '#10b981' },
      { label: 'Monthly Expenses',value: fmt.currency(summary.monthly_expenses || 0), icon: 'trending-down',color: '#ff4d6d' },
      { label: 'Monthly Profit',  value: fmt.currency(summary.monthly_profit || 0),   icon: 'dollar-sign',  color: (summary.monthly_profit || 0) >= 0 ? '#10b981' : '#ff4d6d' },
    ];
    document.getElementById('dashboardCards').innerHTML = cards.map(c => `
      <div class="stat-card square" style="--card-color:${c.color}">
        <div class="card-icon"><i data-lucide="${c.icon}"></i></div>
        <div class="card-value">${c.value}</div>
        <div class="card-label">${c.label}</div>
      </div>`).join('');

    const alertsEl = document.getElementById('dashAlerts');
    let alertsHtml = '<div class="alert-list">';

    if (alerts.overdue_payments.length) {
      alerts.overdue_payments.forEach(r => {
        alertsHtml += `<div class="alert-item" style="--alert-color:var(--danger)">
          <div class="alert-icon"><i data-lucide="alert-circle"></i></div>
          <div>
            <div class="alert-title">Overdue Payment - ${r.customer_name}</div>
            <div class="alert-sub">${r.bike_id} - Was due: ${fmt.date(r.next_due_date)} - Monthly: ${fmt.currency(r.monthly_fee)}</div>
          </div>
        </div>`;
      });
    }

    if (alerts.upcoming_payments.length) {
      alerts.upcoming_payments.forEach(r => {
        alertsHtml += `<div class="alert-item" style="--alert-color:var(--warning)">
          <div class="alert-icon"><i data-lucide="bell"></i></div>
          <div>
            <div class="alert-title">Payment Due Soon - ${r.customer_name}</div>
            <div class="alert-sub">${r.bike_id} - Due: ${fmt.date(r.next_due_date)} - ${fmt.currency(r.monthly_fee)}</div>
          </div>
        </div>`;
      });
    }

    if (alerts.oil_change_needed.length) {
      alerts.oil_change_needed.forEach(m => {
        alertsHtml += `<div class="alert-item" style="--alert-color:var(--accent)">
          <div class="alert-icon"><i data-lucide="droplets"></i></div>
          <div>
            <div class="alert-title">Oil Change Needed - ${m.bike_id}</div>
            <div class="alert-sub">${m.model} - Last: ${fmt.date(m.last_oil_change) || 'Never'}</div>
          </div>
        </div>`;
      });
    }

    if (!alerts.overdue_payments.length && !alerts.upcoming_payments.length && !alerts.oil_change_needed.length) {
      alertsHtml += `<div class="alert-empty"><i data-lucide="check-circle"></i> No alerts - everything looks good!</div>`;
    }
    alertsHtml += '</div>';
    alertsEl.innerHTML = alertsHtml;

    const recentEl = document.getElementById('recentActivity');
    recentEl.innerHTML = `
      <div class="recent-card">
        <h4><i data-lucide="file-text"></i> Recent Rentals</h4>
        ${recent.rentals.map(r => `
          <div class="recent-row">
            <div><div class="rr-main">${r.customer_name}</div><div class="rr-sub">${r.bike_id}  -  ${r.model}</div></div>
            <div class="rr-right"><div>${fmt.dateShort(r.start_date)}</div>${badge(r.status, r.status)}</div>
          </div>`).join('') || '<div class="text-muted" style="font-size:.82rem;padding:.5rem 0">No rentals yet</div>'}
      </div>
      <div class="recent-card">
        <h4><i data-lucide="credit-card"></i> Recent Payments</h4>
        ${recent.payments.map(p => `
          <div class="recent-row">
            <div><div class="rr-main">${p.customer_name}</div><div class="rr-sub">${p.bike_id}</div></div>
            <div class="rr-right"><div class="text-success fw-600">${fmt.currency(p.amount)}</div><div class="rr-sub">${fmt.dateShort(p.date)}</div></div>
          </div>`).join('') || '<div class="text-muted" style="font-size:.82rem;padding:.5rem 0">No payments yet</div>'}
      </div>
      <div class="recent-card">
        <h4><i data-lucide="wrench"></i> Recent Maintenance</h4>
        ${recent.maintenance.map(m => `
          <div class="recent-row">
            <div><div class="rr-main">${m.bike_id}  -  ${m.model}</div><div class="rr-sub">${m.type.replace('_',' ')}</div></div>
            <div class="rr-right"><div class="text-warning fw-600">${fmt.currency(m.cost)}</div><div class="rr-sub">${fmt.dateShort(m.date)}</div></div>
          </div>`).join('') || '<div class="text-muted" style="font-size:.82rem;padding:.5rem 0">No logs yet</div>'}
      </div>`;

    lucide.createIcons({ nodes: [document.getElementById('page-dashboard')] });
  } catch (e) { toast('Failed to load dashboard: ' + e.message, 'error'); }
}

//  CUSTOMERS

async function loadCustomers() {
  const search = document.getElementById('customerSearch').value.trim();
  try {
    const customers = await api('GET', `/customers${search ? '?search=' + encodeURIComponent(search) : ''}`);
    window._customers = customers;
    const tbody = document.getElementById('customersBody');
    if (!customers.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i data-lucide="users"></i><br>No customers found</td></tr>`;
      lucide.createIcons({ nodes: [tbody] }); return;
    }
    tbody.innerHTML = customers.map((c, i) => `
      <tr>
        <td class="primary-mobile" data-label="Name" onclick="showCustomerDetail(${c.id})">
          <div class="cell-title">${c.name}</div>
          <div class="cell-sub"><strong>Phone:</strong> ${c.phone || '-'} · <strong>Rentals:</strong> ${c.total_rentals}</div>
        </td>
        <td class="text-muted hide-mobile" data-label="#">${i + 1}</td>
        <td class="hide-mobile" data-label="Name"><div class="fw-600">${c.name}</div></td>
        <td class="hide-mobile" data-label="Phone">${c.phone || '-'}</td>
        <td class="text-muted hide-mobile" data-label="NRC / ID">${c.nrc || '-'}</td>
        <td class="hide-mobile" data-label="Address">${addressCell(c.address)}</td>
        <td class="hide-mobile" data-label="Rentals"><span class="badge badge-active">${c.total_rentals}</span></td>
        <td class="cell-actions" data-label="Actions">
          <div class="actions">
            <button class="btn btn-ghost btn-icon" title="Edit" onclick="editCustomer(${c.id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-icon" title="Delete" style="color:var(--danger)" onclick="deleteCustomer(${c.id},'${c.name}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`).join('');
    lucide.createIcons({ nodes: [tbody] });
  } catch (e) { toast('Failed to load customers: ' + e.message, 'error'); }
}

async function showCustomerDetail(id) {
  let c = (window._customers || []).find(x => x.id === id);
  if (!c) {
    try { c = await api('GET', `/customers/${id}`); }
    catch (e) { toast(e.message, 'error'); return; }
  }
  const rows = [
    detailRow('Name', c.name || '-'),
    detailRow('Phone', c.phone || '-'),
    detailRow('NRC / ID', c.nrc || '-'),
    detailRow('Address', addressCell(c.address)),
    detailRow('Total Rentals', c.total_rentals ?? (c.rentals ? c.rentals.length : '-')),
  ].join('');
  const actions = `
    <button class="btn btn-primary" onclick="editCustomer(${c.id})">Edit</button>
    <button class="btn btn-danger" onclick="deleteCustomer(${c.id},'${c.name}')">Delete</button>
  `;
  openDetailModal('Customer Details', rows, actions);
}

function customerFormHtml(c = {}) {
  c = c || {};
  return `
    <div class="form-row"><label>Name *</label><input id="f_name" value="${c.name || ''}" placeholder="Full name" /></div>
    <div class="form-cols">
      <div class="form-row"><label>Phone</label><input id="f_phone" value="${c.phone || ''}" placeholder="09-xxx-xxxxx" /></div>
      <div class="form-row"><label>NRC / ID</label><input id="f_nrc" value="${c.nrc || ''}" placeholder="Optional" /></div>
    </div>
    <div class="form-row"><label>Address / Google Maps URL</label><input id="f_address" value="${c.address || ''}" placeholder="Street address or paste Maps link" /><div class="hint">Paste a Google Maps URL to get a clickable link</div></div>`;
}

function openCustomerModal(customer = null) {
  openModal(
    customer ? 'Edit Customer' : 'Add Customer',
    customerFormHtml(customer),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveCustomer(${customer?.id || 'null'})">${customer ? 'Save Changes' : 'Add Customer'}</button>`
  );
}

async function saveCustomer(id) {
  const body = {
    name:    document.getElementById('f_name').value.trim(),
    phone:   document.getElementById('f_phone').value.trim(),
    nrc:     document.getElementById('f_nrc').value.trim(),
    address: document.getElementById('f_address').value.trim(),
  };
  if (!body.name) { toast('Name is required', 'error'); return; }
  try {
    if (id) { await api('PUT', `/customers/${id}`, body); toast('Customer updated', 'success'); }
    else     { await api('POST', '/customers', body); toast('Customer added', 'success'); }
    closeModal(); loadCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

async function editCustomer(id) {
  try { const c = await api('GET', `/customers/${id}`); openCustomerModal(c); }
  catch (e) { toast(e.message, 'error'); }
}

function deleteCustomer(id, name) {
  confirmDialog('Delete Customer', `Delete "${name}"? This cannot be undone.`, async () => {
    try { await api('DELETE', `/customers/${id}`); toast('Customer deleted', 'success'); loadCustomers(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

document.getElementById('btnAddCustomer').onclick = () => openCustomerModal();

let _customerSearchTimer;
document.getElementById('customerSearch').addEventListener('input', () => {
  clearTimeout(_customerSearchTimer);
  _customerSearchTimer = setTimeout(loadCustomers, 300);
});

//  MOTORCYCLES

async function loadMotorcycles() {
  const search = document.getElementById('motoSearch').value.trim();
  const status = document.getElementById('motoStatusFilter').value;
  let qs = [];
  if (search) qs.push('search=' + encodeURIComponent(search));
  if (status) qs.push('status=' + status);
  try {
    const motos = await api('GET', `/motorcycles${qs.length ? '?' + qs.join('&') : ''}`);
    window._motos = motos;
    const tbody = document.getElementById('motosBody');
    if (!motos.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No motorcycles found</td></tr>`; return;
    }
    tbody.innerHTML = motos.map(m => `
      <tr>
        <td class="primary-mobile" data-label="Bike" onclick="showMotoDetail(${m.id})">
          <div class="cell-title">${m.bike_id} · ${m.model}</div>
          <div class="cell-sub"><strong>Status:</strong> ${m.status} · <strong>Plate:</strong> ${m.plate_number || '-'}</div>
        </td>
        <td class="fw-600 text-primary hide-mobile" data-label="Bike ID">${m.bike_id}</td>
        <td class="hide-mobile" data-label="Model">${m.model}</td>
        <td class="text-muted hide-mobile" data-label="Plate">${m.plate_number || '-'}</td>
        <td class="hide-mobile" data-label="Status">${badge(m.status, m.status)}</td>
        <td class="hide-mobile" data-label="Purchase Price">${fmt.currency(m.purchase_price)}</td>
        <td class="hide-mobile" data-label="Last Oil Change">${fmt.date(m.last_oil_change) || '<span class="text-warning">None</span>'}</td>
        <td class="hide-mobile" data-label="Next Oil Change">${oilChangeStatus(m.last_oil_change)}</td>
        <td class="cell-actions" data-label="Actions">
          <div class="actions">
            <button class="btn btn-ghost btn-icon" title="Edit" onclick="editMoto(${m.id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-icon" title="Delete" style="color:var(--danger)" onclick="deleteMoto(${m.id},'${m.bike_id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`).join('');
    lucide.createIcons({ nodes: [tbody] });
  } catch (e) { toast('Failed to load motorcycles: ' + e.message, 'error'); }
}

async function showMotoDetail(id) {
  let m = (window._motos || []).find(x => x.id === id);
  if (!m) {
    try { m = await api('GET', `/motorcycles/${id}`); }
    catch (e) { toast(e.message, 'error'); return; }
  }
  const rows = [
    detailRow('Bike ID', m.bike_id || '-'),
    detailRow('Model', m.model || '-'),
    detailRow('Status', m.status || '-'),
    detailRow('Plate', m.plate_number || '-'),
    detailRow('Purchase Price', fmt.currency(m.purchase_price || 0)),
    detailRow('Last Oil Change', fmt.date(m.last_oil_change)),
    detailRow('Next Oil Change', m.next_oil_date ? fmt.date(m.next_oil_date) : '-'),
  ].join('');
  const actions = `
    <button class="btn btn-primary" onclick="editMoto(${m.id})">Edit</button>
    <button class="btn btn-danger" onclick="deleteMoto(${m.id},'${m.bike_id}')">Delete</button>
  `;
  openDetailModal('Motorcycle Details', rows, actions);
}

function motoFormHtml(m = {}) {
  m = m || {};
  const statuses = ['available','rented','maintenance'];
  return `
    <div class="form-cols">
      <div class="form-row"><label>Bike ID *</label><input id="f_bike_id" value="${m.bike_id || ''}" placeholder="e.g. TYR-007" /></div>
      <div class="form-row"><label>Plate Number</label><input id="f_plate" value="${m.plate_number || ''}" placeholder="e.g. YGN-1A-1234" /></div>
    </div>
    <div class="form-row"><label>Model *</label><input id="f_model" value="${m.model || ''}" placeholder="e.g. Honda Wave 110" /></div>
    <div class="form-cols">
      <div class="form-row"><label>Purchase Price (฿)</label><input type="number" id="f_purchase_price" value="${m.purchase_price || ''}" placeholder="0" /></div>
      <div class="form-row"><label>Status</label>
        <select id="f_status">${statuses.map(s => `<option value="${s}" ${m.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row"><label>Last Oil Change Date</label><input type="date" id="f_oil_date" value="${m.last_oil_change || ''}" /></div>`;
}

function openMotoModal(moto = null) {
  openModal(
    moto ? 'Edit Motorcycle' : 'Add Motorcycle',
    motoFormHtml(moto),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveMoto(${moto?.id || 'null'})">${moto ? 'Save Changes' : 'Add Motorcycle'}</button>`
  );
}

async function saveMoto(id) {
  const body = {
    bike_id:        document.getElementById('f_bike_id').value.trim(),
    model:          document.getElementById('f_model').value.trim(),
    plate_number:   document.getElementById('f_plate').value.trim(),
    purchase_price: parseFloat(document.getElementById('f_purchase_price').value) || 0,
    status:         document.getElementById('f_status').value,
    last_oil_change:document.getElementById('f_oil_date').value || null,
  };
  if (!body.bike_id || !body.model) { toast('Bike ID and model are required', 'error'); return; }
  try {
    if (id) { await api('PUT', `/motorcycles/${id}`, body); toast('Motorcycle updated', 'success'); }
    else     { await api('POST', '/motorcycles', body); toast('Motorcycle added', 'success'); }
    closeModal(); loadMotorcycles();
  } catch (e) { toast(e.message, 'error'); }
}

async function editMoto(id) {
  try { const m = await api('GET', `/motorcycles/${id}`); openMotoModal(m); }
  catch (e) { toast(e.message, 'error'); }
}

function deleteMoto(id, bikeId) {
  confirmDialog('Delete Motorcycle', `Delete "${bikeId}"? All maintenance logs will be lost.`, async () => {
    try { await api('DELETE', `/motorcycles/${id}`); toast('Motorcycle deleted', 'success'); loadMotorcycles(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

document.getElementById('btnAddMoto').onclick = () => openMotoModal();
let _motoSearchTimer;
document.getElementById('motoSearch').addEventListener('input', () => {
  clearTimeout(_motoSearchTimer);
  _motoSearchTimer = setTimeout(loadMotorcycles, 300);
});
document.getElementById('motoStatusFilter').addEventListener('change', loadMotorcycles);

//  RENTALS

async function loadRentals() {
  const search = document.getElementById('rentalSearch').value.trim().toLowerCase();
  const status = document.getElementById('rentalStatusFilter').value;
  let qs = [];
  if (status) qs.push('status=' + status);
  try {
    let rentals = await api('GET', `/rentals${qs.length ? '?' + qs.join('&') : ''}`);
    if (search) {
      rentals = rentals.filter(r =>
        r.customer_name.toLowerCase().includes(search) ||
        r.bike_id.toLowerCase().includes(search) ||
        r.model.toLowerCase().includes(search)
      );
    }
    window._rentals = rentals;
    const tbody = document.getElementById('rentalsBody');
    if (!rentals.length) { tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No rentals found</td></tr>`; return; }
    tbody.innerHTML = rentals.map((r, i) => {
      const today = new Date().toISOString().slice(0,10);
      const dueCls = r.status === 'active' && r.next_due_date < today ? ' text-danger' : '';
      return `
        <tr>
          <td class="primary-mobile" data-label="Rental" onclick="showRentalDetail(${r.id})">
            <div class="cell-title">${r.customer_name} · ${r.bike_id}</div>
            <div class="cell-sub"><strong>Monthly:</strong> ${fmt.currency(r.monthly_fee)} · <strong>Due:</strong> ${fmt.date(r.next_due_date)}</div>
          </td>
          <td class="text-muted hide-mobile" data-label="#">${i+1}</td>
          <td class="hide-mobile" data-label="Customer"><div class="fw-600">${r.customer_name}</div><div class="text-muted" style="font-size:.77rem">${r.customer_phone||'-'}</div></td>
          <td class="hide-mobile" data-label="Bike"><div class="fw-600 text-primary">${r.bike_id}</div><div class="text-muted" style="font-size:.77rem">${r.model}</div></td>
          <td class="hide-mobile" data-label="Start Date">${fmt.date(r.start_date)}</td>
          <td class="fw-600 hide-mobile" data-label="Monthly Fee">${fmt.currency(r.monthly_fee)}</td>
          <td class="hide-mobile" data-label="Deposit">${fmt.currency(r.deposit)}</td>
          <td class="${dueCls} fw-600 hide-mobile" data-label="Next Due">${fmt.date(r.next_due_date)}</td>
          <td class="text-success fw-600 hide-mobile" data-label="Paid">${fmt.currency(r.total_paid)}</td>
          <td class="hide-mobile" data-label="Status">${badge(r.status, r.status)}</td>
          <td class="cell-actions" data-label="Actions">
            <div class="actions">
              <button class="btn btn-ghost btn-icon" title="Add Payment" onclick="quickAddPayment(${r.id},'${r.customer_name}','${r.bike_id}')"><i data-lucide="plus-circle"></i></button>
              <button class="btn btn-ghost btn-icon" title="Edit" onclick="editRental(${r.id})"><i data-lucide="pencil"></i></button>
              ${r.status==='active' ? `<button class="btn btn-ghost btn-icon" title="Complete Rental" style="color:var(--accent)" onclick="completeRental(${r.id})"><i data-lucide="check-circle"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
    lucide.createIcons({ nodes: [document.getElementById('rentalsBody')] });
  } catch (e) { toast('Failed to load rentals: ' + e.message, 'error'); }
}

async function showRentalDetail(id) {
  let r = (window._rentals || []).find(x => x.id === id);
  if (!r) {
    try { r = await api('GET', `/rentals/${id}`); }
    catch (e) { toast(e.message, 'error'); return; }
  }
  const rows = [
    detailRow('Customer', r.customer_name || '-'),
    detailRow('Phone', r.customer_phone || '-'),
    detailRow('Bike', `${r.bike_id || '-'}${r.model ? ' · ' + r.model : ''}`),
    detailRow('Start Date', fmt.date(r.start_date)),
    detailRow('Monthly Fee', fmt.currency(r.monthly_fee || 0)),
    detailRow('Deposit', fmt.currency(r.deposit || 0)),
    detailRow('Next Due', fmt.date(r.next_due_date)),
    detailRow('Total Paid', fmt.currency(r.total_paid || 0)),
    detailRow('Status', r.status || '-'),
  ].join('');
  const actions = `
    <button class="btn btn-primary" onclick="editRental(${r.id})">Edit</button>
    ${r.status === 'active' ? `<button class="btn btn-success" onclick="completeRental(${r.id})">Complete</button>` : ''}
    <button class="btn btn-danger" onclick="deleteRental(${r.id})">Delete</button>
  `;
  openDetailModal('Rental Details', rows, actions);
}

async function openRentalModal(rental = null) {
  try {
    const [customers, motorcycles] = await Promise.all([
      api('GET', '/customers'),
      api('GET', '/motorcycles'),
    ]);

    const today = new Date().toISOString().slice(0,10);
    const customerOptions = customers.map(c => `<option value="${c.id}" ${rental?.customer_id===c.id?'selected':''}>${c.name} (${c.phone||'no phone'})</option>`).join('');
    const motoOptions = motorcycles.filter(m => m.status === 'available' || m.id === rental?.motorcycle_id)
      .map(m => `<option value="${m.id}" ${rental?.motorcycle_id===m.id?'selected':''}>${m.bike_id} - ${m.model} [${m.status}]</option>`).join('');

    const body = `
      <div class="form-row">
        <label>Customer *</label>
        <div class="form-select-row">
          <select id="f_customer_id"><option value="">- Select customer -</option>${customerOptions}</select>
          <button class="btn btn-ghost btn-sm" onclick="inlineCreateCustomer()"><i data-lucide="user-plus"></i> New</button>
        </div>
      </div>
      <div class="form-row">
        <label>Motorcycle *</label>
        <div class="form-select-row">
          <select id="f_motorcycle_id"><option value="">- Select motorcycle -</option>${motoOptions}</select>
          <button class="btn btn-ghost btn-sm" onclick="inlineCreateMoto()"><i data-lucide="plus"></i> New</button>
        </div>
      </div>
      <div class="form-cols">
        <div class="form-row"><label>Start Date *</label><input type="date" id="f_start_date" value="${rental?.start_date || today}" /></div>
        <div class="form-row"><label>Monthly Fee (฿) *</label><input type="number" id="f_monthly_fee" value="${rental?.monthly_fee || ''}" placeholder="e.g. 150000" /></div>
      </div>
      <div class="form-row"><label>Deposit (฿)</label><input type="number" id="f_deposit" value="${rental?.deposit || 0}" /></div>
      <div class="form-row"><label>Notes</label><textarea id="f_notes">${rental?.notes || ''}</textarea></div>`;

    openModal(
      rental ? 'Edit Rental' : 'Create New Rental',
      body,
      `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="saveRental(${rental?.id || 'null'})">${rental ? 'Save Changes' : 'Create Rental'}</button>`
    );
  } catch (e) { toast(e.message, 'error'); }
}

async function saveRental(id) {
  const body = {
    customer_id:   parseInt(document.getElementById('f_customer_id').value),
    motorcycle_id: parseInt(document.getElementById('f_motorcycle_id').value),
    start_date:    document.getElementById('f_start_date').value,
    monthly_fee:   parseFloat(document.getElementById('f_monthly_fee').value),
    deposit:       parseFloat(document.getElementById('f_deposit').value) || 0,
    notes:         document.getElementById('f_notes').value.trim(),
  };
  if (!body.customer_id || !body.motorcycle_id || !body.start_date || !body.monthly_fee) {
    toast('Customer, motorcycle, start date and monthly fee are required', 'error'); return;
  }
  try {
    if (id) { await api('PUT', `/rentals/${id}`, body); toast('Rental updated', 'success'); }
    else     { await api('POST', '/rentals', body); toast('Rental created', 'success'); }
    closeModal(); loadRentals();
  } catch (e) { toast(e.message, 'error'); }
}

async function editRental(id) {
  try { const r = await api('GET', `/rentals/${id}`); openRentalModal(r); }
  catch (e) { toast(e.message, 'error'); }
}

function completeRental(id) {
  confirmDialog('Complete Rental', 'Mark this rental as completed? The motorcycle will become available again.', async () => {
    try {
      await api('PUT', `/rentals/${id}`, { status: 'completed' });
      toast('Rental marked as completed', 'success'); loadRentals();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// Inline customer creation from within rental modal (uses modal form, not prompt)
function inlineCreateCustomer() {
  // Save current modal state
  const prevTitle  = document.getElementById('modalTitle').textContent;
  const prevBody   = document.getElementById('modalBody').innerHTML;
  const prevFooter = document.getElementById('modalFooter').innerHTML;

  openModal(
    'Quick Add Customer',
    `<div class="form-row"><label>Name *</label><input id="ic_name" placeholder="Full name" /></div>
     <div class="form-row"><label>Phone</label><input id="ic_phone" placeholder="09-xxx-xxxxx" /></div>`,
    `<button class="btn btn-ghost" id="ic_cancel">Cancel</button>
     <button class="btn btn-primary" id="ic_save">Add Customer</button>`
  );

  document.getElementById('ic_cancel').onclick = () => {
    // Restore rental modal
    document.getElementById('modalTitle').textContent = prevTitle;
    document.getElementById('modalBody').innerHTML    = prevBody;
    document.getElementById('modalFooter').innerHTML  = prevFooter;
    lucide.createIcons({ nodes: [document.getElementById('modal')] });
  };

  document.getElementById('ic_save').onclick = async () => {
    const name  = document.getElementById('ic_name').value.trim();
    const phone = document.getElementById('ic_phone').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    try {
      const c = await api('POST', '/customers', { name, phone });
      // Restore rental modal then inject the new customer
      document.getElementById('modalTitle').textContent = prevTitle;
      document.getElementById('modalBody').innerHTML    = prevBody;
      document.getElementById('modalFooter').innerHTML  = prevFooter;
      lucide.createIcons({ nodes: [document.getElementById('modal')] });
      const sel = document.getElementById('f_customer_id');
      sel.innerHTML += `<option value="${c.id}" selected>${c.name} (${c.phone||'no phone'})</option>`;
      sel.value = c.id;
      toast(`Customer "${c.name}" created`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
}

function inlineCreateMoto() {
  const prevTitle  = document.getElementById('modalTitle').textContent;
  const prevBody   = document.getElementById('modalBody').innerHTML;
  const prevFooter = document.getElementById('modalFooter').innerHTML;

  openModal(
    'Quick Add Motorcycle',
    `<div class="form-cols">
       <div class="form-row"><label>Bike ID *</label><input id="im_bike_id" placeholder="e.g. TYR-007" /></div>
       <div class="form-row"><label>Plate</label><input id="im_plate" placeholder="e.g. YGN-1A-1234" /></div>
     </div>
     <div class="form-row"><label>Model *</label><input id="im_model" placeholder="e.g. Honda Wave 110" /></div>
     <div class="form-row"><label>Purchase Price (฿)</label><input type="number" id="im_price" placeholder="0" /></div>`,
    `<button class="btn btn-ghost" id="im_cancel">Cancel</button>
     <button class="btn btn-primary" id="im_save">Add Motorcycle</button>`
  );

  document.getElementById('im_cancel').onclick = () => {
    document.getElementById('modalTitle').textContent = prevTitle;
    document.getElementById('modalBody').innerHTML    = prevBody;
    document.getElementById('modalFooter').innerHTML  = prevFooter;
    lucide.createIcons({ nodes: [document.getElementById('modal')] });
  };

  document.getElementById('im_save').onclick = async () => {
    const bike_id       = document.getElementById('im_bike_id').value.trim();
    const model         = document.getElementById('im_model').value.trim();
    const plate_number  = document.getElementById('im_plate').value.trim();
    const purchase_price = parseFloat(document.getElementById('im_price').value) || 0;
    if (!bike_id || !model) { toast('Bike ID and model are required', 'error'); return; }
    try {
      const m = await api('POST', '/motorcycles', { bike_id, model, plate_number, purchase_price });
      document.getElementById('modalTitle').textContent = prevTitle;
      document.getElementById('modalBody').innerHTML    = prevBody;
      document.getElementById('modalFooter').innerHTML  = prevFooter;
      lucide.createIcons({ nodes: [document.getElementById('modal')] });
      const sel = document.getElementById('f_motorcycle_id');
      sel.innerHTML += `<option value="${m.id}" selected>${m.bike_id} - ${m.model} [available]</option>`;
      sel.value = m.id;
      toast(`Motorcycle "${m.bike_id}" created`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
}

document.getElementById('btnAddRental').onclick = () => openRentalModal();
document.getElementById('rentalSearch').addEventListener('input', loadRentals);
document.getElementById('rentalStatusFilter').addEventListener('change', loadRentals);

//  PAYMENTS

async function loadPayments() {
  const search = document.getElementById('paymentSearch').value.trim().toLowerCase();
  try {
    let payments = await api('GET', '/payments');
    if (search) {
      payments = payments.filter(p =>
        p.customer_name.toLowerCase().includes(search) ||
        p.bike_id.toLowerCase().includes(search)
      );
    }
    window._payments = payments;
    const tbody = document.getElementById('paymentsBody');
    if (!payments.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No payments found</td></tr>`; return; }
    tbody.innerHTML = payments.map(p => `
      <tr>
        <td class="primary-mobile" data-label="Payment" onclick="showPaymentDetail(${p.id})">
          <div class="cell-title">${p.customer_name} · ${p.bike_id}</div>
          <div class="cell-sub"><strong>Amount:</strong> ${fmt.currency(p.amount)} · <strong>Date:</strong> ${fmt.date(p.date)}</div>
        </td>
        <td class="hide-mobile" data-label="Date">${fmt.date(p.date)}</td>
        <td class="fw-600 hide-mobile" data-label="Customer">${p.customer_name}</td>
        <td class="text-primary hide-mobile" data-label="Bike">${p.bike_id}</td>
        <td class="text-success fw-600 hide-mobile" data-label="Amount">${fmt.currency(p.amount)}</td>
        <td class="text-muted hide-mobile" data-label="Note">${p.note || '-'}</td>
        <td class="cell-actions" data-label="Actions">
          <div class="actions">
            <button class="btn btn-ghost btn-icon" title="Edit" onclick="editPayment(${p.id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-icon" title="Delete" style="color:var(--danger)" onclick="deletePayment(${p.id})"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`).join('');
    lucide.createIcons({ nodes: [tbody] });
  } catch (e) { toast('Failed to load payments: ' + e.message, 'error'); }
}

async function showPaymentDetail(id) {
  let p = (window._payments || []).find(x => x.id === id);
  if (!p) {
    try { p = await api('GET', `/payments/${id}`); }
    catch (e) { toast(e.message, 'error'); return; }
  }
  const rows = [
    detailRow('Customer', p.customer_name || '-'),
    detailRow('Bike', p.bike_id || '-'),
    detailRow('Amount', fmt.currency(p.amount || 0)),
    detailRow('Date', fmt.date(p.date)),
    detailRow('Note', p.note || '-'),
  ].join('');
  const actions = `
    <button class="btn btn-primary" onclick="editPayment(${p.id})">Edit</button>
    <button class="btn btn-danger" onclick="deletePayment(${p.id})">Delete</button>
  `;
  openDetailModal('Payment Details', rows, actions);
}

async function openPaymentModal(payment = null, preRentalId = null) {
  try {
    const rentals = await api('GET', '/rentals?status=active');
    const today = new Date().toISOString().slice(0,10);
    const rentalOptions = rentals.map(r =>
      `<option value="${r.id}" ${(payment?.rental_id===r.id || preRentalId===r.id)?'selected':''}>${r.customer_name} / ${r.bike_id}</option>`
    ).join('');
    const body = `
      <div class="form-row"><label>Rental *</label>
        <select id="f_rental_id"><option value="">- Select rental -</option>${rentalOptions}</select>
      </div>
      <div class="form-cols">
        <div class="form-row"><label>Date *</label><input type="date" id="f_date" value="${payment?.date || today}" /></div>
        <div class="form-row"><label>Amount (฿) *</label><input type="number" id="f_amount" value="${payment?.amount || ''}" placeholder="e.g. 150000" /></div>
      </div>
      <div class="form-row"><label>Note</label><input id="f_note" value="${payment?.note || ''}" placeholder="e.g. Month 3, Partial payment..." /></div>`;
    openModal(
      payment ? 'Edit Payment' : 'Add Payment',
      body,
      `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="savePayment(${payment?.id || 'null'})">${payment ? 'Save Changes' : 'Add Payment'}</button>`
    );
  } catch (e) { toast(e.message, 'error'); }
}

async function savePayment(id) {
  const body = {
    rental_id: parseInt(document.getElementById('f_rental_id').value),
    date:      document.getElementById('f_date').value,
    amount:    parseFloat(document.getElementById('f_amount').value),
    note:      document.getElementById('f_note').value.trim(),
  };
  if (!body.rental_id || !body.date || !body.amount) { toast('Rental, date and amount are required', 'error'); return; }
  try {
    if (id) { await api('PUT', `/payments/${id}`, body); toast('Payment updated', 'success'); }
    else     { await api('POST', '/payments', body); toast('Payment recorded', 'success'); }
    closeModal(); loadPayments();
  } catch (e) { toast(e.message, 'error'); }
}

async function editPayment(id) {
  try { const p = await api('GET', `/payments/${id}`); openPaymentModal(p); }
  catch (e) { toast(e.message, 'error'); }
}

function deletePayment(id) {
  confirmDialog('Delete Payment', 'Delete this payment record?', async () => {
    try { await api('DELETE', `/payments/${id}`); toast('Payment deleted', 'success'); loadPayments(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

function quickAddPayment(rentalId, customerName, bikeId) {
  openPaymentModal(null, rentalId);
}

document.getElementById('btnAddPayment').onclick = () => openPaymentModal();
document.getElementById('paymentSearch').addEventListener('input', loadPayments);

//  MAINTENANCE

async function loadMaintenance() {
  const search = document.getElementById('maintSearch').value.trim().toLowerCase();
  const type   = document.getElementById('maintTypeFilter').value;
  let qs = [];
  if (type) qs.push('type=' + type);
  try {
    let logs = await api('GET', `/maintenance${qs.length ? '?' + qs.join('&') : ''}`);
    if (search) logs = logs.filter(l => l.bike_id.toLowerCase().includes(search) || l.model.toLowerCase().includes(search));
    window._maint = logs;

    // Oil alert banner
    const today = new Date().toISOString().slice(0,10);
    const motos = await api('GET', '/motorcycles');
    const needOil = motos.filter(m => {
      if (!m.last_oil_change) return true;
      const next = new Date(m.last_oil_change);
      next.setDate(next.getDate() + 30);
      return next.toISOString().slice(0,10) <= today;
    });
    document.getElementById('oilAlertBanner').innerHTML = needOil.length
      ? `<div class="alert-item" style="--alert-color:var(--warning);margin-bottom:1rem">
           <div class="alert-icon"><i data-lucide="droplets"></i></div>
           <div><div class="alert-title">${needOil.length} bike(s) need an oil change</div>
           <div class="alert-sub">${needOil.map(m=>m.bike_id).join(', ')}</div></div>
         </div>` : '';
    lucide.createIcons({ nodes: [document.getElementById('oilAlertBanner')] });

    const tbody = document.getElementById('maintBody');
    if (!logs.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No maintenance logs found</td></tr>`; return; }
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="primary-mobile" data-label="Maintenance" onclick="showMaintDetail(${l.id})">
          <div class="cell-title">${l.bike_id} · ${l.model}</div>
          <div class="cell-sub"><strong>Type:</strong> ${l.type.replace('_',' ')} · <strong>Cost:</strong> ${fmt.currency(l.cost)}</div>
        </td>
        <td class="hide-mobile" data-label="Date">${fmt.date(l.date)}</td>
        <td class="hide-mobile" data-label="Bike"><span class="fw-600 text-primary">${l.bike_id}</span> <span class="text-muted">${l.model}</span></td>
        <td class="hide-mobile" data-label="Type">${badge(l.type, l.type)}</td>
        <td class="text-warning fw-600 hide-mobile" data-label="Cost">${fmt.currency(l.cost)}</td>
        <td class="text-muted hide-mobile" data-label="Notes">${l.notes || '-'}</td>
        <td class="cell-actions" data-label="Actions">
          <div class="actions">
            <button class="btn btn-ghost btn-icon" title="Edit" onclick="editMaint(${l.id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-icon" title="Delete" style="color:var(--danger)" onclick="deleteMaint(${l.id})"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`).join('');
    lucide.createIcons({ nodes: [tbody] });
  } catch (e) { toast('Failed to load maintenance: ' + e.message, 'error'); }
}

async function showMaintDetail(id) {
  let l = (window._maint || []).find(x => x.id === id);
  if (!l) {
    try { l = await api('GET', `/maintenance/${id}`); }
    catch (e) { toast(e.message, 'error'); return; }
  }
  const rows = [
    detailRow('Bike', `${l.bike_id || '-'}${l.model ? ' · ' + l.model : ''}`),
    detailRow('Type', l.type ? l.type.replace('_',' ') : '-'),
    detailRow('Date', fmt.date(l.date)),
    detailRow('Cost', fmt.currency(l.cost || 0)),
    detailRow('Notes', l.notes || '-'),
  ].join('');
  const actions = `
    <button class="btn btn-primary" onclick="editMaint(${l.id})">Edit</button>
    <button class="btn btn-danger" onclick="deleteMaint(${l.id})">Delete</button>
  `;
  openDetailModal('Maintenance Details', rows, actions);
}

async function openMaintModal(log = null) {
  const motos = await api('GET', '/motorcycles');
  const today = new Date().toISOString().slice(0,10);
  const motoOpts = motos.map(m => `<option value="${m.id}" ${log?.motorcycle_id===m.id?'selected':''}>${m.bike_id} - ${m.model}</option>`).join('');
  const types = ['oil_change','repair','other'];
  const body = `
    <div class="form-row"><label>Motorcycle *</label>
      <select id="f_moto_id"><option value="">- Select -</option>${motoOpts}</select>
    </div>
    <div class="form-cols">
      <div class="form-row"><label>Date *</label><input type="date" id="f_date" value="${log?.date || today}" /></div>
      <div class="form-row"><label>Type *</label>
        <select id="f_type">${types.map(t => `<option value="${t}" ${log?.type===t?'selected':''}>${t.replace('_',' ')}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row"><label>Cost (฿)</label><input type="number" id="f_cost" value="${log?.cost || 0}" /></div>
    <div class="form-row"><label>Notes</label><textarea id="f_notes">${log?.notes || ''}</textarea></div>`;
  openModal(
    log ? 'Edit Maintenance Log' : 'Add Maintenance Log',
    body,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveMaint(${log?.id || 'null'})">${log ? 'Save' : 'Add Log'}</button>`
  );
}

async function saveMaint(id) {
  const body = {
    motorcycle_id: parseInt(document.getElementById('f_moto_id').value),
    date:          document.getElementById('f_date').value,
    type:          document.getElementById('f_type').value,
    cost:          parseFloat(document.getElementById('f_cost').value) || 0,
    notes:         document.getElementById('f_notes').value.trim(),
  };
  if (!body.motorcycle_id || !body.date || !body.type) { toast('Motorcycle, date, type required', 'error'); return; }
  try {
    if (id) { await api('PUT', `/maintenance/${id}`, body); toast('Log updated', 'success'); }
    else     { await api('POST', '/maintenance', body); toast('Log added', 'success'); }
    closeModal(); loadMaintenance();
  } catch (e) { toast(e.message, 'error'); }
}

async function editMaint(id) {
  try { const l = await api('GET', `/maintenance/${id}`); openMaintModal(l); }
  catch (e) { toast(e.message, 'error'); }
}

function deleteMaint(id) {
  confirmDialog('Delete Log', 'Delete this maintenance log?', async () => {
    try { await api('DELETE', `/maintenance/${id}`); toast('Log deleted', 'success'); loadMaintenance(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

document.getElementById('btnAddMaint').onclick = () => openMaintModal();
document.getElementById('maintSearch').addEventListener('input', loadMaintenance);
document.getElementById('maintTypeFilter').addEventListener('change', loadMaintenance);

//  CALENDAR

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

const EVENT_COLORS = {
  rental_start: 'var(--accent)',
  payment_due:  'var(--danger)',
  payment_made: 'var(--success)',
  oil_change_due:'var(--warning)',
  maintenance:  'var(--info)',
};

async function loadCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${months[calMonth-1]} ${calYear}`;

  try {
    const data = await api('GET', `/calendar?year=${calYear}&month=${calMonth}`);
    const { events } = data;
    const today = new Date().toISOString().slice(0,10);

    const grid = document.getElementById('calendarGrid');
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayEvents = events[dateStr] || [];
      const isToday = dateStr === today;
      html += `
        <div class="cal-day${isToday?' today':''}${dayEvents.length?' has-events':''}" onclick="showCalDetail('${dateStr}')">
          <div class="cal-day-num">${day}</div>
          <div class="cal-dots">
            ${dayEvents.slice(0,6).map(e => `<div class="cal-dot-item" style="background:${EVENT_COLORS[e.type]||'var(--text-muted)'}" title="${e.label}"></div>`).join('')}
          </div>
        </div>`;
    }

    grid.innerHTML = html;
    window._calEvents = events;
  } catch (e) { toast('Failed to load calendar: ' + e.message, 'error'); }
}

function showCalDetail(dateStr) {
  const evs = (window._calEvents || {})[dateStr] || [];
  const panel = document.getElementById('calDetail');
  const fd = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('calDetailDate').textContent = fd;

  if (!evs.length) {
    document.getElementById('calDetailContent').innerHTML = '<div class="text-muted" style="padding:.5rem 0;font-size:.85rem">No events on this day.</div>';
  } else {
    document.getElementById('calDetailContent').innerHTML = evs.map(e => `
      <div class="cal-event-item">
        <div class="cal-event-dot" style="background:${EVENT_COLORS[e.type]||'gray'}"></div>
        <div>
          <div style="font-weight:500">${e.label}</div>
          ${e.data?.amount ? `<div style="font-size:.78rem;color:var(--text-muted)">Amount: ${fmt.currency(e.data.amount)}</div>` : ''}
          ${e.data?.cost   ? `<div style="font-size:.78rem;color:var(--text-muted)">Cost: ${fmt.currency(e.data.cost)}</div>` : ''}
        </div>
      </div>`).join('');
  }
  panel.style.display = 'block';
}

document.getElementById('calPrev').onclick = () => { calMonth--; if(calMonth<1){calMonth=12;calYear--;} loadCalendar(); };
document.getElementById('calNext').onclick = () => { calMonth++; if(calMonth>12){calMonth=1;calYear++;} loadCalendar(); };
document.getElementById('calToday').onclick  = () => { calYear=new Date().getFullYear(); calMonth=new Date().getMonth()+1; loadCalendar(); };
document.getElementById('calDetailClose').onclick = () => { document.getElementById('calDetail').style.display='none'; };

//  REPORTS

async function loadReports() {
  try {
    const [profitData, monthly] = await Promise.all([
      api('GET', '/reports/profit'),
      api('GET', '/reports/monthly'),
    ]);

    const t = profitData.totals;
    const rCards = [
      { label:'Total Income',        value: fmt.currency(t.total_income),        icon:'trending-up',   color:'#10b981'},
      { label:'Total Maint. Cost',   value: fmt.currency(t.total_maint_cost),    icon:'wrench',        color:'#f59e0b'},
      { label:'Total Purchase Cost', value: fmt.currency(t.total_purchase_cost), icon:'shopping-cart', color:'#3b82f6'},
      { label:'Net Profit (ex.purchase)', value: fmt.currency(t.total_profit_excl), icon:'dollar-sign', color: t.total_profit_excl>=0?'#10b981':'#ff4d6d'},
      { label:'Net Profit (inc.purchase)', value: fmt.currency(t.total_profit_incl), icon:'dollar-sign', color: t.total_profit_incl>=0?'#10b981':'#ff4d6d'},
    ];
    document.getElementById('reportCards').innerHTML = rCards.map(c => `
      <div class="stat-card square" style="--card-color:${c.color}">
        <div class="card-icon"><i data-lucide="${c.icon}"></i></div>
        <div class="card-value" style="font-size:1.1rem">${c.value}</div>
        <div class="card-label">${c.label}</div>
      </div>`).join('');

    const maxIncome = Math.max(...profitData.bikes.map(b => b.total_income), 1);
    document.getElementById('profitBody').innerHTML = profitData.bikes.map(b => `
      <tr>
        <td class="primary-mobile" data-label="Profit">
          <div class="cell-title">${b.bike_id} · ${b.model}</div>
          <div class="cell-sub"><strong>Income:</strong> ${fmt.currency(b.total_income)} · <strong>Profit:</strong> ${fmt.currency(b.profit_incl_purchase)}</div>
        </td>
        <td class="fw-600 text-primary hide-mobile" data-label="Bike ID">${b.bike_id}</td>
        <td class="hide-mobile" data-label="Model">${b.model}</td>
        <td class="text-muted hide-mobile" data-label="Purchase Price">${fmt.currency(b.purchase_price)}</td>
        <td class="hide-mobile" data-label="Total Income">
          <div class="fw-600 text-success">${fmt.currency(b.total_income)}</div>
          <div class="profit-bar" style="width:${Math.round((b.total_income/maxIncome)*100)}%"></div>
        </td>
        <td class="text-warning hide-mobile" data-label="Maint. Cost">${fmt.currency(b.total_maint_cost)}</td>
        <td class="${b.profit_excl_purchase>=0?'text-success':'text-danger'} fw-600 hide-mobile" data-label="Profit (excl.)">${fmt.currency(b.profit_excl_purchase)}</td>
        <td class="${b.profit_incl_purchase>=0?'text-success':'text-danger'} fw-600 hide-mobile" data-label="Profit (incl.)">${fmt.currency(b.profit_incl_purchase)}</td>
      </tr>`).join('');

    document.getElementById('monthlyBody').innerHTML = monthly.map(m => `
      <tr>
        <td class="primary-mobile" data-label="Month">
          <div class="cell-title">${m.month}</div>
          <div class="cell-sub"><strong>Income:</strong> ${fmt.currency(m.income)} · <strong>Profit:</strong> ${fmt.currency(m.profit)}</div>
        </td>
        <td class="fw-600 hide-mobile" data-label="Month">${m.month}</td>
        <td class="text-success fw-600 hide-mobile" data-label="Income">${fmt.currency(m.income)}</td>
        <td class="text-warning hide-mobile" data-label="Expenses">${fmt.currency(m.expenses)}</td>
        <td class="${m.profit>=0?'text-success':'text-danger'} fw-600 hide-mobile" data-label="Profit">${fmt.currency(m.profit)}</td>
      </tr>`).join('');

    lucide.createIcons({ nodes: [document.getElementById('page-reports')] });
  } catch (e) { toast('Failed to load reports: ' + e.message, 'error'); }
}

//  PAGE LOADER MAP

const pageLoaders = {
  dashboard:   loadDashboard,
  customers:   loadCustomers,
  motorcycles: loadMotorcycles,
  rentals:     loadRentals,
  payments:    loadPayments,
  maintenance: loadMaintenance,
  calendar:    loadCalendar,
  reports:     loadReports,
};

window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.showCustomerDetail = showCustomerDetail;
window.editMoto = editMoto;
window.deleteMoto = deleteMoto;
window.showMotoDetail = showMotoDetail;
window.editRental = editRental;
window.completeRental = completeRental;
window.showRentalDetail = showRentalDetail;
window.quickAddPayment = quickAddPayment;
window.editPayment = editPayment;
window.deletePayment = deletePayment;
window.showPaymentDetail = showPaymentDetail;
window.editMaint = editMaint;
window.deleteMaint = deleteMaint;
window.showMaintDetail = showMaintDetail;
window.showCalDetail = showCalDetail;
window.inlineCreateCustomer = inlineCreateCustomer;
window.inlineCreateMoto = inlineCreateMoto;
window.saveCustomer = saveCustomer;
window.saveMoto = saveMoto;
window.saveRental = saveRental;
window.savePayment = savePayment;
window.saveMaint = saveMaint;
window.closeModal = closeModal;

lucide.createIcons();
navigate('dashboard');





