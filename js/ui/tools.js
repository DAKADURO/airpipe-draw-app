import { state, invalidateSnapCache } from '../state.js';
import { MODO } from '../config.js';
import { getModeCursor } from '../canvas_events.js';

export function setStatus(msg) {
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = msg;
}

export function updateModeIndicator() {
    const modeIndicator = document.getElementById('mode-indicator');
    if (!modeIndicator) return;
    const labels = {
        [MODO.NINGUNO]: null,
        [MODO.LINEA]: '✏️  Modo: Tubería',
        [MODO.COMPRESOR]: '⚙️  Modo: Compresor',
        [MODO.BAJADA]: '🔴  Modo: Bajada',
        [MODO.VALVULA]: '🟢  Modo: Válvula',
        [MODO.ACOTAR]: '📏  Modo: Acotar',
        [MODO.PAN]: '🖐️  Modo: Encuadre',
        [MODO.NOTA]: '📝  Modo: Nota',
        [MODO.DESFASE]: '⫽  Modo: Paralela',
        [MODO.MOVER]: '✥  Modo: Mover',
        [MODO.BORRAR]: '🗑️  Modo: Borrador'
    };
    const label = labels[state.modoActual];
    if (label) {
        modeIndicator.textContent = label;
        modeIndicator.classList.remove('hidden');
    } else {
        modeIndicator.classList.add('hidden');
    }
}

