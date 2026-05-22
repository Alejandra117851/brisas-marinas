/**
 * inventory.js
 * Gestión de productos: listar, crear, editar, ajustar stock, desactivar.
 */
const inv = {
    products: [],
    categories: [],
    filter: { search: '', category: '', lowStock: false },
    editingId: null,
    adjustingId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('inventory');
    const user = api.getUser();
    inv.isAdmin = user?.role === 'administrador';

    // Si no es admin, oculta los botones de acción
    if (!inv.isAdmin) {
        document.body.classList.add('readonly');
    }

    await loadAll();
    setupListeners();
});

async function loadAll() {
    try {
        const [pRes, cRes] = await Promise.all([
            api.get('/products', buildQuery()),
            api.get('/categories'),
        ]);
        inv.products = pRes.data;
        inv.categories = cRes.data;
        renderCategoryFilter();
        renderTable();
        populateCategorySelect('form-category');
    } catch (err) {
        toastError(err.message);
    }
}

function buildQuery() {
    const q = {};
    if (inv.filter.search)    q.search = inv.filter.search;
    if (inv.filter.category)  q.category = inv.filter.category;
    if (inv.filter.lowStock)  q.low_stock = 'true';
    return q;
}

function setupListeners() {
    document.getElementById('search-input').addEventListener('input', debounce((e) => {
        inv.filter.search = e.target.value.trim();
        loadAll();
    }, 300));

    document.getElementById('category-filter').addEventListener('change', (e) => {
        inv.filter.category = e.target.value;
        loadAll();
    });

    document.getElementById('low-stock-filter').addEventListener('change', (e) => {
        inv.filter.lowStock = e.target.checked;
        loadAll();
    });

    document.getElementById('btn-new-product').addEventListener('click', openNewProduct);
    document.getElementById('product-form').addEventListener('submit', submitProduct);
    document.getElementById('stock-form').addEventListener('submit', submitStockAdjustment);
}

function renderCategoryFilter() {
    const sel = document.getElementById('category-filter');
    const current = inv.filter.category;
    sel.innerHTML = `
        <option value="">Todas las categorías</option>
        ${inv.categories.map(c => `<option value="${c.id}" ${String(c.id) === String(current) ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
    `;
}

function populateCategorySelect(elementId) {
    const sel = document.getElementById(elementId);
    if (!sel) return;
    sel.innerHTML = `
        <option value="">Sin categoría</option>
        ${inv.categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}
    `;
}

function renderTable() {
    const tbody = document.getElementById('products-tbody');
    if (!inv.products.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${inv.isAdmin ? 7 : 6}">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div>No hay productos para mostrar.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = inv.products.map(p => {
        const stockBadge = p.stock === 0
            ? `<span class="badge badge-danger">${p.stock}</span>`
            : p.stock <= p.min_stock
                ? `<span class="badge badge-warning">${p.stock}</span>`
                : `<span class="badge badge-success">${p.stock}</span>`;

        const actions = inv.isAdmin ? `
            <td class="text-right">
                <button class="btn btn-sm btn-outline" onclick="openAdjustStock(${p.id})">📊 Stock</button>
                <button class="btn btn-sm btn-ghost" onclick="openEditProduct(${p.id})">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="deactivateProduct(${p.id})">🗑️</button>
            </td>
        ` : '';

        return `
            <tr>
                <td>
                    <div class="font-semibold">${escapeHTML(p.name)}</div>
                    <div class="text-sm text-muted">${escapeHTML(p.code || '—')}</div>
                </td>
                <td>${escapeHTML(p.category_name || '—')}</td>
                <td>${formatCurrency(p.price)}</td>
                <td class="text-center">${stockBadge}</td>
                <td class="text-center text-muted">${p.min_stock}</td>
                <td>${p.is_active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-neutral">Inactivo</span>'}</td>
                ${actions}
            </tr>
        `;
    }).join('');
}

function openNewProduct() {
    if (!inv.isAdmin) return;
    inv.editingId = null;
    document.getElementById('product-modal-title').textContent = 'Nuevo producto';
    document.getElementById('product-form').reset();
    document.getElementById('form-stock-group').classList.remove('hidden');

    // Generar código automático PRD-001, PRD-002, etc.
    const next = String(inv.products.length + 1).padStart(3, '0');
    document.getElementById('form-code').value = `PRD-${next}`;

    openModal('product-modal');
}

window.openEditProduct = function (id) {
    const p = inv.products.find(x => x.id === id);
    if (!p) return;
    inv.editingId = id;
    document.getElementById('product-modal-title').textContent = 'Editar producto';
    document.getElementById('form-code').value        = p.code || '';
    document.getElementById('form-name').value        = p.name;
    document.getElementById('form-description').value = p.description || '';
    document.getElementById('form-category').value    = p.category_id || '';
    document.getElementById('form-price').value       = p.price;
    document.getElementById('form-cost').value        = p.cost || 0;
    document.getElementById('form-min-stock').value   = p.min_stock;
    document.getElementById('form-unit').value        = p.unit || 'unidad';
    document.getElementById('form-stock-group').classList.add('hidden');
    openModal('product-modal');
};

async function submitProduct(e) {
    e.preventDefault();
    const payload = {
        code:        document.getElementById('form-code').value.trim() || null,
        name:        document.getElementById('form-name').value.trim(),
        description: document.getElementById('form-description').value.trim() || null,
        category_id: parseInt(document.getElementById('form-category').value, 10) || null,
        price:       parseFloat(document.getElementById('form-price').value),
        cost:        parseFloat(document.getElementById('form-cost').value) || 0,
        min_stock:   parseInt(document.getElementById('form-min-stock').value, 10) || 5,
        unit:        document.getElementById('form-unit').value || 'unidad',
    };

    if (inv.editingId === null) {
        payload.stock = parseInt(document.getElementById('form-stock').value, 10) || 0;
    }

    try {
        if (inv.editingId) {
            await api.put(`/products/${inv.editingId}`, payload);
            toastSuccess('Producto actualizado.');
        } else {
            await api.post('/products', payload);
            toastSuccess('Producto creado.');
        }
        closeModal('product-modal');
        await loadAll();
    } catch (err) {
        toastError(err.message);
    }
}

window.openAdjustStock = function (id) {
    const p = inv.products.find(x => x.id === id);
    if (!p) return;
    inv.adjustingId = id;
    document.getElementById('adjust-product-name').textContent = p.name;
    document.getElementById('adjust-current-stock').textContent = p.stock;
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-reason').value = '';
    document.getElementById('adjust-type').value = 'in';
    openModal('stock-modal');
};

async function submitStockAdjustment(e) {
    e.preventDefault();
    const type   = document.getElementById('adjust-type').value;
    const amount = parseInt(document.getElementById('adjust-amount').value, 10);
    const reason = document.getElementById('adjust-reason').value.trim() || null;

    if (!amount || amount <= 0) {
        toastError('Ingresa una cantidad válida.');
        return;
    }

    const adjustment = type === 'in' ? amount : -amount;

    try {
        await api.patch(`/products/${inv.adjustingId}/stock`, { adjustment, reason });
        toastSuccess('Stock ajustado correctamente.');
        closeModal('stock-modal');
        await loadAll();
    } catch (err) {
        toastError(err.message);
    }
}

window.deactivateProduct = async function (id) {
    if (!confirm('¿Desactivar este producto? No se eliminará del historial.')) return;
    try {
        await api.delete(`/products/${id}`);
        toastSuccess('Producto desactivado.');
        await loadAll();
    } catch (err) {
        toastError(err.message);
    }
};
