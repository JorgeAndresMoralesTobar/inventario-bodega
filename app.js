// AURA LUXE COMMERCE - Main Application Controller (Alumax JT)

class StoreApp {
  constructor() {
    this.products = [...PRODUCTS];
    this.filteredProducts = [...PRODUCTS];
    this.cart = this.loadFromStorage('aura_cart', []);
    this.wishlist = this.loadFromStorage('aura_wishlist', []);
    this.currentCategory = 'todas';
    this.currentProvider = 'todos';
    this.searchQuery = '';
    this.sortBy = 'featured';
    this.maxPrice = 999999999;
    this.appliedCoupon = null;
    this.currentCurrency = this.loadFromStorage('aura_currency', 'COP');
    this.currentCountry = this.loadFromStorage('aura_country', 'CO');
    this.editingProductId = null;
    this.quickViewProduct = null;
    this.quickViewSelectedImage = 0;
    this.quickViewSelectedSize = null;
    this.quickViewSelectedColor = null;
    this.quickViewQty = 1;
    this.visibleCount = 24;

    this.init();
  }

  // --- CONTROL DE SESIÓN Y ADMIN ---
  isAdmin() {
    return localStorage.getItem('aura_admin_session') === 'true';
  }

  updateAdminUI() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
      if (this.isAdmin()) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  loginAdmin() {
    const user = prompt("Acceso Administrador\nIngrese Usuario:");
    const pass = prompt("Acceso Administrador\nIngrese Contraseña:");

    if (user === "admin" && pass === "admin123") {
      localStorage.setItem('aura_admin_session', 'true');
      this.updateAdminUI();
      this.renderProducts();
      this.showToast("Modo Administrador", "Herramientas de edición activadas.", "success");
    } else {
      alert("Usuario o contraseña incorrectos.");
    }
  }

  logoutAdmin() {
    localStorage.removeItem('aura_admin_session');
    this.updateAdminUI();
    this.renderProducts();
    this.showToast("Sesión Cerrada", "Modo cliente activo.", "info");
  }

  loadFromStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  init() {
    this.populateProviderSelect();
    this.renderCategoryPills();
    this.renderProducts();
    this.updateCartBadge();
    this.updateWishlistBadge();
    this.updateRegionDisplay();
    this.setupEventListeners();
    this.startFlashCountdown();
    this.updateAdminUI();
    this.refreshIcons();
  }

