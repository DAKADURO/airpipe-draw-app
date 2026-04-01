import { state } from './state.js';

export const SNAP_RADIUS = 15;
export const SNAP_ANGLE = 22.5;
export const SNAP_GUIDE_TOLERANCE = 10;
export const ANGULOS_SNAP = [0, 45, 90, 135, 180, 225, 270, 315];

export function toWorld(screenX, screenY, currentZ = null) {
    const { scale, offsetX, offsetY, isIsometric } = state.viewState;
    const rawX = (screenX - offsetX) / scale;
    const rawY = (screenY - offsetY) / scale;

    if (!isIsometric) {
        return { x: rawX, y: rawY, z: 0 };
    }

    // Inversión Isométrica precisa (Isoplane Top)
    const z = currentZ !== null ? currentZ : state.viewState.currentZ;
    const s3 = Math.sqrt(3);
    const y = (rawY + z) - (rawX / s3);
    const x = 2 * (rawY + z) - y;
    return { x, y, z };
}

export function projectIso(worldX, worldY, worldZ = 0) {
    const cos30 = 0.86602540378; 
    return {
        x: (worldX - worldY) * cos30,
        y: (worldX + worldY) * 0.5 - worldZ
    };
}

export function toScreen(worldX, worldY, worldZ = 0) {
    const { scale, offsetX, offsetY, isIsometric } = state.viewState;
    
    let wx, wy;
    if (isIsometric) {
        const p = projectIso(worldX, worldY, worldZ);
        wx = p.x;
        wy = p.y;
    } else {
        wx = worldX;
        wy = worldY;
    }

    return {
        x: wx * scale + offsetX,
        y: wy * scale + offsetY
    };
}

export function getSnapPoints() {
    if (state._snapPointsCache !== null) return state._snapPointsCache;
    const puntos = [];
    for (const accion of state.historial) {
        if (accion.tipo === 'linea') {
            const { x1, y1, x2, y2 } = accion.datos;
            const z1 = accion.datos.z1 || 0;
            const z2 = accion.datos.z2 || 0;
            puntos.push({ x: x1, y: y1, z: z1, tipo: 'extremo' });
            puntos.push({ x: x2, y: y2, z: z2, tipo: 'extremo' });
            puntos.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: (z1 + z2) / 2, tipo: 'medio' });
        } else if (accion.tipo === 'nodo') {
            puntos.push({ x: accion.datos.x, y: accion.datos.y, z: accion.datos.z || 0, tipo: 'extremo' });
        }
    }

    // Añadir puntos de las líneas de fondo (DXF)
    if (state.bgLines && state.bgLines.length > 0) {
        for (const l of state.bgLines) {
            const sx = l.x1 * state.bgScale;
            const sy = l.y1 * state.bgScale;
            const ex = l.x2 * state.bgScale;
            const ey = l.y2 * state.bgScale;
            puntos.push({ x: sx, y: sy, z: 0, tipo: 'extremo' });
            puntos.push({ x: ex, y: ey, z: 0, tipo: 'extremo' });
        }
    }

    state._snapPointsCache = puntos;
    return puntos;
}

export function getSnapPoint(x, y, z = 0) {
    const puntos = getSnapPoints(); 
    const currentSnapRadius = SNAP_RADIUS / state.viewState.scale;
    let closest = null;
    let minDist = Infinity;

    for (const p of puntos) {
        // En isométrico, la distancia visual (2D proyectada) es más útil para el snap
        const worldP = toScreen(p.x, p.y, p.z);
        const mouseP = toScreen(x, y, z);
        const dist = Math.hypot(worldP.x - mouseP.x, worldP.y - mouseP.y) / state.viewState.scale;
        
        if (dist <= currentSnapRadius && dist < minDist) {
            minDist = dist;
            closest = p;
        }
    }
    return closest;
}

