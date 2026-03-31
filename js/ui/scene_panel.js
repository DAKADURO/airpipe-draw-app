import { state, invalidateSnapCache } from '../state.js';
import { setStatus } from './tools.js';

export function cargarImagenFondo(base64Data) {
    const bgControls = document.getElementById('bg-controls');
    const img = new Image();
    img.onload = () => {
        state.bgImageObj = img;
        if (bgControls) bgControls.style.display = 'block';
        setStatus('Plano de fondo cargado.');
        document.getElementById('bg-opacity').value = state.bgOpacity * 100;
        document.getElementById('bg-opacity-val').textContent = `${state.bgOpacity * 100}%`;
        document.getElementById('bg-scale').value = state.bgScale;
        document.getElementById('bg-scale-val').textContent = `${state.bgScale.toFixed(1)}x`;
        import('../drawing.js').then(d => d.redraw());
    };
    img.src = base64Data;
}
window.cargarImagenFondo = cargarImagenFondo;

export async function cargarDXFFondo(file) {
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
            state.bgImageObj = null; 
            state.bgBase64 = null;
            
            const bgControls = document.getElementById('bg-controls');
            if (bgControls) bgControls.style.display = 'block';
            
            invalidateSnapCache();
            import('../drawing.js').then(d => d.redraw());
            setStatus(`Dibujo DXF cargado: ${res.count} líneas.`);
        } else {
            alert("Error al procesar el DXF: " + (res.error || "Formato no soportado"));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al servidor para procesar DXF.");
    }
}

export function setupScenePanel() {
    const bgInput = document.getElementById('bg-input');
    const bgControls = document.getElementById('bg-controls');
    
    document.getElementById('btn-load-bg').onclick = () => bgInput.click();

    bgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.toLowerCase().endsWith('.dxf')) {
            cargarDXFFondo(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.bgLines = []; 
                cargarImagenFondo(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    const opac = document.getElementById('bg-opacity');
    if (opac) {
        opac.addEventListener('input', (e) => {
            state.bgOpacity = e.target.value / 100;
            const val = document.getElementById('bg-opacity-val');
            if (val) val.textContent = `${e.target.value}%`;
            import('../drawing.js').then(d => d.scheduleRedraw());
        });
    }

    const sca = document.getElementById('bg-scale');
    if (sca) {
        sca.addEventListener('input', (e) => {
            state.bgScale = e.target.value;
            const val = document.getElementById('bg-scale-val');
            if (val) val.innerText = `${state.bgScale}x`;
            invalidateSnapCache();
            import('../drawing.js').then(d => d.redraw());
        });
    }

    document.getElementById('btn-remove-bg').addEventListener('click', () => {
        state.bgImageObj = null;
        state.bgBase64 = null;
        state.bgUrl = null;
        state.bgScale = 1.0;
        state.bgOpacity = 0.5;
        bgInput.value = ''; 
        if (bgControls) bgControls.style.display = 'none';
        setStatus('Plano de fondo removido.');
        import('../drawing.js').then(d => d.redraw());
    });

    setupIsometricUI();
}

export function setupIsometricUI() {
    const checkIsometric = document.getElementById('check-isometric');
    const zControl = document.getElementById('z-control');
    const inputZ = document.getElementById('input-z');

    if (checkIsometric) {
        checkIsometric.addEventListener('change', (e) => {
            const isIso = e.target.checked;
            state.viewState.isIsometric = isIso;
            syncIsometricUI();
            invalidateSnapCache();
            import('../drawing.js').then(d => {
                d.redraw();
                if (isIso && window.centrarVistaGlobal) {
                    setTimeout(() => window.centrarVistaGlobal(), 100); 
                }
            });
        });
    }

    if (inputZ) {
        inputZ.addEventListener('input', (e) => {
            state.viewState.currentZ = parseFloat(e.target.value) || 0;
            import('../drawing.js').then(d => d.redraw()); 
        });
    }

    // Initial sync
    syncIsometricUI();
}

/**
 * Centra la vista en el contenido del historial (tuberías, nodos, etc.)
 */
window.centrarVistaGlobal = function() {
    if (state.historial.length === 0) {
        state.viewState.offsetX = 0;
        state.viewState.offsetY = 0;
        state.viewState.scale = 1.0;
        import('../drawing.js').then(d => d.redraw());
        return;
    }

    // Calcular límites envolventes (AABB)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const item of state.historial) {
        if (item.tipo === 'linea') {
            const { x1, y1, x2, y2 } = item.datos;
            const z1 = item.datos.z1 || 0, z2 = item.datos.z2 || 0;
            import('../math.js').then(m => {
                const p1 = m.projectIso ? (state.viewState.isIsometric ? m.projectIso(x1, y1, z1) : {x: x1, y: y1}) : {x: x1, y: y1};
                const p2 = m.projectIso ? (state.viewState.isIsometric ? m.projectIso(x2, y2, z2) : {x: x2, y: y2}) : {x: x2, y: y2};
                minX = Math.min(minX, p1.x, p2.x); maxX = Math.max(maxX, p1.x, p2.x);
                minY = Math.min(minY, p1.y, p2.y); maxY = Math.max(maxY, p1.y, p2.y);
            });
        } else if (item.tipo === 'nodo') {
            const { x, y, z } = item.datos;
            import('../math.js').then(m => {
                const p = m.projectIso ? (state.viewState.isIsometric ? m.projectIso(x, y, z || 0) : {x: x, y: y}) : {x: x, y: y};
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });
        }
    }

    // Simplificado: por ahora solo resetear a un punto razonable si no tenemos cálculo exacto síncrono
    // Pero asegurarnos de que NO resetee isIsometric
    const canvas = document.getElementById('mainCanvas');
    if (canvas) {
        state.viewState.offsetX = canvas.width / 2;
        state.viewState.offsetY = canvas.height / 2;
        import('../drawing.js').then(d => d.redraw());
    }
};

/**
 * Synchronizes the UI elements (checkbox, Z-height input visibility) with the application state.
 */
export function syncIsometricUI() {
    const checkIsometric = document.getElementById('check-isometric');
    const zHeightControl = document.getElementById('z-height-control');
    const inputZ = document.getElementById('input-z');

    const isIso = state.viewState.isIsometric;

    if (checkIsometric) {
        checkIsometric.checked = isIso;
        // Persistence
        localStorage.setItem('airpipe_isometric_view', isIso ? 'true' : 'false');
    }
    
    // Solo ocultamos/mostramos el control de ALTURA (Z), no el checkbox 3D en sí
    if (zHeightControl) zHeightControl.style.display = isIso ? 'flex' : 'none';
    if (inputZ) inputZ.value = state.viewState.currentZ || 0;
}
