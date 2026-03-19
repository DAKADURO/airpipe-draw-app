import { state, invalidateSnapCache, updateCanvasRect } from './state.js';
import { MAX_CAMERA_OFFSET, MODO, PIXELS_POR_METRO } from './config.js';
import { toWorld, toScreen, getSnapPoint, getSmartSnap, getAngleSnapPoint, getLineSnap, getCotaAt } from './math.js';
import { redraw, scheduleRedraw } from './drawing.js';

export function aplicarNuevaLongitud(cota, nuevoMetros, setStatusCb) {
    const pixels = nuevoMetros * PIXELS_POR_METRO;
    const { x1, y1, x2, y2 } = cota.datos;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthActual = Math.hypot(dx, dy);
    if (lengthActual < 1) return;

    const ux = dx / lengthActual;
    const uy = dy / lengthActual;
    const nuevoX2 = x1 + ux * pixels;
    const nuevoY2 = y1 + uy * pixels;

    const deltaX = nuevoX2 - x2;
    const deltaY = nuevoY2 - y2;

    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return;

    let lineaEditadaIdx = -1;
    const cotaEditadaIdx = state.historial.indexOf(cota);
    for (let i = 0; i < state.historial.length; i++) {
        const item = state.historial[i];
        if (item.tipo !== 'linea') continue;
        const d1 = Math.hypot(item.datos.x1 - x1, item.datos.y1 - y1);
        const d2 = Math.hypot(item.datos.x2 - x2, item.datos.y2 - y2);
        if (d1 < 2 && d2 < 2) { lineaEditadaIdx = i; break; }
        const d1r = Math.hypot(item.datos.x1 - x2, item.datos.y1 - y2);
        const d2r = Math.hypot(item.datos.x2 - x1, item.datos.y2 - y1);
        if (d1r < 2 && d2r < 2) { lineaEditadaIdx = i; break; }
    }

    const ptKey = (px, py) => `${Math.round(px)},${Math.round(py)}`;
    const puntosAMover = new Set();
    const cola = [ptKey(x2, y2)];
    puntosAMover.add(ptKey(x2, y2));

    let head = 0;
    while (head < cola.length) {
        const currKey = cola[head++];
        for (let i = 0; i < state.historial.length; i++) {
            if (i === lineaEditadaIdx) continue; 
            const item = state.historial[i];
            if (item.tipo !== 'linea') continue; 

            const k1 = ptKey(item.datos.x1, item.datos.y1);
            const k2 = ptKey(item.datos.x2, item.datos.y2);

            if (k1 === currKey && !puntosAMover.has(k2)) {
                puntosAMover.add(k2);
                cola.push(k2);
            }
            if (k2 === currKey && !puntosAMover.has(k1)) {
                puntosAMover.add(k1);
                cola.push(k1);
            }
        }
    }

    for (let i = 0; i < state.historial.length; i++) {
        if (i === lineaEditadaIdx || i === cotaEditadaIdx) continue;
        const item = state.historial[i];
        if (item.tipo === 'linea' || item.tipo === 'cota') {
            const k1 = ptKey(item.datos.x1, item.datos.y1);
            if (puntosAMover.has(k1)) {
                item.datos.x1 += deltaX;
                item.datos.y1 += deltaY;
            }
            const k2 = ptKey(item.datos.x2, item.datos.y2);
            if (puntosAMover.has(k2)) {
                item.datos.x2 += deltaX;
                item.datos.y2 += deltaY;
            }
        } else if (item.tipo === 'nodo' || item.tipo === 'valvula_manual') {
            const k = ptKey(item.datos.x, item.datos.y);
            if (puntosAMover.has(k)) {
                item.datos.x += deltaX;
                item.datos.y += deltaY;
            }
        }
    }

    cota.datos.x2 = nuevoX2;
    cota.datos.y2 = nuevoY2;

    if (lineaEditadaIdx >= 0) {
        const lineaEd = state.historial[lineaEditadaIdx];
        const dA = Math.hypot(lineaEd.datos.x1 - x1, lineaEd.datos.y1 - y1);
        if (dA < 2) {
            lineaEd.datos.x2 = nuevoX2;
            lineaEd.datos.y2 = nuevoY2;
        } else {
            lineaEd.datos.x1 = nuevoX2;
            lineaEd.datos.y1 = nuevoY2;
        }
    }

    invalidateSnapCache();
    if (setStatusCb) setStatusCb(`Longitud: ${nuevoMetros}m — Red actualizada.`);
}

