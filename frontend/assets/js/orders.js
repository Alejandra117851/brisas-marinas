/**
 * orders.js
 * Página de pedidos pendientes por mesa.
 * Permite ver detalle, cobrar, cancelar o modificar cada pedido.
 */

let currentOrderId = null;
let editOrderId = null;
let editOrderItems = [];    // copia mutable de los ítems mientras se edita
let editOriginalItems = []; // snapshot al abrir el modal (para calcular diff)
let allProducts = [];       // catálogo completo para el buscador

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('orders');
    await loadOrders();
    await loadProducts();
    setupListeners();
});

async function loadOrders() {
    const grid = document.getElementById('orders-grid');
    grid.innerHTML = '<div class="empty-state">Cargando pedidos…</div>';
    try {
        const res = await api.get('/orders', { status: 'pendiente' });
        renderOrders(res.data);
    } catch (err) {
        toastError(err.message);
        grid.innerHTML = '<div class="empty-state">Error al cargar pedidos.</div>';
    }
}

async function loadProducts() {
    try {
        const res = await api.get('/products', { active: true });
        allProducts = res.data || [];
    } catch (err) {
        allProducts = [];
    }
}

function renderOrders(orders) {
    const grid = document.getElementById('orders-grid');
    if (!orders.length) {
        grid.innerHTML = `
            <div class="empty-state full-width">
                <div class="empty-state-icon">🍽️</div>
                <div>No hay pedidos pendientes.</div>
                <div class="text-sm text-muted mt-2">Los pedidos aparecerán aquí cuando se registren desde Ventas.</div>
            </div>`;
        return;
    }

    grid.innerHTML = orders.map(order => {
        const itemsHTML = order.items.map(i =>
            `<div class="order-item-row">
                <span>${escapeHTML(i.product_name)} × ${i.quantity}</span>
                <span>${formatCurrency(i.subtotal)}</span>
             </div>`
        ).join('');

        return `
            <div class="order-card" data-id="${order.id}">
                <div class="order-card-header">
                    <div class="order-table-badge">${escapeHTML(order.table_label)}</div>
                    <div class="order-number">${escapeHTML(order.order_number)}</div>
                </div>
                <div class="order-card-time">⏱ ${formatDateTime(order.created_at)}</div>
                <div class="order-card-items">${itemsHTML}</div>
                <div class="order-card-total">
                    <span>Total</span>
                    <strong>${formatCurrency(order.total)}</strong>
                </div>
                ${order.notes ? `<div class="order-card-notes">📝 ${escapeHTML(order.notes)}</div>` : ''}
                <div class="order-card-actions">
                    <button class="btn btn-ghost btn-sm" data-action="cancel" data-id="${order.id}">
                        Cancelar
                    </button>
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${order.id}"
                            data-items='${escapeHTML(JSON.stringify(order.items))}'>
                        ✏️ Editar
                    </button>
                    <button class="btn btn-accent btn-sm" data-action="pay" data-id="${order.id}"
                            data-total="${order.total}" data-label="${escapeHTML(order.table_label)}"
                            data-number="${escapeHTML(order.order_number)}">
                        💳 Cobrar
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Eventos
    grid.querySelectorAll('[data-action="pay"]').forEach(btn => {
        btn.addEventListener('click', () => openPayModal(btn));
    });

    grid.querySelectorAll('[data-action="cancel"]').forEach(btn => {
        btn.addEventListener('click', () => cancelOrder(parseInt(btn.dataset.id, 10)));
    });

    grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn));
    });
}

function setupListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadOrders);
    document.getElementById('pay-form').addEventListener('submit', submitPay);
    document.getElementById('pay-method').addEventListener('change', updatePayChange);
    document.getElementById('pay-received').addEventListener('input', updatePayChange);

    // Edit modal listeners
    document.getElementById('edit-product-search').addEventListener('input', renderProductSearch);
    document.getElementById('btn-confirm-edit').addEventListener('click', submitEdit);
}

// ── Editar pedido ──────────────────────────────────────
function openEditModal(btn) {
    editOrderId = parseInt(btn.dataset.id, 10);

    // Parsear los ítems actuales del pedido
    try {
        editOrderItems = JSON.parse(btn.dataset.items).map(i => ({
            product_id:   i.product_id,
            product_name: i.product_name,
            price:        i.price ?? (i.subtotal / i.quantity),
            quantity:     i.quantity,
        }));
        // snapshot para calcular el diff al guardar
        editOriginalItems = editOrderItems.map(i => ({ ...i }));
    } catch {
        editOrderItems = [];
    }

    document.getElementById('edit-product-search').value = '';
    renderEditItems();
    renderProductSearch();
    openModal('edit-modal');
}

function renderEditItems() {
    const container = document.getElementById('edit-current-items');
    if (!editOrderItems.length) {
        container.innerHTML = '<div class="text-sm text-muted">Sin productos aún.</div>';
        updateEditTotal();
        return;
    }

    container.innerHTML = editOrderItems.map((item, idx) => `
        <div class="edit-item-row">
            <span class="edit-item-name">${escapeHTML(item.product_name)}</span>
            <div class="edit-item-controls">
                <button class="qty-btn" data-action="dec" data-idx="${idx}">−</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" data-action="inc" data-idx="${idx}">+</button>
                <button class="qty-btn qty-btn-remove" data-action="remove" data-idx="${idx}">🗑</button>
            </div>
            <span class="edit-item-subtotal">${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');

    container.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx    = parseInt(btn.dataset.idx, 10);
            const action = btn.dataset.action;
            if (action === 'inc') {
                editOrderItems[idx].quantity += 1;
            } else if (action === 'dec') {
                editOrderItems[idx].quantity -= 1;
                if (editOrderItems[idx].quantity <= 0) editOrderItems.splice(idx, 1);
            } else if (action === 'remove') {
                editOrderItems.splice(idx, 1);
            }
            renderEditItems();
        });
    });

    updateEditTotal();
}

