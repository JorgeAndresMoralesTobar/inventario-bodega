// Carga automática inicial de tus 420 productos extraídos de Inventario_base.xlsx
const initialProducts = [
  {"id": 1, "code": "PROD-001", "name": "Nivelador con Tornillo 1/4", "category": "General", "stock": 500, "minStock": 10, "purchasePrice": 540.0, "salePrice": 702.0},
  {"id": 2, "code": "PROD-002", "name": "Petavos", "category": "General", "stock": 20, "minStock": 10, "purchasePrice": 20000.0, "salePrice": 26000.0},
  {"id": 3, "code": "PROD-003", "name": "Arreglo Escudos", "category": "General", "stock": 10, "minStock": 10, "purchasePrice": 10000.0, "salePrice": 13000.0},
  {"id": 4, "code": "PROD-004", "name": "Nivelador con Tornillo 5/16", "category": "General", "stock": 500, "minStock": 10, "purchasePrice": 640.0, "salePrice": 832.0},
  {"id": 5, "code": "PROD-005", "name": "Nivelador con Tornillo 3/8", "category": "General", "stock": 500, "minStock": 10, "purchasePrice": 700.0, "salePrice": 910.0},
  {"id": 6, "code": "PROD-006", "name": "Cuña Puerta Grande maciza", "category": "General", "stock": 80, "minStock": 10, "purchasePrice": 1400.0, "salePrice": 1820.0},
  {"id": 7, "code": "PROD-007", "name": "Sello Oring #2", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 85.0, "salePrice": 110.5},
  {"id": 8, "code": "PROD-008", "name": "Sello Oring #3", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 85.0, "salePrice": 110.5},
  {"id": 9, "code": "PROD-009", "name": "Sello Oring #4", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 85.0, "salePrice": 110.5},
  {"id": 10, "code": "PROD-010", "name": "Sello Oring #5", "category": "General", "stock": 0, "minStock": 10, "purchasePrice": 85.0, "salePrice": 110.5},
  {"id": 11, "code": "PROD-011", "name": "Sello Oring #6", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 90.0, "salePrice": 117.0},
  {"id": 12, "code": "PROD-012", "name": "Sello Oring #7", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 90.0, "salePrice": 117.0},
  {"id": 13, "code": "PROD-013", "name": "Sello Oring #8", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 90.0, "salePrice": 117.0},
  {"id": 14, "code": "PROD-014", "name": "Sello Oring #9", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 100.0, "salePrice": 130.0},
  {"id": 15, "code": "PROD-015", "name": "Sello Oring #10", "category": "General", "stock": 200, "minStock": 10, "purchasePrice": 100.0, "salePrice": 130.0}
];

let products = JSON.parse(localStorage.getItem('bodega_products')) || initialProducts;
let movements = JSON.parse(localStorage.getItem('bodega_movements')) || [];
let currentRole = 'admin';

document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();
  renderProducts();
  renderMovements();
  populateProductSelect();
  applyRolePermissions();
});

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
  const totalValue = products.reduce((acc, p) => acc + (p.stock * p.purchasePrice), 0);
  const lowStock = products.filter(p => p.stock <= p.minStock).length;

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
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${p.stock <= p.minStock ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${p.stock} unidades
          </span>
        </td>
        <td class="p-4">$${p.purchasePrice.toLocaleString()}</td>
        <td class="p-4">$${p.salePrice.toLocaleString()}</td>
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

function saveMovement() {
  const type = document.getElementById('mov-type').value;
  const productId = parseInt(document.getElementById('mov-product').value);
  const qty = parseInt(document.getElementById('mov-qty').value);
  const comment = document.getElementById('mov-comment').value.trim();

  if (!comment) {
    alert("⚠️ Debes introducir un comentario u observación para registrar el movimiento.");
    return;
  }

  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (type === 'OUT' && product.stock < qty) {
    alert(`⚠️ Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
    return;
  }

  // Modificación dinámica del stock
  if (type === 'IN') {
    product.stock += qty;
  } else {
    product.stock -= qty;
  }

  // Registro del historial
  const movement = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    type: type,
    productName: product.name,
    qty: qty,
    comment: comment,
    user: currentRole.toUpperCase()
  };

  movements.unshift(movement);

  localStorage.setItem('bodega_products', JSON.stringify(products));
  localStorage.setItem('bodega_movements', JSON.stringify(movements));

  renderDashboard();
  renderProducts();
  renderMovements();
  closeMovementModal();
  document.getElementById('mov-comment').value = '';
}

function renderMovements() {
  const tbody = document.getElementById('movements-table-body');
  tbody.innerHTML = '';

  movements.forEach(m => {
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900 transition">
        <td class="p-4 text-xs text-slate-400">${m.date}</td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${m.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${m.type === 'IN' ? 'ENTRADA (+)' : 'SALIDA (-)'}
          </span>
        </td>
        <td class="p-4 font-medium text-white">${m.productName}</td>
        <td class="p-4 font-bold">${m.qty}</td>
        <td class="p-4 text-slate-300 italic">${m.comment}</td>
        <td class="p-4 text-xs text-indigo-400 font-semibold">${m.user}</td>
      </tr>
    `;
  });
}