export function initCanvasEvents(canvas, wrapper, floatingDimInput, lengthInput, setStatusCb) {

    function resizeCanvas() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        updateCanvasRect(canvas);
        redraw();
    }
    window.addEventListener('resize', resizeCanvas);
    
    // Configuración Inicial para que tome la zona desde el arranque
    updateCanvasRect(canvas);

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        updateCanvasRect(canvas); // En caso de scroll nativo en OS
        const mouseX = e.clientX - state.canvasRect.left;
        const mouseY = e.clientY - state.canvasRect.top;

        const worldBefore = toWorld(mouseX, mouseY);

        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        let newScale = state.viewState.scale * (1 + direction * zoomIntensity);
        newScale = Math.min(Math.max(0.1, newScale), 5);

        state.viewState.scale = newScale;

        let nextOffsetX = mouseX - worldBefore.x * newScale;
        let nextOffsetY = mouseY - worldBefore.y * newScale;

        state.viewState.offsetX = Math.min(nextOffsetX, MAX_CAMERA_OFFSET);
        state.viewState.offsetY = Math.min(nextOffsetY, MAX_CAMERA_OFFSET);

        redraw();
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => {
        updateCanvasRect(canvas);
        const rawX = e.clientX - state.canvasRect.left;
        const rawY = e.clientY - state.canvasRect.top;
        const worldPos = toWorld(rawX, rawY);

        const hit = getCotaAt(worldPos.x, worldPos.y);
        if (hit) {
            e.preventDefault();
            let currentOff = hit.cota.datos.offset;
            if (currentOff === undefined) currentOff = 30 / state.viewState.scale;
            hit.cota.datos.offset = -currentOff;

            invalidateSnapCache();
            redraw();
            if (setStatusCb) setStatusCb("Lado de la cota alternado.");
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
            state.isPanning = true;
            state.lastPanX = e.clientX;
            state.lastPanY = e.clientY;
            e.preventDefault();
        }
    });

    canvas.addEventListener('mouseup', () => {
        state.isPanning = false;
    });

    canvas.addEventListener('click', (e) => {
        if (state.isPanning) return;
        updateCanvasRect(canvas);

        const rawX = e.clientX - state.canvasRect.left;
        const rawY = e.clientY - state.canvasRect.top;

        const worldPos = toWorld(rawX, rawY);
        let x = worldPos.x;
        let y = worldPos.y;

        if (state.modoActual === MODO.NINGUNO || (state.modoActual === MODO.ACOTAR && !state.cotaInicio)) {
            const hit = getCotaAt(x, y);
            if (hit) {
                state.cotaSiendoEditada = hit.cota;
                const currentLen = (Math.hypot(hit.cota.datos.x2 - hit.cota.datos.x1, hit.cota.datos.y2 - hit.cota.datos.y1) / PIXELS_POR_METRO).toFixed(2);

                floatingDimInput.style.display = 'block';
                floatingDimInput.style.left = `${e.clientX}px`;
                floatingDimInput.style.top = `${e.clientY}px`;
                floatingDimInput.value = currentLen;
                floatingDimInput.focus();
                floatingDimInput.select();
                return;
            }
        }

        if (state.snapPoint) {
            x = state.snapPoint.x;
            y = state.snapPoint.y;
        } else if (state.smartSnapPoint) {
            x = state.smartSnapPoint.x;
            y = state.smartSnapPoint.y;
        } else if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.angleSnapPoint) {
            x = state.angleSnapPoint.x;
            y = state.angleSnapPoint.y;
        }

        if (state.modoActual === MODO.LINEA) {
            if (!state.lineaIniciada) {
                state.lineaIniciada = true;
                state.puntoInicio = { x, y };
                if (setStatusCb) setStatusCb('Punto de inicio fijado. Clic para terminar la tubería.');
            } else {
                state.historial.push({
                    tipo: 'linea',
                    datos: { x1: state.puntoInicio.x, y1: state.puntoInicio.y, x2: x, y2: y },
                });
                invalidateSnapCache();
                state.lineaIniciada = false;
                state.puntoInicio = null;
                if (setStatusCb) setStatusCb(`Tubería añadida. (${state.historial.filter(a => a.tipo === 'linea').length} en total)`);
                redraw();
            }
        } else if (state.modoActual === MODO.COMPRESOR) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'compresor', x, y } });
            invalidateSnapCache();
            if (setStatusCb) setStatusCb(`Compresor colocado en (${(x / PIXELS_POR_METRO).toFixed(2)}m, ${(y / PIXELS_POR_METRO).toFixed(2)}m).`);
            redraw();
        } else if (state.modoActual === MODO.CONSUMO) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'consumo', x, y } });
            invalidateSnapCache();
            if (setStatusCb) setStatusCb(`Punto de Consumo colocado en (${(x / PIXELS_POR_METRO).toFixed(2)}m, ${(y / PIXELS_POR_METRO).toFixed(2)}m).`);
            redraw();
        } else if (state.modoActual === MODO.VALVULA) {
            const snap = getLineSnap(x, y);
            if (snap) {
                state.historial.push({
                    tipo: 'valvula_manual',
                    datos: {
                        x: snap.x, y: snap.y, angulo: snap.angulo, diametro: snap.linea.diametro || null
                    },
                });
                if (setStatusCb) setStatusCb('Válvula colocada sobre la tubería.');
                redraw();
            } else {
                if (setStatusCb) setStatusCb('Debes hacer clic SOBRE una tubería para colocar la válvula.');
            }
        } else if (state.modoActual === MODO.ACOTAR) {
            if (!state.cotaInicio) {
                state.cotaInicio = { x, y };
                if (setStatusCb) setStatusCb('Primer punto fijado. Clic en el segundo punto para completar la cota.');
            } else {
                const dist = Math.hypot(x - state.cotaInicio.x, y - state.cotaInicio.y);
                if (dist > 5) {
                    state.historial.push({
                        tipo: 'cota',
                        datos: {
                            x1: state.cotaInicio.x, y1: state.cotaInicio.y,
                            x2: x, y2: y,
                            offset: 30 / state.viewState.scale
                        }
                    });
                    if (setStatusCb) setStatusCb(`Cota añadida: ${(dist / PIXELS_POR_METRO).toFixed(2)}m`);
                    redraw();
                }
                state.cotaInicio = null;
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (state.isPanning) {
            const deltaX = e.clientX - state.lastPanX;
            const deltaY = e.clientY - state.lastPanY;

            let nextOffsetX = state.viewState.offsetX + deltaX;
            let nextOffsetY = state.viewState.offsetY + deltaY;

            state.viewState.offsetX = Math.min(nextOffsetX, MAX_CAMERA_OFFSET);
            state.viewState.offsetY = Math.min(nextOffsetY, MAX_CAMERA_OFFSET);

            state.lastPanX = e.clientX;
            state.lastPanY = e.clientY;
            scheduleRedraw(); 
            return;
        }

        updateCanvasRect(canvas);
        const rawX = e.clientX - state.canvasRect.left;
        const rawY = e.clientY - state.canvasRect.top;

        const worldPos = toWorld(rawX, rawY);
        const worldX = worldPos.x;
        const worldY = worldPos.y;

        state.snapPoint = getSnapPoint(worldX, worldY);

        state.smartSnapPoint = null;
        if (!state.snapPoint) {
            state.activeGuides = []; // will be filled via getSmartSnap
            state.smartSnapPoint = getSmartSnap(worldX, worldY, state.activeGuides);
        } else {
            state.activeGuides = [];
        }

        state.angleSnapPoint = null;
        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio && !state.snapPoint && !state.smartSnapPoint) {
            state.angleSnapPoint = getAngleSnapPoint(state.puntoInicio.x, state.puntoInicio.y, worldX, worldY);
        }

        if (state.snapPoint) {
            state.puntoMouse = { x: state.snapPoint.x, y: state.snapPoint.y };
        } else if (state.smartSnapPoint) {
            state.puntoMouse = { x: state.smartSnapPoint.x, y: state.smartSnapPoint.y };
        } else if (state.angleSnapPoint) {
            state.puntoMouse = { x: state.angleSnapPoint.x, y: state.angleSnapPoint.y };
        } else if (state.modoActual === MODO.VALVULA) {
            const snap = getLineSnap(worldX, worldY);
            if (snap) {
                state.puntoMouse = { x: snap.x, y: snap.y, angulo: snap.angulo };
            } else {
                state.puntoMouse = { x: worldX, y: worldY };
            }
        } else {
            state.puntoMouse = { x: worldX, y: worldY };
        }

        scheduleRedraw();
    });

    canvas.addEventListener('mouseleave', () => {
        state.puntoMouse = null;
        state.snapPoint = null;
        state.angleSnapPoint = null;
        state.smartSnapPoint = null;
        state.activeGuides = [];
        scheduleRedraw();
    });

    function finalizarEdicionCota(guardar) {
        if (!state.cotaSiendoEditada) return;

        if (guardar) {
            const nuevoMetros = parseFloat(floatingDimInput.value);
            if (!isNaN(nuevoMetros) && nuevoMetros > 0) {
                aplicarNuevaLongitud(state.cotaSiendoEditada, nuevoMetros, setStatusCb);
            }
        }
        state.cotaSiendoEditada = null;
        floatingDimInput.style.display = 'none';
        redraw();
    }

    floatingDimInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finalizarEdicionCota(true);
        else if (e.key === 'Escape') finalizarEdicionCota(false);
    });

    floatingDimInput.addEventListener('blur', () => {
        finalizarEdicionCota(false);
    });

    function confirmarLongitudManual(distancia) {
        if (!state.puntoInicio || !state.puntoMouse) return;

        let dx = state.puntoMouse.x - state.puntoInicio.x;
        let dy = state.puntoMouse.y - state.puntoInicio.y;
        const currentDist = Math.hypot(dx, dy);

        if (currentDist < 0.1) { dx = 1; dy = 0; } 
        else { dx /= currentDist; dy /= currentDist; }

        const pxDistancia = distancia * PIXELS_POR_METRO;
        const finalX = state.puntoInicio.x + dx * pxDistancia;
        const finalY = state.puntoInicio.y + dy * pxDistancia;

        state.historial.push({ tipo: 'linea', datos: { x1: state.puntoInicio.x, y1: state.puntoInicio.y, x2: finalX, y2: finalY } });
        invalidateSnapCache(); 
        state.lineaIniciada = false;
        state.puntoInicio = null;
        if (setStatusCb) setStatusCb(`Tubería de ${distancia}m añadida.`);
        redraw();
    }

    lengthInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = parseFloat(lengthInput.value);
            if (!isNaN(val) && val > 0) confirmarLongitudManual(val);
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

    document.addEventListener('keydown', (e) => {
        if (document.activeElement === lengthInput) return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            // Lógica Undo
            if (state.historial.length === 0) {
                if (setStatusCb) setStatusCb('No hay acciones para deshacer.');
                return;
            }
            state.historial.pop();
            invalidateSnapCache();
            state.lineaIniciada = false;
            state.puntoInicio = null;
            redraw();
            if (setStatusCb) setStatusCb(`Acción deshecha. (${state.historial.length} elementos restan)`);
            return;
        }

        if (e.key === 'Escape') {
            if (state.lineaIniciada) {
                state.lineaIniciada = false;
                state.puntoInicio = null;
                if (setStatusCb) setStatusCb('Tubería cancelada. Clic para iniciar una nueva.');
                redraw();
            }
            return;
        }

        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio &&
            !e.ctrlKey && !e.altKey && !e.metaKey && /^[0-9]$/.test(e.key) && state.puntoMouse) {
            
            const screenPos = toScreen(state.puntoMouse.x, state.puntoMouse.y);
            lengthInput.style.display = 'block';
            lengthInput.style.left = (screenPos.x + 20) + 'px';
            lengthInput.style.top = (screenPos.y + 20) + 'px';
            lengthInput.value = e.key;
            lengthInput.focus();
            e.preventDefault();
        }
    });

    return { resizeCanvas }; // Expose to orchestrator if needed
}
