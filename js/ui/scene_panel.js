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
 * Synchronizes the UI elements (checkbox, Z-control visibility) with the application state.
 */
export function syncIsometricUI() {
    const checkIsometric = document.getElementById('check-isometric');
    const zControl = document.getElementById('z-control');
    const inputZ = document.getElementById('input-z');

    const isIso = state.viewState.isIsometric;

    if (checkIsometric) checkIsometric.checked = isIso;
    if (zControl) zControl.style.display = isIso ? 'flex' : 'none';
    if (inputZ) inputZ.value = state.viewState.currentZ || 0;
}
