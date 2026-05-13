import { state } from './state.js';

export const SNAP_RADIUS = 20;
export const SNAP_ANGLE = 22.5;
export const SNAP_GUIDE_TOLERANCE = 15;
export const ANGULOS_SNAP = [0, 45, 90, 135, 180, 225, 270, 315];

// Constants for asymmetric isometric projection
const ISO_ALPHA = 30 * Math.PI / 180;
const ISO_BETA  = 35 * Math.PI / 180;
const C_ALPHA = Math.cos(ISO_ALPHA);
const S_ALPHA = Math.sin(ISO_ALPHA);
const C_BETA  = Math.cos(ISO_BETA);
const S_BETA  = Math.sin(ISO_BETA);
const SIN_SUM = Math.sin(ISO_ALPHA + ISO_BETA);

export function toWorld(screenX, screenY, currentZ = null) {
    const { scale, offsetX, offsetY, isIsometric } = state.viewState;
    const rawX = (screenX - offsetX) / scale;
    const rawY = (screenY - offsetY) / scale;

    if (!isIsometric) {
        return { x: rawX, y: rawY, z: 0 };
    }

    const z = currentZ !== null ? currentZ : state.viewState.currentZ;
    const worldY = ( (rawY + z) * C_ALPHA - rawX * S_ALPHA ) / SIN_SUM;
    const worldX = ( rawX * S_BETA + (rawY + z) * C_BETA ) / SIN_SUM;
    
    return { x: worldX, y: worldY, z };
}

export function projectIso(worldX, worldY, worldZ = 0) {
    return {
        x: worldX * C_ALPHA - worldY * C_BETA,
        y: worldX * S_ALPHA + worldY * S_BETA - worldZ
    };
}

export function toScreen(worldX, worldY, worldZ = 0) {
    const { scale, offsetX, offsetY, isIsometric } = state.viewState;
    let wx, wy;
    if (isIsometric) {
        const p = projectIso(worldX, worldY, worldZ);
        wx = p.x; wy = p.y;
    } else {
        wx = worldX; wy = worldY;
    }
    return { x: wx * scale + offsetX, y: wy * scale + offsetY };
}

export function clearInternalMathCaches() {
    // Ya no usamos el caché de grid interno, el SpatialIndex se encarga
}

export function getSnapPoint(x, y, z = 0) {
    const currentSnapRadius = SNAP_RADIUS / state.viewState.scale;
    const worldBox = { x: x - currentSnapRadius, y: y - currentSnapRadius, w: currentSnapRadius * 2, h: currentSnapRadius * 2 };
    
    const candidates = state.spatialIndex.search(worldBox);
    let closest = null;
    let minDist = Infinity;
    const mouseP = toScreen(x, y, z);

    for (const cand of candidates) {
        // El cand puede ser un objeto del historial o un bg_line generado por el indexer
        let pts = [];
        if (cand.tipo === 'linea' || cand.tipo === 'bg_line') {
            pts.push({ x: cand.datos.x1, y: cand.datos.y, z: cand.datos.z1 || 0, t: 'ext' });
            pts.push({ x: cand.datos.x2, y: cand.datos.y2, z: cand.datos.z2 || 0, t: 'ext' });
            pts.push({ x: (cand.datos.x1 + cand.datos.x2)/2, y: (cand.datos.y1 + cand.datos.y2)/2, z: ((cand.datos.z1||0) + (cand.datos.z2||0))/2, t: 'mid' });
        } else if (cand.tipo === 'nodo' || cand.tipo === 'valvula_manual') {
            pts.push({ x: cand.datos.x, y: cand.datos.y, z: cand.datos.z || 0, t: 'ext' });
        }

        for (const p of pts) {
            const screenP = toScreen(p.x, p.y, p.z);
            const d = Math.hypot(screenP.x - mouseP.x, screenP.y - mouseP.y) / state.viewState.scale;
            if (d <= currentSnapRadius && d < minDist) {
                minDist = d;
                closest = { x: p.x, y: p.y, z: p.z, tipo: p.t === 'mid' ? 'medio' : 'extremo' };
            }
        }
    }
    return closest;
}

