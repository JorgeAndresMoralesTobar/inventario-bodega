// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = "https://apjxqtxxyctytybkkduc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zHSPfLOo02j4C3SIpxN7oA_m3YdnHcx";

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let movements = [];
let systemUsers = [];
let appRequests = [];
let distributors = [];
let currentUser = null;
let trendChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("inventory_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAppScreen();
  }

  // Cerrar desplegables de búsqueda al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#select-units-filter-search") && !e.target.closest("#select-units-filter-results")) {
      const res = document.getElementById("select-units-filter-results");
      if (res) res.classList.add("hidden");
    }
    if (!e.target.closest("#select-product-filter-search") && !e.target.closest("#select-product-filter-results")) {
      const res = document.getElementById("select-product-filter-results");
      if (res) res.classList.add("hidden");
    }
    if (!e.target.closest("#select-low-stock-filter-search") && !e.target.closest("#select-low-stock-filter-results")) {
      const res = document.getElementById("select-low-stock-filter-results");
      if (res) res.classList.add("hidden");
    }
  });
});

// CÁLCULO DE IVA EN TIEMPO REAL
function updateVatPreview(priceInputId, vatDisplayId) {
  const priceVal = parseFloat(document.getElementById(priceInputId).value) || 0;
  const vatPrice = priceVal * 1.19;
  const displayElement = document.getElementById(vatDisplayId);
  if (displayElement) {
    displayElement.value = vatPrice.toFixed(2);
  }
}

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
  await fetchRequests();

  if (currentUser.role === 'admin' || currentUser.role === 'operator') {
    await fetchDistributors();
  }

  if (currentUser.role === 'admin') {
    await fetchUsers();
  }

  subscribeRealtime();
}

