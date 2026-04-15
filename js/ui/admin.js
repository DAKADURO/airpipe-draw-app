import { getUsers, updateUser, deleteUser } from '../api.js';

export function setupAdminPortal() {
    const btnAdmin = document.getElementById('btn-admin-portal');
    const adminModal = document.getElementById('admin-modal');
    const btnClose = document.getElementById('btn-close-admin');
    const usersList = document.getElementById('admin-users-list');

    if (!btnAdmin) return;

    btnAdmin.onclick = async () => {
        adminModal.classList.remove('hidden');
        await refreshUsersList();
    };

    btnClose.onclick = () => {
        adminModal.classList.add('hidden');
    };

    async function refreshUsersList() {
        usersList.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando usuarios...</td></tr>';
        
        try {
            const resp = await getUsers();
            if (!resp.ok) throw new Error("No se pudo cargar la lista de usuarios");
            
            const users = await resp.json();
            usersList.innerHTML = '';
            
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.email}</td>
                    <td>
                        <select class="status-select" data-id="${user.id}" style="background:#0F3460; color:white; border:1px solid #1A4A8A; border-radius:4px; padding:2px;">
                            <option value="true" ${user.is_approved ? 'selected' : ''}>Aprobado</option>
                            <option value="false" ${!user.is_approved ? 'selected' : ''}>Pendiente</option>
                        </select>
                    </td>
                    <td>
                        <select class="role-select" data-id="${user.id}" style="background:#0F3460; color:white; border:1px solid #1A4A8A; border-radius:4px; padding:2px;">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>
                        <button class="action-btn delete-user-btn" data-id="${user.id}" style="color:#e57373; border-color:#5a2020;">Eliminar</button>
                    </td>
                `;
                
                // Eventos de cambio
                tr.querySelector('.status-select').onchange = (e) => handleUpdate(user.id, { is_approved: e.target.value === 'true' });
                tr.querySelector('.role-select').onchange = (e) => handleUpdate(user.id, { role: e.target.value });
                tr.querySelector('.delete-user-btn').onclick = () => handleDelete(user.id, user.email);
                
                usersList.appendChild(tr);
            });
        } catch (err) {
            usersList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#e57373;">${err.message}</td></tr>`;
        }
    }

    async function handleUpdate(id, data) {
        try {
            const resp = await updateUser(id, data);
            if (!resp.ok) {
                const errData = await resp.json();
                alert("Error al actualizar: " + (errData.error || "Desconocido"));
                await refreshUsersList();
            }
        } catch (err) {
            alert("Error de conexión");
        }
    }

    async function handleDelete(id, email) {
        if (!confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) return;
        
        try {
            const resp = await deleteUser(id);
            if (resp.ok) {
                await refreshUsersList();
            } else {
                alert("Error al eliminar usuario");
            }
        } catch (err) {
            alert("Error de conexión");
        }
    }
}