export function getAngleSnapPoint(x1, y1, x2, y2, z1) {
    const isIso = state.viewState.isIsometric;
    const { scale, offsetX, offsetY } = state.viewState;

    if (isIso) {
        const p1Screen = projectIso(x1, y1, z1);
        const p2ScreenRaw = { x: (state.lastMouseX - offsetX) / scale, y: (state.lastMouseY - offsetY) / scale };
        const dx_s = p2ScreenRaw.x - p1Screen.x;
        const dy_s = p2ScreenRaw.y - p1Screen.y;
        const dist_s = Math.hypot(dx_s, dy_s);

        if (dist_s > 10) {
            let screenAngle = Math.atan2(dy_s, dx_s) * (180 / Math.PI);
            if (screenAngle < 0) screenAngle += 360;
            let d90 = Math.min(Math.abs(screenAngle - 90), Math.abs(screenAngle - 450));
            let d270 = Math.abs(screenAngle - 270);

            if (d90 <= SNAP_ANGLE || d270 <= SNAP_ANGLE) {
                return { x: x1, y: y1, z: z1 + (p1Screen.y - p2ScreenRaw.y), angle: (d270 < d90) ? 90 : 270, isVertical: true };
            }
        }
    }

    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return null;

    let worldAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (worldAngle < 0) worldAngle += 360;

    const targetAngles = isIso ? [0, 90, 180, 270] : ANGULOS_SNAP;
    let closestAngle = null, minDiff = Infinity;
    for (const a of targetAngles) {
        let diff = Math.abs(worldAngle - a);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) { minDiff = diff; closestAngle = a; }
    }

    if (minDiff <= SNAP_ANGLE) {
        const rad = closestAngle * (Math.PI / 180);
        return { x: x1 + dist * Math.cos(rad), y: y1 + dist * Math.sin(rad), z: z1, angle: closestAngle };
    }
    return null;
}

export function getSmartSnap(mouseX, mouseY, outGuides, overrideZ = null) {
    const currentSnapRadius = SNAP_RADIUS / state.viewState.scale;
    const worldBox = { x: mouseX - 1000, y: mouseY - 1000, w: 2000, h: 2000 };
    const candidates = state.spatialIndex.search(worldBox);
    
    const currentGuideTolerance = SNAP_GUIDE_TOLERANCE / state.viewState.scale;
    const isIso = state.viewState.isIsometric;
    let bestX = null, bestY = null, minDistX = Infinity, minDistY = Infinity;
    let best45 = null, minDist45 = Infinity;
    outGuides.length = 0;

    const isDrawingLine = state.lineaIniciada && state.puntoInicio;
    
    for (const cand of candidates) {
        let pts = [];
        if (cand.tipo === 'linea' || cand.tipo === 'bg_line') {
            pts.push({ x: cand.datos.x1, y: cand.datos.y1 });
            pts.push({ x: cand.datos.x2, y: cand.datos.y2 });
        } else if (cand.tipo === 'nodo') {
            pts.push({ x: cand.datos.x, y: cand.datos.y });
        }

        for (const p of pts) {
            if (isDrawingLine && Math.hypot(p.x - state.puntoInicio.x, p.y - state.puntoInicio.y) < 1) continue;

            const diffY = Math.abs(p.y - mouseY);
            if (diffY <= currentGuideTolerance && diffY < minDistY) { minDistY = diffY; bestY = { val: p.y, source: p }; }

            const diffX = Math.abs(p.x - mouseX);
            if (diffX <= currentGuideTolerance && diffX < minDistX) { minDistX = diffX; bestX = { val: p.x, source: p }; }

            if (!isIso) {
                const dx45 = mouseX - p.x, dy45 = mouseY - p.y;
                const diff45 = Math.abs(Math.abs(dx45) - Math.abs(dy45));
                if (diff45 <= currentGuideTolerance && diff45 < minDist45 && Math.abs(dx45) > 5) {
                    minDist45 = diff45;
                    const signX = dx45 >= 0 ? 1 : -1, signY = dy45 >= 0 ? 1 : -1;
                    const avgDist = (Math.abs(dx45) + Math.abs(dy45)) / 2;
                    best45 = { x: p.x + signX * avgDist, y: p.y + signY * avgDist, source: p };
                }
            }
        }
    }

    if (bestX === null && bestY === null && best45 === null) return null;
    const result = { x: mouseX, y: mouseY };

    if (bestX !== null) {
        result.x = bestX.val;
        outGuides.push({ x1: bestX.source.x, y1: bestX.source.y, x2: result.x, y2: result.y, tipo: 'vertical' });
    }
    if (bestY !== null) {
        result.y = bestY.val;
        outGuides.push({ x1: bestY.source.x, y1: bestY.source.y, x2: result.x, y2: result.y, tipo: 'horizontal' });
    }
    if (best45 !== null && bestX === null && bestY === null) {
        result.x = best45.x; result.y = best45.y;
        outGuides.push({ x1: best45.source.x, y1: best45.source.y, x2: result.x, y2: result.y, tipo: 'diagonal' });
    }
    return result;
}

