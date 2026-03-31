import { MODO, PIXELS_POR_METRO, COLOR_LINEA } from '../config.js';
import { toScreen, getLineSnap } from '../math.js';
import { drawLinea } from './NetworkRenderer.js';

export function drawOverlay(ctx, canvas, state) {
    // 1. Linea temporal de dibujo
    if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio && state.puntoMouse) {
        const z1 = state.puntoInicio.z || 0;
        const z2 = state.puntoMouse.z || 0;
        drawLinea(ctx, state.puntoInicio.x, state.puntoInicio.y, z1, state.puntoMouse.x, state.puntoMouse.y, z2, true, null, state);
        
        const p = toScreen(state.puntoInicio.x, state.puntoInicio.y, z1);
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_LINEA; ctx.fill(); ctx.restore();
    }

    // 2. Manipuladores (Diamantes)
    ctx.save();
    ctx.strokeStyle = '#9C27B0'; 
    ctx.lineWidth = 1.5;
    const dm = 6;
    const selection = state.historial.filter(a => a.seleccionada);
    for (const accion of selection) {
        if (accion.tipo !== 'linea') continue;
        const { x1, y1, x2, y2 } = accion.datos;
        if (!state.viewState.isIsometric) {
            const isVertical = (x1 === x2 && y1 === y2);
            if (isVertical) continue;
        }
        const p = toScreen((x1 + x2) / 2, (y1 + y2) / 2, ((accion.datos.z1||0) + (accion.datos.z2||0)) / 2);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - dm); ctx.lineTo(p.x + dm, p.y);
        ctx.lineTo(p.x, p.y + dm); ctx.lineTo(p.x - dm, p.y);
        ctx.closePath(); ctx.stroke();
    }
    ctx.restore();

    // 3. Puntos de Snap
    if (state.snapPoint) {
        ctx.save();
        const { x, y, z, tipo } = state.snapPoint;
        const isMidpoint = tipo === 'medio';
        const r_snap = 6;
        ctx.lineWidth = 2;
        ctx.strokeStyle = isMidpoint ? '#9C27B0' : '#FF9800';
        const p = toScreen(x, y, z);

        if (isMidpoint) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - r_snap * 1.4); ctx.lineTo(p.x + r_snap * 1.4, p.y);
            ctx.lineTo(p.x, p.y + r_snap * 1.4); ctx.lineTo(p.x - r_snap * 1.4, p.y);
            ctx.closePath(); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(p.x, p.y, r_snap, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    // 4. Guías Angulares
    if (state.angleSnapPoint) {
        ctx.save();
        const { x, y, angle, isVertical } = state.angleSnapPoint;
        const z = state.angleSnapPoint.z !== undefined ? state.angleSnapPoint.z : (state.viewState.currentZ || 0);
        const p = toScreen(x, y, z);
        ctx.fillStyle = COLOR_LINEA;
        ctx.font = `bold 12px Consolas, monospace`;
        let label = `${angle.toFixed(1)}°`;
        if (state.viewState.isIsometric) {
            if (isVertical) label = "Vertical (Z)";
            else if (angle === 0 || angle === 180) label = "Eje X";
            else if (angle === 90 || angle === 270) label = "Eje Y";
        }
        ctx.fillText(label, p.x + 10, p.y - 10);
        ctx.restore();
    }

    if (state.activeGuides && state.activeGuides.length > 0) {
        ctx.save();
        for (const guia of state.activeGuides) {
            const p1 = toScreen(guia.x1, guia.y1, guia.z1 || 0);
            const p2 = toScreen(guia.x2, guia.y2, guia.z2 || 0);

            // Color por tipo de guía
            const isDiag = guia.tipo === 'diagonal';
            ctx.strokeStyle = isDiag ? 'rgba(255, 152, 0, 0.6)' : 'rgba(0, 188, 212, 0.5)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 4]);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Marcador de intersección (diamante pequeño en el punto de destino)
            ctx.setLineDash([]);
            ctx.strokeStyle = isDiag ? '#FF9800' : '#00BCD4';
            ctx.lineWidth = 1.5;
            const cr = 4;
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y - cr);
            ctx.lineTo(p2.x + cr, p2.y);
            ctx.lineTo(p2.x, p2.y + cr);
            ctx.lineTo(p2.x - cr, p2.y);
            ctx.closePath();
            ctx.stroke();

            // 'X' en el punto fuente
            ctx.lineWidth = 1;
            ctx.strokeStyle = isDiag ? 'rgba(255, 152, 0, 0.4)' : 'rgba(0, 188, 212, 0.35)';
            const xr = 3;
            ctx.beginPath();
            ctx.moveTo(p1.x - xr, p1.y - xr); ctx.lineTo(p1.x + xr, p1.y + xr);
            ctx.moveTo(p1.x - xr, p1.y + xr); ctx.lineTo(p1.x + xr, p1.y - xr);
            ctx.stroke();
        }
        ctx.restore();
    }

    // 5. Notas y Cotas
    const notas = state.historial.filter(a => a.tipo === 'nota');
    for (const nota of notas) renderNota(ctx, nota.datos.x, nota.datos.y, nota.datos.z || 0, nota.datos.texto, state);

    const cotas = state.historial.filter(a => a.tipo === 'cota');
    for (const c of cotas) renderCota(ctx, c.datos, false, state);

    if (state.modoActual === MODO.ACOTAR && state.cotaInicio && state.puntoMouse && !state.isPanning) {
        renderCota(ctx, {
            x1: state.cotaInicio.x, y1: state.cotaInicio.y, z1: state.cotaInicio.z || 0,
            x2: state.puntoMouse.x, y2: state.puntoMouse.y, z2: state.puntoMouse.z || 0
        }, true, state);
    }

    // 6. Highlight de Seleccionados y Ghosting
    if (state.seleccionados && state.seleccionados.size > 0) {
        ctx.save();
        ctx.shadowColor = '#00BFFF'; ctx.shadowBlur = 10;
        ctx.lineWidth = 3; ctx.strokeStyle = '#00BFFF';
        for (const item of state.seleccionados) {
            if (item.tipo === 'linea') {
                const p1 = toScreen(item.datos.x1, item.datos.y1, item.datos.z1 || 0);
                const p2 = toScreen(item.datos.x2, item.datos.y2, item.datos.z2 || 0);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            } else if (item.tipo === 'nodo' || item.tipo === 'valvula_manual') {
                const p = toScreen(item.datos.x, item.datos.y, item.datos.z || 0);
                ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
            }
        }
        ctx.restore();
    }

    if (state.modoActual === MODO.MOVER && state.seleccionados && state.seleccionados.size > 0 && state.moveAnchor && state.puntoMouse && !state.isPanning) {
        const snapDestObj = getLineSnap(state.puntoMouse.x, state.puntoMouse.y, state.viewState.currentZ) || state.puntoMouse;
        const destX = snapDestObj.x !== undefined ? snapDestObj.x : state.puntoMouse.x;
        const destY = snapDestObj.y !== undefined ? snapDestObj.y : state.puntoMouse.y;
        const destZ = snapDestObj.z !== undefined ? snapDestObj.z : (state.viewState.currentZ || 0);
        const dx = destX - state.moveAnchor.x; const dy = destY - state.moveAnchor.y; const dz = destZ - state.moveAnchor.z;

        ctx.save();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
        for (const item of state.seleccionados) {
             if (item.tipo === 'linea') {
                const p1 = toScreen(item.datos.x1 + dx, item.datos.y1 + dy, (item.datos.z1||0) + dz);
                const p2 = toScreen(item.datos.x2 + dx, item.datos.y2 + dy, (item.datos.z2||0) + dz);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
             } else if (item.tipo === 'nodo' || item.tipo === 'valvula_manual') {
                const p = toScreen(item.datos.x + dx, item.datos.y + dy, (item.datos.z||0) + dz);
                ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.stroke();
             }
        }
        const pA = toScreen(state.moveAnchor.x, state.moveAnchor.y, state.moveAnchor.z);
        const pD = toScreen(destX, destY, destZ);
        ctx.setLineDash([5, 5]); ctx.strokeStyle = '#FFEB3B';
        ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pD.x, pD.y); ctx.stroke();
        ctx.restore();
    }

    // 7. Caja de Selección (Absolute, no scaled)
    if (state.isSelecting && state.selectionBox) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Resetear transformacion
        ctx.fillStyle = 'rgba(0, 120, 215, 0.2)';
        ctx.strokeStyle = '#0078D7';
        ctx.lineWidth = 1;
        ctx.fillRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.w, state.selectionBox.h);
        ctx.strokeRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.w, state.selectionBox.h);
        ctx.restore();
    }
}

export function renderNota(ctx, x, y, z, texto, state) {
    const p = toScreen(x, y, z || 0);
    ctx.save();
    const fontSize = Math.max(10, 14 * state.viewState.scale);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const padding = 4;
    const metrics = ctx.measureText(texto);
    const w = metrics.width + padding * 2;
    const h = fontSize + padding * 2;

    ctx.fillStyle = 'rgba(30, 30, 30, 0.7)';
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texto, p.x + padding, p.y + padding);
    ctx.restore();
}

export function renderCota(ctx, datos, isPreview = false, state) {
    const { x1, y1, x2, y2, offset } = datos;
    const p1 = toScreen(x1, y1, datos.z1 || 0);
    const p2 = toScreen(x2, y2, datos.z2 || 0);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthScreen = Math.hypot(dx, dy);
    if (lengthScreen < 1) return;

    const ux = dx / lengthScreen;
    const uy = dy / lengthScreen;
    const px = -uy;
    const py = ux;

    const off = (offset !== undefined ? offset : (30 / state.viewState.scale)) * state.viewState.scale;

    const cx1 = p1.x + px * off;
    const cy1 = p1.y + py * off;
    const cx2 = p2.x + px * off;
    const cy2 = p2.y + py * off;

    const ext = 5;
    const alpha = isPreview ? 0.5 : 1.0;
    const color = isPreview ? `rgba(255, 215, 0, ${alpha})` : '#FFD700';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(isPreview ? [4, 4] : []);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(cx1 + px * ext, cy1 + py * ext);
    ctx.moveTo(p2.x, p2.y); ctx.lineTo(cx2 + px * ext, cy2 + py * ext);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();

    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx1 + ux * arrowSize + px * arrowSize * 0.3, cy1 + uy * arrowSize + py * arrowSize * 0.3);
    ctx.lineTo(cx1 + ux * arrowSize - px * arrowSize * 0.3, cy1 + uy * arrowSize - py * arrowSize * 0.3);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx2, cy2);
    ctx.lineTo(cx2 - ux * arrowSize + px * arrowSize * 0.3, cy2 - uy * arrowSize + py * arrowSize * 0.3);
    ctx.lineTo(cx2 - ux * arrowSize - px * arrowSize * 0.3, cy2 - uy * arrowSize - py * arrowSize * 0.3);
    ctx.closePath(); ctx.fill();

    const worldDist = Math.hypot(x2 - x1, y2 - y1, (datos.z2 || 0) - (datos.z1 || 0));
    const metros = (worldDist / PIXELS_POR_METRO).toFixed(2);
    const midX = (cx1 + cx2) / 2;
    const midY = (cy1 + cy2) / 2;
    const fontSize = 12;

    ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    let angle = Math.atan2(dy, dx);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const textWidth = ctx.measureText(`${metros} m`).width;
    ctx.fillStyle = 'rgba(10, 25, 47, 0.85)';
    ctx.fillRect(-textWidth / 2 - 3, -fontSize - 2, textWidth + 6, fontSize + 2);

    ctx.fillStyle = color;
    ctx.fillText(`${metros} m`, 0, -3);
    ctx.restore();
    ctx.restore();
}
