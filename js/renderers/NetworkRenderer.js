import { 
    COLOR_LINEA, COLOR_LINEA_PREV, COLOR_COMPRESOR, COLOR_CONSUMO, 
    COLOR_COMPRESOR_BORDER, COLOR_CONSUMO_BORDER, GROSOR_LINEA, RADIO_NODO 
} from '../config.js';
import { toScreen } from '../math.js';

export function drawNetwork(ctx, canvas, state) {
    const isIso = state.viewState.isIsometric;
    
    // 1. Dibujar Líneas del Historial (Siempre)
    const lineasHistorial = state.historial.filter(a => a.tipo === 'linea');
    ctx.save();
    for (const accion of lineasHistorial) {
        const { x1, y1, x2, y2, color } = accion.datos;
        const z1 = accion.datos.z1 || 0;
        const z2 = accion.datos.z2 || 0;
        drawLinea(ctx, x1, y1, z1, x2, y2, z2, false, color, state);
    }
    ctx.restore();

    // 2. Dibujar Líneas Rectificadas (Si existen, sobre el historial)
    if (state.resultadosCalculo && state.resultadosCalculo.length > 0) {
        ctx.save();
        ctx.lineWidth = 4.0; 
        for (const lRes of state.resultadosCalculo) {
            drawLinea(ctx, lRes.x1, lRes.y1, lRes.z1 || 0, lRes.x2, lRes.y2, lRes.z2 || 0, false, null, state);
        }
        ctx.restore();
    }

    // 3. Dibujar Compresores y Consumos
    const compresores = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'compresor');
    const consumos = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'consumo');
    const r_nodo = RADIO_NODO; 

    if (compresores.length > 0) {
        ctx.save();
        for (const accion of compresores) {
            const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0, state);
            
            // Cuerpo Principal (Fondo oscuro)
            ctx.fillStyle = COLOR_COMPRESOR;
            ctx.strokeStyle = COLOR_COMPRESOR_BORDER;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r_nodo, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            // Detalles Industriales: Circulo interno
            ctx.beginPath();
            ctx.arc(p.x, p.y, r_nodo * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = '#616161';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Líneas de Radiador / Aletas de Enfriamiento
            ctx.strokeStyle = '#757575';
            ctx.lineWidth = 1;
            for(let a=0; a<360; a+=45) {
                const rad = a * Math.PI / 180;
                ctx.beginPath();
                ctx.moveTo(p.x + Math.cos(rad) * (r_nodo * 0.45), p.y + Math.sin(rad) * (r_nodo * 0.45));
                ctx.lineTo(p.x + Math.cos(rad) * r_nodo, p.y + Math.sin(rad) * r_nodo);
                ctx.stroke();
            }

            // Letra identificadora
            ctx.fillStyle = '#4FC3F7'; // Azul brillante para mayor legibilidad
            ctx.font = `bold 10px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('C', p.x, p.y);
            
            // Etiqueta inferior (Opcional)
            ctx.fillStyle = '#BDBDBD';
            ctx.font = `italic 8px 'Segoe UI', sans-serif`;
            ctx.fillText('COMP', p.x, p.y + r_nodo + 11);
        }
        ctx.restore();
    }

    if (consumos.length > 0) {
        ctx.save();
        for (const accion of consumos) {
            const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0, state);
            
            // Cuerpo (Cuadrado con bordes redondeados o Triangulo)
            ctx.fillStyle = COLOR_CONSUMO;
            ctx.strokeStyle = COLOR_CONSUMO_BORDER;
            ctx.lineWidth = 2;
            const s = r_nodo * 0.8;
            ctx.beginPath();
            ctx.rect(p.x - s, p.y - s, s * 2, s * 2);
            ctx.fill(); ctx.stroke();

            // Símbolo interno (Flecha hacia abajo o punto)
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x - s*0.5, p.y);
            ctx.lineTo(p.x, p.y + s*0.5);
            ctx.lineTo(p.x + s*0.5, p.y);
            ctx.stroke();

            // Letra P (Punto de utilización)
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold 9px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('P', p.x, p.y - s*0.3);

            // Etiqueta
            ctx.fillStyle = '#EF9A9A';
            ctx.font = `italic 8px 'Segoe UI', sans-serif`;
            ctx.fillText('CONS', p.x, p.y + r_nodo + 11);
        }
        ctx.restore();
    }

    // 4. Diametros de cálculo
    if (state.resultadosCalculo) {
        ctx.save();
        ctx.font = `bold 12px Arial, sans-serif`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00BCD4'; 

        for (const linea of state.resultadosCalculo) {
            if (linea.diametro) {
                if (!isIso) {
                    const isVertical = (linea.x1 === linea.x2 && linea.y1 === linea.y2);
                    const isSimVertical = (Math.abs(linea.x2 - linea.x1) > 1 && Math.abs(Math.abs(linea.x2 - linea.x1) - Math.abs(linea.y2 - linea.y1)) < 2.0);
                    if (isVertical || isSimVertical) continue;
                }
                const mx = (linea.x1 + linea.x2) / 2;
                const my = (linea.y1 + linea.y2) / 2;
                const z1 = linea.z1 || 0;
                const z2 = linea.z2 || 0;
                
                const p1 = toScreen(linea.x1, linea.y1, z1, state);
                const p2 = toScreen(linea.x2, linea.y2, z2, state);
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const pM = toScreen(mx, my, (z1 + z2) / 2, state);
                
                let angle = Math.atan2(dy, dx);
                if (angle > Math.PI / 2) angle -= Math.PI;
                if (angle < -Math.PI / 2) angle += Math.PI;

                ctx.save();
                ctx.translate(pM.x, pM.y);
                ctx.rotate(angle);
                ctx.fillText(`Ø${linea.diametro}`, 0, -8); 
                ctx.restore();
            }
        }
        ctx.restore();
    }

    // 5. Piezas / Fittings
    if (state.piezasCalculo) {
        ctx.save();
        ctx.font = `bold 10px Arial, sans-serif`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const pieza of state.piezasCalculo) {
            if (!isIso) {
                const lConnect = state.historial.filter(a => a.tipo === 'linea' && 
                    ((Math.abs(a.datos.x1 - pieza.x) < 1 && Math.abs(a.datos.y1 - pieza.y) < 1) || 
                     (Math.abs(a.datos.x2 - pieza.x) < 1 && Math.abs(a.datos.y2 - pieza.y) < 1)));
                
                const isAtRiser = lConnect.some(l => {
                    const dx = l.datos.x2 - l.datos.x1;
                    const dy = l.datos.y2 - l.datos.y1;
                    return (dx === 0 && dy === 0) || (Math.abs(dx) > 1 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 5.0);
                });
                if (isAtRiser) continue;
            }

            const p = toScreen(pieza.x, pieza.y, pieza.z || 0, state);
            const px = p.x, py = p.y;

            if (pieza.tipo === 'Union') {
                const sz = 11;
                ctx.fillStyle = '#2196F3'; 
                ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#FFFFFF';
                ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
            } else if (pieza.tipo === 'Te Igual') {
                const sz = 11;
                ctx.fillStyle = '#FF9800'; 
                ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#FFFFFF';
                ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
            } else if (pieza.tipo === 'Tapon') {
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#F44336'; 
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
            } else if (pieza.tipo === 'Codo 45' || pieza.tipo === 'Te Lateral 45') {
                ctx.fillStyle = '#FF9800'; 
                ctx.beginPath();
                const sz = 7;
                ctx.moveTo(px, py - sz);
                ctx.lineTo(px + sz, py);
                ctx.lineTo(px, py + sz);
                ctx.lineTo(px - sz, py);
                ctx.closePath();
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, 2 * Math.PI);
                if (pieza.tipo === 'Codo') ctx.fillStyle = '#4CAF50'; 
                else if (pieza.tipo === 'Te') ctx.fillStyle = '#FF9800'; 
                else if (pieza.tipo === 'Cruz') ctx.fillStyle = '#9C27B0'; 
                else ctx.fillStyle = '#FF9800'; 
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
            }

            ctx.fillStyle = '#FFFFFF';
            let label = '';
            if (pieza.tipo === 'Codo') label = 'C';
            else if (pieza.tipo === 'Codo 45') label = '45';
            else if (pieza.tipo === 'Te' || pieza.tipo === 'Te Igual') label = 'T';
            else if (pieza.tipo === 'Te Lateral 45') label = 'L';
            else if (pieza.tipo === 'Cruz') label = '+';
            else if (pieza.tipo === 'Union') label = 'U';
            else if (pieza.tipo === 'Tapon') label = 'X';
            else if (pieza.tipo === 'Te + Codo') label = 'T'; 
            ctx.fillText(label, px, py);
        }
        ctx.restore();
    }

    // 6. Válvulas
    if (state.valvulasCalculo) {
        for (const v of state.valvulasCalculo) {
            renderValvula(ctx, v.x, v.y, v.z || 0, v.angulo, '#00BCD4', state);
        }
    }
    const manualValves = state.historial.filter(a => a.tipo === 'valvula_manual');
    for (const mv of manualValves) {
        renderValvula(ctx, mv.datos.x, mv.datos.y, mv.datos.z || 0, mv.datos.angulo, '#FFC107', state); 
    }
}

export function drawLinea(ctx, x1, y1, z1 = 0, x2, y2, z2 = 0, preview = false, color = null, state) {
    const isIso = state.viewState.isIsometric;
    if (!isIso) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const isTrueVertical = (Math.abs(dx) < 1.0 && Math.abs(dy) < 1.0 && Math.abs(dz) > 1.0);
        const isSimulatedVertical = (Math.abs(dx) > 1 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 5.0);

        if (isTrueVertical || isSimulatedVertical) {
            const p1S = toScreen(x1, y1, z1, state);
            ctx.save();
            const r = 6;
            ctx.beginPath();
            ctx.arc(p1S.x, p1S.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = preview ? COLOR_LINEA_PREV : (color || COLOR_LINEA);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p1S.x - r*0.7, p1S.y - r*0.7);
            ctx.lineTo(p1S.x + r*0.7, p1S.y + r*0.7);
            ctx.moveTo(p1S.x + r*0.7, p1S.y - r*0.7);
            ctx.lineTo(p1S.x - r*0.7, p1S.y + r*0.7);
            ctx.stroke();
            ctx.restore();
            return;
        }
    }

    const p1 = toScreen(x1, y1, z1, state);
    const p2 = toScreen(x2, y2, z2, state);

    ctx.save();
    ctx.strokeStyle = preview ? COLOR_LINEA_PREV : (color || COLOR_LINEA);
    ctx.lineWidth = GROSOR_LINEA * state.viewState.scale;
    ctx.lineCap = 'round';
    if (preview) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
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
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
}
