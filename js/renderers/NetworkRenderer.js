import { 
    COLOR_LINEA, COLOR_LINEA_PREV, COLOR_COMPRESOR, COLOR_CONSUMO, 
    COLOR_COMPRESOR_BORDER, COLOR_CONSUMO_BORDER, GROSOR_LINEA, RADIO_NODO 
} from '../config.js';
import { toScreen, getViewportWorldBounds } from '../math.js';

export function drawNetwork(ctx, canvas, state) {
    const isIso = state.viewState.isIsometric;
    
    // Culling: Only render what's on screen
    const viewport = state._currentViewport || getViewportWorldBounds();
    const visibleElements = state.spatialIndex.search(viewport);

    // 1. Dibujar Líneas del Historial
    ctx.save();
    ctx.lineWidth = Math.max(GROSOR_LINEA * state.viewState.scale, 4.0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLOR_LINEA;

    for (const accion of visibleElements) {
        if (accion.tipo !== 'linea') continue;
        const { x1, y1, x2, y2, color } = accion.datos;
        const z1 = accion.datos.z1 || 0;
        const z2 = accion.datos.z2 || 0;

        ctx.save();
        if (color) ctx.strokeStyle = color;
        else {
            ctx.shadowColor = COLOR_LINEA;
            ctx.shadowBlur = 4;
        }
        drawLineaInternal(ctx, x1, y1, z1, x2, y2, z2, state, isIso);
        ctx.restore();
    }
    ctx.restore();

    // 2. Dibujar Líneas Rectificadas (Resultados de cálculo)
    if (state.resultadosCalculo && state.resultadosCalculo.length > 0) {
        ctx.save();
        ctx.lineWidth = 5.0; 
        ctx.strokeStyle = '#00BCD4'; // Cyan para tuberías calculadas
        for (const lRes of state.resultadosCalculo) {
            drawLineaInternal(ctx, lRes.x1, lRes.y1, lRes.z1 || 0, lRes.x2, lRes.y2, lRes.z2 || 0, state, isIso);
        }
        ctx.restore();
    }

    // 3. Dibujar Nodos (Compresores y Consumos)
    const r_nodo = RADIO_NODO; 
    for (const accion of visibleElements) {
        if (accion.tipo !== 'nodo') continue;
        const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0, state);
        
        if (accion.datos.tipo === 'compresor') {
            drawCompresor(ctx, p, r_nodo);
        } else {
            drawConsumo(ctx, p, r_nodo, accion.datos.dropSize);
        }
    }

    // 4. Diametros y Piezas (Solo si hay cálculo activo)
    if (state.resultadosCalculo) {
        drawCalculatedInfo(ctx, state, isIso);
    }

    // 5. Válvulas
    for (const accion of visibleElements) {
        if (accion.tipo === 'valvula_manual') {
            renderValvula(ctx, accion.datos.x, accion.datos.y, accion.datos.z || 0, accion.datos.angulo, '#FFC107', state);
        }
    }
}

export function drawLineaInternal(ctx, x1, y1, z1, x2, y2, z2, state, isIso) {
    if (!isIso) {
        const dz = (z2 || 0) - (z1 || 0);
        if (Math.abs(x1 - x2) < 0.1 && Math.abs(y1 - y2) < 0.1 && Math.abs(dz) > 0.1) {
            // Riser vertical en 2D
            const p = toScreen(x1, y1, z1, state);
            const r = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x - 4, p.y - 4); ctx.lineTo(p.x + 4, p.y + 4);
            ctx.moveTo(p.x + 4, p.y - 4); ctx.lineTo(p.x - 4, p.y + 4);
            ctx.stroke();
            return;
        }
    }
    const p1 = toScreen(x1, y1, z1, state);
    const p2 = toScreen(x2, y2, z2, state);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

function drawCompresor(ctx, p, r) {
    ctx.save();
    ctx.fillStyle = COLOR_COMPRESOR;
    ctx.strokeStyle = COLOR_COMPRESOR_BORDER;
    ctx.lineWidth = 2.5;
    
    // Outer glow
    ctx.shadowColor = COLOR_COMPRESOR;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.font = `bold 12px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', p.x, p.y);
    ctx.restore();
}

function drawConsumo(ctx, p, r, dropSize) {
    ctx.save();
    ctx.fillStyle = COLOR_CONSUMO;
    ctx.strokeStyle = COLOR_CONSUMO_BORDER;
    ctx.lineWidth = 2;
    
    ctx.shadowColor = COLOR_CONSUMO;
    ctx.shadowBlur = 8;

    const s = r * 0.8;
    ctx.beginPath();
    ctx.roundRect(p.x - s, p.y - s, s * 2, s * 2, 4);
    ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 10px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', p.x, p.y);
    ctx.restore();
}

function drawCalculatedInfo(ctx, state, isIso) {
    ctx.save();
    ctx.font = `bold 11px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00BCD4';

    for (const linea of state.resultadosCalculo) {
        if (!linea.diametro) continue;
        const pM = toScreen((linea.x1 + linea.x2)/2, (linea.y1 + linea.y2)/2, ((linea.z1||0) + (linea.z2||0))/2, state);
        ctx.fillText(`Ø${linea.diametro}`, pM.x, pM.y - 10);
    }
    ctx.restore();
}

export function drawLinea(ctx, x1, y1, z1, x2, y2, z2, preview, color, state) {
    ctx.save();
    ctx.strokeStyle = preview ? COLOR_LINEA_PREV : (color || COLOR_LINEA);
    ctx.lineWidth = Math.max(GROSOR_LINEA * state.viewState.scale, 4.0);
    if (preview) ctx.setLineDash([6, 4]);
    drawLineaInternal(ctx, x1, y1, z1, x2, y2, z2, state, state.viewState.isIsometric);
    ctx.restore();
}

export function renderValvula(ctx, x, y, z, anguloGrados, color, state) {
    const p = toScreen(x, y, z || 0, state);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(anguloGrados * Math.PI / 180);
    const S = 8; 
    ctx.beginPath();
    ctx.moveTo(-S, -S / 1.5); ctx.lineTo(0, 0); ctx.lineTo(-S, S / 1.5); ctx.closePath();
    ctx.moveTo(S, -S / 1.5); ctx.lineTo(0, 0); ctx.lineTo(S, S / 1.5); ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
}
