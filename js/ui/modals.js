import { state, invalidateSnapCache } from '../state.js';
import { saveProject, getProjects, getProject, deleteProject } from '../api.js';
import { setStatus } from './tools.js';
import { syncIsometricUI } from './scene_panel.js';

export function serializeProjectData() {
    return {
        lineas: state.historial.filter(a => a.tipo === 'linea').map(a => a.datos),
        nodos: state.historial.filter(a => a.tipo === 'nodo').map(a => a.datos),
        valvulas_manuales: state.historial.filter(a => a.tipo === 'valvula_manual').map(a => a.datos),
        notas: state.historial.filter(a => a.tipo === 'nota').map(a => a.datos),
        historial: state.historial,
        viewState: state.viewState,
        tipo_red: document.getElementById('select-tipo-red').value,
        caudal_scfm: parseFloat(document.getElementById('input-caudal').value) || 0,
        bgBase64: state.bgBase64,
        bgUrl: state.bgUrl,
        bgOpacity: state.bgOpacity,
        bgScale: state.bgScale,
        bgLines: (state.bgLines instanceof Float32Array) ? Array.from(state.bgLines) : state.bgLines,
        isIsometric: state.viewState.isIsometric,
        currentZ: state.viewState.currentZ
    };
}

export function restoreProjectData(data) {
    state.lineas = data.lineas || [];
    state.nodos = data.nodos || [];
    state.valvulasManuales = data.valvulas_manuales || [];
    state.historial = data.historial || [];
    invalidateSnapCache();
    if (data.viewState) {
        state.viewState.scale = data.viewState.scale || 1.0;
        state.viewState.offsetX = data.viewState.offsetX || 0;
        state.viewState.offsetY = data.viewState.offsetY || 0;
    }
    if (data.tipo_red) document.getElementById('select-tipo-red').value = data.tipo_red;
    if (data.caudal_scfm) document.getElementById('input-caudal').value = data.caudal_scfm;

    state.bgBase64 = data.bgBase64 || null;
    state.bgUrl = data.bgUrl || null;
    state.bgOpacity = data.bgOpacity !== undefined ? data.bgOpacity : 0.5;
    state.bgScale = data.bgScale !== undefined ? data.bgScale : 1.0;
    
    // Restaurar como Float32Array si es una lista de coordenadas
    if (Array.isArray(data.bgLines) && data.bgLines.length > 0 && typeof data.bgLines[0] === 'number') {
        state.bgLines = new Float32Array(data.bgLines);
    } else {
        state.bgLines = data.bgLines || []; 
    }

    state.viewState.isIsometric = data.isIsometric || false;
    state.viewState.currentZ = data.currentZ || 0;
    
    syncIsometricUI();

    const bgControls = document.getElementById('bg-controls');
    if (state.bgLines && state.bgLines.length > 0) {
        state.bgImageObj = null;
        state.bgBase64 = null;
        state.bgUrl = null;
        if (bgControls) bgControls.style.display = 'block';
    } else if (state.bgBase64 || state.bgUrl) {
        state.bgLines = [];
        if (window.cargarImagenFondo) window.cargarImagenFondo(state.bgBase64 || state.bgUrl); 
    } else {
        document.getElementById('btn-remove-bg').click();
    }

    state.resultadosCalculo = null;
    state.piezasCalculo = null;
    state.valvulasCalculo = null;
    state.bomCalculo = null;
    state.lineaIniciada = false;
    state.puntoInicio = null;
    import('../drawing.js').then(d => d.redraw());
}

export function updateProjectDisplay() {
    const projectNameDisplay = document.getElementById('project-name-display');
    if (!projectNameDisplay) return;
    if (state.proyectoActualId && state.proyectoActualName) {
        projectNameDisplay.textContent = `📌 ${state.proyectoActualName}`;
    } else {
        projectNameDisplay.textContent = '';
    }
}

