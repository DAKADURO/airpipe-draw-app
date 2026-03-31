import { state } from '../state.js';
import { scheduleRedraw } from '../drawing.js';
import { setStatus } from '../ui/tools.js';

export const DimensionTool = {
    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        if (!state.cotaInicio) {
            state.cotaInicio = { x, y, z };
            setStatus('Punto inicial de cota fijado. Clic en punto final.');
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
    }
};
