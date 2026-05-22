/**
 * api.js
 * Cliente HTTP centralizado para comunicarse con el backend.
 * Maneja automáticamente el token JWT y los errores.
 */
// Por defecto usa ruta relativa (/api) — funciona cuando el backend sirve el
// frontend. Para servir el frontend por separado, define window.API_BASE_URL
// (p. ej. en un <script>) antes de cargar api.js.
const API_BASE_URL = 'https://brisas-marinas-backend.onrender.com/api';

const TOKEN_KEY = 'bm_token';
const USER_KEY  = 'bm_user';

const api = {
    // ----- Gestión de sesión -----
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    },
    setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
    },
    clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },
    getUser() {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },
    setUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    isAuthenticated() {
        return !!this.getToken();
    },

    // ----- Request genérico -----
    async request(path, options = {}) {
        const url = `${API_BASE_URL}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = {
            method: options.method || 'GET',
            headers,
        };
        if (options.body) config.body = JSON.stringify(options.body);

        let response;
        try {
            response = await fetch(url, config);
        } catch (err) {
            throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
        }

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            // respuesta no JSON
        }

        if (response.status === 401 && path !== '/auth/login') {
            this.clearToken();
            window.location.href = '/index.html';
            throw new Error('Sesión expirada.');
        }

        if (!response.ok) {
            const message = data.message || `Error HTTP ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            error.errors = data.errors;
            throw error;
        }

        return data;
    },

    get(path, params)         {
        if (params) {
            const qs = new URLSearchParams(params).toString();
            path += (path.includes('?') ? '&' : '?') + qs;
        }
        return this.request(path);
    },
    post(path, body)          { return this.request(path, { method: 'POST',   body }); },
    put(path, body)           { return this.request(path, { method: 'PUT',    body }); },
    patch(path, body)         { return this.request(path, { method: 'PATCH',  body }); },
    delete(path)              { return this.request(path, { method: 'DELETE' }); },
};

// Exponer en window
window.api = api;
