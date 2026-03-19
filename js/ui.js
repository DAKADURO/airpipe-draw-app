import { state, invalidateSnapCache } from './state.js';
import { MODO, PIXELS_POR_METRO, API_BASE } from './config.js';
import { redraw, scheduleRedraw } from './drawing.js';
import { procesarPlano, saveProject, getProjects, getProject, deleteProject, login, register, downloadPDF } from './api.js';

export function setupUI(canvas) {
    const statusText = document.getElementById('status-text');
    const modeIndicator = document.getElementById('mode-indicator');
    let svgContainer = document.getElementById('svg-container');
    let svgModal = document.getElementById('svg-modal');

    function setStatus(msg) {
        if (statusText) statusText.textContent = msg;
    }

    function updateModeIndicator() {
        const labels = {
            [MODO.NINGUNO]: null,
            [MODO.LINEA]: '✏️  Modo: Tubería',
            [MODO.COMPRESOR]: '⚙️  Modo: Compresor',
            [MODO.CONSUMO]: '🔴  Modo: Punto de Consumo',
            [MODO.ACOTAR]: '📏  Modo: Acotar',
        };
        const label = labels[state.modoActual];
        if (label) {
            modeIndicator.textContent = label;
            modeIndicator.classList.remove('hidden');
        } else {
            modeIndicator.classList.add('hidden');
        }
    }

    function setActiveButton(btnKey) {
        ['btn-line', 'btn-compresor', 'btn-consumo', 'btn-valvula', 'btn-acotar', 'btn-borrar'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.remove('active');
        });
        if (btnKey) {
            const activeBtn = document.getElementById(btnKey);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    function setModo(modo, btnKey) {
        if (state.modoActual === modo) {
            state.modoActual = MODO.NINGUNO;
            state.lineaIniciada = false;
            state.puntoInicio = null;
            setActiveButton(null);
            setStatus('Selecciona una herramienta para comenzar.');
        } else {
            state.modoActual = modo;
            state.lineaIniciada = false;
            state.puntoInicio = null;
            setActiveButton(btnKey);

            const statusMap = {
                [MODO.LINEA]: 'Clic para iniciar tubería. Segundo clic para terminarla.',
                [MODO.COMPRESOR]: 'Clic en el canvas para colocar un Compresor.',
                [MODO.CONSUMO]: 'Clic en el canvas para colocar un Punto de Consumo.',
                [MODO.VALVULA]: 'Clic sobre una tubería para colocar una Válvula de aislamiento.',
                [MODO.ACOTAR]: 'Clic en el primer punto a acotar. Segundo clic para generar la cota.',
                [MODO.BORRAR]: 'MODO BORRADOR: Haz clic sobre cualquier elemento para eliminarlo.',
            };
            setStatus(statusMap[modo] || '');
        }
        updateModeIndicator();
        redraw();
    }

    // ── Tool Buttons ──
    const btnLine = document.getElementById('btn-line');
    if (btnLine) btnLine.onclick = () => setModo(MODO.LINEA, 'btn-line');
    const btnCompresor = document.getElementById('btn-compresor');
    if (btnCompresor) btnCompresor.onclick = () => setModo(MODO.COMPRESOR, 'btn-compresor');
    const btnConsumo = document.getElementById('btn-consumo');
    if (btnConsumo) btnConsumo.onclick = () => setModo(MODO.CONSUMO, 'btn-consumo');
    const btnValvula = document.getElementById('btn-valvula');
    if (btnValvula) btnValvula.onclick = () => setModo(MODO.VALVULA, 'btn-valvula');
    const btnAcotar = document.getElementById('btn-acotar');
    if (btnAcotar) btnAcotar.onclick = () => setModo(MODO.ACOTAR, 'btn-acotar');

    const btnBorrar = document.getElementById('btn-borrar');
    if (btnBorrar) btnBorrar.onclick = () => setModo(MODO.BORRAR, 'btn-borrar');

    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.onclick = () => {
        if (state.historial.length === 0) {
            setStatus('No hay acciones para deshacer.');
            return;
        }
        state.historial.pop();
        invalidateSnapCache();
        state.lineaIniciada = false;
        state.puntoInicio = null;
        redraw();
        setStatus(`Acción deshecha. (${state.historial.length} elementos restran)`);
    };

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.onclick = () => {
        state.historial = [];
        invalidateSnapCache();
        state.lineaIniciada = false;
        state.puntoInicio = null;
        redraw();
        setStatus('Canvas limpiado.');
    };

    // ── Generar Plano y BOM ──
    const bomModal = document.getElementById('bom-modal');
    const bomBody = document.getElementById('bom-body');
    const btnGenerar = document.getElementById('btn-generar');
    
    function actualizarTablaBOM(bom, infoStock = null) {
        if (!bom) return;
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
    }

    if (btnGenerar) btnGenerar.onclick = async () => {
        const plano = {
            lineas: state.historial.filter(a => a.tipo === 'linea').map(a => a.datos),
            nodos: state.historial.filter(a => a.tipo === 'nodo').map(a => a.datos),
            valvulas_manuales: state.historial.filter(a => a.tipo === 'valvula_manual').map(a => a.datos),
            tipo_red: document.getElementById('select-tipo-red').value || 'lineal',
            caudal_scfm: parseFloat(document.getElementById('input-caudal').value) || 0,
        };

        setStatus('Generando plano, por favor espera...');
        try {
            const response = await procesarPlano(plano);
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const data = await response.json();

            if (data.svg) {
                svgContainer.innerHTML = data.svg;
                svgModal.classList.remove('hidden');
                setStatus('Plano generado exitosamente.');

                if (data.lineas) {
                    state.resultadosCalculo = data.lineas;
                    state.piezasCalculo = data.piezas;
                    state.valvulasCalculo = data.valvulas;
                    state.bomCalculo = data.bom; 
                    actualizarTablaBOM(data.bom);
                }
                redraw();

                document.getElementById('btn-download').onclick = () => {
                    const blob = new Blob([data.svg], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'plano_airpipe.svg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                };

                const btnDownloadDxf = document.getElementById('btn-download-dxf');
                if (data.dxf) {
                    btnDownloadDxf.style.display = 'inline-block';
                    btnDownloadDxf.onclick = () => {
                        const byteCharacters = atob(data.dxf);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'application/dxf' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'plano_airpipe.dxf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    };
                } else {
                    btnDownloadDxf.style.display = 'none';
                }

                document.getElementById('btn-close').onclick = () => {
                    svgModal.classList.add('hidden');
                    svgContainer.innerHTML = '';
                };
            }
        } catch (err) {
            setStatus('Error al generar plano: ' + err.message);
        }
    };

    document.getElementById('btn-show-bom').onclick = () => {
        if (!state.bomCalculo) {
            alert('Primero debes hacer clic en "⚡ Generar Plano" para calcular los materiales de tu diseño.');
            return;
        }
        bomModal.classList.remove('hidden');
    };
    document.getElementById('btn-close-bom').onclick = () => bomModal.classList.add('hidden');

    const triggerPDFDownload = async () => {
        if (!state.proyectoActualId) {
            alert("⚠️ Debes guardar tu proyecto en la nube al menos una vez antes de poder generar el Informe PDF interactivo.");
            return;
        }
        setStatus('Generando PDF en la nube, por favor espera...');
        const btn1 = document.getElementById('btn-download-pdf');
        const btn2 = document.getElementById('btn-download-pdf-bom');
        if (btn1) btn1.disabled = true;
        if (btn2) btn2.disabled = true;

        try {
            // Capturar el dibujo actual del canvas como imagen para el PDF
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Fondo oscuro para que se vea igual que en la app
            tempCtx.fillStyle = '#0f172a';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Dibujar el contenido actual (incluyendo el fondo si existe)
            if (state.bgImageObj) {
                tempCtx.globalAlpha = state.bgOpacity;
                const sw = state.bgImageObj.width;
                const sh = state.bgImageObj.height;
                tempCtx.drawImage(state.bgImageObj, 0, 0, sw, sh, state.bgOffsetX, state.bgOffsetY, sw * state.bgScale, sh * state.bgScale);
                tempCtx.globalAlpha = 1.0;
            }
            
            // Dibujar las tuberías y piezas (usamos la función redraw pero sobre el tempCtx)
            // Para simplicidad, podemos usar el canvas principal si no tiene UI encima, 
            // pero mejor generar un dataURL limpio.
            const drawingDataUrl = canvas.toDataURL('image/png');

            const resp = await downloadPDF(state.proyectoActualId, drawingDataUrl);
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || 'Error de procesamiento en el servidor');
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_AIRpipe_${state.proyectoActualName || 'Plano'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatus('PDF generado y descargado exitosamente.');
        } catch (err) {
            alert("Error al generar el PDF: " + err.message);
            setStatus('Error al generar PDF: ' + err.message);
        } finally {
            if (btn1) btn1.disabled = false;
            if (btn2) btn2.disabled = false;
        }
    };

    const btnPdf1 = document.getElementById('btn-download-pdf');
    if (btnPdf1) btnPdf1.onclick = triggerPDFDownload;
    
    const btnPdf2 = document.getElementById('btn-download-pdf-bom');
    if (btnPdf2) btnPdf2.onclick = triggerPDFDownload;

    
    // ── Plano de Fondo ──
    const bgInput = document.getElementById('bg-input');
    const bgControls = document.getElementById('bg-controls');
    document.getElementById('btn-load-bg').onclick = () => bgInput.click();

    function cargarImagenFondo(base64Data) {
        const img = new Image();
        img.onload = () => {
            state.bgImageObj = img;
            bgControls.style.display = 'block';
            setStatus('Plano de fondo cargado.');
            document.getElementById('bg-opacity').value = state.bgOpacity * 100;
            document.getElementById('bg-opacity-val').textContent = `${state.bgOpacity * 100}%`;
            document.getElementById('bg-scale').value = state.bgScale;
            document.getElementById('bg-scale-val').textContent = `${state.bgScale.toFixed(1)}x`;
            redraw();
        };
        img.src = base64Data;
    }

    // Assign globally to be called from app loads correctly
    window.cargarImagenFondo = cargarImagenFondo;

    bgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.toLowerCase().endsWith('.dxf')) {
            cargarDXFFondo(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.bgLines = []; // Limpiar líneas si se sube imagen
                cargarImagenFondo(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    async function cargarDXFFondo(file) {
        try {
            setStatus('Procesando dibujo DXF...');
            const formData = new FormData();
            formData.append('file', file);

            const resp = await fetch('/processing/dxf-to-json', {
                method: 'POST',
                body: formData
            });

            const res = await resp.json();
            if (res.lines) {
                state.bgLines = res.lines;
                state.bgImageObj = null; // Limpiar imagen si se sube DXF
                state.bgBase64 = null;
                
                // Mostrar controles
                if (bgControls) bgControls.style.display = 'block';
                
                invalidateSnapCache();
                redraw();
                setStatus(`Dibujo DXF cargado: ${res.count} líneas.`);
            } else {
                alert("Error al procesar el DXF: " + (res.error || "Formato no soportado"));
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión al servidor para procesar DXF.");
        }
    }

    document.getElementById('bg-opacity').addEventListener('input', (e) => {
        state.bgOpacity = e.target.value / 100;
        document.getElementById('bg-opacity-val').textContent = `${e.target.value}%`;
        scheduleRedraw();
    });

    document.getElementById('bg-scale').addEventListener('input', (e) => {
        state.bgScale = parseFloat(e.target.value);
        document.getElementById('bg-scale-val').textContent = `${state.bgScale.toFixed(1)}x`;
        scheduleRedraw();
    });

    document.getElementById('btn-remove-bg').addEventListener('click', () => {
        state.bgImageObj = null;
        state.bgBase64 = null;
        state.bgUrl = null;
        state.bgScale = 1.0;
        state.bgOpacity = 0.5;
        bgInput.value = ''; 
        bgControls.style.display = 'none';
        setStatus('Plano de fondo removido.');
        redraw();
    });

    // ── Auth y Formulares Principales ──
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

    // ── Project Saving ──
    function serializeProjectData() {
        return {
            lineas: state.historial.filter(a => a.tipo === 'linea').map(a => a.datos),
            nodos: state.historial.filter(a => a.tipo === 'nodo').map(a => a.datos),
            valvulas_manuales: state.historial.filter(a => a.tipo === 'valvula_manual').map(a => a.datos),
            historial: state.historial,
            viewState: state.viewState,
            tipo_red: document.getElementById('select-tipo-red').value,
            caudal_scfm: parseFloat(document.getElementById('input-caudal').value) || 0,
            bgBase64: state.bgBase64,
            bgUrl: state.bgUrl,
            bgOpacity: state.bgOpacity,
            bgScale: state.bgScale,
            bgLines: state.bgLines
        };
    }

    function updateProjectDisplay() {
        const projectNameDisplay = document.getElementById('project-name-display');
        if (state.proyectoActualId && state.proyectoActualName) {
            projectNameDisplay.textContent = `📌 ${state.proyectoActualName}`;
        } else {
            projectNameDisplay.textContent = '';
        }
    }

    const projectsModal = document.getElementById('projects-modal');
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
            const result = await response.json();
            if (response.ok) {
                if (result.id) state.proyectoActualId = result.id;
                state.proyectoActualName = name;
                updateProjectDisplay();
                projectsModal.classList.add('hidden');
                setStatus(`Proyecto "${name}" guardado exitosamente.`);
            } else {
                alert('Error al guardar: ' + (result.error || 'Error desconocido'));
            }
        } catch (err) {
            alert('Error de conexión al guardar el proyecto.');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = originalText;
        }
    };

    // ── Open Project ──
    function restoreProjectData(data) {
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

        // Restore background data
        state.bgBase64 = data.bgBase64 || null;
        state.bgUrl = data.bgUrl || null;
        state.bgOpacity = data.bgOpacity !== undefined ? data.bgOpacity : 0.5;
        state.bgScale = data.bgScale !== undefined ? data.bgScale : 1.0;
        state.bgLines = data.bgLines || []; // Load bgLines

        if (state.bgLines && state.bgLines.length > 0) {
            // If DXF lines are present, clear image data
            state.bgImageObj = null;
            state.bgBase64 = null;
            state.bgUrl = null;
            if (bgControls) bgControls.style.display = 'block';
        } else if (state.bgBase64 || state.bgUrl) {
            // If image data is present, clear DXF lines
            state.bgLines = [];
            cargarImagenFondo(state.bgBase64 || state.bgUrl); 
        } else {
            // No background data, remove any existing
            document.getElementById('btn-remove-bg').click();
        }

        state.resultadosCalculo = null;
        state.piezasCalculo = null;
        state.valvulasCalculo = null;
        state.bomCalculo = null;
        state.lineaIniciada = false;
        state.puntoInicio = null;
        redraw();
    }

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

    return { setStatus };
}
