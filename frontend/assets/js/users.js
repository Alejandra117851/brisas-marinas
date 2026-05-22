/**
 * users.js
 * Módulo de Usuarios (solo administrador).
 */
const usersState = {
    users: [],
    filter: { role: '', active: '', search: '' },
    editingId: null,
    resetId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar('users');
    if (!requireRole('administrador')) return;

    await loadUsers();
    setupListeners();
});

async function loadUsers() {
    try {
        const params = {};
        if (usersState.filter.role)    params.role   = usersState.filter.role;
        if (usersState.filter.active)  params.active = usersState.filter.active;
        if (usersState.filter.search)  params.search = usersState.filter.search;

        const res = await api.get('/users', params);
        usersState.users = res.data;
        renderTable();
    } catch (err) {
        toastError(err.message);
    }
}

function setupListeners() {
    document.getElementById('user-search').addEventListener('input', debounce((e) => {
        usersState.filter.search = e.target.value.trim();
        loadUsers();
    }, 300));

    document.getElementById('role-filter').addEventListener('change', (e) => {
        usersState.filter.role = e.target.value;
        loadUsers();
    });

    document.getElementById('active-filter').addEventListener('change', (e) => {
        usersState.filter.active = e.target.value;
        loadUsers();
    });

    document.getElementById('btn-new-user').addEventListener('click', openNewUser);
    document.getElementById('user-form').addEventListener('submit', submitUser);
    document.getElementById('reset-form').addEventListener('submit', submitReset);
}

function renderTable() {
    const tbody = document.getElementById('users-tbody');
    if (!usersState.users.length) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div>No hay usuarios para mostrar.</div>
                </div>
            </td></tr>
        `;
        return;
    }

    const currentUserId = api.getUser()?.id;

    tbody.innerHTML = usersState.users.map(u => `
        <tr>
            <td>
                <div class="font-semibold">${escapeHTML(u.full_name)}</div>
                <div class="text-sm text-muted">@${escapeHTML(u.username)}</div>
            </td>
            <td>${escapeHTML(u.email || '—')}</td>
            <td>${roleBadge(u.role)}</td>
            <td>${u.is_active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-neutral">Inactivo</span>'}</td>
            <td class="text-sm text-muted">${formatDate(u.created_at)}</td>
            <td class="text-right">
                <button class="btn btn-sm btn-outline" onclick="openEditUser(${u.id})">✏️ Editar</button>
                <button class="btn btn-sm btn-ghost"   onclick="openResetPassword(${u.id})">🔑</button>
                ${u.id !== currentUserId
                    ? `<button class="btn btn-sm btn-ghost" onclick="deactivateUser(${u.id})">🗑️</button>`
                    : ''}
            </td>
        </tr>
    `).join('');
}

function openNewUser() {
    usersState.editingId = null;
    document.getElementById('user-modal-title').textContent = 'Nuevo usuario';
    document.getElementById('user-form').reset();
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-password-group').classList.remove('hidden');
    document.getElementById('form-password').required = true;
    document.getElementById('form-active-group').classList.add('hidden');
    openModal('user-modal');
}

window.openEditUser = function (id) {
    const u = usersState.users.find(x => x.id === id);
    if (!u) return;
    usersState.editingId = id;
    document.getElementById('user-modal-title').textContent = 'Editar usuario';
    document.getElementById('form-username').value  = u.username;
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-full-name').value = u.full_name;
    document.getElementById('form-role').value      = u.role;
    document.getElementById('form-active').checked  = u.is_active;
    document.getElementById('form-password-group').classList.add('hidden');
    document.getElementById('form-password').required = false;
    document.getElementById('form-active-group').classList.remove('hidden');
    openModal('user-modal');
};

async function submitUser(e) {
    e.preventDefault();
    const payload = {
        username:  document.getElementById('form-username').value.trim(),
        full_name: document.getElementById('form-full-name').value.trim(),
        role:      document.getElementById('form-role').value,
    };

    try {
        if (usersState.editingId) {
    payload.is_active = document.getElementById('form-active').checked;
    await api.put(`/users/${usersState.editingId}`, payload);
            toastSuccess('Usuario actualizado.');
        } else {
            payload.username = document.getElementById('form-username').value.trim();
            payload.password = document.getElementById('form-password').value;
            await api.post('/users', payload);
            toastSuccess('Usuario creado correctamente.');
        }
        closeModal('user-modal');
        await loadUsers();
    } catch (err) {
        toastError(err.message);
    }
}

window.openResetPassword = function (id) {
    usersState.resetId = id;
    const u = usersState.users.find(x => x.id === id);
    document.getElementById('reset-user-name').textContent = u ? u.full_name : '';
    document.getElementById('reset-form').reset();
    openModal('reset-modal');
};

async function submitReset(e) {
    e.preventDefault();
    const newPass = document.getElementById('reset-password').value;
    if (newPass.length < 6) {
        toastError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    try {
        await api.put(`/users/${usersState.resetId}/reset-password`, { new_password: newPass });
        toastSuccess('Contraseña restablecida.');
        closeModal('reset-modal');
    } catch (err) {
        toastError(err.message);
    }
}

window.deactivateUser = async function (id) {
    if (!confirm('¿Desactivar este usuario? No podrá iniciar sesión hasta que se reactive.')) return;
    try {
        await api.delete(`/users/${id}`);
        toastSuccess('Usuario desactivado.');
        await loadUsers();
    } catch (err) {
        toastError(err.message);
    }
};