export function setActiveButton(btnKey) {
    ['btn-cursor', 'btn-line', 'btn-compresor', 'btn-bajada', 'btn-valvula', 'btn-acotar', 'btn-desfase', 'btn-mover', 'btn-borrar', 'btn-pan', 'btn-nota'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.classList.remove('active');
    });
    if (btnKey) {
        const activeBtn = document.getElementById(btnKey);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

export function setModo(nuevoModo, btnId = null) {
    if (state.modoActual === nuevoModo && nuevoModo !== MODO.NINGUNO) {
        state.modoActual = MODO.NINGUNO;
        setActiveButton('btn-cursor');
        setStatus('Cursor normal. Selecciona caja o clics individuales.');
        updateModeIndicator();
        const c = document.getElementById('mainCanvas');
        if (c) c.style.cursor = getModeCursor(MODO.NINGUNO);
        import('../drawing.js').then(d => d.scheduleRedraw());
        return;
    }

    state.modoActual = nuevoModo;
    state.isPanning = false;   // Garantizar que no se quede bloqueado el Pan
    state.isSelecting = false; // Garantizar que no se quede bloqueada la caja de selección
    
    const finalBtn = btnId || (nuevoModo === MODO.NINGUNO ? 'btn-cursor' : null);
    setActiveButton(finalBtn);

    const statusMap = {
        [MODO.LINEA]: 'Clic para iniciar tubería. Segundo clic para terminarla.',
        [MODO.COMPRESOR]: 'Clic en el canvas para colocar un Compresor.',
        [MODO.BAJADA]: 'Clic en el canvas para configurar y colocar una Bajada.',
        [MODO.VALVULA]: 'Clic sobre una tubería para colocar una Válvula de aislamiento.',
        [MODO.ACOTAR]: 'Clic en el primer punto a acotar. Segundo clic para generar la cota.',
        [MODO.BORRAR]: 'MODO BORRADOR: Haz clic sobre cualquier elemento para eliminarlo.',
        [MODO.PAN]: 'MODO ENCUADRE: Arrastra con el clic izquierdo para desplazar la vista.',
        [MODO.NOTA]: 'MODO NOTA: Haz clic en el canvas para añadir una anotación de texto.',
        [MODO.DESFASE]: 'MODO PARALELA: Haz clic en una tubería para duplicar su trayecto completo.',
        [MODO.MOVER]: 'MODO MOVER: Selecciona elementos primero. Clic en ancla base -> Clic en destino.',
    };
    setStatus(statusMap[nuevoModo] || '');
    updateModeIndicator();
    
    // Update canvas cursor to match the new mode
    const c = document.getElementById('mainCanvas');
    if (c) c.style.cursor = getModeCursor(nuevoModo);
    
    import('../drawing.js').then(d => d.scheduleRedraw());
}

export function setupTools() {
    const btnCursor = document.getElementById('btn-cursor');
    if (btnCursor) btnCursor.onclick = () => setModo(MODO.NINGUNO, 'btn-cursor');

    const btnLine = document.getElementById('btn-line');
    if (btnLine) btnLine.onclick = () => setModo(MODO.LINEA, 'btn-line');
    const btnCompresor = document.getElementById('btn-compresor');
    if (btnCompresor) btnCompresor.onclick = () => setModo(MODO.COMPRESOR, 'btn-compresor');
    const btnBajada = document.getElementById('btn-bajada');
    if (btnBajada) btnBajada.onclick = () => setModo(MODO.BAJADA, 'btn-bajada');
    const btnValvula = document.getElementById('btn-valvula');
    if (btnValvula) btnValvula.onclick = () => setModo(MODO.VALVULA, 'btn-valvula');
    const btnAcotar = document.getElementById('btn-acotar');
    if (btnAcotar) btnAcotar.onclick = () => setModo(MODO.ACOTAR, 'btn-acotar');
    const btnDesfase = document.getElementById('btn-desfase');
    if (btnDesfase) btnDesfase.onclick = () => setModo(MODO.DESFASE, 'btn-desfase');
    const btnMover = document.getElementById('btn-mover');
    if (btnMover) btnMover.onclick = () => setModo(MODO.MOVER, 'btn-mover');
    const btnBorrar = document.getElementById('btn-borrar');
    if (btnBorrar) btnBorrar.onclick = () => setModo(MODO.BORRAR, 'btn-borrar');
    const btnPan = document.getElementById('btn-pan');
    if (btnPan) btnPan.onclick = () => setModo(MODO.PAN, 'btn-pan');
    const btnNota = document.getElementById('btn-nota');
    if (btnNota) btnNota.onclick = () => setModo(MODO.NOTA, 'btn-nota');

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
        import('../drawing.js').then(d => {
            d.redraw();
            setStatus(`Acción deshecha. (${state.historial.length} elementos restran)`);
        });
    };

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.onclick = () => {
        state.historial = [];
        invalidateSnapCache();
        state.lineaIniciada = false;
        state.puntoInicio = null;
        import('../drawing.js').then(d => {
            d.redraw();
            setStatus('Canvas limpiado.');
        });
    };

    const btnAplicarDiametro = document.getElementById('btn-aplicar-diametro');
    const selectDiametroManual = document.getElementById('select-diametro-manual');
    if (btnAplicarDiametro) {
        btnAplicarDiametro.onclick = () => {
            const diametro = selectDiametroManual.value;
            if (state.seleccionados.size === 0) {
                setStatus('Selecciona primero las tuberías que quieres cambiar.');
                return;
            }

            let count = 0;
            state.seleccionados.forEach(item => {
                if (item.tipo === 'linea') {
                    if (!diametro) {
                        delete item.datos.diametro;
                    } else {
                        item.datos.diametro = diametro;
                    }
                    count++;
                }
            });

            if (count > 0) {
                setStatus(`Se actualizó el diámetro a ${diametro || 'Automático'} en ${count} tramos.`);
                import('../drawing.js').then(d => d.redraw());
            } else {
                setStatus('No hay tuberías seleccionadas para cambiar el diámetro.');
            }
        };
    }

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
        
        if (e.key === 'c' || e.key === 'C') {
            if (window.centrarVistaGlobal) window.centrarVistaGlobal();
        } else if (e.key === 'Escape') {
            setModo(MODO.NINGUNO, 'btn-cursor');
            state.seleccionados.clear();
            state.isSelecting = false;
            state.moveAnchor = null;
            state.cotaInicio = null;
            import('../drawing.js').then(d => d.scheduleRedraw());
        }
    });

    const btnCenter = document.getElementById('btn-center');
    if (btnCenter) {
        btnCenter.addEventListener('click', () => {
            if (window.centrarVistaGlobal) window.centrarVistaGlobal();
        });
    }
}