export function setupModals() {
    const projectsModal = document.getElementById('projects-modal');
    
    document.getElementById('btn-new-project').onclick = () => {
        if (state.historial.length > 0 && !confirm('¿Estás seguro de que quieres empezar un nuevo proyecto? Se perderán los cambios no guardados.')) {
            return;
        }
        state.historial = [];
        state.resultadosCalculo = null;
        state.piezasCalculo = null;
        state.valvulasCalculo = null;
        state.bomCalculo = null;
        state.proyectoActualId = null;
        state.proyectoActualName = "";
        state.bgImageObj = null;
        state.bgLines = [];
        
        invalidateSnapCache();
        setStatus('Nuevo proyecto iniciado.');
        updateProjectDisplay();
        import('../drawing.js').then(d => d.redraw());
    };

    document.getElementById('btn-save-project').onclick = () => {
        projectsModal.classList.remove('hidden');
        document.getElementById('projects-save-view').style.display = 'block';
        document.getElementById('projects-list-view').style.display = 'none';
        const nameInput = document.getElementById('input-project-name');
        if (state.proyectoActualName) nameInput.value = state.proyectoActualName;
        nameInput.focus();
    };

    document.getElementById('btn-close-projects').onclick = () => projectsModal.classList.add('hidden');
    document.getElementById('btn-cancel-save').onclick = () => projectsModal.classList.add('hidden');

    document.getElementById('btn-confirm-save').onclick = async () => {
        const name = document.getElementById('input-project-name').value.trim();
        const client = document.getElementById('input-project-client').value.trim();
        if (!name) return alert('Por favor ingresa un nombre para el proyecto.');

        const projectData = serializeProjectData();
        const btnConfirm = document.getElementById('btn-confirm-save');
        const originalText = btnConfirm.innerText;
        btnConfirm.disabled = true;
        btnConfirm.innerText = '💾 Guardando...';
        setStatus('Guardando proyecto en la nube...');

        try {
            const response = await saveProject({ name, client, data: projectData }, state.proyectoActualId);
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseErr) {
                alert(`Error al guardar: El servidor respondió con estado ${response.status}`);
                return;
            }
            if (response.ok) {
                if (result.id) state.proyectoActualId = result.id;
                state.proyectoActualName = name;
                updateProjectDisplay();
                projectsModal.classList.add('hidden');
                setStatus(`Proyecto "${name}" guardado exitosamente.`);
            } else {
                alert('Error al guardar: ' + (result.error || result.msg || `HTTP ${response.status}`));
            }
        } catch (err) {
            alert('Error de conexión al guardar el proyecto: ' + err.message);
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = originalText;
        }
    };

    document.getElementById('btn-open-project').onclick = async () => {
        projectsModal.classList.remove('hidden');
        document.getElementById('projects-save-view').style.display = 'none';
        document.getElementById('projects-list-view').style.display = 'block';
        const projectsList = document.getElementById('projects-list');
        try {
            const response = await getProjects();
            if (response.status === 401) { localStorage.removeItem('draw_token'); location.reload(); return; }
            const projects = await response.json();
            if (projects.length === 0) {
                projectsList.innerHTML = '';
                document.getElementById('projects-empty').style.display = 'block';
                return;
            }
            document.getElementById('projects-empty').style.display = 'none';
            projectsList.innerHTML = projects.map(p => {
                const date = new Date(p.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const clientStr = p.client ? ` — ${p.client}` : '';
                return `<li class="project-item">
                            <div class="project-info" data-id="${p.id}">
                                <div class="project-name">${p.name}</div>
                                <div class="project-meta">${date}${clientStr}</div>
                            </div>
                            <button class="project-delete" data-id="${p.id}" title="Eliminar">🗑</button>
                        </li>`;
            }).join('');
            
            projectsList.querySelectorAll('.project-info').forEach(el => {
                el.onclick = async () => {
                    const res = await getProject(el.dataset.id);
                    const proy = await res.json();
                    restoreProjectData(proy.data);
                    state.proyectoActualId = proy.id;
                    state.proyectoActualName = proy.name;
                    updateProjectDisplay();
                    projectsModal.classList.add('hidden');
                    setStatus(`Proyecto "${proy.name}" cargado correctamente.`);
                };
            });
            projectsList.querySelectorAll('.project-delete').forEach(el => {
                el.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm('¿Eliminar este proyecto permanentemente?')) return;
                    await deleteProject(el.dataset.id);
                    document.getElementById('btn-open-project').click();
                };
            });
        } catch (err) {
            alert('Error al cargar la lista de proyectos.');
        }
    };

    const bomModal = document.getElementById('bom-modal');
    document.getElementById('btn-show-bom').onclick = () => {
        if (!state.bomCalculo) {
            alert('Primero debes hacer clic en "⚡ Generar Plano" para calcular los materiales de tu diseño.');
            return;
        }
        bomModal.classList.remove('hidden');
    };
    document.getElementById('btn-close-bom').onclick = () => bomModal.classList.add('hidden');
}

window.actualizarTablaBOM = function(bom, infoStock = null) {
    const bomBody = document.getElementById('bom-body');
    if (!bom || !bomBody) return;
    let html = '';
    const categories = [
        { key: 'tuberias', title: 'Tuberías (Metros Lineales)' },
        { key: 'accesorios', title: 'Accesorios (Fittings)' },
        { key: 'valvulas', title: 'Válvulas y Equipos' }
    ];

    categories.forEach(cat => {
        const items = bom[cat.key];
        if (items && items.length > 0) {
            html += `<tr><td colspan="4" class="bom-cat-header">${cat.title}</td></tr>`;
            items.forEach(item => {
                let stockStatus = '';
                if (infoStock) {
                    const match = infoStock.find(s => s.original_description === item.descripcion);
                    if (match) {
                        const codeLabel = match.matched_code !== 'N/A' ? `[${match.matched_code}] ` : '';
                        const color = match.status === 'Disponible' ? '#4CAF50' : (match.status === 'Sin stock' ? '#F44336' : '#FF9800');
                        stockStatus = `<td style="font-size: 11px; color: ${color};">${codeLabel}${match.status} (${match.current_stock})</td>`;
                    }
                }
                html += `<tr>
                            <td>${item.descripcion}</td>
                            <td style="text-align: right; padding-right: 20px; font-weight: bold; color: #FFF;">${item.cantidad}</td>
                            <td style="color: #8B9FD3;">${item.unidad}</td>
                            ${stockStatus}
                        </tr>`;
            });
        }
    });
    bomBody.innerHTML = html;
};