export function getAngleSnapPoint(x1, y1, x2, y2, z1) {
    const isIso = state.viewState.isIsometric;
    const { scale, offsetX, offsetY } = state.viewState;

    // 1. Detección de Z (Vertical en pantalla)
    // En isométrico, si el movimiento en pantalla es vertical, es un cambio de Z.
    if (isIso) {
        const p1Screen = projectIso(x1, y1, z1);
        const p2ScreenRaw = {
            x: (state.lastMouseX - offsetX) / scale,
            y: (state.lastMouseY - offsetY) / scale
        };
        const dx_s = p2ScreenRaw.x - p1Screen.x;
        const dy_s = p2ScreenRaw.y - p1Screen.y;
        const dist_s = Math.hypot(dx_s, dy_s);

        if (dist_s > 10) {
            let screenAngle = Math.atan2(dy_s, dx_s) * (180 / Math.PI);
            if (screenAngle < 0) screenAngle += 360;

            // En pantalla, 270 es arriba, 90 es abajo.
            let d90 = Math.min(Math.abs(screenAngle - 90), Math.abs(screenAngle - 450));
            let d270 = Math.abs(screenAngle - 270);

            if (d90 <= SNAP_ANGLE || d270 <= SNAP_ANGLE) {
                const deltaZ = p1Screen.y - p2ScreenRaw.y; // Up -> deltaZ positivo
                return {
                    x: x1,
                    y: y1,
                    z: z1 + deltaZ,
                    angle: (d270 < d90) ? 90 : 270, // Etiqueta lógica para el usuario
                    isVertical: true
                };
            }
        }
    }

    // 2. Snap de ángulos planos (World Space)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return null;

    let worldAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (worldAngle < 0) worldAngle += 360;

    // En isométrico, limitamos a 0, 90, 180, 270 para que en 2D sea ortogonal
    const targetAngles = isIso ? [0, 90, 180, 270] : ANGULOS_SNAP;
    let closestAngle = null;
    let minDiff = Infinity;

    for (const a of targetAngles) {
        let diff = Math.abs(worldAngle - a);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) {
            minDiff = diff;
            closestAngle = a;
        }
    }

    if (minDiff <= SNAP_ANGLE) {
        const rad = closestAngle * (Math.PI / 180);
        return {
            x: x1 + dist * Math.cos(rad),
            y: y1 + dist * Math.sin(rad),
            z: z1, // Mantenemos el Z del punto de inicio
            angle: closestAngle
        };
    }
    return null;
}

export function getSmartSnap(mouseX, mouseY, outGuides, overrideZ = null) {
    const puntos = getSnapPoints(); 
    const currentGuideTolerance = SNAP_GUIDE_TOLERANCE / state.viewState.scale;
    const isIso = state.viewState.isIsometric;

    let bestX = null;
    let bestY = null;
    let minDistX = Infinity;
    let minDistY = Infinity;

    // También buscar alineación en 45° con endpoints existentes
    let best45 = null;
    let minDist45 = Infinity;

    outGuides.length = 0;

    const isDrawingLine = state.lineaIniciada && state.puntoInicio;
    
    // Filter out self-snap (the punto de inicio itself)
    const referencePoints = isDrawingLine
        ? puntos.filter(p => {
            const dx = Math.abs(p.x - state.puntoInicio.x);
            const dy = Math.abs(p.y - state.puntoInicio.y);
            return dx > 0.5 || dy > 0.5;
          })
        : puntos;

    for (const p of referencePoints) {
        // --- Alineación Horizontal (misma Y) ---
        const diffY = Math.abs(p.y - mouseY);
        if (diffY <= currentGuideTolerance && diffY < minDistY) {
            minDistY = diffY;
            bestY = { val: p.y, source: p };
        }

        // --- Alineación Vertical (misma X) ---
        const diffX = Math.abs(p.x - mouseX);
        if (diffX <= currentGuideTolerance && diffX < minDistX) {
            minDistX = diffX;
            bestX = { val: p.x, source: p };
        }

        // --- Alineación 45° (solo 2D) ---
        if (!isIso) {
            const dx45 = mouseX - p.x;
            const dy45 = mouseY - p.y;
            const diff45 = Math.abs(Math.abs(dx45) - Math.abs(dy45));
            if (diff45 <= currentGuideTolerance && diff45 < minDist45 && Math.abs(dx45) > 5) {
                minDist45 = diff45;
                const sign = dy45 >= 0 ? 1 : -1;
                const avgDist = (Math.abs(dx45) + Math.abs(dy45)) / 2;
                const signX = dx45 >= 0 ? 1 : -1;
                best45 = {
                    x: p.x + signX * avgDist,
                    y: p.y + sign * avgDist,
                    source: p
                };
            }
        }
    }

    if (bestX === null && bestY === null && best45 === null) return null;

    const currentZ = overrideZ !== null ? overrideZ : (state.viewState.currentZ || 0);
    const result = { x: mouseX, y: mouseY };

    if (bestX !== null) {
        result.x = bestX.val;
        const matchedPt = bestX.source;
        // Guide from the MATCHED point to cursor — shows what you're aligned with (symmetry)
        outGuides.push({ 
            x1: matchedPt.x, y1: matchedPt.y, z1: matchedPt.z || 0,
            x2: result.x, y2: result.y, z2: currentZ,
            tipo: 'vertical'
        });
    }

    if (bestY !== null) {
        result.y = bestY.val;
        const matchedPt = bestY.source;
        // Guide from the MATCHED point to cursor — shows what you're aligned with (symmetry)
        outGuides.push({ 
            x1: matchedPt.x, y1: matchedPt.y, z1: matchedPt.z || 0,
            x2: result.x, y2: result.y, z2: currentZ,
            tipo: 'horizontal'
        });
    }

    // Si hay alineación 45° y no hay snap H/V más fuerte, usar 45°
    if (best45 !== null && bestX === null && bestY === null) {
        result.x = best45.x;
        result.y = best45.y;
        outGuides.push({
            x1: best45.source.x, y1: best45.source.y, z1: best45.source.z || 0,
            x2: result.x, y2: result.y, z2: currentZ,
            tipo: 'diagonal'
        });
    }

    return result;
}



