import { state, invalidateSnapCache, updateCanvasRect } from './state.js';
import { MAX_CAMERA_OFFSET, MODO, PIXELS_POR_METRO } from './config.js';
import { toWorld, toScreen, getSnapPoint, getSmartSnap, getAngleSnapPoint, getLineSnap, getCotaAt, findItemAt, projectIso, splitLineAtJunctions } from './math.js';
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
        if (!wrapper) return;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        updateCanvasRect(canvas);
        redraw();
    }
    window.addEventListener('resize', resizeCanvas);
    
    // Configuración Inicial para que tome la zona y resolución reales desde el arranque
    resizeCanvas();

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        updateCanvasRect(canvas); // En caso de scroll nativo en OS
        const mouseX = e.clientX - state.canvasRect.left;
        const mouseY = e.clientY - state.canvasRect.top;

        const worldBefore = toWorld(mouseX, mouseY);
        let projX = worldBefore.x;
        let projY = worldBefore.y;
        if (state.viewState.isIsometric) {
            const p = projectIso(worldBefore.x, worldBefore.y, worldBefore.z || 0);
            projX = p.x;
            projY = p.y;
        }

        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        let newScale = state.viewState.scale * (1 + direction * zoomIntensity);
        newScale = Math.min(Math.max(0.02, newScale), 5); // 0.02 permite ver 50m en 1000px

        state.viewState.scale = newScale;

        let nextOffsetX = mouseX - projX * newScale;
        let nextOffsetY = mouseY - projY * newScale;

        state.viewState.offsetX = Math.min(nextOffsetX, MAX_CAMERA_OFFSET);
        state.viewState.offsetY = Math.min(nextOffsetY, MAX_CAMERA_OFFSET);

        redraw();
    }, { passive: false });

    // --- Touch Events (Mobile Support) ---
    let initialPinchDistance = null;
    let initialPinchScale = null;
    let isTouchDragging = false;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialPinchScale = state.viewState.scale;
            state.isPanning = false;
            isTouchDragging = false;
        } else if (e.touches.length === 1) {
            updateCanvasRect(canvas);
            const forcePan = state.modoActual === MODO.PAN;
            if (forcePan) {
                e.preventDefault();
                state.isPanning = true;
                state.lastPanX = e.touches[0].clientX;
                state.lastPanY = e.touches[0].clientY;
            } else {
                isTouchDragging = true;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            if (!initialPinchDistance) return;
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            const pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const mouseX = pinchCenterX - state.canvasRect.left;
            const mouseY = pinchCenterY - state.canvasRect.top;

            const worldBefore = toWorld(mouseX, mouseY);
            let projX = worldBefore.x;
            let projY = worldBefore.y;
            if (state.viewState.isIsometric) {
                const p = projectIso(worldBefore.x, worldBefore.y, worldBefore.z || 0);
                projX = p.x;
                projY = p.y;
            }

            let newScale = initialPinchScale * (currentDistance / initialPinchDistance);
            newScale = Math.min(Math.max(0.1, newScale), 5);
            state.viewState.scale = newScale;

            let nextOffsetX = mouseX - projX * newScale;
            let nextOffsetY = mouseY - projY * newScale;

            state.viewState.offsetX = Math.min(nextOffsetX, MAX_CAMERA_OFFSET);
            state.viewState.offsetY = Math.min(nextOffsetY, MAX_CAMERA_OFFSET);
            
            state.isPanning = false;
            isTouchDragging = false;
            scheduleRedraw();
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            if (state.isPanning) {
                e.preventDefault();
                const deltaX = touch.clientX - state.lastPanX;
                const deltaY = touch.clientY - state.lastPanY;

                let nextOffsetX = state.viewState.offsetX + deltaX;
                let nextOffsetY = state.viewState.offsetY + deltaY;

                state.viewState.offsetX = Math.min(nextOffsetX, MAX_CAMERA_OFFSET);
                state.viewState.offsetY = Math.min(nextOffsetY, MAX_CAMERA_OFFSET);

                state.lastPanX = touch.clientX;
                state.lastPanY = touch.clientY;
                scheduleRedraw();
            } else if (isTouchDragging) {
                // Simulate mousemove for snaps and previews
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                canvas.dispatchEvent(mouseEvent);
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (state.isPanning) {
            state.isPanning = false;
        } else if (isTouchDragging && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const clickEvent = new MouseEvent('click', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            canvas.dispatchEvent(clickEvent);
            isTouchDragging = false;
        }
        
        if (e.touches.length < 2) {
            initialPinchDistance = null;
            initialPinchScale = null;
        }
    });

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

    const coordsDisplay = document.getElementById('coords-display');

    canvas.addEventListener('mousedown', (e) => {
        updateCanvasRect(canvas);
        // Pan con botón central (1) o botón izquierdo (0) si modo es PAN o espacio pulsado
        const forcePan = state._spacePressed || state.modoActual === MODO.PAN;
        if (e.button === 1 || (e.button === 0 && forcePan)) {
            state.isPanning = true;
            state.lastPanX = e.clientX;
            state.lastPanY = e.clientY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    canvas.addEventListener('mouseup', () => {
        state.isPanning = false;
        if (state.modoActual === MODO.PAN || state._spacePressed) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = (state.modoActual === MODO.NINGUNO) ? 'default' : 'crosshair';
        }
    });

    canvas.addEventListener('click', (e) => {
        if (state.isPanning) return;
        updateCanvasRect(canvas);

        const rawX = e.clientX - state.canvasRect.left;
        const rawY = e.clientY - state.canvasRect.top;

        const worldPos = toWorld(rawX, rawY);
        let x = worldPos.x;
        let y = worldPos.y;
        let z = worldPos.z;
        
        if (state.modoActual === MODO.BORRAR) {
            const itemToRemove = findItemAt(x, y);
            if (itemToRemove) {
                if (itemToRemove.tipo === 'linea') {
                    // Smart Delete: Dividir la línea por sus uniones
                    const segments = splitLineAtJunctions(itemToRemove);
                    
                    if (segments.length > 1) {
                        // Encontrar qué segmento borrar basándonos en la cercanía al mouse
                        let closestSegmentIdx = -1;
                        let minDist = Infinity;
                        
                        segments.forEach((seg, idx) => {
                            // Proyectar punto sobre segmento para ver distancia
                            const { x1, y1, x2, y2 } = seg.datos;
                            const z1 = seg.datos.z1 || 0;
                            const z2 = seg.datos.z2 || 0;
                            
                            // Usar una versión simplificada de la lógica de distancia punto-segmento
                            const t = ((x - x1)*(x2-x1) + (y - y1)*(y2-y1) + (z - z1)*(z2-z1)) / 
                                      (Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2) + Math.pow(z2-z1, 2));
                            const tClamped = Math.max(0, Math.min(1, t));
                            const px = x1 + tClamped * (x2 - x1);
                            const py = y1 + tClamped * (y2 - y1);
                            const pz = z1 + tClamped * (z2 - z1);
                            
                            const d = Math.hypot(x - px, y - py, z - pz);
                            if (d < minDist) {
                                minDist = d;
                                closestSegmentIdx = idx;
                            }
                        });

                        // Reemplazar la línea original por los segmentos restantes
                        const index = state.historial.indexOf(itemToRemove);
                        if (index > -1) {
                            const remainants = segments.filter((_, idx) => idx !== closestSegmentIdx);
                            state.historial.splice(index, 1, ...remainants);
                            if (setStatusCb) setStatusCb("Tramo de tubería eliminado.");
                        }
                    } else {
                        // No hay uniones, borrar línea completa
                        const index = state.historial.indexOf(itemToRemove);
                        if (index > -1) state.historial.splice(index, 1);
                        if (setStatusCb) setStatusCb("Inclinación eliminada.");
                    }
                } else {
                    // No es una línea (cota, nodo, válvula), borrar normal
                    const index = state.historial.indexOf(itemToRemove);
                    if (index > -1) state.historial.splice(index, 1);
                    if (setStatusCb) setStatusCb("Elemento eliminado.");
                }
                
                invalidateSnapCache();
                redraw();
                return;
            }
        }

        if (state.snapPoint) {
            x = state.snapPoint.x;
            y = state.snapPoint.y;
            z = state.snapPoint.z;
        } else if (state.smartSnapPoint) {
            x = state.smartSnapPoint.x;
            y = state.smartSnapPoint.y;
            z = state.smartSnapPoint.z || z;
          } else if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.angleSnapPoint) {
            x = state.angleSnapPoint.x;
            y = state.angleSnapPoint.y;
            z = state.angleSnapPoint.z || z;
        }

        if (state.modoActual === MODO.LINEA) {
            if (!state.lineaIniciada) {
                state.lineaIniciada = true;
                state.puntoInicio = { x, y, z };
                if (setStatusCb) setStatusCb('Punto de inicio fijado. Clic para terminar la tubería.');
            } else {
                state.historial.push({
                    tipo: 'linea',
                    datos: { 
                        x1: state.puntoInicio.x, y1: state.puntoInicio.y, z1: state.puntoInicio.z,
                        x2: x, y2: y, z2: z 
                    },
                });
                invalidateSnapCache();
                state.lineaIniciada = false;
                state.puntoInicio = null;
                if (setStatusCb) setStatusCb(`Tubería añadida. (${state.historial.filter(a => a.tipo === 'linea').length} en total)`);
                redraw();
            }
        } else if (state.modoActual === MODO.COMPRESOR) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'compresor', x, y, z } });
            invalidateSnapCache();
            if (setStatusCb) setStatusCb(`Compresor colocado en altura ${z}m.`);
            redraw();
        } else if (state.modoActual === MODO.CONSUMO) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'consumo', x, y, z } });
            invalidateSnapCache();
            if (setStatusCb) setStatusCb(`Punto de Consumo colocado en altura ${z}m.`);
            redraw();
        } else if (state.modoActual === MODO.VALVULA) {
            const snap = getLineSnap(x, y, z);
            if (snap) {
                state.historial.push({
                    tipo: 'valvula_manual',
                    datos: {
                        x: snap.x, y: snap.y, z: snap.z, angulo: snap.angulo, diametro: snap.linea.diametro || null
                    },
                });
                if (setStatusCb) setStatusCb('Válvula colocada sobre la tubería.');
                redraw();
            } else {
                if (setStatusCb) setStatusCb('Debes hacer clic SOBRE una tubería para colocar la válvula.');
            }
        } else if (state.modoActual === MODO.ACOTAR) {
            if (!state.cotaInicio) {
                state.cotaInicio = { x, y, z };
                if (setStatusCb) setStatusCb('Primer punto fijado. Clic en el segundo punto para completar la cota.');
            } else {
                const dist = Math.hypot(x - state.cotaInicio.x, y - state.cotaInicio.y, z - state.cotaInicio.z);
                if (dist > 5) {
                    state.historial.push({
                        tipo: 'cota',
                        datos: {
                            x1: state.cotaInicio.x, y1: state.cotaInicio.y, z1: state.cotaInicio.z,
                            x2: x, y2: y, z2: z,
                            offset: 30 / state.viewState.scale
                        }
                    });
                    if (setStatusCb) setStatusCb('Cota añadida.');
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
        
        // El punto de referencia Z del ratón debe ser el mismo que el punto de inicio si estamos dibujando,
        // esto permite dibujar tuberías horizontales a la misma altura sin esfuerzo.
        let refZ = state.viewState.currentZ || 0;
        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio) {
            refZ = state.puntoInicio.z || 0;
        }
        
        const worldPos = toWorld(rawX, rawY, refZ);
        const worldX = worldPos.x;
        const worldY = worldPos.y;
        const worldZ = worldPos.z;

        state.lastMouseX = rawX;
        state.lastMouseY = rawY;

        if (coordsDisplay) {
            coordsDisplay.textContent = `X: ${worldX.toFixed(2)}, Y: ${worldY.toFixed(2)}, Z: ${worldZ.toFixed(2)}`;
        }

        state.snapPoint = getSnapPoint(worldX, worldY, worldZ);

        state.smartSnapPoint = null;
        if (!state.snapPoint) {
            state.activeGuides = []; 
            state.smartSnapPoint = getSmartSnap(worldX, worldY, state.activeGuides);
            if (state.smartSnapPoint) state.smartSnapPoint.z = worldZ;
        } else {
            state.activeGuides = [];
        }

        state.angleSnapPoint = null;
        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio) {
            const z1 = state.puntoInicio.z || 0;
            state.angleSnapPoint = getAngleSnapPoint(state.puntoInicio.x, state.puntoInicio.y, worldX, worldY, z1);
            
            // IMPORTANTE: Para verticales, el Z ya viene calculado en el snap. No sobreescribir con worldZ.
            if (state.angleSnapPoint) {
                if (!state.angleSnapPoint.isVertical) {
                    state.angleSnapPoint.z = worldZ;
                }
                // Añadir una guía visual para el snap de ángulo
                state.activeGuides.push({
                    x1: state.puntoInicio.x, y1: state.puntoInicio.y, z1: state.puntoInicio.z,
                    x2: state.angleSnapPoint.x, y2: state.angleSnapPoint.y, z2: state.angleSnapPoint.z
                });
            }
        }

        if (state.snapPoint) {
            state.puntoMouse = { x: state.snapPoint.x, y: state.snapPoint.y, z: state.snapPoint.z };
        } else if (state.angleSnapPoint && state.angleSnapPoint.isVertical) {
            // Prioridad máxima a la verticalidad (Z) para evitar líneas torcidas
            state.puntoMouse = { x: state.angleSnapPoint.x, y: state.angleSnapPoint.y, z: state.angleSnapPoint.z };
        } else if (state.smartSnapPoint) {
            state.puntoMouse = { x: state.smartSnapPoint.x, y: state.smartSnapPoint.y, z: state.smartSnapPoint.z };
        } else if (state.angleSnapPoint) {
            state.puntoMouse = { x: state.angleSnapPoint.x, y: state.angleSnapPoint.y, z: state.angleSnapPoint.z };
        } else if (state.modoActual === MODO.VALVULA) {
            const snap = getLineSnap(worldX, worldY, worldZ);
            if (snap) {
                state.puntoMouse = { x: snap.x, y: snap.y, z: snap.z, angulo: snap.angulo };
            } else {
                state.puntoMouse = { x: worldX, y: worldY, z: worldZ };
            }
        } else {
            state.puntoMouse = { x: worldX, y: worldY, z: worldZ };
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

        const x1 = state.puntoInicio.x;
        const y1 = state.puntoInicio.y;
        const z1 = state.puntoInicio.z || 0;
        
        const x2 = state.puntoMouse.x;
        const y2 = state.puntoMouse.y;
        const z2 = state.puntoMouse.z || 0;

        let dx = x2 - x1;
        let dy = y2 - y1;
        let dz = z2 - z1;

        const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (currentDist < 0.01) { 
            // Dirección por defecto (X+) si no hay movimiento
            dx = 1; dy = 0; dz = 0;
        } else { 
            dx /= currentDist; 
            dy /= currentDist;
            dz /= currentDist;
        }

        const pxDistancia = distancia * PIXELS_POR_METRO;
        const finalX = x1 + dx * pxDistancia;
        const finalY = y1 + dy * pxDistancia;
        const finalZ = z1 + dz * pxDistancia;

        state.historial.push({ 
            tipo: 'linea', 
            datos: { 
                x1, y1, z1, 
                x2: finalX, y2: finalY, z2: finalZ 
            } 
        });
        
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

        if (e.key === 'c' || e.key === 'C') {
            if (document.activeElement.tagName !== 'INPUT') {
                const btnCenter = document.getElementById('btn-center');
                if (btnCenter) btnCenter.click();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state._spacePressed = false;
            canvas.style.cursor = (state.modoActual === MODO.PAN) ? 'grab' : 
                                 (state.modoActual === MODO.NINGUNO ? 'default' : 'crosshair');
        }
    });

    return { resizeCanvas }; // Expose to orchestrator if needed
}
