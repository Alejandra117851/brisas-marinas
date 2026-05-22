/**
 * sales.js
 * Punto de Venta con flujo en 2 pasos:
 *  1. Selección de mesa
 *  2. Armar pedido y guardarlo como pendiente
 */
 
const state = {
    // Mesas
    tables: [],
    selectedTable: null,
 
    // Productos
    products: [],
    filtered: [],
    categories: [],
    activeCategory: null,
    search: '',
 
    // Carrito
    cart: new Map(),   // product_id → { product, qty }
};
 
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('sales');
    await loadTables();
    await loadProductsAndCategories();
    setupListeners();
});
 
// ─────────────────────────────────────────
//  PASO 1 — Mesas
// ─────────────────────────────────────────
 
async function loadTables() {
    try {
        const res = await api.get('/tables');
        state.tables = res.data;
        renderTables();
    } catch (err) {
        toastError(err.message);
    }
}
 
function renderTables() {
    const grid = document.getElementById('tables-grid');
    if (!state.tables.length) {
        grid.innerHTML = '<div class="empty-state">No hay mesas configuradas.</div>';
        return;
    }
 
    grid.innerHTML = state.tables.map(t => {
        const occupied = t.is_occupied;
        return `
            <button
                class="table-card ${occupied ? 'table-occupied' : 'table-free'}"
                data-id="${t.id}"
                data-label="${escapeHTML(t.label)}"
                ${occupied ? 'disabled' : ''}
                title="${occupied ? 'Mesa ocupada' : 'Mesa disponible'}"
            >
                <div class="table-icon">${occupied ? '🔴' : '🟢'}</div>
                <div class="table-number">${escapeHTML(t.label)}</div>
                <div class="table-status">${occupied ? 'Ocupada' : 'Disponible'}</div>
                ${occupied && t.order_number ? `<div class="table-order">${escapeHTML(t.order_number)}</div>` : ''}
            </button>
        `;
    }).join('');
 
    grid.querySelectorAll('.table-card:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const id    = parseInt(btn.dataset.id, 10);
            const label = btn.dataset.label;
            selectTable(id, label);
        });
    });
}
 
function selectTable(id, label) {
    state.selectedTable = { id, label };
    state.cart.clear();
 
    document.getElementById('pos-title').textContent = `Pedido — ${label}`;
    document.getElementById('step-tables').classList.add('hidden');
    document.getElementById('step-pos').classList.remove('hidden');
 
    renderCart();
    renderProducts();
    document.getElementById('product-search').value = '';
    state.search = '';
    state.activeCategory = null;
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
    const all = document.querySelector('.category-chip[data-id="all"]');
    if (all) all.classList.add('active');
    applyFilters();
}
 
function goBackToTables() {
    if (state.cart.size > 0) {
        if (!confirm('¿Descartar el pedido y volver a mesas?')) return;
    }
    state.cart.clear();
    state.selectedTable = null;
    document.getElementById('step-pos').classList.add('hidden');
    document.getElementById('step-tables').classList.remove('hidden');
    loadTables(); // refresca estados
}
 
// ─────────────────────────────────────────
//  PASO 2 — Productos y carrito
// ─────────────────────────────────────────
 
async function loadProductsAndCategories() {
    try {
        const [productsRes, categoriesRes] = await Promise.all([
            api.get('/products', { active: 'true' }),
            api.get('/categories'),
        ]);
        state.products   = productsRes.data;
        state.categories = categoriesRes.data;
        state.filtered   = [...state.products];
        renderCategories();
        renderProducts();
    } catch (err) {
        toastError(err.message);
    }
}
 
function setupListeners() {
    document.getElementById('btn-back-tables').addEventListener('click', goBackToTables);
 
    document.getElementById('product-search').addEventListener('input', debounce((e) => {
        state.search = e.target.value.trim().toLowerCase();
        applyFilters();
    }, 200));
 
    document.getElementById('btn-clear-cart').addEventListener('click', () => {
        if (state.cart.size === 0) return;
        if (confirm('¿Vaciar el carrito?')) {
            state.cart.clear();
            renderCart();
        }
    });
 
    document.getElementById('btn-save-order').addEventListener('click', () => {
        if (state.cart.size === 0) return;
        document.getElementById('order-notes').value = '';
        openModal('save-order-modal');
    });
 
    document.getElementById('btn-confirm-order').addEventListener('click', confirmSaveOrder);
}
 
function renderCategories() {
    const container = document.getElementById('category-chips');
    container.innerHTML = `
        <button class="category-chip active" data-id="all">Todos</button>
        ${state.categories.map(c => `
            <button class="category-chip" data-id="${c.id}">${escapeHTML(c.name)}</button>
        `).join('')}
    `;
    container.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const id = chip.dataset.id;
            state.activeCategory = id === 'all' ? null : parseInt(id, 10);
            applyFilters();
        });
    });
}
 
function applyFilters() {
    state.filtered = state.products.filter(p => {
        if (state.activeCategory && p.category_id !== state.activeCategory) return false;
        if (state.search) {
            const haystack = `${p.name} ${p.code || ''} ${p.description || ''}`.toLowerCase();
            if (!haystack.includes(state.search)) return false;
        }
        return true;
    });
    renderProducts();
}
 