  // --- BUSCADOR CON VISTA PREVIA EN VIVO (LIVE SEARCH DROPDOWN) ---
  handleLiveSearch(query, mode = 'desktop') {
    this.setSearch(query);

    const dropdownId = mode === 'mobile' ? 'mobile-search-dropdown' : 'search-dropdown';
    const resultsId = mode === 'mobile' ? 'mobile-search-dropdown-results' : 'search-dropdown-results';
    const dropdown = document.getElementById(dropdownId);
    const resultsContainer = document.getElementById(resultsId);

    if (!dropdown || !resultsContainer) return;

    const q = query.toLowerCase().trim();
    if (q.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }

    const matches = this.products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.provider && p.provider.toLowerCase().includes(q))
    ).slice(0, 5); // Mostrar máximo 5 sugerencias rápidas

    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div class="p-3 text-xs text-slate-500 text-center">No hay coincidencias directas</div>`;
    } else {
      resultsContainer.innerHTML = matches.map(p => `
        <div onclick="app.openQuickView('${p.id}'); app.hideSearchDropdown();" class="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors">
          <img src="${p.images[0]}" class="w-10 h-10 object-contain rounded-lg bg-white p-1 border border-slate-200" />
          <div class="flex-1 min-w-0">
            <h5 class="text-xs font-bold text-slate-900 truncate">${p.name}</h5>
            <span class="text-[10px] text-slate-500">${p.categoryName} • ${p.provider || 'Alumax JT'}</span>
          </div>
          <strong class="text-xs font-bold text-blue-600">${this.formatPrice(p.price)}</strong>
        </div>
      `).join('');
    }

    dropdown.classList.remove('hidden');
    this.refreshIcons();
  }

  hideSearchDropdown() {
    const d1 = document.getElementById('search-dropdown');
    const d2 = document.getElementById('mobile-search-dropdown');
    if (d1) d1.classList.add('hidden');
    if (d2) d2.classList.add('hidden');
  }

  // --- FILTRO DE PROVEEDORES ---
  populateProviderSelect() {
    const select = document.getElementById('filter-provider-select');
    if (!select) return;

    const providers = Array.from(new Set(this.products.map(p => p.provider).filter(Boolean))).sort();
    select.innerHTML = `<option value="todos">Todos los distribuidores (${providers.length})</option>` +
      providers.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  setProviderFilter(provider) {
    this.currentProvider = provider;
    this.applyFilters();
  }

  // --- MONEDA Y REGIÓN ---
  formatPrice(euroAmount) {
    if (euroAmount === undefined || euroAmount === null) return '';
    const curr = CURRENCIES[this.currentCurrency] || CURRENCIES.COP || { rate: 1, symbol: '$', decimals: 0, position: 'before' };
    const converted = euroAmount * curr.rate;
    
    const formattedNumber = converted.toLocaleString('es-CO', {
      minimumFractionDigits: curr.decimals,
      maximumFractionDigits: curr.decimals
    });

    return curr.position === 'before' 
      ? `${curr.symbol} ${formattedNumber}` 
      : `${formattedNumber} ${curr.symbol}`;
  }

  updateRegionDisplay() {
    const country = COUNTRIES.find(c => c.code === this.currentCountry) || COUNTRIES[0];
    const curr = CURRENCIES[this.currentCurrency] || CURRENCIES.COP;

    const labelEls = document.querySelectorAll('.global-region-label');
    labelEls.forEach(el => {
      el.innerHTML = `${country.flag} ${country.code} • ${curr.code} (${curr.symbol})`;
    });

    const heroPriceEl = document.getElementById('hero-product-price');
    const heroOldPriceEl = document.getElementById('hero-product-oldprice');
    if (heroPriceEl) heroPriceEl.textContent = this.formatPrice(87707.16);
    if (heroOldPriceEl) heroOldPriceEl.textContent = this.formatPrice(105248.0);
  }

  openRegionModal() {
    const modal = document.getElementById('region-modal');
    const container = document.getElementById('region-list-container');
    if (!modal || !container) return;

    container.innerHTML = COUNTRIES.map(c => {
      const isSelected = this.currentCountry === c.code;
      const curr = CURRENCIES[c.currency] || { name: c.currency };
      return `
        <button 
          onclick="app.setCountryAndCurrency('${c.code}', '${c.currency}')"
          class="flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
            isSelected 
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20' 
              : 'border-slate-200 hover:border-slate-400 bg-white'
          }"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">${c.flag}</span>
            <div>
              <div class="font-bold text-slate-900 text-sm">${c.name}</div>
              <div class="text-xs text-slate-500">${curr.name}</div>
            </div>
          </div>
          ${isSelected ? '<span class="text-blue-600 font-bold text-xs bg-blue-100 px-2 py-0.5 rounded-full">Activo</span>' : ''}
        </button>
      `;
    }).join('');

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    this.refreshIcons();
  }

  closeRegionModal() {
    const modal = document.getElementById('region-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  setCountryAndCurrency(countryCode, currencyCode) {
    this.currentCountry = countryCode;
    this.currentCurrency = currencyCode;
    this.saveToStorage('aura_country', this.currentCountry);
    this.saveToStorage('aura_currency', this.currentCurrency);

    this.updateRegionDisplay();
    this.renderProducts();
    this.renderCartItems();
    if (this.quickViewProduct) {
      this.renderQuickViewContent();
    }
    this.closeRegionModal();

    const country = COUNTRIES.find(c => c.code === countryCode);
    this.showToast('Región y Moneda actualizadas', `Comprando desde ${country.name} con divisa ${currencyCode}.`, 'success');
  }

  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- RELOJ CUENTA REGRESIVA ---
  startFlashCountdown() {
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (!hoursEl || !minsEl || !secsEl) return;

    let totalSeconds = 14 * 3600 + 42 * 60 + 15;

    setInterval(() => {
      if (totalSeconds <= 0) totalSeconds = 24 * 3600;
      totalSeconds--;

      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      hoursEl.textContent = String(h).padStart(2, '0');
      minsEl.textContent = String(m).padStart(2, '0');
      secsEl.textContent = String(s).padStart(2, '0');
    }, 1000);
  }

  // --- CATEGORÍAS Y FILTROS ---
  renderCategoryPills() {
    const container = document.getElementById('category-pills-container');
    if (!container) return;

    const counts = { todas: this.products.length };
    this.products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    container.innerHTML = CATEGORIES.map(cat => {
      const isActive = this.currentCategory === cat.id;
      const count = counts[cat.id] || 0;
      return `
        <button onclick="app.setCategory('${cat.id}')" class="category-pill ${isActive ? 'active' : ''}">
          <span>${cat.name}</span>
          <span class="pill-count">${count}</span>
        </button>
      `;
    }).join('');

    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) catSelect.value = this.currentCategory;
  }

  setCategory(catId) {
    this.currentCategory = catId;
    this.renderCategoryPills();
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.products];

    if (this.currentCategory !== 'todas') {
      result = result.filter(p => p.category === this.currentCategory);
    }

    if (this.currentProvider !== 'todos') {
      result = result.filter(p => p.provider === this.currentProvider);
    }

    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(query)) ||
        p.categoryName.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.provider && p.provider.toLowerCase().includes(query))
      );
    }

    result = result.filter(p => p.price <= this.maxPrice);

    switch (this.sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
        break;
      case 'deals':
        result.sort((a, b) => (b.isFlashDeal ? 1 : 0) - (a.isFlashDeal ? 1 : 0));
        break;
      case 'bestseller':
        result.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      case 'featured':
      default:
        break;
    }

    this.filteredProducts = result;
    this.renderProducts();

    const countEl = document.getElementById('products-count');
    if (countEl) {
      countEl.textContent = `${this.filteredProducts.length} producto${this.filteredProducts.length === 1 ? '' : 's'} disponible${this.filteredProducts.length === 1 ? '' : 's'}`;
    }
  }

  setSort(sortValue) {
    this.sortBy = sortValue;
    this.applyFilters();
  }

  setSearch(query) {
    this.searchQuery = query;
    this.applyFilters();
  }

  // --- MOSTRAR PRODUCTOS EN GRILLA ---
  renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (this.filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <div class="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <i data-lucide="search-x" class="w-10 h-10"></i>
          </div>
          <h3 class="text-xl font-bold text-slate-800 mb-2">No se encontraron productos</h3>
          <p class="text-slate-500 max-w-md mx-auto text-sm mb-6">
            Intenta cambiar los filtros o los términos de búsqueda.
          </p>
          <button onclick="app.resetFilters()" class="px-6 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-all shadow-md">
            Ver todo el catálogo
          </button>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    const visible = this.filteredProducts.slice(0, this.visibleCount || 24);
    const remaining = this.filteredProducts.length - visible.length;

    grid.innerHTML = visible.map(product => {
      const isFav = this.wishlist.includes(product.id);

      let tagHtml = '';
      if (product.isFlashDeal) {
        tagHtml = `<span class="pc-tag pc-tag--flash">Oferta ${product.discount}</span>`;
      } else if (product.isBestSeller) {
        tagHtml = `<span class="pc-tag">Más vendido</span>`;
      } else if (product.isNew) {
        tagHtml = `<span class="pc-tag pc-tag--new">Nuevo</span>`;
      }

      const showOld = product.oldPrice && product.oldPrice > product.price;

      return `
        <article class="product-card" id="prod-${product.id}">
          <div class="pc-media" onclick="app.openQuickView('${product.id}')">
            ${tagHtml}
            <button onclick="event.stopPropagation(); app.toggleWishlist('${product.id}')" class="pc-fav" aria-label="Añadir a favoritos">
              <i data-lucide="heart" style="${isFav ? 'fill:#d93042;color:#d93042' : ''}"></i>
            </button>
            <img src="${product.images[0]}" alt="${product.name}" loading="lazy" class="card-img" />
            <button onclick="event.stopPropagation(); app.openChangeImageModal('${product.id}')" class="pc-photo ${this.isAdmin() ? '' : 'hidden'}" aria-label="Cambiar foto">
              <i data-lucide="camera"></i>
            </button>
          </div>

          <div class="pc-body">
            <span class="pc-cat">${product.categoryName} • ${product.provider || 'Alumax JT'}</span>
            <h3 class="pc-name" onclick="app.openQuickView('${product.id}')" title="${product.name}">${product.name}</h3>
            <div class="pc-foot">
              <div class="pc-price">
                <strong>${this.formatPrice(product.price)}</strong>
                ${showOld ? `<s>${this.formatPrice(product.oldPrice)}</s>` : ''}
              </div>
              <button onclick="event.stopPropagation(); app.quickAddToCart('${product.id}')" class="pc-add" aria-label="Añadir a la cesta">Añadir</button>
            </div>
          </div>
        </article>
      `;
    }).join('') + (remaining > 0 ? `
      <div class="ax-more">
        <button onclick="app.showMore()" class="ax-btn ax-btn--dark">Mostrar más productos</button>
        <span>Quedan ${remaining} por ver</span>
      </div>` : '');

    this.refreshIcons();
  }

  showMore() {
    this.visibleCount += 24;
    this.renderProducts();
  }

  resetFilters() {
    this.currentCategory = 'todas';
    this.currentProvider = 'todos';
    this.searchQuery = '';
    this.sortBy = 'featured';

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    const provSelect = document.getElementById('filter-provider-select');
    if (provSelect) provSelect.value = 'todos';
    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) catSelect.value = 'todas';
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.value = 'featured';

    this.renderCategoryPills();
    this.applyFilters();
  }

  // --- VISTA RÁPIDA ---
  openQuickView(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.quickViewProduct = product;
    this.quickViewSelectedImage = 0;
    this.quickViewSelectedSize = product.sizes ? product.sizes[0] : null;
    this.quickViewSelectedColor = product.colors ? product.colors[0].name : null;
    this.quickViewQty = 1;

    this.renderQuickViewContent();

    const modal = document.getElementById('quickview-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeQuickView() {
    const modal = document.getElementById('quickview-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  renderQuickViewContent() {
    const p = this.quickViewProduct;
    if (!p) return;

    const modalBody = document.getElementById('quickview-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div class="flex flex-col gap-4">
          <div class="relative aspect-square bg-[#F8FAFC] rounded-3xl overflow-hidden border border-slate-100 flex items-center justify-center p-8">
            <img id="qv-main-img" src="${p.images[0]}" alt="${p.name}" class="w-full h-full object-contain mix-blend-multiply drop-shadow-xl" />
          </div>
        </div>

        <div class="flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span class="uppercase font-bold">${p.categoryName}</span>
              <span class="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold">✓ En Stock Colombia</span>
            </div>

            <h2 class="text-2xl md:text-3xl font-extrabold text-slate-900 font-display mb-2">${p.name}</h2>
            <div class="text-xs text-slate-500 mb-4">Proveedor: <strong class="text-slate-800">${p.provider || 'Distribuciones Alumax JT'}</strong></div>

            <div class="flex items-baseline gap-3 mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span class="text-3xl font-black text-slate-900 font-display">${this.formatPrice(p.price)}</span>
            </div>

            <p class="text-sm text-slate-600 leading-relaxed mb-6">${p.description || 'Producto ferretero e industrial de alta resistencia.'}</p>
          </div>

          <div class="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div class="flex items-center border border-slate-200 rounded-2xl p-1 bg-white justify-between w-full sm:w-auto">
              <button onclick="app.updateQuickViewQty(-1)" class="w-10 h-10 rounded-xl hover:bg-slate-100 font-bold text-slate-700">-</button>
              <span id="qv-qty" class="w-12 text-center font-extrabold text-slate-900 text-sm">1</span>
              <button onclick="app.updateQuickViewQty(1)" class="w-10 h-10 rounded-xl hover:bg-slate-100 font-bold text-slate-700">+</button>
            </div>

            <button onclick="app.addQuickViewToCart()" class="flex-1 w-full py-4 px-6 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl">
              <i data-lucide="shopping-bag" class="w-5 h-5"></i>
              <span>Añadir a la Cesta</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.refreshIcons();
  }

  updateQuickViewQty(delta) {
    let nextQty = this.quickViewQty + delta;
    if (nextQty < 1) nextQty = 1;
    this.quickViewQty = nextQty;
    const qtyEl = document.getElementById('qv-qty');
    if (qtyEl) qtyEl.textContent = this.quickViewQty;
  }

  addQuickViewToCart() {
    if (!this.quickViewProduct) return;
    this.addToCart(this.quickViewProduct.id, null, null, this.quickViewQty);
    this.closeQuickView();
    this.openCart();
  }

  // --- CARRITO ---
  quickAddToCart(productId) {
    this.addToCart(productId, 'Estándar', 'Estándar', 1);
  }

  addToCart(productId, size, color, quantity = 1) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = this.cart.findIndex(item => item.productId === productId);

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        productId,
        product,
        size: size || 'Estándar',
        color: color || 'Estándar',
        quantity
      });
    }

    this.saveToStorage('aura_cart', this.cart);
    this.updateCartBadge();
    this.renderCartItems();

    this.showToast('¡Añadido a la Cesta!', `Se agregó "${product.name}" al carrito.`, 'success');
  }

  updateCartQty(index, delta) {
    if (!this.cart[index]) return;
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.removeFromCart(index);
      return;
    }
    this.saveToStorage('aura_cart', this.cart);
    this.updateCartBadge();
    this.renderCartItems();
  }

  removeFromCart(index) {
    if (!this.cart[index]) return;
    this.cart.splice(index, 1);
    this.saveToStorage('aura_cart', this.cart);
    this.updateCartBadge();
    this.renderCartItems();
  }

  updateCartBadge() {
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('.cart-count-badge');
    badges.forEach(b => {
      b.textContent = totalItems;
      if (totalItems > 0) b.classList.remove('hidden');
      else b.classList.add('hidden');
    });
  }

  openCart() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-backdrop');
    const panel = document.getElementById('cart-panel');

    if (!drawer || !backdrop || !panel) return;

    this.renderCartItems();
    drawer.classList.remove('hidden');
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
      panel.classList.remove('translate-x-full');
      panel.classList.add('translate-x-0');
    }, 10);
    document.body.classList.add('overflow-hidden');
  }

  closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-backdrop');
    const panel = document.getElementById('cart-panel');

    if (!drawer || !backdrop || !panel) return;

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');

    setTimeout(() => {
      drawer.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const shippingEl = document.getElementById('cart-shipping');
    const discountRow = document.getElementById('cart-discount-row');
    const discountVal = document.getElementById('cart-discount-val');
    const totalEl = document.getElementById('cart-total');
    const emptyState = document.getElementById('cart-empty-state');
    const footerControls = document.getElementById('cart-footer-controls');

    if (!container) return;

    if (this.cart.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (footerControls) footerControls.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (footerControls) footerControls.classList.remove('hidden');

    let subtotal = 0;
    container.innerHTML = this.cart.map((item, idx) => {
      const lineTotal = item.product.price * item.quantity;
      subtotal += lineTotal;

      return `
        <div class="flex items-center gap-4 py-4 border-b border-slate-100">
          <div class="w-16 h-16 bg-slate-50 rounded-2xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
            <img src="${item.product.images[0]}" alt="${item.product.name}" class="w-full h-full object-contain mix-blend-multiply" />
          </div>

          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-slate-900 truncate">${item.product.name}</h4>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center border border-slate-200 rounded-lg bg-white">
                <button onclick="app.updateCartQty(${idx}, -1)" class="w-6 h-6 text-xs font-bold text-slate-600 hover:bg-slate-100">-</button>
                <span class="w-6 text-center text-xs font-extrabold text-slate-800">${item.quantity}</span>
                <button onclick="app.updateCartQty(${idx}, 1)" class="w-6 h-6 text-xs font-bold text-slate-600 hover:bg-slate-100">+</button>
              </div>
              <div class="text-right">
                <div class="text-xs font-black text-slate-900">${this.formatPrice(lineTotal)}</div>
              </div>
            </div>
          </div>

          <button onclick="app.removeFromCart(${idx})" class="text-slate-300 hover:text-rose-500 p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');

    const shipping = subtotal >= 200000 ? 0 : 12000;
    let discountAmount = 0;

    if (this.appliedCoupon) {
      discountAmount = (subtotal * this.appliedCoupon.discountPercent) / 100;
      if (discountRow) discountRow.classList.remove('hidden');
      if (discountVal) discountVal.textContent = `-${this.formatPrice(discountAmount)}`;
    } else {
      if (discountRow) discountRow.classList.add('hidden');
    }

    const finalTotal = subtotal - discountAmount + shipping;

    if (subtotalEl) subtotalEl.textContent = this.formatPrice(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? 'GRATIS' : this.formatPrice(shipping);
    if (totalEl) totalEl.textContent = this.formatPrice(finalTotal);

    this.refreshIcons();
  }

  applyPromoCode() {
    const input = document.getElementById('coupon-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();

    if (ACTIVE_COUPONS && ACTIVE_COUPONS[code]) {
      this.appliedCoupon = { code, ...ACTIVE_COUPONS[code] };
      this.showToast('¡Cupón Aplicado!', `Descuento del ${this.appliedCoupon.discountPercent}% activado.`, 'success');
      this.renderCartItems();
    } else {
      this.showToast('Cupón no válido', 'Prueba con: MAYORISTA o ALUMAXJT', 'error');
    }
  }

  // --- FAVORITOS ---
  toggleWishlist(productId) {
    const index = this.wishlist.indexOf(productId);
    const product = this.products.find(p => p.id === productId);

    if (index > -1) {
      this.wishlist.splice(index, 1);
    } else {
      this.wishlist.push(productId);
    }

    this.saveToStorage('aura_wishlist', this.wishlist);
    this.updateWishlistBadge();
    this.renderProducts();
  }

  updateWishlistBadge() {
    const count = this.wishlist.length;
    const badges = document.querySelectorAll('.wishlist-count-badge');
    badges.forEach(b => {
      b.textContent = count;
      if (count > 0) b.classList.remove('hidden');
      else b.classList.add('hidden');
    });
  }

  openWishlistModal() {
    const modal = document.getElementById('wishlist-modal');
    const container = document.getElementById('wishlist-items-container');
    if (!modal || !container) return;

    if (this.wishlist.length === 0) {
      container.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">No tienes productos en favoritos.</div>`;
    } else {
      const favProducts = this.products.filter(p => this.wishlist.includes(p.id));
      container.innerHTML = favProducts.map(p => `
        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div class="flex items-center gap-3">
            <img src="${p.images[0]}" class="w-12 h-12 object-contain bg-white rounded-xl p-1" />
            <div>
              <h5 class="text-xs font-bold text-slate-900">${p.name}</h5>
              <span class="text-xs font-black text-slate-700">${this.formatPrice(p.price)}</span>
            </div>
          </div>
          <button onclick="app.quickAddToCart('${p.id}'); app.closeWishlistModal(); app.openCart();" class="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Añadir</button>
        </div>
      `).join('');
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    this.refreshIcons();
  }

  closeWishlistModal() {
    const modal = document.getElementById('wishlist-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  // --- MODAL DE CHECKOUT Y PROCESO DE PAGO ---
  openCheckoutModal() {
    if (this.cart.length === 0) {
      this.showToast('Cesta vacía', 'Añade productos antes de pagar.', 'warning');
      return;
    }

    this.closeCart();
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    this.setCheckoutStep(1);

    const totalAmount = document.getElementById('cart-total') ? document.getElementById('cart-total').textContent : '$ 0';
    const checkoutTotal = document.getElementById('checkout-summary-total');
    if (checkoutTotal) checkoutTotal.textContent = totalAmount;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    this.refreshIcons();
  }

  closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  setCheckoutStep(stepNumber) {
    for (let i = 1; i <= 3; i++) {
      const stepContent = document.getElementById(`checkout-step-${i}`);
      const stepIndicator = document.getElementById(`step-indicator-${i}`);
      if (stepContent) {
        if (i === stepNumber) stepContent.classList.remove('hidden');
        else stepContent.classList.add('hidden');
      }
      if (stepIndicator) {
        if (i <= stepNumber) {
          stepIndicator.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        } else {
          stepIndicator.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
          stepIndicator.classList.add('bg-white', 'text-slate-400', 'border-slate-300');
        }
      }
    }
  }

  processPaymentOrder() {
    const selectedGateway = document.querySelector('input[name="payment-gateway"]:checked')?.value || 'wompi';
    const payBtn = document.getElementById('pay-submit-btn');

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = `Conectando con ${selectedGateway.toUpperCase()}...`;
    }

    setTimeout(() => {
      this.setCheckoutStep(3);
      const randomOrder = 'ALX-CO-' + Math.floor(100000 + Math.random() * 900000);
      const orderIdEl = document.getElementById('confirmed-order-id');
      if (orderIdEl) orderIdEl.textContent = randomOrder;

      this.launchConfetti();

      this.cart = [];
      this.appliedCoupon = null;
      this.saveToStorage('aura_cart', this.cart);
      this.updateCartBadge();
      this.renderCartItems();

      this.showToast('¡Pago Procesado!', `Orden ${randomOrder} generada exitosamente.`, 'success');
      this.refreshIcons();
    }, 1500);
  }

  launchConfetti() {
    if (window.confetti) {
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item flex items-start gap-3 p-4 bg-white/95 border border-slate-200 rounded-2xl shadow-2xl max-w-sm pointer-events-auto transition-all`;
    toast.innerHTML = `
      <div class="flex-1 min-w-0">
        <h5 class="text-xs font-bold text-slate-900">${title}</h5>
        <p class="text-xs text-slate-500 mt-0.5">${message}</p>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // --- ADMINISTRACIÓN DE FOTOS Y PRODUCTOS ---
  openChangeImageModal(productId) {
    if (!this.isAdmin()) return;

    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.editingProductId = productId;
    const modal = document.getElementById('change-image-modal');
    const nameEl = document.getElementById('change-img-prod-name');
    const inputEl = document.getElementById('change-img-url-input');
    const previewEl = document.getElementById('change-img-preview');

    if (nameEl) nameEl.textContent = product.name;
    if (inputEl) inputEl.value = product.images[0] || '';
    if (previewEl) previewEl.src = product.images[0] || '';

    if (modal) modal.classList.remove('hidden');
  }

  closeChangeImageModal() {
    const modal = document.getElementById('change-image-modal');
    if (modal) modal.classList.add('hidden');
    this.editingProductId = null;
  }

  previewImageChange(url) {
    const previewEl = document.getElementById('change-img-preview');
    if (previewEl && url.trim()) previewEl.src = url.trim();
  }

  saveProductImage() {
    if (!this.editingProductId) return;
    const inputEl = document.getElementById('change-img-url-input');
    const newUrl = inputEl ? inputEl.value.trim() : '';

    if (!newUrl) return;

    const product = this.products.find(p => p.id === this.editingProductId);
    if (product) {
      product.images[0] = newUrl;
      this.applyFilters();
      this.closeChangeImageModal();
      this.showToast('Foto actualizada', `Imagen de "${product.name}" modificada.`, 'success');
    }
  }

  openAddProductModal() {
    if (!this.isAdmin()) return;
    const modal = document.getElementById('add-product-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    if (modal) modal.classList.add('hidden');
  }

  saveNewProduct(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('new-prod-name').value.trim();
    const category = document.getElementById('new-prod-category').value;
    const price = parseFloat(document.getElementById('new-prod-price').value) || 0;
    const provider = document.getElementById('new-prod-provider').value.trim() || 'Alumax JT';
    const image = document.getElementById('new-prod-image').value.trim() || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80';
    const description = document.getElementById('new-prod-desc').value.trim() || 'Pieza industrial garantizada.';

    if (!name || price <= 0) return;

    const catObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
    const newId = `art-custom-${Date.now()}`;

    const newProduct = {
      id: newId,
      name,
      subtitle: `Línea ${catObj.name}`,
      category,
      categoryName: catObj.name,
      price,
      oldPrice: Math.round(price * 1.15),
      discount: "-15%",
      rating: 5.0,
      reviewsCount: 1,
      stock: 999,
      provider,
      colors: [{ name: "Estándar", hex: "#475569" }],
      sizes: ["Estándar"],
      images: [image],
      description,
      specs: [`Referencia: ${newId.toUpperCase()}`, `Proveedor: ${provider}`]
    };

    this.products.unshift(newProduct);
    PRODUCTS = this.products;
    this.populateProviderSelect();
    this.renderCategoryPills();
    this.applyFilters();
    this.closeAddProductModal();

    this.showToast('¡Producto Añadido!', `"${name}" publicado con éxito.`, 'success');
  }

  openAdminModal() {
    if (!this.isAdmin()) return;
    const modal = document.getElementById('admin-modal');
    const totalCountEl = document.getElementById('admin-total-count');
    if (totalCountEl) totalCountEl.textContent = this.products.length;
    if (modal) modal.classList.remove('hidden');
  }

  closeAdminModal() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.add('hidden');
  }

  exportCatalogFile() {
    const fileContent = `const BASE_PRODUCTS = ${JSON.stringify(this.products, null, 2)};\nlet PRODUCTS = [...BASE_PRODUCTS];`;
    const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products.js';
    link.click();
    URL.revokeObjectURL(url);
    this.showToast('Exportado', 'Archivo products.js generado.', 'success');
  }

  setupEventListeners() {
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => this.setSort(e.target.value));
    }

    // Ocultar desplegables de búsqueda al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ax-search') && !e.target.closest('.ax-mobile-search')) {
        this.hideSearchDropdown();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeQuickView();
        this.closeCart();
        this.closeWishlistModal();
        this.closeCheckoutModal();
        this.closeRegionModal();
        this.closeChangeImageModal();
        this.closeAddProductModal();
        this.closeAdminModal();
        this.hideSearchDropdown();
      }
    });
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new StoreApp();
});