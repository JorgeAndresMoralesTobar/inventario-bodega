// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = "https://apjxqtxxyctytybkkduc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zHSPfLOo02j4C3SIpxN7oA_m3YdnHcx";

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let movements = [];
let systemUsers = [];
let currentUser = null;
let trendChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("inventory_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAppScreen();
  }
});

// LOGIN Y SESIÓN
async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("login-username").value.trim();
  const passwordInput = document.getElementById("login-password").value.trim();

  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("app_users")
    .select("*")
    .eq("username", usernameInput)
    .eq("password", passwordInput)
    .single();

  if (error || !data) {
    alert("⚠️ Usuario o contraseña incorrectos.");
    return;
  }

  currentUser = data;
  localStorage.setItem("inventory_user", JSON.stringify(currentUser));
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  showAppScreen();
}

function handleLogout() {
  localStorage.removeItem("inventory_user");
  currentUser = null;
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
}

async function showAppScreen() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  document.getElementById("user-display-name").innerText = `@${currentUser.username}`;
  document.getElementById("user-display-role").innerText = currentUser.role;

  applyRolePermissions();
  await fetchProducts();
  await fetchMovements();

  if (currentUser.role === 'admin') {
    await fetchUsers();
  }

  subscribeRealtime();
}

function applyRolePermissions() {
  const btnMovement = document.getElementById("btn-new-movement");
  const navUsers = document.getElementById("nav-users");
  const btnAddProduct = document.getElementById("btn-add-product");

  if (currentUser.role === "viewer") {
    if (btnMovement) btnMovement.classList.add("hidden");
  } else {
    if (btnMovement) btnMovement.classList.remove("hidden");
  }

  if (currentUser.role === "admin") {
    if (navUsers) navUsers.classList.remove("hidden");
    if (btnAddProduct) btnAddProduct.classList.remove("hidden");
  } else {
    if (navUsers) navUsers.classList.add("hidden");
    if (btnAddProduct) btnAddProduct.classList.add("hidden");
  }
}

// CAMBIO DE CONTRASEÑA
function openChangePasswordModal() {
  document.getElementById("pass-current").value = "";
  document.getElementById("pass-new").value = "";
  document.getElementById("pass-confirm").value = "";
  document.getElementById("change-password-modal").classList.remove("hidden");
}

function closeChangePasswordModal() {
  document.getElementById("change-password-modal").classList.add("hidden");
}

async function saveNewPassword() {
  const currentPass = document.getElementById("pass-current").value.trim();
  const newPass = document.getElementById("pass-new").value.trim();
  const confirmPass = document.getElementById("pass-confirm").value.trim();

  if (currentPass !== currentUser.password) {
    alert("⚠️ La contraseña actual no es correcta.");
    return;
  }

  if (!newPass) {
    alert("⚠️ La nueva contraseña no puede estar vacía.");
    return;
  }

  if (newPass !== confirmPass) {
    alert("⚠️ Las nuevas contraseñas no coinciden.");
    return;
  }

  const { error } = await supabaseClient
    .from("app_users")
    .update({ password: newPass })
    .eq("id", currentUser.id);

  if (error) {
    alert("Error al actualizar la contraseña: " + error.message);
    return;
  }

  currentUser.password = newPass;
  localStorage.setItem("inventory_user", JSON.stringify(currentUser));
  alert("✅ ¡Contraseña actualizada con éxito!");
  closeChangePasswordModal();
}

// REALTIME
function subscribeRealtime() {
  if (!supabaseClient) return;
  supabaseClient
    .channel("public:inventory")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      await fetchProducts();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "movements" }, async () => {
      await fetchMovements();
    })
    .subscribe();
}

// OBTENER DATOS
async function fetchProducts() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("products").select("*").order("id", { ascending: true });
  if (!error && data) {
    products = data;
    populateProductSelectOptions();
    populateLowStockSelectOptions();
    renderDashboard();
    renderProducts();
  }
}

async function fetchMovements() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("movements").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    movements = data;
    renderMovements();
    renderChart();
  }
}

async function fetchUsers() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("app_users").select("*").order("id", { ascending: true });
  if (!error && data) {
    systemUsers = data;
    renderUsers();
  }
}

