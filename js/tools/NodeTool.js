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
            
        } else if (state.modoActual === MODO.BAJADA) {
            const dialog = document.getElementById('bajada-dialog');
            if (dialog) {
                dialog.style.left = e.pageX + 15 + 'px';
                dialog.style.top = e.pageY + 15 + 'px';
                dialog.style.display = 'block';
                
                const btnConfirm = document.getElementById('btn-confirm-bajada');
                const btnCancel = document.getElementById('btn-cancel-bajada');
                
                const handleConfirm = () => {
                    const size = document.getElementById('bajada-size').value;
                    const height = parseFloat(document.getElementById('bajada-height').value) || 2.0;
                    const valve = document.getElementById('bajada-valve').value;
                    
                    state.historial.push({ 
                        tipo: 'nodo', 
                        datos: { tipo: 'bajada', x, y, z, dropSize: size, dropHeight: height, dropValve: valve } 
                    });
                    invalidateSnapCache();
                    setStatus(`Bajada de ${size} añadida a ${height}m.`);
                    scheduleRedraw();
                    
                    dialog.style.display = 'none';
                    newConfirm.removeEventListener('click', handleConfirm);
                    newCancel.removeEventListener('click', handleCancel);
                };
                
                const handleCancel = () => {
                    dialog.style.display = 'none';
                    setStatus('Creación de bajada cancelada.');
                    newConfirm.removeEventListener('click', handleConfirm);
                    newCancel.removeEventListener('click', handleCancel);
                };
                
                const newConfirm = btnConfirm.cloneNode(true);
                const newCancel = btnCancel.cloneNode(true);
                btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
                btnCancel.parentNode.replaceChild(newCancel, btnCancel);
                
                newConfirm.addEventListener('click', handleConfirm);
                newCancel.addEventListener('click', handleCancel);
            }
            
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
