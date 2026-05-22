/**
 * utils.js
 * Funciones de utilidad usadas en toda la aplicación.
 */

// ----- Formato de moneda y números -----
const COP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('es-CO');

window.formatCurrency = (value) => COP.format(Number(value) || 0);
window.formatNumber   = (value) => NUM.format(Number(value) || 0);

// ----- Formato de fechas -----
window.formatDate = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

window.formatDateTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

window.todayISO = () => new Date().toISOString().slice(0, 10);

window.daysAgoISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
};

// ----- Toasts (notificaciones) -----
function ensureToastContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}

window.toast = (message, type = 'info', duration = 3500) => {
    const container = ensureToastContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 250);
    }, duration);
};

window.toastSuccess = (msg) => toast(msg, 'success');
window.toastError   = (msg) => toast(msg, 'error', 4500);
window.toastWarning = (msg) => toast(msg, 'warning');

// ----- Confirmaciones -----
window.confirmAction = async (message) => {
    return window.confirm(message);
};

// ----- Modal helpers -----
window.openModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
};

window.closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
};

// Cierre por overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Cierre por tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

// ----- Debounce -----
window.debounce = (fn, ms = 300) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
};

// ----- Sanitización básica para HTML -----
window.escapeHTML = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// ----- Badges para estados/roles -----
window.roleBadge = (role) => {
    const map = {
        administrador: 'badge-info',
        cajero:        'badge-success',
        empleado:      'badge-neutral',
    };
    return `<span class="badge ${map[role] || 'badge-neutral'}">${escapeHTML(role)}</span>`;
};

window.statusBadge = (status) => {
    const map = {
        completada: { class: 'badge-success', label: 'Completada' },
        anulada:    { class: 'badge-danger',  label: 'Anulada' },
    };
    const s = map[status] || { class: 'badge-neutral', label: status };
    return `<span class="badge ${s.class}">${escapeHTML(s.label)}</span>`;
};

window.paymentBadge = (method) => {
    const labels = {
        efectivo: 'Efectivo',
        transferencia: 'Transferencia',
        tarjeta: 'Tarjeta',
        nequi: 'Nequi',
        daviplata: 'Daviplata',
    };
    return `<span class="badge badge-neutral">${escapeHTML(labels[method] || method)}</span>`;
};