// POBLAR SELECTOR DE VALOR INVENTARIO
function populateProductSelectOptions() {
  const select = document.getElementById('select-product-filter');
  if (!select) return;

  const currentSelection = select.value;
  select.innerHTML = '<option value="all">📦 Todos los productos (Total)</option>';

  products.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.code ? p.code + ' - ' : ''}${p.name}</option>`;
  });

  if (currentSelection) {
    select.value = currentSelection;
  }
}

// POBLAR SELECTOR DE STOCK BAJO
function populateLowStockSelectOptions() {
  const select = document.getElementById('select-low-stock-filter');
  if (!select) return;

  const currentSelection = select.value;
  const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0));

  select.innerHTML = `<option value="all">⚠️ Mostrar todos los críticos (${lowStockItems.length})</option>`;

  lowStockItems.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`;
  });

  if (currentSelection) {
    select.value = currentSelection;
  }
}

function previewLowStockItem() {
  const select = document.getElementById('select-low-stock-filter');
  const statLowStock = document.getElementById('stat-low-stock');
  const selectedId = select.value;

  if (selectedId === 'all') {
    const totalLow = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0)).length;
    statLowStock.innerText = totalLow;
  } else {
    const p = products.find(prod => prod.id === parseInt(selectedId));
    if (p) {
      statLowStock.innerText = `${p.stock} un.`;
    }
  }
}

function openLowStockModal() {
  const modal = document.getElementById('low-stock-modal');
  const tbody = document.getElementById('low-stock-modal-body');
  if (!modal || !tbody) return;

  const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0));

  tbody.innerHTML = '';

  if (lowStockItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No hay productos en estado crítico.</td></tr>`;
  } else {
    lowStockItems.forEach(p => {
      const canMove = currentUser && (currentUser.role === 'admin' || currentUser.role === 'operator');
      tbody.innerHTML += `
        <tr class="hover:bg-slate-900 transition">
          <td class="p-3 font-mono text-indigo-400 font-semibold">${p.code || ''}</td>
          <td class="p-3 font-medium text-white">${p.name}</td>
          <td class="p-3 text-rose-400 font-bold">${p.stock} un.</td>
          <td class="p-3 text-slate-400">${p.min_stock || 5} un.</td>
          <td class="p-3">
            ${canMove ? `<button onclick="closeLowStockModal(); openMovementModalWithProduct(${p.id});" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-semibold">Reponer</button>` : '<span class="text-xs text-slate-600">-</span>'}
          </td>
        </tr>
      `;
    });
  }

  modal.classList.remove('hidden');
}

function closeLowStockModal() {
  document.getElementById('low-stock-modal').classList.add('hidden');
}

// ACTUALIZAR FILTRO POR PRODUCTO SELECCIONADO
function updateProductValueFilter() {
  const select = document.getElementById('select-product-filter');
  const selectedId = select.value;
  const chartTitle = document.getElementById('chart-title');

  let displayValue = 0;

  if (selectedId === 'all') {
    displayValue = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.purchase_price) || 0)), 0);
    if (chartTitle) chartTitle.innerText = "Evolución del Valor del Inventario (Total)";
  } else {
    const p = products.find(prod => prod.id === parseInt(selectedId));
    if (p) {
      displayValue = (Number(p.stock) || 0) * (Number(p.purchase_price) || 0);
      if (chartTitle) chartTitle.innerText = `Evolución del Valor: ${p.name}`;
    }
  }

  document.getElementById('stat-total-value').innerText = "$" + displayValue.toLocaleString();
  renderChart();
}

// ELIMINAR REGISTRO DE HISTORIAL
async function deleteMovement(movementId) {
  if (!currentUser || currentUser.role !== 'admin') return;

  if (!confirm("¿Seguro que deseas eliminar este registro del historial?")) {
    return;
  }

  const { error } = await supabaseClient
    .from('movements')
    .delete()
    .eq('id', movementId);

  if (error) {
    alert("Error al borrar el registro del historial: " + error.message);
    return;
  }

  await fetchMovements();
}

// GESTIÓN DE USUARIOS
async function handleCreateUser(e) {
  e.preventDefault();
  if (currentUser.role !== 'admin') return;

  const username = document.getElementById("new-username").value.trim();
  const password = document.getElementById("new-password").value.trim();
  const role = document.getElementById("new-role").value;

  const { error } = await supabaseClient.from("app_users").insert([{ username, password, role }]);

  if (error) {
    alert("Error al crear usuario: " + error.message);
    return;
  }

  alert(`✅ Usuario @${username} creado con éxito.`);
  document.getElementById("new-username").value = "";
  document.getElementById("new-password").value = "";
  await fetchUsers();
}

async function deleteUser(userId) {
  if (currentUser.role !== 'admin') return;
  if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

  const { error } = await supabaseClient.from("app_users").delete().eq("id", userId);
  if (!error) {
    await fetchUsers();
  }
}

function renderUsers() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  systemUsers.forEach(u => {
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 font-bold text-white">@${u.username}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : u.role === 'operator' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td class="p-4 text-xs text-slate-400">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="p-4">
          ${u.role !== 'admin' ? `<button onclick="deleteUser(${u.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold">Eliminar</button>` : '<span class="text-xs text-slate-600">Principal</span>'}
        </td>
      </tr>
    `;
  });
}