export function getLineSnap(x, y, z = 0) {
    const TOLERANCIA = 20 / state.viewState.scale;
    let closest = null;
    let minDist = Infinity;

    for (const accion of state.historial) {
        if (accion.tipo !== 'linea') continue;
        const { x1, y1, x2, y2 } = accion.datos;
        const z1 = accion.datos.z1 || 0;
        const z2 = accion.datos.z2 || 0;

        // Proyectar coordenadas a 2D para interactuar visualmente
        const p1 = toScreen(x1, y1, z1);
        const p2 = toScreen(x2, y2, z2);
        const m  = toScreen(x, y, z);

        const A = m.x - p1.x;
        const B = m.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;

        let px, py, pz;
        if (param < 0) {
            px = x1; py = y1; pz = z1;
        } else if (param > 1) {
            px = x2; py = y2; pz = z2;
        } else {
            px = x1 + param * (x2 - x1);
            py = y1 + param * (y2 - y1);
            pz = z1 + param * (z2 - z1);
        }

        const proj = toScreen(px, py, pz);
        const dist = Math.hypot(m.x - proj.x, m.y - proj.y) / state.viewState.scale;
        
        if (dist < TOLERANCIA && dist < minDist) {
            minDist = dist;
            const angulo = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
            closest = { x: px, y: py, z: pz, angulo, linea: accion.datos };
        }
    }
    return closest;
}

export function getCotaAt(screenX, screenY) {
    const cotas = state.historial.filter(a => a.tipo === 'cota');
    for (const c of cotas) {
        const { x1, y1, x2, y2, offset } = c.datos;
        
        const p1 = toScreen(x1, y1, c.datos.z1 || 0);
        const p2 = toScreen(x2, y2, c.datos.z2 || 0);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthScreen = Math.hypot(dx, dy);
        if (lengthScreen < 1) continue;

        const ux = dx / lengthScreen;
        const uy = dy / lengthScreen;
        const px = -uy;
        const py = ux;
        const off = (offset !== undefined ? offset : (30 / state.viewState.scale)) * state.viewState.scale;

        const cx1 = p1.x + px * off;
        const cy1 = p1.y + py * off;
        const cx2 = p2.x + px * off;
        const cy2 = p2.y + py * off;

        const midX = (cx1 + cx2) / 2;
        const midY = (cy1 + cy2) / 2;

        const hitRadius = 25; // Tamaño del área cliquable en pantalla

        const dMouse = Math.hypot(screenX - midX, screenY - midY);
        if (dMouse < hitRadius) { 
            return { cota: c, midX, midY };
        }
    }
    return null;
}