export function findItemAt(wx, wy, screenX = null, screenY = null) {
    const isIso = state.viewState.isIsometric;
    const mousePos = screenX !== null ? { x: screenX, y: screenY } : toScreen(wx, wy, isIso ? state.viewState.currentZ : 0);

    const cotaHit = getCotaAt(mousePos.x, mousePos.y);
    if (cotaHit) return cotaHit.cota;

    const searchArea = 15 / state.viewState.scale;
    const worldBox = { x: wx - searchArea, y: wy - searchArea, w: searchArea * 2, h: searchArea * 2 };
    const candidates = state.spatialIndex.search(worldBox);

    for (const a of candidates) {
        if (a.tipo === 'nodo' || a.tipo === 'valvula_manual') {
            const nodeP = toScreen(a.datos.x, a.datos.y, a.datos.z || 0);
            if (Math.hypot(mousePos.x - nodeP.x, mousePos.y - nodeP.y) <= 20) return a;
        } else if (a.tipo === 'linea') {
            const p1 = toScreen(a.datos.x1, a.datos.y1, a.datos.z1 || 0);
            const p2 = toScreen(a.datos.x2, a.datos.y2, a.datos.z2 || 0);
            const dist = distToSegment(mousePos, p1, p2);
            if (dist <= 8) return a;
        }
    }
    return null;
}

export function getLineSnap(wx, wy, wz = 0) {
    const currentSnapRadius = 15 / state.viewState.scale;
    const worldBox = { x: wx - currentSnapRadius, y: wy - currentSnapRadius, w: currentSnapRadius * 2, h: currentSnapRadius * 2 };
    const candidates = state.spatialIndex.search(worldBox);
    const mouseP = toScreen(wx, wy, wz);

    let closest = null, minDist = Infinity;
    for (const cand of candidates) {
        if (cand.tipo !== 'linea' && cand.tipo !== 'bg_line') continue;
        const p1 = toScreen(cand.datos.x1, cand.datos.y1, cand.datos.z1 || 0);
        const p2 = toScreen(cand.datos.x2, cand.datos.y2, cand.datos.z2 || 0);
        const p = nearestPointOnSegment(mouseP, p1, p2);
        const d = Math.hypot(p.x - mouseP.x, p.y - mouseP.y) / state.viewState.scale;
        if (d <= 15 / state.viewState.scale && d < minDist) {
            minDist = d;
            const wp = toWorld(p.x, p.y, wz);
            closest = { x: wp.x, y: wp.y, z: wz, linea: cand.datos };
        }
    }
    return closest;
}

function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function nearestPointOnSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return v;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
}

export function getCotaAt(screenX, screenY) {
    const candidates = state.spatialIndex.search({ x: toWorld(screenX, screenY).x - 100, y: toWorld(screenX, screenY).y - 100, w: 200, h: 200 });
    for (const c of candidates) {
        if (c.tipo !== 'cota') continue;
        const { x1, y1, x2, y2, offset } = c.datos;
        const p1 = toScreen(x1, y1, c.datos.z1 || 0), p2 = toScreen(x2, y2, c.datos.z2 || 0);
        const dx = p2.x - p1.x, dy = p2.y - p1.y, lengthScreen = Math.hypot(dx, dy);
        if (lengthScreen < 1) continue;
        const ux = dx / lengthScreen, uy = dy / lengthScreen, px = -uy, py = ux;
        const off = (offset !== undefined ? offset : (30 / state.viewState.scale)) * state.viewState.scale;
        const cx1 = p1.x + px * off, cy1 = p1.y + py * off, cx2 = p2.x + px * off, cy2 = p2.y + py * off;
        const midX = (cx1 + cx2) / 2, midY = (cy1 + cy2) / 2;
        if (Math.hypot(screenX - midX, screenY - midY) < 25) return { cota: c, midX, midY };
    }
    return null;
}

export function getViewportWorldBounds() {
    const { width, height } = state.canvasRect || { width: window.innerWidth, height: window.innerHeight };
    const p0 = toWorld(0, 0), p1 = toWorld(width, 0), p2 = toWorld(0, height), p3 = toWorld(width, height);
    const minX = Math.min(p0.x, p1.x, p2.x, p3.x), maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y), maxY = Math.max(p0.y, p1.y, p2.y, p3.y);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Encuentra todos los elementos dentro de una caja de selección en pantalla.
 */
