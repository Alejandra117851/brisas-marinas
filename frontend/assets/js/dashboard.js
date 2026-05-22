/**
 * dashboard.js
 * Carga los KPIs y datos de resumen.
 * Si el usuario no es administrador, oculta los reportes y carga solo los KPIs básicos.
 */
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('dashboard');
    const user = api.getUser();
    if (!user) return;

    // Saludo personalizado
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
        const hour = new Date().getHours();
        const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
        greetingEl.textContent = `${saludo}, ${user.full_name.split(' ')[0]}.`;
    }

    // Solo administradores pueden ver el resumen completo de reportes.
    if (user.role !== 'administrador') {
        await loadBasicView();
        return;
    }

    await loadAdminDashboard();
});

async function loadAdminDashboard() {
    try {
        const [summary, lowStock, topProducts, salesByDay] = await Promise.all([
            api.get('/reports/summary'),
            api.get('/products/low-stock'),
            api.get('/reports/top-products', { limit: 5 }),
            api.get('/reports/sales-by-day', { from: daysAgoISO(13), to: todayISO() }),
        ]);

        renderKPIs(summary.data);
        renderLowStock(lowStock.data);
        renderTopProducts(topProducts.data);
        renderSalesChart(salesByDay.data);
    } catch (err) {
        toastError(err.message);
    }
}

async function loadBasicView() {
    // Para cajeros y empleados: solo mostrar accesos rápidos
    document.getElementById('admin-section')?.classList.add('hidden');
    document.getElementById('basic-section')?.classList.remove('hidden');
}

function renderKPIs(data) {
    const kpis = [
        { key: 'today-revenue',    value: formatCurrency(data.today.revenue),  label: 'Ventas hoy',      meta: `${data.today.sales} transacciones` },
        { key: 'week-revenue',     value: formatCurrency(data.week.revenue),   label: 'Ventas esta semana', meta: `${data.week.sales} transacciones` },
        { key: 'month-revenue',    value: formatCurrency(data.month.revenue),  label: 'Ventas este mes',    meta: `${data.month.sales} transacciones` },
        { key: 'average-ticket',   value: formatCurrency(data.average_ticket), label: 'Ticket promedio',    meta: 'Mes actual' },
        { key: 'active-products',  value: formatNumber(data.active_products),  label: 'Productos activos',  meta: '' },
        { key: 'low-stock',        value: formatNumber(data.low_stock_count),  label: 'Bajo stock',         meta: 'Requieren atención', highlight: data.low_stock_count > 0 },
    ];

    kpis.forEach(k => {
        const el = document.getElementById(k.key);
        if (!el) return;
        el.querySelector('.stat-value').textContent = k.value;
        const metaEl = el.querySelector('.stat-meta');
        if (metaEl) metaEl.textContent = k.meta;
        if (k.highlight) el.classList.add('coral');
    });
}

function renderLowStock(items) {
    const container = document.getElementById('low-stock-list');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding: var(--space-6);">
                <div class="empty-state-icon">✓</div>
                <div>Todos los productos tienen stock suficiente.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th class="text-center">Stock</th>
                    <th class="text-center">Mínimo</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(p => `
                    <tr>
                        <td>
                            <strong>${escapeHTML(p.name)}</strong>
                            <div class="text-sm text-muted">${escapeHTML(p.category_name || '')}</div>
                        </td>
                        <td class="text-center">
                            <span class="badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}">${p.stock}</span>
                        </td>
                        <td class="text-center text-muted">${p.min_stock}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderTopProducts(items) {
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `<div class="empty-state" style="padding: var(--space-6);">Aún no hay ventas registradas.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th class="text-center">Vendidos</th>
                    <th class="text-right">Ingresos</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((p, i) => `
                    <tr>
                        <td>
                            <strong>${i + 1}. ${escapeHTML(p.product_name)}</strong>
                        </td>
                        <td class="text-center font-semibold">${formatNumber(p.total_quantity)}</td>
                        <td class="text-right">${formatCurrency(p.total_revenue)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderSalesChart(items) {
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;

    const labels = items.map(i => {
        const d = new Date(i.date);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    });
    const data = items.map(i => Number(i.total_revenue));

    new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Ventas diarias',
                data,
                borderColor: '#38a3a5',
                backgroundColor: 'rgba(56, 163, 165, 0.12)',
                tension: 0.35,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#134074',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.parsed.y),
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatCurrency(v) },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}