function applyRolePermissions() {
  const btnMovement = document.getElementById("btn-new-movement");
  const navUsers = document.getElementById("nav-users");
  const navDistributors = document.getElementById("nav-distributors");
  const btnAddProduct = document.getElementById("btn-add-product");
  const btnAddDist = document.getElementById("btn-add-distributor");

  if (currentUser.role === "admin" || currentUser.role === "operator") {
    if (navDistributors) navDistributors.classList.remove("hidden");
  } else {
    if (navDistributors) navDistributors.classList.add("hidden");
  }

  if (currentUser.role === "admin") {
    if (btnAddDist) btnAddDist.classList.remove("hidden");
  } else {
    if (btnAddDist) btnAddDist.classList.add("hidden");
  }

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
    .on("postgres_changes", { event: "*", schema: "public", table: "distributors" }, async () => {
      if (currentUser.role === 'admin' || currentUser.role === 'operator') {
        await fetchDistributors();
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, async () => {
      await fetchRequests();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, async () => {
      if (currentUser.role === 'admin') {
        await fetchUsers();
      }
    })
    .subscribe();
}

// OBTENER DATOS
async function fetchProducts() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("products").select("*").order("id", { ascending: true });
  if (!error && data) {
    products = data;
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

// CAMBIAR ROL DE USUARIO
async function changeUserRole(userId, newRole) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const targetUser = systemUsers.find(u => u.id === userId);
  if (!targetUser) return;

  if (targetUser.role === 'admin') {
    alert("⚠️ No se puede modificar el rol del administrador principal.");
    await fetchUsers();
    return;
  }

  const { error } = await supabaseClient
    .from("app_users")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) {
    alert("Error al cambiar el rol: " + error.message);
    await fetchUsers();
    return;
  }

  alert(`✅ Rol de @${targetUser.username} cambiado a ${newRole.toUpperCase()}.`);
  await fetchUsers();
}

function renderUsers() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  systemUsers.forEach(u => {
    const isAdmin = u.role === 'admin';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 font-bold text-white">@${u.username}</td>
        <td class="p-4">
          ${isAdmin ? `
            <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              ADMIN
            </span>
          ` : `
            <select onchange="changeUserRole(${u.id}, this.value)" class="bg-slate-900 border border-slate-700 text-xs text-amber-400 font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 cursor-pointer">
              <option value="operator" ${u.role === 'operator' ? 'selected' : ''}>👷 OPERATOR</option>
              <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>👁️ VIEWER</option>
            </select>
          `}
        </td>
        <td class="p-4 text-xs text-slate-400">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="p-4">
          ${!isAdmin ? `<button onclick="deleteUser(${u.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold"><i class="fa-solid fa-trash mr-1"></i> Eliminar</button>` : '<span class="text-xs text-slate-600">Principal</span>'}
        </td>
      </tr>
    `;
  });
}

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

// CONTACTOS / DISTRIBUIDORES
async function fetchDistributors() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("distributors").select("*").order("id", { ascending: true });
  if (!error && data) {
    distributors = data;
    renderDistributors();
  }
}

function applyDistributorFilters() {
  const query = document.getElementById("dist-filter-search").value.toLowerCase().trim();
  const categoryFilter = document.getElementById("dist-filter-category").value;
  const municipalityFilter = document.getElementById("dist-filter-municipality").value.toLowerCase().trim();

  const filtered = distributors.filter(d => {
    const matchesQuery = !query || 
      (d.name && d.name.toLowerCase().includes(query)) || 
      (d.phone && d.phone.toLowerCase().includes(query)) ||
      (d.email && d.email.toLowerCase().includes(query)) ||
      (d.notes && d.notes.toLowerCase().includes(query));

    const matchesCategory = (categoryFilter === 'ALL') || (d.category === categoryFilter);
    const matchesMunicipality = !municipalityFilter || (d.municipality && d.municipality.toLowerCase().includes(municipalityFilter));

    return matchesQuery && matchesCategory && matchesMunicipality;
  });

  renderDistributors(filtered);
}

function renderDistributors(customList = null) {
  const list = customList || distributors;
  const tbody = document.getElementById("distributors-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">No se encontraron contactos.</td></tr>`;
    return;
  }

  list.forEach(d => {
    let catClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (d.category === 'ENVÍOS') catClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (d.category === 'CONTADURÍA') catClass = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';

    const cleanPhone = d.phone ? d.phone.replace(/[^0-9]/g, '') : '';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${catClass}">
            ${d.category || 'PROVEEDORES'}
          </span>
        </td>
        <td class="p-4 font-bold text-white">${d.name}</td>
        <td class="p-4 font-mono text-xs">
          ${d.phone ? `
            <div class="flex items-center gap-2">
              <span class="text-amber-400 font-semibold">${d.phone}</span>
              <a href="https://wa.me/${cleanPhone}" target="_blank" title="Abrir WhatsApp" class="text-emerald-400 hover:text-emerald-300">
                <i class="fa-brands fa-whatsapp text-sm"></i>
              </a>
            </div>
          ` : '<span class="text-slate-600">-</span>'}
        </td>
        <td class="p-4 text-slate-300">${d.municipality || '-'}</td>
        <td class="p-4 text-xs text-slate-400">${d.notes || d.email || '-'}</td>
        <td class="p-4 flex gap-3">
          ${isAdmin ? `
            <button onclick="openEditDistributorModal(${d.id})" class="text-amber-400 hover:text-amber-300 text-xs font-semibold"><i class="fa-solid fa-pen"></i> Editar</button>
            <button onclick="deleteDistributor(${d.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold"><i class="fa-solid fa-trash"></i> Eliminar</button>
          ` : '<span class="text-xs text-slate-600">Solo lectura</span>'}
        </td>
      </tr>
    `;
  });
}

function openAddDistributorModal() {
  if (!currentUser || currentUser.role !== 'admin') return;
  document.getElementById("dist-modal-title").innerText = "Añadir Contacto";
  document.getElementById("dist-id").value = "";
  document.getElementById("dist-category").value = "PROVEEDORES";
  document.getElementById("dist-name").value = "";
  document.getElementById("dist-phone").value = "";
  document.getElementById("dist-municipality").value = "";
  document.getElementById("dist-notes").value = "";

  document.getElementById("distributor-modal").classList.remove("hidden");
}

function openEditDistributorModal(distId) {
  if (!currentUser || currentUser.role !== 'admin') return;
  const d = distributors.find(item => item.id === distId);
  if (!d) return;

  document.getElementById("dist-modal-title").innerText = "Editar Contacto";
  document.getElementById("dist-id").value = d.id;
  document.getElementById("dist-category").value = d.category || "PROVEEDORES";
  document.getElementById("dist-name").value = d.name;
  document.getElementById("dist-phone").value = d.phone || "";
  document.getElementById("dist-municipality").value = d.municipality || "";
  document.getElementById("dist-notes").value = d.notes || d.email || "";

  document.getElementById("distributor-modal").classList.remove("hidden");
}

function closeDistributorModal() {
  document.getElementById("distributor-modal").classList.add("hidden");
}

async function saveDistributor() {
  if (!supabaseClient || currentUser.role !== 'admin') return;

  const id = document.getElementById("dist-id").value;
  const category = document.getElementById("dist-category").value;
  const name = document.getElementById("dist-name").value.trim();
  const phone = document.getElementById("dist-phone").value.trim();
  const municipality = document.getElementById("dist-municipality").value.trim();
  const notes = document.getElementById("dist-notes").value.trim();

  if (!name) {
    alert("⚠️ El nombre del contacto es obligatorio.");
    return;
  }

  if (id) {
    const { error } = await supabaseClient
      .from("distributors")
      .update({ category, name, phone, municipality, notes })
      .eq("id", parseInt(id));

    if (error) {
      alert("Error al actualizar contacto: " + error.message);
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from("distributors")
      .insert([{ category, name, phone, municipality, notes }]);

    if (error) {
      alert("Error al guardar contacto: " + error.message);
      return;
    }
  }

  closeDistributorModal();
  await fetchDistributors();
}

async function deleteDistributor(distId) {
  if (!currentUser || currentUser.role !== 'admin') return;

  if (!confirm("¿Seguro que deseas eliminar este contacto?")) return;

  const { error } = await supabaseClient.from("distributors").delete().eq("id", distId);
  if (error) {
    alert("Error al eliminar contacto: " + error.message);
    return;
  }

  await fetchDistributors();
}

// DESPLEGABLES CON BUSCADOR EN TARJETAS
function filterUnitsProducts(showAll = false) {
  const input = document.getElementById("select-units-filter-search");
  const resultsDiv = document.getElementById("select-units-filter-results");
  const query = showAll ? "" : input.value.toLowerCase().trim();

  let html = `
    <div onclick="selectUnitsProduct('all', '📦 Todas las unidades (Total)')" class="p-2.5 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white cursor-pointer transition">
      📦 Todas las unidades (Total)
    </div>
  `;

  const filtered = query ? products.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) || 
    (p.code && p.code.toLowerCase().includes(query))
  ) : products;

  filtered.forEach(p => {
    html += `
      <div onclick="selectUnitsProduct(${p.id}, '${p.code ? p.code + ' - ' : ''}${p.name.replace(/'/g, "\\'")}')" class="p-2.5 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white cursor-pointer transition truncate">
        ${p.code ? '<strong>' + p.code + '</strong> - ' : ''}${p.name}
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
  resultsDiv.classList.remove("hidden");
}

function selectUnitsProduct(id, label) {
  document.getElementById("select-units-filter-search").value = label;
  document.getElementById("select-units-filter-id").value = id;
  document.getElementById("select-units-filter-results").classList.add("hidden");
  updateProductUnitsFilter();
}

function updateProductUnitsFilter() {
  const selectedId = document.getElementById('select-units-filter-id').value;
  const statUnits = document.getElementById('stat-total-units');

  if (selectedId === 'all') {
    const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    statUnits.innerText = totalUnits.toLocaleString();
  } else {
    const p = products.find(prod => prod.id === parseInt(selectedId));
    if (p) {
      statUnits.innerText = (Number(p.stock) || 0).toLocaleString();
    }
  }
}

function filterValuationProducts(showAll = false) {
  const input = document.getElementById("select-product-filter-search");
  const resultsDiv = document.getElementById("select-product-filter-results");
  const query = showAll ? "" : input.value.toLowerCase().trim();

  let html = `
    <div onclick="selectValuationProduct('all', '📦 Todos los productos (Total)')" class="p-2.5 text-xs text-slate-200 hover:bg-emerald-600 hover:text-white cursor-pointer transition">
      📦 Todos los productos (Total)
    </div>
  `;

  const filtered = query ? products.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) || 
    (p.code && p.code.toLowerCase().includes(query))
  ) : products;

  filtered.forEach(p => {
    html += `
      <div onclick="selectValuationProduct(${p.id}, '${p.code ? p.code + ' - ' : ''}${p.name.replace(/'/g, "\\'")}')" class="p-2.5 text-xs text-slate-200 hover:bg-emerald-600 hover:text-white cursor-pointer transition truncate">
        ${p.code ? '<strong>' + p.code + '</strong> - ' : ''}${p.name}
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
  resultsDiv.classList.remove("hidden");
}

function selectValuationProduct(id, label) {
  document.getElementById("select-product-filter-search").value = label;
  document.getElementById("select-product-filter-id").value = id;
  document.getElementById("select-product-filter-results").classList.add("hidden");
  updateProductValueFilter();
}

function filterLowStockProducts(showAll = false) {
  const input = document.getElementById("select-low-stock-filter-search");
  const resultsDiv = document.getElementById("select-low-stock-filter-results");
  const query = showAll ? "" : input.value.toLowerCase().trim();
  const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0));

  let html = `
    <div onclick="selectLowStockProduct('all', '⚠️ Mostrar todos los críticos (${lowStockItems.length})')" class="p-2.5 text-xs text-slate-200 hover:bg-rose-600 hover:text-white cursor-pointer transition">
      ⚠️ Mostrar todos los críticos (${lowStockItems.length})
    </div>
  `;

  const filtered = query ? lowStockItems.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) || 
    (p.code && p.code.toLowerCase().includes(query))
  ) : lowStockItems;

  filtered.forEach(p => {
    html += `
      <div onclick="selectLowStockProduct(${p.id}, '${p.name.replace(/'/g, "\\'")} (${p.stock} un.)')" class="p-2.5 text-xs text-slate-200 hover:bg-rose-600 hover:text-white cursor-pointer transition truncate">
        ${p.name} <span class="font-bold text-rose-400">(${p.stock} un.)</span>
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
  resultsDiv.classList.remove("hidden");
}

function selectLowStockProduct(id, label) {
  document.getElementById("select-low-stock-filter-search").value = label;
  document.getElementById("select-low-stock-filter-id").value = id;
  document.getElementById("select-low-stock-filter-results").classList.add("hidden");
  previewLowStockItem();
}

function previewLowStockItem() {
  const selectedId = document.getElementById('select-low-stock-filter-id').value;
  const statLowStock = document.getElementById('stat-low-stock');

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

function updateProductValueFilter() {
  const selectedId = document.getElementById('select-product-filter-id').value;
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

// HISTORIAL Y FILTROS
function applyMovementFilters() {
  const query = document.getElementById("mov-filter-search").value.toLowerCase().trim();
  const typeFilter = document.getElementById("mov-filter-type").value;
  const startDate = document.getElementById("mov-filter-date-start").value;
  const endDate = document.getElementById("mov-filter-date-end").value;

  const filtered = movements.filter(m => {
    const matchesQuery = !query || 
      (m.product_name && m.product_name.toLowerCase().includes(query)) || 
      (m.user_role && m.user_role.toLowerCase().includes(query)) ||
      (m.comment && m.comment.toLowerCase().includes(query));

    const matchesType = (typeFilter === 'ALL') || (m.type === typeFilter);

    const mDate = new Date(m.created_at).toISOString().split('T')[0];
    const matchesStartDate = !startDate || (mDate >= startDate);
    const matchesEndDate = !endDate || (mDate <= endDate);

    return matchesQuery && matchesType && matchesStartDate && matchesEndDate;
  });

  renderMovements(filtered);
}

function renderMovements(customList = null) {
  const list = customList || movements;
  const tbody = document.getElementById('movements-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">No se encontraron movimientos.</td></tr>`;
    return;
  }

  list.forEach(m => {
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

// PETICIONES Y SUGERENCIAS
async function fetchRequests() {
  if (!supabaseClient) return;
  let query = supabaseClient.from("requests").select("*").order("created_at", { ascending: false });

  if (currentUser && currentUser.role !== 'admin') {
    query = query.eq("username", currentUser.username);
  }

  const { data, error } = await query;
  if (!error && data) {
    appRequests = data;
    renderRequests();
  }
}

function filterRequestsList() {
  const query = document.getElementById("search-requests-input").value.toLowerCase().trim();
  const filtered = appRequests.filter(r => 
    (r.request_text && r.request_text.toLowerCase().includes(query)) ||
    (r.username && r.username.toLowerCase().includes(query)) ||
    (r.status && r.status.toLowerCase().includes(query))
  );
  renderRequests(filtered);
}

async function handleSendRequest(e) {
  e.preventDefault();
  const requestInput = document.getElementById("request-input");
  const text = requestInput.value.trim();

  if (!text) return;

  const { error } = await supabaseClient.from("requests").insert([
    {
      username: currentUser.username,
      request_text: text,
      status: "En proceso"
    }
  ]);

  if (error) {
    alert("Error al enviar petición: " + error.message);
    return;
  }

  alert("✅ Petición enviada correctamente.");
  requestInput.value = "";
  await fetchRequests();
}

async function toggleRequestStatus(requestId, currentStatus) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const newStatus = currentStatus === 'Hecha' ? 'En proceso' : 'Hecha';

  const { error } = await supabaseClient
    .from("requests")
    .update({ status: newStatus })
    .eq("id", requestId);

  if (error) {
    alert("Error al actualizar el estado: " + error.message);
    return;
  }

  await fetchRequests();
}

async function deleteRequest(requestId) {
  if (!currentUser || currentUser.role !== 'admin') return;

  if (!confirm("¿Seguro que deseas eliminar esta petición?")) return;

  const { error } = await supabaseClient
    .from("requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    alert("Error al eliminar petición: " + error.message);
    return;
  }

  await fetchRequests();
}

function renderRequests(customList = null) {
  const list = customList || appRequests;
  const tbody = document.getElementById("requests-table-body");
  const title = document.getElementById("requests-list-title");
  if (!tbody) return;

  tbody.innerHTML = "";

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (title) {
    title.innerText = isAdmin ? "Todas las Peticiones de los Usuarios" : "Mis Peticiones Enviadas";
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No se encontraron peticiones.</td></tr>`;
    return;
  }

  list.forEach(req => {
    const isDone = req.status === 'Hecha';
    const dateStr = new Date(req.created_at).toLocaleDateString();

    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 text-xs text-slate-400">${dateStr}</td>
        <td class="p-4 font-bold text-white">@${req.username}</td>
        <td class="p-4 text-slate-200">${req.request_text}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
            ${isDone ? '✅ Hecha' : '⏳ En proceso'}
          </span>
        </td>
        <td class="p-4 flex gap-2">
          ${isAdmin ? `
            <button onclick="toggleRequestStatus(${req.id}, '${req.status}')" class="px-3 py-1 rounded-lg text-xs font-semibold ${isDone ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}">
              ${isDone ? 'Marcar En proceso' : 'Marcar Hecha'}
            </button>
            <button onclick="deleteRequest(${req.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold p-1">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : '<span class="text-xs text-slate-600">-</span>'}
        </td>
      </tr>
    `;
  });
}

// MODAL STOCK BAJO
function openLowStockModal() {
  const modal = document.getElementById('low-stock-modal');
  const tbody = document.getElementById('low-stock-modal-body');
  if (!modal || !tbody) return;

  const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0));

  tbody.innerHTML = '';

  if (lowStockItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No hay productos en estado crítico.</td></tr>`;
  } else {
    const isAdmin = currentUser && currentUser.role === 'admin';

    lowStockItems.forEach(p => {
      tbody.innerHTML += `
        <tr class="hover:bg-slate-900 transition">
          <td class="p-3 font-mono text-indigo-400 font-semibold">${p.code || ''}</td>
          <td class="p-3 font-medium text-white">${p.name}</td>
          <td class="p-3 text-rose-400 font-bold">${p.stock} un.</td>
          <td class="p-3 text-slate-400">${p.min_stock || 5} un.</td>
          <td class="p-3">
            ${isAdmin ? `<button onclick="closeLowStockModal(); openMovementModalWithProduct(${p.id});" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-semibold">Reponer</button>` : '<span class="text-xs text-slate-600">-</span>'}
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
  const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 0)).length;

  document.getElementById('stat-total-products').innerText = totalProducts;
  document.getElementById('stat-low-stock').innerText = lowStock;
  document.getElementById('total-count-badge').innerText = totalProducts;

  updateProductUnitsFilter();
  updateProductValueFilter();
  previewLowStockItem();
}

// RENDER DEL GRÁFICO DE EVOLUCIÓN
function renderChart() {
  const canvas = document.getElementById('valueTrendChart');
  if (!canvas) return;

  const selectedId = document.getElementById('select-product-filter-id') ? document.getElementById('select-product-filter-id').value : 'all';

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

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">No se encontraron productos.</td></tr>`;
    return;
  }

  list.forEach(p => {
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.min_stock) || 5;
    const canMove = currentUser && (currentUser.role === 'admin' || currentUser.role === 'operator');
    const isAdmin = currentUser && currentUser.role === 'admin';

    const salePrice = Number(p.sale_price) || 0;
    // Cálculo seguro del Precio Venta + IVA (19%)
    const salePriceVat = salePrice * 1.19;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition border-b border-slate-800/50">
        <td class="p-4 font-mono text-indigo-400 font-semibold">${p.code || ''}</td>
        <td class="p-4 font-medium text-white">${p.name || ''}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${stock <= minStock ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${stock} unidades
          </span>
        </td>
        <td class="p-4">$${Number(p.purchase_price || 0).toLocaleString()}</td>
        <td class="p-4 font-semibold text-amber-400">$${salePrice.toLocaleString()}</td>
        <td class="p-4 font-bold text-emerald-400">$${salePriceVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
  document.getElementById('add-sale-price-vat').value = '0.00';

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
  
  // Cálculo automático del Precio con IVA (Venta * 1.19)
  const salePriceVat = Number((salePrice * 1.19).toFixed(2));

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
      sale_price: salePrice,
      sale_price_vat: salePriceVat
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

  const salePrice = Number(product.sale_price || 0);
  const salePriceVat = Number(product.sale_price_vat || (salePrice * 1.19));

  document.getElementById('edit-product-id').value = product.id;
  document.getElementById('edit-product-name').value = product.name;
  document.getElementById('edit-product-stock').value = product.stock;
  document.getElementById('edit-purchase-price').value = product.purchase_price;
  document.getElementById('edit-sale-price').value = salePrice;
  document.getElementById('edit-sale-price-vat').value = salePriceVat.toFixed(2);

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
  const newPurchasePrice = parseFloat(document.getElementById('edit-purchase-price').value) || 0;
  const newSalePrice = parseFloat(document.getElementById('edit-sale-price').value) || 0;
  
  // Cálculo automático del Precio con IVA (Venta * 1.19)
  const newSalePriceVat = Number((newSalePrice * 1.19).toFixed(2));

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
      sale_price: newSalePrice,
      sale_price_vat: newSalePriceVat
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