// NAVEGACIÓN TAB
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');

  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
  const targetNav = document.getElementById(`nav-${tabName}`);
  if (targetNav) targetNav.classList.add('active-nav');
}

function renderDashboard() {
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0)).length;

  document.getElementById('stat-total-products').innerText = totalProducts;
  document.getElementById('stat-total-units').innerText = totalUnits.toLocaleString();
  document.getElementById('stat-low-stock').innerText = lowStock;
  document.getElementById('total-count-badge').innerText = totalProducts;

  updateProductValueFilter();
  previewLowStockItem();
}

// RENDER DEL GRÁFICO DE EVOLUCIÓN
function renderChart() {
  const canvas = document.getElementById('valueTrendChart');
  if (!canvas) return;

  const select = document.getElementById('select-product-filter');
  const selectedId = select ? select.value : 'all';

  let currentValue = 0;
  if (selectedId === 'all') {
    currentValue = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.purchase_price) || 0)), 0);
  } else {
    const p = products.find(prod => prod.id === parseInt(selectedId));
    if (p) currentValue = (Number(p.stock) || 0) * (Number(p.purchase_price) || 0);
  }

  const now = new Date();
  const labels = ["Hoy (" + now.toLocaleDateString() + ")"];
  const values = [currentValue];

  for (let i = 1; i <= 4; i++) {
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + (i * 7));
    labels.push("Semana " + i + " (" + futureDate.toLocaleDateString() + ")");
    values.push(currentValue);
  }

  if (trendChart) {
    trendChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Valor ($)',
        data: values,
        borderColor: '#10b981',
        borderWidth: 3,
        fill: true,
        backgroundColor: gradient,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointRadius: 5,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ' Valor: $' + context.raw.toLocaleString();
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: function(val) {
              return '$' + val.toLocaleString();
            }
          }
        }
      }
    }
  });
}

