import { API_BASE } from './config.js';

export function getAuthHeaders() {
    const token = localStorage.getItem('draw_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export function updateAuthUI() {
    const token = localStorage.getItem('draw_token');
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        if (token) {
            authModal.classList.add('hidden');
        } else {
            authModal.classList.remove('hidden');
        }
    }
}

export async function login(email, password) {
    try {
        const resp = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await resp.json();
        if (resp.ok) {
            localStorage.setItem('draw_token', data.access_token);
            updateAuthUI();
            return { success: true };
        } else {
            return { success: false, error: data.error || "Error al iniciar sesión" };
        }
    } catch (err) {
        return { success: false, error: "Error de conexión con el servidor" };
    }
}

export async function register(email, password) {
    try {
        const resp = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await resp.json();
        if (resp.ok) {
            return { success: true };
        } else {
            return { success: false, error: data.error || "Error al registrarse" };
        }
    } catch (err) {
        return { success: false, error: "Error de conexión con el servidor" };
    }
}

// Processing
export async function procesarPlano(payload) {
    const resp = await fetch(`${API_BASE}/procesar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    return resp;
}

// Projects
export async function getProjects() {
    const resp = await fetch(`${API_BASE}/projects`, {
        headers: getAuthHeaders()
    });
    return resp;
}

export async function getProject(id) {
    const resp = await fetch(`${API_BASE}/projects/${id}`, {
        headers: getAuthHeaders()
    });
    return resp;
}

export async function saveProject(payload, id = null) {
    const url = id ? `${API_BASE}/projects/${id}` : `${API_BASE}/projects`;
    const method = id ? 'PUT' : 'POST';
    const resp = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    return resp;
}

export async function deleteProject(id) {
    const resp = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    return resp;
}
