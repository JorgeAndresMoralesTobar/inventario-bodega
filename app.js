// --- CONFIGURACIÓN SUPABASE NUBE GLOBAL ---
const SUPABASE_URL = "https://apjxqtxxyctytybkkduc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zHSPfLOo02j4C3SIpxN7oA_m3YdnHcx";

// Instancia global del cliente Supabase
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let movements = [];
let currentRole = 'admin';

document.addEventListener("DOMContentLoaded", async () => {
  if (!supabaseClient) {
    console.error("No se pudo inicializar Supabase.");
    return;
  }
  await fetchProducts();
  await fetchMovements();
  applyRolePermissions();
  subscribeRealtime();
});

// Sincronización en Tiempo Real
function subscribeRealtime() {
  if (!supabaseClient) return;
  supabaseClient
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
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from('products').select('*').order('id', { ascending: true });
  if (!error && data) {
    products = data;
    renderDashboard();
    renderProducts();
    populateProductSelect();
  } else if (error) {
    console.error("Error al obtener productos:", error);
  }
}

async function fetchMovements() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from('movements').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    movements = data;
    renderMovements();
  } else if (error) {
    console.error("Error al obtener movimientos:", error);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');

  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
  const targetNav = document.getElementById(`nav-${tabName}`);
  if (targetNav) targetNav.classList.add('active-nav');
}

function changeRole(role) {
  currentRole = role;
  applyRolePermissions();
}

function applyRolePermissions() {
  const btnMovement = document.getElementById('btn-new-movement');
  if (!btnMovement) return;
  if (currentRole === 'viewer') {
    btnMovement.classList.add('hidden');
  } else {
    btnMovement.classList.remove('hidden');
  }
}

function renderDashboard() {
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalValue = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.purchase_price) || 0)), 0);
  const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0)).length;

  document.getElementById('stat-total-products').innerText = totalProducts;
  document.getElementById('stat-total-units').innerText = totalUnits.toLocaleString();
  document.getElementById('stat-total-value').innerText = "$" + totalValue.toLocaleString();
  document.getElementById('stat-low-stock').innerText = lowStock;
  document.getElementById('total-count-badge').innerText = totalProducts;
}

function renderProducts(filteredList = null) {
  const list = filteredList || products;
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  list.forEach(p => {
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.min_stock) || 0;
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 font-mono text-indigo-400 font-semibold">${p.code || ''}</td>
        <td class="p-4 font-medium text-white">${p.name || ''}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${stock <= minStock ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${stock} unidades
          </span>
        </td>
        <td class="p-4">$${Number(p.purchase_price || 0).toLocaleString()}</td>
        <td class="p-4">$${Number(p.sale_price || 0).toLocaleString()}</td>
        <td class="p-4">
          <button onclick="openMovementModalWithProduct(${p.id})" class="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">Mover Stock</button>
        </td>
      </tr>
    `;
  });
}

function filterProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const filtered = products.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) || 
    (p.code && p.code.toLowerCase().includes(query))
  );
  renderProducts(filtered);
}

// --- BUSCADOR DINÁMICO EN EL MODAL ---

function populateProductSelect() {
  const searchInput = document.getElementById('mov-product-search');
  const hiddenId = document.getElementById('mov-product-id');
  const resultsDiv = document.getElementById('mov-product-results');

  if (searchInput) searchInput.value = '';
  if (hiddenId) hiddenId.value = '';
  if (resultsDiv) {
    resultsDiv.classList.add('hidden');
    resultsDiv.innerHTML = '';
  }
}

function filterModalProducts() {
  const searchInput = document.getElementById('mov-product-search');
  const hiddenId = document.getElementById('mov-product-id');
  const resultsDiv = document.getElementById('mov-product-results');
  const query = searchInput.value.toLowerCase().trim();

  hiddenId.value = '';

  if (!query) {
    resultsDiv.classList.add('hidden');
    resultsDiv.innerHTML = '';
    return;
  }

  const filtered = products.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) || 
    (p.code && p.code.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    resultsDiv.innerHTML = `<div class="p-3 text-xs text-slate-500 text-center">No se encontraron productos</div>`;
  } else {
    resultsDiv.innerHTML = filtered.map(p => `
      <div 
        onclick="selectModalProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.stock})"
        class="p-3 text-sm text-slate-200 hover:bg-indigo-600 hover:text-white cursor-pointer transition flex justify-between items-center"
      >
        <span><strong>${p.code || ''}</strong> - ${p.name}</span>
        <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">Stock: ${p.stock}</span>
      </div>
    `).join('');
  }

  resultsDiv.classList.remove('hidden');
}

function selectModalProduct(id, name, stock) {
  document.getElementById('mov-product-search').value = `${name} (Stock: ${stock})`;
  document.getElementById('mov-product-id').value = id;
  document.getElementById('mov-product-results').classList.add('hidden');
}

function openMovementModal() {
  populateProductSelect();
  document.getElementById('movement-modal').classList.remove('hidden');
}

function openMovementModalWithProduct(productId) {
  openMovementModal();
  const product = products.find(p => p.id === productId);
  if (product) {
    selectModalProduct(product.id, product.name, product.stock);
  }
}

function closeMovementModal() {
  document.getElementById('movement-modal').classList.add('hidden');
  const resultsDiv = document.getElementById('mov-product-results');
  if (resultsDiv) resultsDiv.classList.add('hidden');
}

async function saveMovement() {
  if (!supabaseClient) return;
  const type = document.getElementById('mov-type').value;
  const productId = parseInt(document.getElementById('mov-product-id').value);
  const qty = parseInt(document.getElementById('mov-qty').value);
  const comment = document.getElementById('mov-comment').value.trim();

  if (!productId) {
    alert("⚠️ Debes buscar y seleccionar un producto de la lista.");
    return;
  }

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

  const { error: updateError } = await supabaseClient
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId);

  if (updateError) {
    alert("Error al actualizar stock: " + updateError.message);
    return;
  }

  await supabaseClient.from('movements').insert([
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