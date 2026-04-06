import { state, invalidateSnapCache } from '../state.js';
import { scheduleRedraw } from '../drawing.js';
import {PIXELS_POR_METRO } from '../config.js';
import { setStatus } from '../ui/tools.js';

export const DrawTool = {
    onMouseDown(e, { worldPos, rawX, rawY, x, y, z }) {
        if (!state.lineaIniciada) {
            state.lineaIniciada = true;
            state.puntoInicio = { x, y, z };
            state._drawDragStart = { rawX, rawY };
            state._drawJustStarted = true;
            setStatus('Punto de inicio fijado. Arrastra o da clic para terminar la tubería.');
        } 
    },
    
    onMouseUp(e, { worldPos, rawX, rawY, x, y, z }) {
        if (!state.lineaIniciada) return;
        
        let dragged = false;
        if (state._drawDragStart) {
            const dist = Math.hypot(rawX - state._drawDragStart.rawX, rawY - state._drawDragStart.rawY);
            if (dist > 15) dragged = true;
        }

        if (state._drawJustStarted && !dragged) {
            state._drawJustStarted = false;
            return;
        }

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
        state._drawDragStart = null;
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

            state.historial.push({ tipo: 'linea', datos: { x1, y1, z1, x2: finalX, y2: finalY, z2: finalZ } });
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
            
            dx /= currentDist; dy /= currentDist; dz /= currentDist;

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
