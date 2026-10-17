// --- CONFIGURACIÓN SUPABASE NUBE GLOBAL ---
const SUPABASE_URL = "https://apjxqtxxyctytybkkduc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zHSPfLOo02j4C3SIpxN7oA_m3YdnHcx";

// Usamos supabaseClient para no sobrescribir la propiedad global 'window.supabase'
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
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${stock <= minStock ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg