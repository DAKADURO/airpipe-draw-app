import { state } from './state.js';

export const SNAP_RADIUS = 15;
export const SNAP_ANGLE = 15;
export const SNAP_GUIDE_TOLERANCE = 10;
export const ANGULOS_SNAP = [0, 45, 90, 135, 180, 225, 270, 315];

export function toWorld(screenX, screenY) {
    return {
        x: (screenX - state.viewState.offsetX) / state.viewState.scale,
        y: (screenY - state.viewState.offsetY) / state.viewState.scale
    };
}

export function toScreen(worldX, worldY) {
    return {
        x: worldX * state.viewState.scale + state.viewState.offsetX,
        y: worldY * state.viewState.scale + state.viewState.offsetY
    };
}

export function getSnapPoints() {
    if (state._snapPointsCache !== null) return state._snapPointsCache;
    const puntos = [];
    for (const accion of state.historial) {
        if (accion.tipo === 'linea') {
            const { x1, y1, x2, y2 } = accion.datos;
            puntos.push({ x: x1, y: y1, tipo: 'extremo' });
            puntos.push({ x: x2, y: y2, tipo: 'extremo' });
            puntos.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, tipo: 'medio' });
        } else if (accion.tipo === 'nodo') {
            puntos.push({ x: accion.datos.x, y: accion.datos.y, tipo: 'extremo' });
        }
    }
    state._snapPointsCache = puntos;
    return puntos;
}

export function getSnapPoint(x, y) {
    const puntos = getSnapPoints(); 
    const currentSnapRadius = SNAP_RADIUS / state.viewState.scale;
    let closest = null;
    let minDist = Infinity;

    for (const p of puntos) {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist <= currentSnapRadius && dist < minDist) {
            minDist = dist;
            closest = p;
        }
    }
    return closest;
}

export function getAngleSnapPoint(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) return null;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    let closestAngle = null;
    let minDiff = Infinity;

    for (const a of ANGULOS_SNAP) {
        let diff = Math.abs(angle - a);
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
            angle: closestAngle
        };
    }
    return null;
}

export function getSmartSnap(mouseX, mouseY, outGuides) {
    const puntos = getSnapPoints(); 
    const currentGuideTolerance = SNAP_GUIDE_TOLERANCE / state.viewState.scale;

    let bestX = null;
    let bestY = null;
    let minDistX = Infinity;
    let minDistY = Infinity;

    outGuides.length = 0; // Clear array using reference mutation

    for (const p of puntos) {
        const diffX = Math.abs(p.x - mouseX);
        if (diffX <= currentGuideTolerance && diffX < minDistX) {
            minDistX = diffX;
            bestX = p.x;
        }
        const diffY = Math.abs(p.y - mouseY);
        if (diffY <= currentGuideTolerance && diffY < minDistY) {
            minDistY = diffY;
            bestY = p.y;
        }
    }

    if (bestX === null && bestY === null) return null;

    const result = { x: mouseX, y: mouseY };

    if (bestX !== null) {
        result.x = bestX;
        for (const p of puntos) {
            if (Math.abs(p.x - bestX) < 0.1) {
                outGuides.push({ x1: p.x, y1: p.y, x2: result.x, y2: result.y });
                break;
            }
        }
    }

    if (bestY !== null) {
        result.y = bestY;
        for (const p of puntos) {
            if (Math.abs(p.y - bestY) < 0.1) {
                outGuides.push({ x1: p.x, y1: p.y, x2: result.x, y2: result.y });
                break;
            }
        }
    }
    return result;
}

export function getLineSnap(x, y) {
    const TOLERANCIA = 20 / state.viewState.scale;
    let closest = null;
    let minDist = Infinity;

    for (const accion of state.historial) {
        if (accion.tipo !== 'linea') continue;
        const { x1, y1, x2, y2 } = accion.datos;

        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;

        let px, py;
        if (param < 0) {
            px = x1; py = y1;
        } else if (param > 1) {
            px = x2; py = y2;
        } else {
            px = x1 + param * C;
            py = y1 + param * D;
        }

        const dist = Math.hypot(x - px, y - py);
        if (dist < TOLERANCIA && dist < minDist) {
            minDist = dist;
            const angulo = Math.atan2(D, C) * (180 / Math.PI);
            closest = { x: px, y: py, angulo, linea: accion.datos };
        }
    }
    return closest;
}

export function getCotaAt(wx, wy) {
    const cotas = state.historial.filter(a => a.tipo === 'cota');
    for (const c of cotas) {
        const { x1, y1, x2, y2, offset } = c.datos;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const off = offset || 30 / state.viewState.scale;

        const midX = (x1 + x2) / 2 + px * off;
        const midY = (y1 + y2) / 2 + py * off;

        const hitH = 30 / state.viewState.scale;

        const dMouse = Math.hypot(wx - midX, wy - midY);
        if (dMouse < hitH) { 
            return { cota: c, midX, midY };
        }
    }
    return null;
}
