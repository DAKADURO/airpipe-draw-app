import { state } from '../state.js';
import { scheduleRedraw } from '../drawing.js';
import { setStatus } from '../ui/tools.js';
import { PIXELS_POR_METRO } from '../config.js';

export const DimensionTool = {
    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        if (!state.cotaInicio) {
            state.cotaInicio = { x, y, z };
            setStatus('Punto inicial de cota fijado. Clic en punto final o teclea longitud.');
        } else {
            const zInicio = state.cotaInicio.z || 0;
            state.historial.push({
                tipo: 'cota',
                datos: {
                    x1: state.cotaInicio.x, y1: state.cotaInicio.y, z1: zInicio,
                    x2: x, y2: y, z2: z,
                    offset: 30 / state.viewState.scale 
                }
            });
            state.cotaInicio = null;
            setStatus('Cota añadida.');
            scheduleRedraw();
        }
    },

    confirmarLongitudManual(distancia) {
        if (!state.cotaInicio || !state.puntoMouse) return;

        const x1 = state.cotaInicio.x;
        const y1 = state.cotaInicio.y;
        const z1 = state.cotaInicio.z || 0;

        const x2 = state.puntoMouse.x;
        const y2 = state.puntoMouse.y;
        const z2 = state.puntoMouse.z || 0;

        let dx = x2 - x1;
        let dy = y2 - y1;
        let dz = z2 - z1;
        const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (currentDist < 0.01) {
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
            tipo: 'cota',
            datos: {
                x1, y1, z1,
                x2: finalX, y2: finalY, z2: finalZ,
                offset: 30 / state.viewState.scale
            }
        });

        state.cotaInicio = null;
        setStatus(`Cota de ${distancia}m añadida.`);
        scheduleRedraw();
    }
};