/**
 * Encuentra un elemento en el historial que coincida con la posición (wx, wy)
 * con una tolerancia basada en la escala actual.
 */
export function findItemAt(wx, wy, screenX = null, screenY = null) {
    const s = state.viewState.scale;
    const isIso = state.viewState.isIsometric;
    
    // Obtener posición del mouse en pantalla
    const mousePos = screenX !== null ? { x: screenX, y: screenY } : toScreen(wx, wy, isIso ? state.viewState.currentZ : 0);

    // 1. Probar Cotas primero (hit-box de texto/centro en pantalla)
    const cotaHit = getCotaAt(mousePos.x, mousePos.y);
    if (cotaHit) return cotaHit.cota;

    // 2. Probar Nodos (Compresor / Consumo)
    const radioNodoPxs = 15; // píxeles físicos en pantalla
    for (const a of state.historial) {
        if (a.tipo === 'nodo' || a.tipo === 'valvula_manual') {
            const z = a.datos.z || 0;
            const nodeP = toScreen(a.datos.x, a.datos.y, z);
            const d = Math.hypot(mousePos.x - nodeP.x, mousePos.y - nodeP.y);
            if (d <= radioNodoPxs) return a;
        }
    }

    // 4. Probar Notas
    const hNota = 20; // Aproximadamente el alto de la caja en píxeles
    for (const a of state.historial) {
        if (a.tipo === 'nota') {
            const z = a.datos.z || 0;
            const noteP = toScreen(a.datos.x, a.datos.y, z);
            // Caja aproximada para hit-test
            if (mousePos.x >= noteP.x && mousePos.x <= noteP.x + 100 &&
                mousePos.y >= noteP.y && mousePos.y <= noteP.y + hNota) {
                return a;
            }
        }
    }

    // 5. Probar Líneas (Tuberías)
    const snapLinea = getLineSnap(wx, wy, isIso ? state.viewState.currentZ : 0);
    if (snapLinea) {
        return state.historial.find(a => 
            a.tipo === 'linea' && 
            a.datos.x1 === snapLinea.linea.x1 && 
            a.datos.y1 === snapLinea.linea.y1 &&
            a.datos.x2 === snapLinea.linea.x2 && 
            a.datos.y2 === snapLinea.linea.y2
        );
    }

    return null;
}

/**
 * Divide una línea en segmentos basados en:
 * 1. Puntos de unión (extremos de otras líneas o nodos) que existen sobre su trayectoria
 * 2. Intersecciones reales (cruces) con otras líneas — estilo TRIM de AutoCAD
 */
