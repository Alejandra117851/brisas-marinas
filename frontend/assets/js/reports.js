/**
 * reports.js
 * Módulo de Reportes (solo administrador).
 * Genera gráficos y tablas a partir de los endpoints de /api/reports.
 */
const reports = {
    from: daysAgoISO(29),
    to:   todayISO(),
    charts: {},
};

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('reports');
    if (!requireRole('administrador')) return;

    document.getElementById('date-from').value = reports.from;
    document.getElementById('date-to').value   = reports.to;
    document.getElementById('btn-apply-filter').addEventListener('click', () => {
        reports.from = document.getElementById('date-from').value;
        reports.to   = document.getElementById('date-to').value;
        if (!reports.from || !reports.to) {
            toastError('Debes seleccionar ambas fechas.');
            return;
        }
        loadAllReports();
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    await loadAllReports();
});

function applyPreset(preset) {
    let from = todayISO(), to = todayISO();
    switch (preset) {
        case 'today':       from = todayISO();        break;
        case 'week':        from = daysAgoISO(6);     break;
        case 'month':       from = daysAgoISO(29);    break;
        case 'quarter':     from = daysAgoISO(89);    break;
    }
    reports.from = from;
    reports.to   = to;
    document.getElementById('date-from').value = from;
    document.getElementById('date-to').value   = to;
    loadAllReports();
}

async function loadAllReports() {
    try {
        const params = { from: reports.from, to: reports.to };

        const [byDay, topProducts, byPayment, byCategory, byUser, sales] = await Promise.all([
            api.get('/reports/sales-by-day', params),
            api.get('/reports/top-products', { ...params, limit: 10 }),
            api.get('/reports/by-payment',   params),
            api.get('/reports/by-category',  params),
            api.get('/reports/by-user',      params),
            api.get('/sales', { ...params, limit: 50, status: 'completada' }),
        ]);

        renderTotals(byDay.data);
        renderSalesChart(byDay.data);
        renderTopProductsChart(topProducts.data);
        renderPaymentChart(byPayment.data);
        renderCategoryChart(byCategory.data);
        renderByUser(byUser.data);
        renderRecentSales(sales.data);
    } catch (err) {
        toastError(err.message);
    }
}

function renderTotals(items) {
    const totalRevenue = items.reduce((sum, d) => sum + Number(d.total_revenue), 0);
    const totalSales   = items.reduce((sum, d) => sum + parseInt(d.sales_count, 10), 0);
    const avgTicket    = totalSales > 0 ? totalRevenue / totalSales : 0;

    document.querySelector('#kpi-revenue .stat-value').textContent = formatCurrency(totalRevenue);
    document.querySelector('#kpi-sales .stat-value').textContent   = formatNumber(totalSales);
    document.querySelector('#kpi-ticket .stat-value').textContent  = formatCurrency(avgTicket);

    const days = items.length || 1;
    document.querySelector('#kpi-revenue .stat-meta').textContent =
        `≈ ${formatCurrency(totalRevenue / days)} / día`;
}

function destroyChart(key) {
    if (reports.charts[key]) {
        reports.charts[key].destroy();
        reports.charts[key] = null;
    }
}

/**
 * Oculta el canvas y muestra un mensaje "sin datos" sin destruirlo,
 * para que el próximo render con datos vuelva a dibujar el gráfico.
 */
function setChartEmpty(canvas, isEmpty, message) {
    const parent = canvas.parentElement;
    let emptyEl = parent.querySelector('.chart-empty');
    if (isEmpty) {
        canvas.style.display = 'none';
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state chart-empty';
            emptyEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
            emptyEl.textContent = message || 'Sin datos para mostrar.';
            parent.appendChild(emptyEl);
        }
    } else {
        canvas.style.display = '';
        if (emptyEl) emptyEl.remove();
    }
}

function renderSalesChart(items) {
    const canvas = document.getElementById('sales-chart');
    destroyChart('sales');

    const labels = items.map(i => {
        const d = new Date(i.date);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    });
    const data = items.map(i => Number(i.total_revenue));

    reports.charts.sales = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ingresos diarios',
                data,
                backgroundColor: 'rgba(56, 163, 165, 0.7)',
                borderColor: '#38a3a5',
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderTopProductsChart(items) {
    const canvas = document.getElementById('top-products-chart');
    destroyChart('topProducts');
    setChartEmpty(canvas, !items.length);
    if (!items.length) return;

    const labels = items.map(i => i.product_name);
    const data   = items.map(i => parseInt(i.total_quantity, 10));

    reports.charts.topProducts = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Unidades vendidas',
                data,
                backgroundColor: ['#0b2545','#134074','#13668c','#38a3a5','#b5e2ee','#e76f51','#f4a261','#2a9d8f','#5a6a7a','#8b97a8'],
                borderRadius: 6,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
        }
    });
}

function renderPaymentChart(items) {
    const canvas = document.getElementById('payment-chart');
    destroyChart('payment');
    setChartEmpty(canvas, !items.length);
    if (!items.length) return;

    const labels = items.map(i => {
        const map = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', nequi: 'Nequi', daviplata: 'Daviplata' };
        return map[i.payment_method] || i.payment_method;
    });
    const data = items.map(i => Number(i.total_revenue));

    reports.charts.payment = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#134074','#38a3a5','#e76f51','#f4a261','#13668c'],
                borderWidth: 2,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
            },
        }
    });
}

function renderCategoryChart(items) {
    const canvas = document.getElementById('category-chart');
    destroyChart('category');
    setChartEmpty(canvas, !items.length);
    if (!items.length) return;

    const labels = items.map(i => i.category_name);
    const data   = items.map(i => Number(i.total_revenue));

    reports.charts.category = new Chart(canvas, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#0b2545','#134074','#13668c','#38a3a5','#b5e2ee','#e76f51','#f4a261'],
                borderWidth: 2,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
            },
        }
    });
}

function renderByUser(items) {
    const container = document.getElementById('by-user-table');
    if (!items.length) {
        container.innerHTML = `<div class="empty-state">Sin datos.</div>`;
        return;
    }
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th class="text-center">Ventas</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(u => `
                    <tr>
                        <td><strong>${escapeHTML(u.full_name)}</strong></td>
                        <td>${roleBadge(u.role)}</td>
                        <td class="text-center">${formatNumber(u.sales_count)}</td>
                        <td class="text-right">${formatCurrency(u.total_revenue)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderRecentSales(items) {
    const container = document.getElementById('recent-sales-table');
    if (!items.length) {
        container.innerHTML = `<div class="empty-state">Sin ventas en el rango seleccionado.</div>`;
        return;
    }
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>N° Venta</th>
                    <th>Fecha</th>
                    <th>Atendido por</th>
                    <th>Pago</th>
                    <th>Estado</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(s => `
                    <tr>
                        <td><code>${escapeHTML(s.sale_number)}</code></td>
                        <td>${formatDateTime(s.created_at)}</td>
                        <td>${escapeHTML(s.user_name)}</td>
                        <td>${paymentBadge(s.payment_method)}</td>
                        <td>${statusBadge(s.status)}</td>
                        <td class="text-right font-semibold">${formatCurrency(s.total)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
