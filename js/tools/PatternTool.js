import { state, invalidateSnapCache } from '../state.js';
import { findItemAt, getLineSnap } from '../math.js';
import { scheduleRedraw } from '../drawing.js';
import { MODO } from '../config.js';
import { setStatus, setModo } from '../ui/tools.js';

export const PatternTool = {
    onClick(e, { x, y, z, rawX, rawY }) {
        if (!state._patternSource) {
            // Paso 1: Seleccionar la bajada original
            const item = findItemAt(x, y, rawX, rawY);
            if (item && item.tipo === 'nodo' && item.datos.tipo === 'bajada') {
                state._patternSource = item;
                setStatus('Bajada seleccionada. Ahora haz clic en la tubería destino.');
                scheduleRedraw();
            } else {
                setStatus('⚠️ Selecciona una BAJADA existente como origen.');
            }
        } else {
            // Paso 2: Seleccionar la línea
            const snap = getLineSnap(x, y, z);
            if (snap && snap.linea) {
                this.execute(state._patternSource, snap.linea);
                state._patternSource = null;
                setModo(MODO.NINGUNO, 'btn-cursor');
            } else {
                setStatus('⚠️ Selecciona la TUBERÍA donde quieres distribuir las bajadas.');
            }
        }
    },

    execute(source, line) {
        const distStr = prompt('Distancia entre bajadas (metros):', '2.0');
        const d = parseFloat(distStr);
        if (isNaN(d) || d <= 0) {
            setStatus('Operación cancelada o distancia inválida.');
            return;
        }

        const x1 = line.x1, y1 = line.y1, z1 = line.z1 || 0;
        const x2 = line.x2, y2 = line.y2, z2 = line.z2 || 0;
        const sx = source.datos.x, sy = source.datos.y, sz = source.datos.z || 0;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const L = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (L < 0.1) return;

        // Versores de la línea
        const ux = dx / L;
        const uy = dy / L;
        const uz = dz / L;

        // Encontrar el "t" del origen en la línea
        // t = (P_source - P1) · u / 100 (PIXELS_POR_METRO)
        // Pero trabajamos en píxeles del mundo
        const distPixels = d * 100; // PIXELS_POR_METRO

        // Determinamos la dirección: ¿Hacia P2 o hacia P1?
        // El usuario dijo "unidireccional". Vamos a ir hacia el extremo más alejado del origen.
        const distToP1 = Math.sqrt((sx-x1)**2 + (sy-y1)**2 + (sz-z1)**2);
        const distToP2 = Math.sqrt((sx-x2)**2 + (sy-y2)**2 + (sz-z2)**2);
        
        const dir = (distToP2 >= distToP1) ? 1 : -1;
        const vux = ux * dir;
        const vuy = uy * dir;
        const vuz = uz * dir;
        const activeL = (dir === 1) ? distToP2 : distToP1;

        const count = Math.floor(activeL / distPixels);
        if (count <= 0) {
            setStatus('La tubería es demasiado corta para esa distancia.');
            return;
        }

        for (let i = 1; i <= count; i++) {
            const nextX = sx + vux * (i * distPixels);
            const nextY = sy + vuy * (i * distPixels);
            const nextZ = sz + vuz * (i * distPixels);

            state.historial.push({
                tipo: 'nodo',
                datos: {
                    ...source.datos,
                    x: nextX,
                    y: nextY,
                    z: nextZ
                }
            });
        }

        invalidateSnapCache();
        scheduleRedraw();
        setStatus(`Matriz creada: ${count} nuevas bajadas añadidas.`);
    }
};
