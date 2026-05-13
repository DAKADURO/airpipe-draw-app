import { state, invalidateSnapCache } from '../state.js';
import { scheduleRedraw } from '../drawing.js';
import {PIXELS_POR_METRO } from '../config.js';
import { setStatus } from '../ui/tools.js';

export const DrawTool = {
    onMouseDown(e, { x, y, z }) {
        if (!state.lineaIniciada) {
            state.lineaIniciada = true;
            state.puntoInicio = { x, y, z };
            setStatus('Punto de inicio fijado. Haz clic para terminar la tubería.');
        } else {
            // Terminamos la línea en el Down (AutoCAD style) o dejamos que el Up lo haga
            // Para máxima estabilidad, usaremos el ciclo de Down/Up estándar
        }
    },
    
    onMouseUp(e, data) {
        if (!state.lineaIniciada || !state.puntoInicio || !state.puntoMouse) return;
        
        // Si el punto final es casi igual al inicial (clic accidental), ignoramos
        const dist = Math.hypot(state.puntoMouse.x - state.puntoInicio.x, state.puntoMouse.y - state.puntoInicio.y);
        if (dist < 5 / state.viewState.scale) return;

        state.historial.push({
            tipo: 'linea',
            datos: { 
                x1: state.puntoInicio.x, y1: state.puntoInicio.y, z1: state.puntoInicio.z || 0,
                x2: state.puntoMouse.x, y2: state.puntoMouse.y, z2: state.puntoMouse.z || 0,
                planar_intent: !state.viewState.isIsometric
            },
        });
        
        // Continuidad: El punto final de esta línea es el inicial de la siguiente
        const nextX = state.puntoMouse.x;
        const nextY = state.puntoMouse.y;
        const nextZ = state.puntoMouse.z || 0;

        invalidateSnapCache();
        state.puntoInicio = { x: nextX, y: nextY, z: nextZ };
        setStatus(`Tubería añadida. (${state.historial.filter(a => a.tipo === 'linea').length} en total)`);
        scheduleRedraw();
    },

    onClick(e, data) {
        // Ignorado, el flujo híbrido es gobernado por Down y Up
    },

    onMouseMove(e, { worldPos, rawX, rawY, x, y, z }) {
        // Move Preview handled inside mathematics and overlays
    },

    confirmarLongitudManual(distancia) {
        if (!state.puntoMouse) return;

        if (state.lineaIniciada && state.puntoInicio) {
            const x1 = state.puntoInicio.x;
            const y1 = state.puntoInicio.y;
            const z1 = state.puntoInicio.z || 0;
            
            const x2 = state.puntoMouse.x;
            const y2 = state.puntoMouse.y;
            const z2 = state.puntoMouse.z || 0;

            let dx = x2 - x1; let dy = y2 - y1; let dz = z2 - z1;
            const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (currentDist < 0.01) { dx = 1; dy = 0; dz = 0; } 
            else { dx /= currentDist; dy /= currentDist; dz /= currentDist; }

            const pxDistancia = distancia * PIXELS_POR_METRO;
            const finalX = x1 + dx * pxDistancia;
            const finalY = y1 + dy * pxDistancia;
            const finalZ = z1 + dz * pxDistancia;

            state.historial.push({ 
                tipo: 'linea', 
                datos: { 
                    x1, y1, z1, 
                    x2: finalX, y2: finalY, z2: finalZ,
                    planar_intent: !state.viewState.isIsometric
                } 
            });
            invalidateSnapCache(); 
            state.lineaIniciada = false;
            state.puntoInicio = null;
            setStatus(`Tubería de ${distancia}m añadida.`);
            scheduleRedraw();
        } else {
            // O-Track: Start line at a distance from a referenced corner/snap
            let origen = null;

            if (state.activeGuides && state.activeGuides.length > 0) {
                const gui = state.activeGuides[0];
                origen = { x: gui.x1, y: gui.y1, z: gui.z1 || 0 };
            } else if (state.snapPoint) {
                origen = { x: state.snapPoint.x, y: state.snapPoint.y, z: state.snapPoint.z || 0 };
            } else {
                setStatus('Acércate a un punto o usa una guía de alineación para la distancia inicial.');
                return;
            }

            const x2 = state.puntoMouse.x;
            const y2 = state.puntoMouse.y;
            const z2 = state.puntoMouse.z || 0;

            let dx = x2 - origen.x; let dy = y2 - origen.y; let dz = z2 - origen.z;
            const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (currentDist < 0.01) { 
                setStatus('Mueve el cursor hacia la dirección deseada antes de teclear la distancia.');
                return;
            } 
            
            // Constrain the tracking vector to strictly orthogonal / 45-degree global angles
            const isIso = state.viewState.isIsometric;
            let trackingAng = Math.atan2(dy, dx) * (180 / Math.PI);
            if (trackingAng < 0) trackingAng += 360;

            const targetAngles = isIso ? [0, 90, 180, 270] : [0, 45, 90, 135, 180, 225, 270, 315];
            let closestAngle = trackingAng;
            let minDiff = Infinity;
            for (const a of targetAngles) {
                let diff = Math.abs(trackingAng - a);
                if (diff > 180) diff = 360 - diff;
                if (diff < minDiff) {
                    minDiff = diff;
                    closestAngle = a;
                }
            }

            // Snap it strictly if it is within a reasonable tracking tolerance (e.g., 30 degrees)
            if (minDiff <= 30) {
                const rad = closestAngle * (Math.PI / 180);
                // Math.cos and Math.sin can return extremely small numbers instead of exactly 0
                dx = Math.round(Math.cos(rad) * 1e8) / 1e8;
                dy = Math.round(Math.sin(rad) * 1e8) / 1e8;
            } else {
                dx /= currentDist; 
                dy /= currentDist; 
            }
            
            // For isometric Z tracking (vertical screen)
            if (isIso && state.angleSnapPoint && state.angleSnapPoint.isVertical) {
                 dx = 0;
                 dy = 0;
                 dz = dz > 0 ? 1 : -1;
            } else {
                 dz = 0; // Prevent accidental Z drift in O-Track if not strictly vertical
            }

            const pxDistancia = distancia * PIXELS_POR_METRO;
            const finalX = origen.x + dx * pxDistancia;
            const finalY = origen.y + dy * pxDistancia;
            const finalZ = origen.z + dz * pxDistancia;

            state.lineaIniciada = true;
            state.puntoInicio = { x: finalX, y: finalY, z: finalZ };
            state._drawJustStarted = true;
            setStatus(`Punto iniciado a ${distancia}m de la esquina. Dibuja la tubería.`);
            scheduleRedraw();
        }
    }
};
