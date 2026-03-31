import { state, invalidateSnapCache } from '../state.js';
import { getLineSnap } from '../math.js';
import { MODO, PIXELS_POR_METRO } from '../config.js';
import { scheduleRedraw } from '../drawing.js';
import { setStatus, setModo } from '../ui/tools.js';

export const OffsetTool = {
    onClick(e, { worldPos, rawX, rawY, x, y, z }) {
        const snap = getLineSnap(x, y, z);
        if (snap) {
            const lineaInicial = state.historial.find(a => 
                a.tipo === 'linea' && 
                a.datos.x1 === snap.linea.x1 && a.datos.y1 === snap.linea.y1 &&
                a.datos.x2 === snap.linea.x2 && a.datos.y2 === snap.linea.y2
            );
            
            if (lineaInicial) {
                // Algoritmo BFS Intersecciones O(V+E)
                const trayecto = new Set([lineaInicial]);
                let queue = [lineaInicial];
                const eps = 0.5;
                const isConnected = (l1, l2) => {
                    const p1 = [{x:l1.datos.x1, y:l1.datos.y1, z:l1.datos.z1||0}, {x:l1.datos.x2, y:l1.datos.y2, z:l1.datos.z2||0}];
                    const p2 = [{x:l2.datos.x1, y:l2.datos.y1, z:l2.datos.z1||0}, {x:l2.datos.x2, y:l2.datos.y2, z:l2.datos.z2||0}];
                    for(const a of p1) {
                        for(const b of p2) {
                            if (Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) < eps) return true;
                        }
                    }
                    return false;
                };

                while (queue.length > 0) {
                    const curr = queue.shift();
                    for (const item of state.historial) {
                        if (item.tipo === 'linea' && !trayecto.has(item) && isConnected(curr, item)) {
                            trayecto.add(item);
                            queue.push(item);
                        }
                    }
                }

                const isIso = state.viewState.isIsometric;
                const defaultYMsg = isIso ? "1 (Vertical en plano 2D, Diagonal Isometrico)" : "1";
                const dxStr = prompt("Distancia de Desfase en X (m) [Horizontal]:", "0");
                if (dxStr === null) return;
                const dyStr = prompt("Distancia de Desfase en Y (m) [Eje Y]:", defaultYMsg);
                if (dyStr === null) return;
                const dzStr = prompt("Distancia de Desfase en Z (m) [Vertical real]:", "0");
                if (dzStr === null) return;

                const dx = (parseFloat(dxStr) || 0) * PIXELS_POR_METRO;
                const dy = (parseFloat(dyStr) || 0) * PIXELS_POR_METRO;
                const dz = (parseFloat(dzStr) || 0) * PIXELS_POR_METRO;

                if (dx === 0 && dy === 0 && dz === 0) {
                    setStatus('Desfase cancelado (distancias son 0).');
                    return;
                }

                trayecto.forEach(l => {
                    state.historial.push({
                        tipo: 'linea',
                        datos: {
                            ...l.datos,
                            x1: l.datos.x1 + dx, y1: l.datos.y1 + dy, z1: (l.datos.z1 || 0) + dz,
                            x2: l.datos.x2 + dx, y2: l.datos.y2 + dy, z2: (l.datos.z2 || 0) + dz,
                        }
                    });
                });

                invalidateSnapCache();
                setStatus(`Desfase generado: ${trayecto.size} tuberías clonadas.`);
                setModo(MODO.NINGUNO, 'btn-cursor');
                scheduleRedraw();
            }
        } else {
            setStatus('Debes hacer clic SOBRE una tubería para duplicarla.');
        }
    }
};
