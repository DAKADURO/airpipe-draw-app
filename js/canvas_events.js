import { state, invalidateSnapCache } from './state.js';
import { toWorld, toScreen, getLineSnap, getSnapPoint, getAngleSnapPoint, getSmartSnap } from './math.js';
import { redraw, scheduleRedraw, canvas } from './drawing.js';
import { MODO, PIXELS_POR_METRO } from './config.js';
import { ToolManager } from './tools/ToolManager.js';
// import { setModoGlobal } from './main.js'; // Eliminated, was causing SyntaxError crash
import { DrawTool } from './tools/DrawTool.js'; // Needed specifically for manual length

export function getModeCursor(modo) {
    if (state._spacePressed) return 'grab';
    switch (modo) {
        case MODO.PAN:     return 'grab';
        case MODO.BORRAR:  return 'not-allowed';
        case MODO.NINGUNO: return 'default';
        default:           return 'crosshair';
    }
}

export function initCanvasEvents(c) {
    let setStatusCb = null;
    let updateModeCb = null;
    let inDOMCtx = false;

    try {
        const { setStatus, updateModeIndicator } = import('./ui/tools.js').then(m => {
            setStatusCb = m.setStatus;
            updateModeCb = m.updateModeIndicator;
        });
        inDOMCtx = true;
    } catch { } // Para modo testing offline

    function resizeCanvas() {
        const container = document.getElementById('canvas-wrapper');
        if (!container) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        scheduleRedraw();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Snap Points and Info Variables for Renderers
    const lengthInput = document.getElementById('length-input');
    
    function extractMouseEventData(e) {
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const currentZ = state.viewState.isIsometric ? (state.viewState.currentZ || 0) : 0;
        const worldPos = toWorld(rawX, rawY, currentZ, state);
        
        // Synchronize state for math engine (Angle snap relies on this)
        state.lastMouseX = rawX;
        state.lastMouseY = rawY;
        
        let finalPos = { ...worldPos };
        
        // Always calculate snap point for rendering, unless panning
        if (!state.isPanning && state.modoActual !== MODO.MOVER && state.modoActual !== MODO.BORRAR) {
            // A. Point / Vertex Snap
            let snap = getSnapPoint(worldPos.x, worldPos.y, currentZ);
            
            // B. Edge / Line Snap
            if (!snap) {
                snap = getLineSnap(worldPos.x, worldPos.y, currentZ);
            }

            if (snap) {
                state.snapPoint = snap;
                finalPos = { x: snap.x, y: snap.y, z: snap.z };
            } else {
                state.snapPoint = null;
            }

            // C. Angle Snap (If drawing a line)
            if (state.lineaIniciada && state.puntoInicio) {
                const angleSnap = getAngleSnapPoint(state.puntoInicio.x, state.puntoInicio.y, worldPos.x, worldPos.y, state.puntoInicio.z || 0);
                if (angleSnap) {
                    state.angleSnapPoint = angleSnap;
                    // Angle snap has lower priority than vertex snap, but overrides the raw pos
                    if (!state.snapPoint) {
                        finalPos = { x: angleSnap.x, y: angleSnap.y, z: angleSnap.z };
                    }
                } else {
                    state.angleSnapPoint = null;
                }
            } else {
                state.angleSnapPoint = null;
            }

            // D. Smart Alignment Guides (Always compute for visual feedback)
            {
                const smartPos = state.angleSnapPoint
                    ? { x: finalPos.x, y: finalPos.y }
                    : { x: worldPos.x, y: worldPos.y };
                
                let overrideZ = currentZ;
                if (state.angleSnapPoint && state.angleSnapPoint.z !== undefined) {
                    overrideZ = state.angleSnapPoint.z;
                } else if (state.lineaIniciada && state.puntoInicio && state.puntoInicio.z !== undefined) {
                    overrideZ = state.puntoInicio.z;
                }

                const smart = getSmartSnap(smartPos.x, smartPos.y, state.activeGuides, overrideZ);
                
                if (smart && !state.snapPoint) {
                    // Si el usuario está moviendo exclusivamente el eje Z, no dejamos que un alineamiento en X/Y arruine su eje vertical.
                    if (!(state.angleSnapPoint && state.angleSnapPoint.isVertical)) {
                        finalPos = { x: smart.x, y: smart.y, z: overrideZ };
                    }
                }
            }
        } else {
            state.snapPoint = null;
            state.angleSnapPoint = null;
            state.activeGuides = [];
        }

        // Set system-wide mouse target
        state.puntoMouse = { ...finalPos };
        
        return {
            rawX, rawY,
            worldPos,
            x: finalPos.x,
            y: finalPos.y,
            z: finalPos.z,
            multiSelectModifier: e.ctrlKey || e.metaKey || e.shiftKey
        };
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0 && e.button !== 1) return; // Allow left and middle click ONLY
        
        if (e.button === 1 || state._spacePressed) {
            state.isPanning = true;
            state.lastMouse = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (state.modoActual === MODO.PAN) {
            state.isPanning = true;
            state.lastMouse = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            return;
        }

        const data = extractMouseEventData(e);
        ToolManager.handleEvent('onMouseDown', e, data);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (state.isPanning) {
            const dx = e.clientX - state.lastMouse.x;
            const dy = e.clientY - state.lastMouse.y;
            state.viewState.offsetX += dx;
            state.viewState.offsetY += dy;
            state.lastMouse = { x: e.clientX, y: e.clientY };
            scheduleRedraw();
            return;
        }

        const data = extractMouseEventData(e);
        ToolManager.handleEvent('onMouseMove', e, data);
        
        // Special case global angle calculation for UI display
        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio) {
            const dx = data.x - state.puntoInicio.x;
            const dy = data.y - state.puntoInicio.y;
            const isVertical = !state.viewState.isIsometric && Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs((data.z||0) - (state.puntoInicio.z||0)) > 1;
            let angulo = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angulo < 0) angulo += 360;
            state.angleSnapPoint = { x: data.x, y: data.y, angle: angulo, isVertical, z: data.z };
        } else {
            state.angleSnapPoint = null;
        }
        
        scheduleRedraw();
    });

    window.addEventListener('mouseup', (e) => {
        if (state.isPanning) {
            state.isPanning = false;
            canvas.style.cursor = getModeCursor(state.modoActual);
            return;
        }

        if (state.isSelecting) {
            state.isSelecting = false;
            // No return here, let tool handle end of selection if needed
        }
        
        const data = extractMouseEventData(e);
        ToolManager.handleEvent('onMouseUp', e, data);
    });

    canvas.addEventListener('click', (e) => {
        if (state.isPanning) return; // Prevent spurious clicks while panning
        
        const data = extractMouseEventData(e);
        ToolManager.handleEvent('onClick', e, data);
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomSpeed = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        
        // Clamp scale multiplier
        const zoomFactor = 1 + direction * zoomSpeed;
        let newScale = state.viewState.scale * zoomFactor;
        newScale = Math.max(0.1, Math.min(newScale, 10.0));
        
        const realZoomFactor = newScale / state.viewState.scale;

        state.viewState.offsetX = mouseX - (mouseX - state.viewState.offsetX) * realZoomFactor;
        state.viewState.offsetY = mouseY - (mouseY - state.viewState.offsetY) * realZoomFactor;
        state.viewState.scale = newScale;

        scheduleRedraw();
    }, { passive: false });

    if (lengthInput) {
        lengthInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = parseFloat(lengthInput.value);
                if (!isNaN(val) && val > 0) DrawTool.confirmarLongitudManual(val);
                lengthInput.value = '';
                lengthInput.style.display = 'none';
                canvas.focus();
            } else if (e.key === 'Escape') {
                lengthInput.value = '';
                lengthInput.style.display = 'none';
                canvas.focus();
                e.stopPropagation();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !state._spacePressed) {
            if (document.activeElement.tagName !== 'INPUT') {
                state._spacePressed = true;
                canvas.style.cursor = 'grab';
                e.preventDefault();
            }
        }

        if (document.activeElement === lengthInput) return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            document.getElementById('btn-undo')?.click();
            return;
        }

        if (e.key === 'Escape') {
            if (state.lineaIniciada) {
                state.lineaIniciada = false;
                state.puntoInicio = null;
                if (setStatusCb) setStatusCb('Tubería cancelada. Clic para iniciar una nueva.');
                scheduleRedraw();
            }
            return;
        }

        const isDigitKey = /^[0-9]$/.test(e.key);
        const isNumpadDigit = /^Numpad[0-9]$/.test(e.code);
        
        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio &&
            !e.ctrlKey && !e.altKey && !e.metaKey && (isDigitKey || isNumpadDigit) && state.puntoMouse) {
            
            let numValue = isDigitKey ? e.key : e.code.replace('Numpad', '');
            const zPos = state.puntoMouse.z !== undefined ? state.puntoMouse.z : 0;
            const screenPos = toScreen(state.puntoMouse.x, state.puntoMouse.y, zPos);
            
            if (lengthInput) {
                lengthInput.style.display = 'block';
                lengthInput.style.left = (screenPos.x + 20) + 'px';
                lengthInput.style.top = (screenPos.y + 20) + 'px';
                lengthInput.value = numValue;
                lengthInput.focus();
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state._spacePressed = false;
            canvas.style.cursor = getModeCursor(state.modoActual);
        }
    });

    return { resizeCanvas };
}
