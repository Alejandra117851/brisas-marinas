/**
 * auth.js
 * - Guard de páginas (redirige a /index.html si no hay sesión).
 * - Renderiza el sidebar con drawer móvil integrado.
 * - Aplica visibilidad por rol a los enlaces del menú.
 */

(function () {
    const PUBLIC_PATHS = ['/index.html', '/', ''];
    const isPublic = PUBLIC_PATHS.some(p =>
        window.location.pathname === p || window.location.pathname.endsWith('/index.html')
    );

    if (!isPublic && !api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    if (isPublic && api.isAuthenticated()) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
})();

/**
 * Inyecta el overlay y el botón hamburguesa en el <body> si no existen ya.
 * De esta forma cualquier página los tiene sin tocar su HTML.
 */
function ensureMobileUI() {
    if (!document.getElementById('sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    if (!document.getElementById('mobile-menu-btn')) {
        const btn = document.createElement('button');
        btn.className = 'mobile-menu-btn';
        btn.id = 'mobile-menu-btn';
        btn.setAttribute('aria-label', 'Abrir menú');
        btn.innerHTML = '☰';
        document.body.appendChild(btn);
    }
}

/**
 * Inicializa la lógica de apertura/cierre del drawer.
 */
function initDrawer() {
    const btn     = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (!btn || !sidebar || !overlay) return;

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    btn.addEventListener('click', openSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Cerrar al navegar (clic en enlace del sidebar)
    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
}

/**
 * Renderiza el sidebar de navegación.
 * Llamar después de DOMContentLoaded.
 */
function renderSidebar(activePage) {
    const user = api.getUser();
    if (!user) return;

    const isAdmin = user.role === 'administrador';

    const items = [
        { key: 'dashboard', href: '/pages/dashboard.html', icon: '📊', label: 'Dashboard'  },
        { key: 'sales',     href: '/pages/sales.html',     icon: '🧾', label: 'Ventas'     },
        { key: 'inventory', href: '/pages/inventory.html', icon: '📦', label: 'Inventario' },
        { key: 'orders',    href: '/pages/orders.html',    icon: '🍽️', label: 'Pedidos'    },
        { key: 'reports',   href: '/pages/reports.html',   icon: '📈', label: 'Reportes',  show: isAdmin },
        { key: 'users',     href: '/pages/users.html',     icon: '👥', label: 'Usuarios',  show: isAdmin },
    ];

    const navHTML = items
        .filter(i => i.show !== false)
        .map(i => `
            <a class="nav-link ${i.key === activePage ? 'active' : ''}" href="${i.href}">
                <span class="nav-link-icon">${i.icon}</span>
                <span>${i.label}</span>
            </a>
        `).join('');

    const container = document.getElementById('sidebar');
    if (!container) return;

    container.innerHTML = `
        <div class="sidebar-brand">
            <div class="sidebar-brand-icon">
                <img src="/assets/img/logo.png" alt="Brisas Marinas">
            </div>
            <div>
                <div class="sidebar-brand-name">Brisas Marinas</div>
                <div class="sidebar-brand-sub">Restaurante</div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <div class="sidebar-nav-title">Menú principal</div>
            ${navHTML}
        </nav>

        <div class="sidebar-user">
            <div class="sidebar-user-name">${escapeHTML(user.full_name)}</div>
            <div class="sidebar-user-role">${escapeHTML(user.role)}</div>
            <button class="btn-logout" id="btn-logout">Cerrar sesión</button>
        </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) {
            api.clearToken();
            window.location.href = '/index.html';
        }
    });

    // Inyectar UI móvil y activar drawer
    ensureMobileUI();
    initDrawer();
}

function requireRole(...roles) {
    const user = api.getUser();
    if (!user || !roles.includes(user.role)) {
        toastError('No tienes permisos para acceder a esta sección.');
        setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 1500);
        return false;
    }
    return true;
}

window.renderSidebar = renderSidebar;
window.requireRole   = requireRole;