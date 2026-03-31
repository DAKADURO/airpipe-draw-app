import { state, invalidateSnapCache } from '../state.js';
import { findItemAt, getLineSnap, splitLineAtJunctions, getItemsInScreenBox } from '../math.js';
import { scheduleRedraw } from '../drawing.js';
import { MODO } from '../config.js';
import { setStatus, setModo } from '../ui/tools.js';

export const SelectTool = {
    onMouseDown(e, { worldPos, rawX, rawY, x, y, z, multiSelectModifier }) {
        if (state.modoActual === MODO.MOVER || state.modoActual === MODO.BORRAR) return;
        
        const hitItem = findItemAt(worldPos.x, worldPos.y, rawX, rawY);
        if (hitItem) {
            if (!multiSelectModifier && !state.seleccionados.has(hitItem)) state.seleccionados.clear();
            if (state.seleccionados.has(hitItem) && multiSelectModifier) state.seleccionados.delete(hitItem);
            else state.seleccionados.add(hitItem);
            scheduleRedraw();
            return;
        }

        if (!multiSelectModifier) state.seleccionados.clear();
        state.isSelecting = true;
        state.selectionStart = { x: rawX, y: rawY };
        state.selectionBox = { x: rawX, y: rawY, w: 0, h: 0 };
    },

    onMouseMove(e, { rawX, rawY }) {
        if (state.isSelecting) {
            state.selectionBox.w = rawX - state.selectionStart.x;
            state.selectionBox.h = rawY - state.selectionStart.y;
            scheduleRedraw();
        }
    },

    onMouseUp(e) {
        if (state.isSelecting) {
            state.isSelecting = false;
            if (state.selectionBox && Math.abs(state.selectionBox.w) > 5 && Math.abs(state.selectionBox.h) > 5) {
                const caught = getItemsInScreenBox(state.selectionBox);
                for (const a of caught) state.seleccionados.add(a);
            }
            state.selectionBox = null;
            scheduleRedraw();
        }
    },

    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        if (state.modoActual === MODO.BORRAR) {
            const itemToRemove = findItemAt(x, y, rawX, rawY);
            if (itemToRemove) {
                if (itemToRemove.tipo === 'linea') {
                    const segments = splitLineAtJunctions(itemToRemove);
                    if (segments.length > 1) {
                        let closestSegmentIdx = -1; let minDist = Infinity;
                        segments.forEach((seg, idx) => {
                            const { x1, y1, x2, y2 } = seg.datos;
                            const z1 = seg.datos.z1 || 0; const z2 = seg.datos.z2 || 0;
                            const t = ((x - x1)*(x2-x1) + (y - y1)*(y2-y1) + (z - z1)*(z2-z1)) / 
                                      (Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2) + Math.pow(z2-z1, 2));
                            const tClamped = Math.max(0, Math.min(1, t));
                            const px = x1 + tClamped * (x2 - x1); const py = y1 + tClamped * (y2 - y1); const pz = z1 + tClamped * (z2 - z1);
                            const d = Math.hypot(x - px, y - py, z - pz);
                            if (d < minDist) { minDist = d; closestSegmentIdx = idx; }
                        });
                        const index = state.historial.indexOf(itemToRemove);
                        if (index > -1) {
                            const remainants = segments.filter((_, idx) => idx !== closestSegmentIdx);
                            state.historial.splice(index, 1, ...remainants);
                            setStatus("Tramo de tubería eliminado.");
                        }
                    } else {
                        const index = state.historial.indexOf(itemToRemove);
                        if (index > -1) state.historial.splice(index, 1);
                        setStatus("Inclinación eliminada.");
                    }
                } else {
                    const index = state.historial.indexOf(itemToRemove);
                    if (index > -1) state.historial.splice(index, 1);
                    setStatus("Elemento eliminado.");
                }
                invalidateSnapCache(); scheduleRedraw();
            }
        } else if (state.modoActual === MODO.MOVER) {
            if (!state.seleccionados || state.seleccionados.size === 0) {
                setStatus("⚠️ No hay elementos seleccionados. Vuelve al cursor normal para seleccionar.");
                return;
            }
            if (!state.moveAnchor) {
                const snap = getLineSnap(x, y, z) || { x, y, z };
                state.moveAnchor = { x: snap.x, y: snap.y, z: snap.z || 0 };
                setStatus("Ancla fijada. Haz clic en el destino final.");
                scheduleRedraw();
            } else {
                const snap = getLineSnap(x, y, z) || { x, y, z };
                const destX = snap.x; const destY = snap.y; const destZ = snap.z || 0;
                const dx = destX - state.moveAnchor.x; const dy = destY - state.moveAnchor.y; const dz = destZ - state.moveAnchor.z;
                
                for (const item of state.seleccionados) {
                    if (item.tipo === 'linea' || item.tipo === 'cota') {
                        item.datos.x1 += dx; item.datos.y1 += dy; if (item.datos.z1!==undefined) item.datos.z1 += dz;
                        item.datos.x2 += dx; item.datos.y2 += dy; if (item.datos.z2!==undefined) item.datos.z2 += dz;
                    } else if (item.tipo === 'nodo' || item.tipo === 'valvula_manual' || item.tipo === 'nota') {
                        item.datos.x += dx; item.datos.y += dy; if (item.datos.z!==undefined) item.datos.z += dz;
                    }
                }
                
                state.moveAnchor = null;
                state.seleccionados.clear();
                setModo(MODO.NINGUNO, 'btn-cursor');
                invalidateSnapCache();
                setStatus("Bloque movido exitosamente.");
                scheduleRedraw();
            }
        }
    }
};
