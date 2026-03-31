import { login, register } from '../api.js';

export function setupAuth() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const res = await login(document.getElementById('login-email').value, document.getElementById('login-password').value);
            if (res.success) location.reload();
            else alert(res.error);
        };
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const res = await register(document.getElementById('register-email').value, document.getElementById('register-password').value);
            if (res.success) {
                alert("Registro exitoso. Ahora puedes iniciar sesión.");
                document.getElementById('switch-to-login').click();
            } else alert(res.error);
        };
    }
    
    document.getElementById('switch-to-register').onclick = () => {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'block';
    };
    document.getElementById('switch-to-login').onclick = () => {
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    };

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            localStorage.removeItem('draw_token');
            location.reload();
        };
    }
}