export function getItemsInScreenBox(box) {
    const x = box.w > 0 ? box.x : box.x + box.w;
    const y = box.h > 0 ? box.y : box.y + box.h;
    const w = Math.abs(box.w);
    const h = Math.abs(box.h);

    const p0 = toWorld(x, y);
    const p1 = toWorld(x + w, y);
    const p2 = toWorld(x, y + h);
    const p3 = toWorld(x + w, y + h);

    const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);

    const worldBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    const candidates = state.spatialIndex.search(worldBox);
    const caught = [];

    for (const cand of candidates) {
        if (cand.tipo === 'bg_line') continue; // No seleccionar fondo

        let isInside = false;
        if (cand.tipo === 'linea') {
            const screenP1 = toScreen(cand.datos.x1, cand.datos.y1, cand.datos.z1 || 0);
            const screenP2 = toScreen(cand.datos.x2, cand.datos.y2, cand.datos.z2 || 0);
            isInside = (screenP1.x >= x && screenP1.x <= x + w && screenP1.y >= y && screenP1.y <= y + h &&
                        screenP2.x >= x && screenP2.x <= x + w && screenP2.y >= y && screenP2.y <= y + h);
        } else if (cand.tipo === 'nodo' || cand.tipo === 'valvula_manual' || cand.tipo === 'nota' || cand.tipo === 'cota') {
            const p = toScreen(cand.datos.x || cand.datos.x1, cand.datos.y || cand.datos.y1, cand.datos.z || cand.datos.z1 || 0);
            isInside = (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h);
        }

        if (isInside) caught.push(cand);
    }
    return caught;
}

/**
 * Divide una línea en tramos si hay nodos o uniones intermedias.
 */
export function splitLineAtJunctions(lineItem) {
    const { x1, y1, x2, y2 } = lineItem.datos;
    const z1 = lineItem.datos.z1 || 0;
    const z2 = lineItem.datos.z2 || 0;
    
    // Encontrar todos los nodos o extremos que caen sobre esta línea
    const worldBox = { 
        x: Math.min(x1, x2) - 1, y: Math.min(y1, y2) - 1, 
        w: Math.abs(x1 - x2) + 2, h: Math.abs(y1 - y2) + 2 
    };
    
    const candidates = state.spatialIndex.search(worldBox);
    const splitPoints = [];

    for (const cand of candidates) {
        if (cand === lineItem || cand.tipo === 'bg_line' || cand.tipo === 'cota') continue;

        let pts = [];
        if (cand.tipo === 'linea') {
            pts.push({ x: cand.datos.x1, y: cand.datos.y1, z: cand.datos.z1 || 0 });
            pts.push({ x: cand.datos.x2, y: cand.datos.y2, z: cand.datos.z2 || 0 });
        } else if (cand.tipo === 'nodo' || cand.tipo === 'valvula_manual') {
            pts.push({ x: cand.datos.x, y: cand.datos.y, z: cand.datos.z || 0 });
        }

        for (const p of pts) {
            // Verificar si el punto p está sobre el segmento (x1,y1,z1)-(x2,y2,z2)
            const dStart = Math.hypot(p.x - x1, p.y - y1, p.z - z1);
            const dEnd = Math.hypot(p.x - x2, p.y - y2, p.z - z2);
            const lineLen = Math.hypot(x2 - x1, y2 - y1, z2 - z1);

            if (dStart > 0.1 && dEnd > 0.1 && Math.abs((dStart + dEnd) - lineLen) < 0.1) {
                // El punto está entre los extremos (no es un extremo propio)
                if (!splitPoints.some(sp => Math.hypot(sp.x - p.x, sp.y - p.y, sp.z - p.z) < 0.1)) {
                    splitPoints.push({ ...p, dist: dStart });
                }
            }
        }
    }

    if (splitPoints.length === 0) return [lineItem];

    // Ordenar puntos por distancia desde el inicio
    splitPoints.sort((a, b) => a.dist - b.dist);

    const segments = [];
    let lastPt = { x: x1, y: y1, z: z1 };
    
    for (const sp of splitPoints) {
        segments.push({
            tipo: 'linea',
            datos: { ...lineItem.datos, x1: lastPt.x, y1: lastPt.y, z1: lastPt.z, x2: sp.x, y2: sp.y, z2: sp.z }
        });
        lastPt = sp;
    }
    
    // Último tramo
    segments.push({
        tipo: 'linea',
        datos: { ...lineItem.datos, x1: lastPt.x, y1: lastPt.y, z1: lastPt.z, x2: x2, y2: y2, z2: z2 }
    });

    return segments;
}
