// --- CONFIGURACIÓN SUPABASE NUBE GLOBAL ---
const SUPABASE_URL = "https://apjxqtxxyctytybkkduc.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_zHSPfLOo02j4C3SIpxN7oA_m3YdnHcx";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [];
let movements = [];
let currentRole = 'admin';

document.addEventListener("DOMContentLoaded", async () => {
  await fetchProducts();
  await fetchMovements();
  applyRolePermissions();
  subscribeRealtime();
});

// Sincronización en Tiempo Real para Colombia, España y EE.UU.
function subscribeRealtime() {
  supabase
    .channel('public:inventory')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
      await fetchProducts();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, async () => {
      await fetchMovements();
    })
    .subscribe();
}

async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
  if (!error && data) {
    products = data;
    renderDashboard();
    renderProducts();
    populateProductSelect();
  }
}

async function fetchMovements() {
  const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    movements = data;
    renderMovements();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');

  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
  document.getElementById(`nav-${tabName}`).classList.add('active-nav');
}

function changeRole(role) {
  currentRole = role;
  applyRolePermissions();
}

function applyRolePermissions() {
  const btnMovement = document.getElementById('btn-new-movement');
  if (currentRole === 'viewer') {
    btnMovement.classList.add('hidden');
  } else {
    btnMovement.classList.remove('hidden');
  }
}

function renderDashboard() {
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValue = products.reduce((acc, p) => acc + (p.stock * p.purchase_price), 0);
  const lowStock = products.filter(p => p.stock <= p.min_stock).length;

  document.getElementById('stat-total-products').innerText = totalProducts;
  document.getElementById('stat-total-units').innerText = totalUnits.toLocaleString();
  document.getElementById('stat-total-value').innerText = "$" + totalValue.toLocaleString();
  document.getElementById('stat-low-stock').innerText = lowStock;
  document.getElementById('total-count-badge').innerText = totalProducts;
}

function renderProducts(filteredList = null) {
  const list = filteredList || products;
  const tbody = document.getElementById('inventory-table-body');
  tbody.innerHTML = '';

  list.forEach(p => {
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 font-mono text-indigo-400 font-semibold">${p.code}</td>
        <td class="p-4 font-medium text-white">${p.name}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${p.stock <= p.min_stock ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${p.stock} unidades
          </span>
        </td>
        <td class="p-4">$${Number(p.purchase_price).toLocaleString()}</td>
        <td class="p-4">$${Number(p.sale_price).toLocaleString()}</td>
        <td class="p-4">
          <button onclick="openMovementModalWithProduct(${p.id})" class="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">Mover Stock</button>
        </td>
      </tr>
    `;
  });
}

function filterProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));
  renderProducts(filtered);
}

function populateProductSelect() {
  const select = document.getElementById('mov-product');
  if (!select) return;
  select.innerHTML = '';
  products.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`;
  });
}

function openMovementModal() {
  populateProductSelect();
  document.getElementById('movement-modal').classList.remove('hidden');
}

function openMovementModalWithProduct(productId) {
  openMovementModal();
  document.getElementById('mov-product').value = productId;
}

function closeMovementModal() {
  document.getElementById('movement-modal').classList.add('hidden');
}

async function saveMovement() {
  const type = document.getElementById('mov-type').value;
  const productId = parseInt(document.getElementById('mov-product').value);
  const qty = parseInt(document.getElementById('mov-qty').value);
  const comment = document.getElementById('mov-comment').value.trim();

  if (!comment) {
    alert("⚠️ Debes introducir un comentario u observación obligatoria.");
    return;
  }

  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (type === 'OUT' && product.stock < qty) {
    alert(`⚠️ Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
    return;
  }

  const newStock = type === 'IN' ? product.stock + qty : product.stock - qty;

  // Actualizar en la base de datos Supabase
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId);

  if (updateError) {
    alert("Error al actualizar stock: " + updateError.message);
    return;
  }

  // Registrar el historial de movimientos en Supabase
  await supabase.from('movements').insert([
    {
      type: type,
      product_name: product.name,
      qty: qty,
      comment: comment,
      user_role: currentRole.toUpperCase()
    }
  ]);

  closeMovementModal();
  document.getElementById('mov-comment').value = '';
}

function renderMovements() {
  const tbody = document.getElementById('movements-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  movements.forEach(m => {
    const formattedDate = new Date(m.created_at).toLocaleString();
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 text-xs text-slate-400">${formattedDate}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${m.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${m.type === 'IN' ? 'ENTRADA (+)' : 'SALIDA (-)'}
          </span>
        </td>
        <td class="p-4 font-medium text-white">${m.product_name}</td>
        <td class="p-4 font-bold">${m.qty}</td>
        <td class="p-4 text-slate-300 italic">${m.comment}</td>
        <td class="p-4 text-xs text-indigo-400 font-semibold">${m.user_role}</td>
      </tr>
    `;
  });
}