function updateEditTotal() {
    const total = editOrderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    document.getElementById('edit-total').textContent = formatCurrency(total);
}

function renderProductSearch() {
    const query   = document.getElementById('edit-product-search').value.toLowerCase().trim();
    const results = document.getElementById('edit-product-results');

    const filtered = query
        ? allProducts.filter(p => p.name.toLowerCase().includes(query))
        : allProducts.slice(0, 12); // muestra los primeros 12 si no hay búsqueda

    if (!filtered.length) {
        results.innerHTML = '<div class="text-sm text-muted">Sin resultados.</div>';
        return;
    }

    results.innerHTML = filtered.map(p => `
        <button class="product-chip" data-id="${p.id}" data-name="${escapeHTML(p.name)}" data-price="${p.price}">
            <span class="product-chip-name">${escapeHTML(p.name)}</span>
            <span class="product-chip-price">${formatCurrency(p.price)}</span>
        </button>
    `).join('');

    results.querySelectorAll('.product-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            addProductToEdit({
                product_id:   parseInt(chip.dataset.id, 10),
                product_name: chip.dataset.name,
                price:        Number(chip.dataset.price),
            });
        });
    });
}

function addProductToEdit(product) {
    const existing = editOrderItems.find(i => i.product_id === product.product_id);
    if (existing) {
        existing.quantity += 1;
    } else {
        editOrderItems.push({ ...product, quantity: 1 });
    }
    renderEditItems();
}

async function submitEdit() {
    if (!editOrderId) return;
    if (!editOrderItems.length) {
        toastError('El pedido debe tener al menos un producto.');
        return;
    }

    // Solo enviamos los ítems que se agregaron o cuya cantidad aumentó
    const newItems = editOrderItems
        .map(i => {
            const original = editOriginalItems.find(o => o.product_id === i.product_id);
            const diff = i.quantity - (original ? original.quantity : 0);
            return diff > 0 ? { product_id: i.product_id, quantity: diff } : null;
        })
        .filter(Boolean);

    if (!newItems.length) {
        toastError('No hay productos nuevos para agregar.');
        return;
    }

    const btn = document.getElementById('btn-confirm-edit');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    try {
        await api.post(`/orders/${editOrderId}/add-items`, { items: newItems });
        toastSuccess('Pedido actualizado correctamente.');
        closeModal('edit-modal');
        await loadOrders();
    } catch (err) {
        toastError(err.message);
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Guardar cambios';
    }
}