// RENDER TABLA PRODUCTOS
function renderProducts(filteredList = null) {
  const list = filteredList || products;
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  list.forEach(p => {
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.min_stock) || 0;
    const canMove = currentUser && (currentUser.role === 'admin' || currentUser.role === 'operator');
    const isAdmin = currentUser && currentUser.role === 'admin';

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
        <td class="p-4 flex gap-3">
          ${canMove ? `<button onclick="openMovementModalWithProduct(${p.id})" class="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">Mover Stock</button>` : ''}
          ${isAdmin ? `<button onclick="openEditProductModal(${p.id})" class="text-amber-400 hover:text-amber-300 text-xs font-semibold"><i class="fa-solid fa-pen"></i> Editar</button>` : ''}
          ${!canMove && !isAdmin ? '<span class="text-xs text-slate-600">Solo lectura</span>' : ''}
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

// CREAR NUEVO PRODUCTO
function openAddProductModal() {
  if (!currentUser || currentUser.role !== 'admin') return;
  
  const nextNumber = products.length + 1;
  const suggestedCode = `PROD-${String(nextNumber).padStart(3, '0')}`;
  
  document.getElementById('add-product-code').value = suggestedCode;
  document.getElementById('add-product-name').value = '';
  document.getElementById('add-product-stock').value = 0;
  document.getElementById('add-purchase-price').value = 0;
  document.getElementById('add-sale-price').value = 0;

  document.getElementById('add-product-modal').classList.remove('hidden');
}

function closeAddProductModal() {
  document.getElementById('add-product-modal').classList.add('hidden');
}

async function saveNewProduct() {
  if (!supabaseClient || currentUser.role !== 'admin') return;

  const code = document.getElementById('add-product-code').value.trim();
  const name = document.getElementById('add-product-name').value.trim();
  const stock = parseInt(document.getElementById('add-product-stock').value) || 0;
  const purchasePrice = parseFloat(document.getElementById('add-purchase-price').value) || 0;
  const salePrice = parseFloat(document.getElementById('add-sale-price').value) || 0;

  if (!name) {
    alert("⚠️ Debes asignar un nombre al nuevo producto.");
    return;
  }

  const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

  const { error } = await supabaseClient.from('products').insert([
    {
      id: newId,
      code: code || `PROD-${newId}`,
      name: name,
      category: 'General',
      stock: stock,
      min_stock: 5,
      purchase_price: purchasePrice,
      sale_price: salePrice
    }
  ]);

  if (error) {
    alert("Error al guardar el nuevo producto: " + error.message);
    return;
  }

  if (stock > 0) {
    await supabaseClient.from('movements').insert([
      {
        type: 'IN',
        product_name: name,
        qty: stock,
        comment: 'Alta inicial de nuevo producto',
        user_role: currentUser.username.toUpperCase()
      }
    ]);
  }

  closeAddProductModal();
  await fetchProducts();
}

// EDICIÓN DE PRODUCTO EXISTENTE
function openEditProductModal(productId) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const product = products.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('edit-product-id').value = product.id;
  document.getElementById('edit-product-name').value = product.name;
  document.getElementById('edit-product-stock').value = product.stock;
  document.getElementById('edit-purchase-price').value = product.purchase_price;
  document.getElementById('edit-sale-price').value = product.sale_price;

  document.getElementById('edit-product-modal').classList.remove('hidden');
}

function closeEditProductModal() {
  document.getElementById('edit-product-modal').classList.add('hidden');
}

async function saveProductEdit() {
  if (!supabaseClient || currentUser.role !== 'admin') return;

  const productId = parseInt(document.getElementById('edit-product-id').value);
  const newName = document.getElementById('edit-product-name').value.trim();
  const newStock = parseInt(document.getElementById('edit-product-stock').value);
  const newPurchasePrice = parseFloat(document.getElementById('edit-purchase-price').value);
  const newSalePrice = parseFloat(document.getElementById('edit-sale-price').value);

  if (!newName) {
    alert("⚠️ El nombre del producto no puede estar vacío.");
    return;
  }

  const { error } = await supabaseClient
    .from('products')
    .update({
      name: newName,
      stock: newStock,
      purchase_price: newPurchasePrice,
      sale_price: newSalePrice
    })
    .eq('id', productId);

  if (error) {
    alert("Error al actualizar producto: " + error.message);
    return;
  }

  closeEditProductModal();
  await fetchProducts();
}

// BUSCADOR EN EL MODAL DE MOVIMIENTOS
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
  if (currentUser.role === 'viewer') return;
  populateProductSelect();
  document.getElementById('movement-modal').classList.remove('hidden');
}

function openMovementModalWithProduct(productId) {
  if (currentUser.role === 'viewer') return;
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
  if (!supabaseClient || currentUser.role === 'viewer') return;
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
      user_role: currentUser.username.toUpperCase()
    }
  ]);

  closeMovementModal();
  document.getElementById('mov-comment').value = '';
}

function renderMovements() {
  const tbody = document.getElementById('movements-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const isAdmin = currentUser && currentUser.role === 'admin';

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
        <td class="p-4">
          ${isAdmin ? `<button onclick="deleteMovement(${m.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold"><i class="fa-solid fa-trash mr-1"></i> Borrar</button>` : '<span class="text-xs text-slate-600">-</span>'}
        </td>
      </tr>
    `;
  });
}