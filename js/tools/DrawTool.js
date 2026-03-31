import { state, invalidateSnapCache } from '../state.js';
import { scheduleRedraw } from '../drawing.js';
import {PIXELS_POR_METRO } from '../config.js';
import { setStatus } from '../ui/tools.js';

export const DrawTool = {
    onMouseDown(e, { worldPos }) {
        // Nada específico aquí, click maneja la lógica
    },
    
    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        if (!state.lineaIniciada) {
            state.lineaIniciada = true;
            state.puntoInicio = { x, y, z };
            setStatus('Punto de inicio fijado. Clic para terminar la tubería.');
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
            setStatus(`Tubería añadida. (${state.historial.filter(a => a.tipo === 'linea').length} en total)`);
            scheduleRedraw();
        }
    },

    onMouseMove(e, { worldPos, rawX, rawY, x, y, z }) {
        // Move Preview handled inside mathematics and overlays
    },

    confirmarLongitudManual(distancia) {
        if (!state.puntoInicio || !state.puntoMouse) return;

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
    }
};