// ── Cobro ──────────────────────────────────────────────
function openPayModal(btn) {
    currentOrderId = parseInt(btn.dataset.id, 10);
    const total    = Number(btn.dataset.total);
    const label    = btn.dataset.label;
    const number   = btn.dataset.number;

    document.getElementById('pay-modal-title').textContent = `Cobrar — ${label} (${number})`;
    document.getElementById('pay-total').textContent       = formatCurrency(total);
    document.getElementById('pay-total').dataset.total     = total;
    document.getElementById('pay-received').value          = '';
    document.getElementById('pay-customer').value          = '';
    document.getElementById('pay-method').value            = 'efectivo';
    document.getElementById('pay-received-group').classList.remove('hidden');
    document.getElementById('pay-change').classList.add('hidden');

    openModal('pay-modal');
}

function updatePayChange() {
    const method   = document.getElementById('pay-method').value;
    const group    = document.getElementById('pay-received-group');
    const changeEl = document.getElementById('pay-change');

    if (method !== 'efectivo') {
        group.classList.add('hidden');
        changeEl.classList.add('hidden');
        return;
    }
    group.classList.remove('hidden');

    const total    = Number(document.getElementById('pay-total').dataset.total) || 0;
    const received = Number(document.getElementById('pay-received').value) || 0;

    if (received >= total && received > 0) {
        changeEl.textContent = `Cambio a devolver: ${formatCurrency(received - total)}`;
        changeEl.classList.remove('hidden');
    } else {
        changeEl.classList.add('hidden');
    }
}

async function submitPay(e) {
    e.preventDefault();
    if (!currentOrderId) return;

    const payment_method  = document.getElementById('pay-method').value;
    const amount_received = payment_method === 'efectivo'
        ? Number(document.getElementById('pay-received').value) || null
        : null;
    const customer_name   = document.getElementById('pay-customer').value.trim() || null;
    const total           = Number(document.getElementById('pay-total').dataset.total);

    if (payment_method === 'efectivo' && amount_received !== null && amount_received < total) {
        toastError('El monto recibido es menor al total.');
        return;
    }

    const btn = document.getElementById('btn-confirm-pay');
    btn.disabled    = true;
    btn.textContent = 'Procesando…';

    try {
        const res = await api.post(`/orders/${currentOrderId}/pay`, {
            payment_method, amount_received, customer_name,
        });
        toastSuccess(`Venta ${res.data.sale_number} registrada correctamente.`);
        closeModal('pay-modal');
        showReceipt(res.data);
        await loadOrders();
    } catch (err) {
        toastError(err.message);
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Confirmar cobro';
    }
}

// ── Cancelar ───────────────────────────────────────────
async function cancelOrder(id) {
    if (!confirm('¿Cancelar este pedido? Se liberará la mesa y se repondrá el stock.')) return;
    try {
        await api.post(`/orders/${id}/cancel`, {});
        toastSuccess('Pedido cancelado y mesa liberada.');
        await loadOrders();
    } catch (err) {
        toastError(err.message);
    }
}

// ── Comprobante ────────────────────────────────────────
function showReceipt(sale) {
    const container = document.getElementById('receipt-content');
    const itemsHTML = (sale.items || []).map(i => `
        <tr>
            <td>${escapeHTML(i.product_name)}</td>
            <td class="text-center">${i.quantity}</td>
            <td class="text-right">${formatCurrency(i.subtotal)}</td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="text-center mb-4">
            <h3 style="font-family:var(--font-display)">Restaurante Brisas Marinas</h3>
            <div class="text-sm text-soft">Comprobante de venta</div>
            <div class="text-sm font-semibold mt-2">${escapeHTML(sale.sale_number)}</div>
            <div class="text-sm text-muted">${formatDateTime(sale.created_at || new Date().toISOString())}</div>
        </div>
        <table class="table">
            <thead><tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-right">Subtotal</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
        </table>
        <div class="mt-4">
            <div class="totals-row total"><span>Total:</span><span>${formatCurrency(sale.total)}</span></div>
            <div class="totals-row"><span>Forma de pago:</span><span>${paymentBadge(sale.payment_method)}</span></div>
            ${sale.amount_received ? `
                <div class="totals-row"><span>Recibido:</span><span>${formatCurrency(sale.amount_received)}</span></div>
                <div class="totals-row"><span>Cambio:</span><span>${formatCurrency(sale.change_given || 0)}</span></div>
            ` : ''}
        </div>`;
    openModal('receipt-modal');
}