export function splitLineAtJunctions(lineObject) {
    const { x1, y1, x2, y2 } = lineObject.datos;
    const z1 = lineObject.datos.z1 || 0;
    const z2 = lineObject.datos.z2 || 0;
    
    const TOL = 0.5; // Tolerancia en metros (mundo)
    const junctionPoints = [];

    for (const other of state.historial) {
        if (other === lineObject) continue;

        // --- A. Extremos de otras líneas/nodos que caen SOBRE esta línea ---
        let candidates = [];
        if (other.tipo === 'linea') {
            candidates.push({ x: other.datos.x1, y: other.datos.y1, z: other.datos.z1 || 0 });
            candidates.push({ x: other.datos.x2, y: other.datos.y2, z: other.datos.z2 || 0 });
        } else if (other.tipo === 'nodo' || other.tipo === 'valvula_manual') {
            candidates.push({ x: other.datos.x, y: other.datos.y, z: other.datos.z || 0 });
        }

        for (const p of candidates) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dz = z2 - z1;
            const lenSq = dx*dx + dy*dy + dz*dz;
            if (lenSq < 0.01) continue;

            const t = ((p.x - x1)*dx + (p.y - y1)*dy + (p.z - z1)*dz) / lenSq;

            if (t > 0.01 && t < 0.99) {
                const projX = x1 + t * dx;
                const projY = y1 + t * dy;
                const projZ = z1 + t * dz;
                const dist = Math.hypot(p.x - projX, p.y - projY, p.z - projZ);

                if (dist < TOL) {
                    if (!junctionPoints.some(jp => Math.abs(jp.t - t) < 0.01)) {
                        junctionPoints.push({ x: projX, y: projY, z: projZ, t });
                    }
                }
            }
        }

        // --- B. Intersecciones REALES línea-línea (cruces en el plano) — TRIM style ---
        if (other.tipo === 'linea') {
            const ox1 = other.datos.x1, oy1 = other.datos.y1;
            const ox2 = other.datos.x2, oy2 = other.datos.y2;

            // Intersección paramétrica 2D (proyección al plano XY)
            const dAx = x2 - x1;
            const dAy = y2 - y1;
            const dBx = ox2 - ox1;
            const dBy = oy2 - oy1;

            const denom = dAx * dBy - dAy * dBx;
            if (Math.abs(denom) < 0.0001) continue; // Paralelas

            const tA = ((ox1 - x1) * dBy - (oy1 - y1) * dBx) / denom;
            const tB = ((ox1 - x1) * dAy - (oy1 - y1) * dAx) / denom;

            // Ambos parámetros deben estar estrictamente dentro del segmento
            if (tA > 0.01 && tA < 0.99 && tB > 0.01 && tB < 0.99) {
                const ix = x1 + tA * dAx;
                const iy = y1 + tA * dAy;
                // Interpolar Z a lo largo de la línea objetivo
                const iz = z1 + tA * (z2 - z1);

                // Verificar que no sea un duplicado
                if (!junctionPoints.some(jp => Math.abs(jp.t - tA) < 0.01)) {
                    junctionPoints.push({ x: ix, y: iy, z: iz, t: tA });
                }
            }
        }
    }

    if (junctionPoints.length === 0) return [lineObject];

    junctionPoints.sort((a, b) => a.t - b.t);

    const segments = [];
    let lastP = { x: x1, y: y1, z: z1 };
    
    for (const jp of junctionPoints) {
        segments.push({
            tipo: 'linea',
            datos: { ...lineObject.datos, x1: lastP.x, y1: lastP.y, z1: lastP.z, x2: jp.x, y2: jp.y, z2: jp.z }
        });
        lastP = { x: jp.x, y: jp.y, z: jp.z };
    }
    
    segments.push({
        tipo: 'linea',
        datos: { ...lineObject.datos, x1: lastP.x, y1: lastP.y, z1: lastP.z, x2: x2, y2: y2, z2: z2 }
    });

    return segments;
}


/**
 * Devuelve todos los elementos dentro de una caja trazada en pantalla.
 * @param {Object} box - Objeto con {x, y, w, h} (Coordenadas de pantalla crudas)
 * @returns {Set} - Un conjunto de elementos del historial atrapados
 */
export function getItemsInScreenBox(box) {
    const selected = new Set();
    const left = Math.min(box.x, box.x + box.w);
    const right = Math.max(box.x, box.x + box.w);
    const top = Math.min(box.y, box.y + box.h);
    const bottom = Math.max(box.y, box.y + box.h);

    const inside = (px, py) => px >= left && px <= right && py >= top && py <= bottom;

    for (const a of state.historial) {
        if (a.tipo === 'linea') {
            const p1 = toScreen(a.datos.x1, a.datos.y1, a.datos.z1 || 0);
            const p2 = toScreen(a.datos.x2, a.datos.y2, a.datos.z2 || 0);
            const tVals = [0, 0.25, 0.5, 0.75, 1];
            let isHit = false;
            for (let t of tVals) {
                const px = p1.x + t * (p2.x - p1.x);
                const py = p1.y + t * (p2.y - p1.y);
                if (inside(px, py)) {
                    isHit = true;
                    break;
                }
            }
            if (isHit) selected.add(a);
        } else if (a.tipo === 'nodo' || a.tipo === 'valvula_manual' || a.tipo === 'nota') {
            const p = toScreen(a.datos.x, a.datos.y, a.datos.z || 0);
            if (inside(p.x, p.y)) selected.add(a);
        } else if (a.tipo === 'cota') {
            const p1 = toScreen(a.datos.x1, a.datos.y1, a.datos.z1 || 0);
            const p2 = toScreen(a.datos.x2, a.datos.y2, a.datos.z2 || 0);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            if (inside(midX, midY)) selected.add(a);
        }
    }
    return selected;
}