function renderProducts() {
    const container = document.getElementById('products-grid');
    if (!state.filtered.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">🔍</div>
                <div>No se encontraron productos.</div>
            </div>`;
        return;
    }
 
    container.innerHTML = state.filtered.map(p => {
        const outOfStock = p.stock <= 0;
        const lowStock   = p.stock > 0 && p.stock <= p.min_stock;
        return `
            <button class="product-card ${outOfStock ? 'out-of-stock' : ''}"
                    data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
                <div class="product-card-category">${escapeHTML(p.category_name || '—')}</div>
                <div class="product-card-name">${escapeHTML(p.name)}</div>
                <div class="product-card-price">${formatCurrency(p.price)}</div>
                <div class="product-card-stock ${lowStock ? 'low' : ''}">
                    ${outOfStock ? 'Sin stock' : `Stock: ${p.stock}`}
                </div>
            </button>`;
    }).join('');
 
    container.querySelectorAll('.product-card[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const product = state.products.find(p => p.id === parseInt(btn.dataset.id, 10));
            if (product) addToCart(product);
        });
    });
}
 
function addToCart(product) {
    const current = state.cart.get(product.id);
    const qty = current ? current.qty + 1 : 1;
    if (qty > product.stock) { toastWarning(`Stock disponible: ${product.stock}`); return; }
    state.cart.set(product.id, { product, qty });
    renderCart();
}
 
function changeQty(productId, delta) {
    const entry = state.cart.get(productId);
    if (!entry) return;
    const newQty = entry.qty + delta;
    if (newQty <= 0) {
        state.cart.delete(productId);
    } else if (newQty > entry.product.stock) {
        toastWarning(`Stock disponible: ${entry.product.stock}`);
        return;
    } else {
        entry.qty = newQty;
    }
    renderCart();
}
 
function removeFromCart(productId) {
    state.cart.delete(productId);
    renderCart();
}
 
function getCartTotals() {
    let subtotal = 0, itemCount = 0;
    for (const { product, qty } of state.cart.values()) {
        subtotal  += Number(product.price) * qty;
        itemCount += qty;
    }
    return { subtotal, total: subtotal, itemCount };
}
 
function renderCart() {
    const container = document.getElementById('cart-items');
    const totals    = getCartTotals();
 
    document.getElementById('cart-count').textContent    = totals.itemCount;
    document.getElementById('cart-subtotal').textContent = formatCurrency(totals.subtotal);
    document.getElementById('cart-total').textContent    = formatCurrency(totals.total);
    document.getElementById('btn-save-order').disabled   = state.cart.size === 0;
 
    if (state.cart.size === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <div>El carrito está vacío.</div>
                <div class="text-sm text-muted mt-2">Selecciona productos para comenzar.</div>
            </div>`;
        return;
    }
 
    container.innerHTML = Array.from(state.cart.values()).map(({ product, qty }) => `
        <div class="cart-item">
            <div>
                <div class="cart-item-name">${escapeHTML(product.name)}</div>
                <div class="cart-item-meta">${formatCurrency(product.price)} c/u</div>
            </div>
            <div class="cart-item-subtotal">${formatCurrency(Number(product.price) * qty)}</div>
            <div class="cart-item-controls">
                <button class="qty-btn" data-action="dec" data-id="${product.id}">−</button>
                <span class="qty-display">${qty}</span>
                <button class="qty-btn" data-action="inc" data-id="${product.id}">+</button>
                <button class="cart-item-remove" data-action="remove" data-id="${product.id}">Eliminar</button>
            </div>
        </div>
    `).join('');
 
    container.querySelectorAll('[data-action]').forEach(btn => {
        const id     = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        btn.addEventListener('click', () => {
            if (action === 'inc')         changeQty(id, +1);
            else if (action === 'dec')    changeQty(id, -1);
            else if (action === 'remove') removeFromCart(id);
        });
    });
}
 
// ─────────────────────────────────────────
//  Guardar pedido pendiente
// ─────────────────────────────────────────
 
async function confirmSaveOrder() {
    if (!state.selectedTable || state.cart.size === 0) return;
 
    const items = Array.from(state.cart.values()).map(({ product, qty }) => ({
        product_id: product.id,
        quantity:   qty,
    }));
    const notes = document.getElementById('order-notes').value.trim() || null;
 
    const btn = document.getElementById('btn-confirm-order');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';
 
    try {
        const res = await api.post('/orders', {
            table_id: state.selectedTable.id,
            items,
            notes,
        });
 
        toastSuccess(`Pedido ${res.data.order_number} guardado para ${state.selectedTable.label}.`);
        closeModal('save-order-modal');
        state.cart.clear();
        state.selectedTable = null;
 
        // Volver a la selección de mesas
        document.getElementById('step-pos').classList.add('hidden');
        document.getElementById('step-tables').classList.remove('hidden');
        await loadTables();
    } catch (err) {
        toastError(err.message);
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Guardar pedido';
    }
}