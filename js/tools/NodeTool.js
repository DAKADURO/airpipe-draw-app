import { state, invalidateSnapCache } from '../state.js';
import { getLineSnap } from '../math.js';
import { MODO } from '../config.js';
import { scheduleRedraw } from '../drawing.js';
import { setStatus, setModo } from '../ui/tools.js';

export const NodeTool = {
    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        if (state.modoActual === MODO.COMPRESOR) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'compresor', x, y, z } });
            invalidateSnapCache();
            setStatus('Compresor añadido.');
            scheduleRedraw();
            
        } else if (state.modoActual === MODO.CONSUMO) {
            state.historial.push({ tipo: 'nodo', datos: { tipo: 'consumo', x, y, z } });
            invalidateSnapCache();
            setStatus('Punto de consumo añadido.');
            scheduleRedraw();
            
        } else if (state.modoActual === MODO.VALVULA) {
            const snap = getLineSnap(x, y, z);
            if (snap) {
                state.historial.push({
                    tipo: 'valvula_manual',
                    datos: { x: snap.x, y: snap.y, z: snap.z || 0, angulo: snap.angulo }
                });
                invalidateSnapCache();
                setStatus('Válvula de aislamiento insertada.');
                scheduleRedraw();
            } else {
                setStatus('Haz clic sobre una línea de tubería para insertar una válvula.');
            }
            
        } else if (state.modoActual === MODO.NOTA) {
            const texto = prompt("Introduce el texto de la nota:");
            if (texto) {
                state.historial.push({ tipo: 'nota', datos: { texto, x, y, z } });
                setStatus('Nota añadida.');
                scheduleRedraw();
            } else {
                setStatus('Creación de nota cancelada.');
            }
            setModo(MODO.NINGUNO, 'btn-cursor');
        }
    }
};
