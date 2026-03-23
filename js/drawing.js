import { state } from './state.js';
import { 
    COLOR_GRID, COLOR_GRID_SUB, COLOR_LINEA, COLOR_LINEA_PREV,
    COLOR_COMPRESOR, COLOR_CONSUMO, COLOR_COMPRESOR_BORDER, COLOR_CONSUMO_BORDER,
    GROSOR_LINEA, RADIO_NODO, PIXELS_POR_METRO, PASO_GRID, MODO,
    COLOR_FONDO_CAD, COLOR_GRID_CAD, COLOR_GRID_SUB_CAD
} from './config.js';
import { getLineSnap, toWorld, toScreen, projectIso } from './math.js';

export let canvas = null;
export let ctx = null;

export function initCanvas(c, cx) {
    canvas = c;
    ctx = cx;
}
export function drawGrid() {
    const s = state.viewState.scale;
    const isIso = state.viewState.isIsometric;

    // Actualizar Cursor
    if (state._spacePressed || state.modoActual === MODO.PAN) {
        canvas.style.cursor = state.isPanning ? 'grabbing' : 'grab';
    } else {
        canvas.style.cursor = (state.modoActual === MODO.NINGUNO) ? 'default' : 'crosshair';
    }

    if (isIso) {
        if (!canvas) return;

        ctx.save();
        ctx.strokeStyle = COLOR_GRID_CAD;
        ctx.lineWidth = 0.5 / s;
        ctx.beginPath();
        
        const worldCenter = toWorld(canvas.width / 2, canvas.height / 2);
        const centerX = Math.round(worldCenter.x / PASO_GRID) * PASO_GRID;
        const centerY = Math.round(worldCenter.y / PASO_GRID) * PASO_GRID;
        
        const range = 10000; // Aumentar a 100m para diseños grandes
        const step = PASO_GRID;
        
        for (let i = -range; i <= range; i += step) {
            const v1 = { x: centerX - range, y: centerY + i };
            const v2 = { x: centerX + range, y: centerY + i };
            const p1 = projectIso(v1.x, v1.y, 0);
            const p2 = projectIso(v2.x, v2.y, 0);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            const v3 = { x: centerX + i, y: centerY - range };
            const v4 = { x: centerX + i, y: centerY + range };
            const p3 = projectIso(v3.x, v3.y, 0);
            const p4 = projectIso(v4.x, v4.y, 0);
            ctx.moveTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
        }
        ctx.stroke();
        ctx.restore();
        return;
    }

    const left = -state.viewState.offsetX / s;
    const top = -state.viewState.offsetY / s;
    const right = (canvas.width - state.viewState.offsetX) / s;
    const bottom = (canvas.height - state.viewState.offsetY) / s;

    let gridStep = PASO_GRID;
    while (gridStep * s < 20) gridStep *= 2;

    const startX = Math.floor(left / gridStep) * gridStep;
    const startY = Math.floor(top / gridStep) * gridStep;

    const thinLine = 1 / s; 

    ctx.save();
    ctx.strokeStyle = COLOR_GRID_CAD;
    ctx.lineWidth = thinLine;
    ctx.beginPath();
    for (let x = startX; x <= right; x += gridStep) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= bottom; y += gridStep) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
    }
    ctx.stroke();

    if (gridStep * s > 50) {
        ctx.strokeStyle = COLOR_GRID_SUB_CAD;
        ctx.beginPath();
        for (let x = startX; x <= right; x += gridStep) {
            ctx.moveTo(x + gridStep / 2, top);
            ctx.lineTo(x + gridStep / 2, bottom);
        }
        for (let y = startY; y <= bottom; y += gridStep) {
            ctx.moveTo(left, y + gridStep / 2);
            ctx.lineTo(right, y + gridStep / 2);
        }
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = `${10 / s}px Consolas, monospace`;
    for (let x = startX; x <= right; x += gridStep) {
        if (Math.abs(x % PIXELS_POR_METRO) < 0.1) {
            ctx.fillText(`${Math.round(x / PIXELS_POR_METRO)}m`, x + 2 / s, top + 12 / s);
        }
    }
    for (let y = startY; y <= bottom; y += gridStep) {
        if (Math.abs(y % PIXELS_POR_METRO) < 0.1) {
            ctx.fillText(`${Math.round(y / PIXELS_POR_METRO)}m`, left + 2 / s, y - 2 / s);
        }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 / s;
    ctx.beginPath();
    if (left <= 0 && right >= 0) {
        ctx.moveTo(0, Math.max(0, top));
        ctx.lineTo(0, bottom);
    }
    if (top <= 0 && bottom >= 0) {
        ctx.moveTo(Math.max(0, left), 0);
        ctx.lineTo(right, 0);
    }
    ctx.stroke();
    ctx.restore();
}

export function drawLinea(x1, y1, z1 = 0, x2, y2, z2 = 0, preview = false, color = null) {
    const isIso = state.viewState.isIsometric;

    // En modo 2D (no isométrico), queremos una vista simplificada.
    if (!isIso) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const isTrueVertical = (Math.abs(dx) < 1.0 && Math.abs(dy) < 1.0 && Math.abs(dz) > 1.0);
        const isSimulatedVertical = (Math.abs(dx) > 1 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 5.0);

        if (isTrueVertical || isSimulatedVertical) {
            const p1S = toScreen(x1, y1, z1);
            ctx.save();
            const r = 6;
            ctx.beginPath();
            ctx.arc(p1S.x, p1S.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = preview ? COLOR_LINEA_PREV : (color || COLOR_LINEA);
            ctx.lineWidth = 2;
            ctx.stroke();
            // X dentro
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

    const p1 = toScreen(x1, y1, z1);
    const p2 = toScreen(x2, y2, z2);

    ctx.save();
    ctx.strokeStyle = preview ? COLOR_LINEA_PREV : (color || COLOR_LINEA);
    ctx.lineWidth = GROSOR_LINEA * state.viewState.scale; // Ancho ajustado por zoom
    ctx.lineCap = 'round';
    if (preview) {
        ctx.setLineDash([6, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
}

export function renderValvula(x, y, z, anguloGrados, color) {
    const p = toScreen(x, y, z || 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(anguloGrados * Math.PI / 180);

    const S = 8; // Tamaño fijo en pantalla
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

export function renderNota(x, y, z, texto) {
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

    // Fondo semitransparente para legibilidad
    ctx.fillStyle = 'rgba(30, 30, 30, 0.7)';
    ctx.fillRect(p.x, p.y, w, h);

    // Borde sutil
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, w, h);

    // Texto
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texto, p.x + padding, p.y + padding);
    
    ctx.restore();
}

export function renderCota(datos, isPreview = false) {
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

    const off = offset || 30; // 30px fijos en pantalla

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
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(cx1 + px * ext, cy1 + py * ext);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(cx2 + px * ext, cy2 + py * ext);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.stroke();

    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx1 + ux * arrowSize + px * arrowSize * 0.3, cy1 + uy * arrowSize + py * arrowSize * 0.3);
    ctx.lineTo(cx1 + ux * arrowSize - px * arrowSize * 0.3, cy1 + uy * arrowSize - py * arrowSize * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx2, cy2);
    ctx.lineTo(cx2 - ux * arrowSize + px * arrowSize * 0.3, cy2 - uy * arrowSize + py * arrowSize * 0.3);
    ctx.lineTo(cx2 - ux * arrowSize - px * arrowSize * 0.3, cy2 - uy * arrowSize - py * arrowSize * 0.3);
    ctx.closePath();
    ctx.fill();

    // Longitud real basada en coordenadas mundo (3D si es necesario)
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

export function redraw() {
    if (!ctx) return;
    try {
        // Fondo AutoCAD (Antigris)
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = COLOR_FONDO_CAD;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.save();
        ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
        ctx.scale(state.viewState.scale, state.viewState.scale);

        drawGrid();

        if (state.bgImageObj) {
            ctx.save();
            ctx.globalAlpha = state.bgOpacity;
            ctx.drawImage(state.bgImageObj, 0, 0, state.bgImageObj.width * state.bgScale, state.bgImageObj.height * state.bgScale);
            ctx.restore();
        }

        if (state.bgLines && state.bgLines.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#607D8B'; // Gris azulado discreto
            ctx.globalAlpha = state.bgOpacity;
            ctx.lineWidth = 1 / state.viewState.scale;
            ctx.beginPath();
            for (const l of state.bgLines) {
                const x1 = l.x1 * state.bgScale;
                const y1 = l.y1 * state.bgScale;
                const x2 = l.x2 * state.bgScale;
                const y2 = l.y2 * state.bgScale;
                
                let p1x = x1, p1y = y1, p2x = x2, p2y = y2;
                if (state.viewState.isIsometric) {
                    const p1 = projectIso(x1, y1, 0);
                    p1x = p1.x; p1y = p1.y;
                    const p2 = projectIso(x2, y2, 0);
                    p2x = p2.x; p2y = p2.y;
                }
                
                ctx.moveTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
            }
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore(); // Restaurar para que toScreen() funcione en espacio absoluto

        // 1. Dibujar Líneas del Historial (Siempre)
        const lineasHistorial = state.historial.filter(a => a.tipo === 'linea');
        ctx.save();
        for (const accion of lineasHistorial) {
            const { x1, y1, x2, y2, color } = accion.datos;
            const z1 = accion.datos.z1 || 0;
            const z2 = accion.datos.z2 || 0;
            drawLinea(x1, y1, z1, x2, y2, z2, false, color);
        }
        ctx.restore();

        // 2. Dibujar Líneas Rectificadas (Si existen, sobre el historial)
        if (state.resultadosCalculo && state.resultadosCalculo.length > 0) {
            ctx.save();
            ctx.lineWidth = 4.0; // Grosor aumentado para máxima visibilidad
            for (const lRes of state.resultadosCalculo) {
                drawLinea(lRes.x1, lRes.y1, lRes.z1 || 0, lRes.x2, lRes.y2, lRes.z2 || 0);
            }
            ctx.restore();
        }

        const compresores = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'compresor');
        const consumos = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'consumo');
        const r_nodo = RADIO_NODO; // Pixeles fijos en pantalla (o scaled if user prefer)

        if (compresores.length > 0) {
            ctx.save();
            ctx.fillStyle = COLOR_COMPRESOR;
            ctx.strokeStyle = COLOR_COMPRESOR_BORDER;
            ctx.lineWidth = 2;
            for (const accion of compresores) {
                const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0);
                ctx.beginPath();
                ctx.arc(p.x, p.y, r_nodo, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#BDBDBD';
            ctx.font = `9px Segoe UI, sans-serif`;
            ctx.textAlign = 'center';
            for (const accion of compresores) {
                const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0);
                ctx.fillText('C', p.x, p.y + r_nodo + 11);
            }
            ctx.restore();
        }

        if (consumos.length > 0) {
            ctx.save();
            ctx.fillStyle = COLOR_CONSUMO;
            ctx.strokeStyle = COLOR_CONSUMO_BORDER;
            ctx.lineWidth = 2;
            for (const accion of consumos) {
                const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0);
                ctx.beginPath();
                ctx.arc(p.x, p.y, r_nodo, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#EF9A9A';
            ctx.font = `9px Segoe UI, sans-serif`;
            ctx.textAlign = 'center';
            for (const accion of consumos) {
                const p = toScreen(accion.datos.x, accion.datos.y, accion.datos.z || 0);
                ctx.fillText('P', p.x, p.y + r_nodo + 11);
            }
            ctx.restore();
        }

        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio && state.puntoMouse) {
            const z1 = state.puntoInicio.z || 0;
            const z2 = state.puntoMouse.z || 0;
            drawLinea(state.puntoInicio.x, state.puntoInicio.y, z1, state.puntoMouse.x, state.puntoMouse.y, z2, true);
            
            const p = toScreen(state.puntoInicio.x, state.puntoInicio.y, z1);
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_LINEA;
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = '#9C27B0'; 
        ctx.lineWidth = 1.5;
        const dm = 6;
        const selection = state.historial.filter(a => a.seleccionada);
        for (const accion of selection) {
            if (accion.tipo !== 'linea') continue;
            const { x1, y1, x2, y2 } = accion.datos;
            const z1 = accion.datos.z1 || 0;
            const z2 = accion.datos.z2 || 0;
            
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const mz = (z1 + z2) / 2;
            
            const p = toScreen(mx, my, mz);
            
            // Omitir diamantes de manipulación en 2D para risers
            if (!state.viewState.isIsometric) {
                const isVertical = (x1 === x2 && y1 === y2);
                const isSimVertical = (Math.abs(x2 - x1) > 1 && Math.abs(Math.abs(x2 - x1) - Math.abs(y2 - y1)) < 5.0);
                if (isVertical || isSimVertical) continue;
            }

            ctx.beginPath();
            ctx.moveTo(p.x, p.y - dm);
            ctx.lineTo(p.x + dm, p.y);
            ctx.lineTo(p.x, p.y + dm);
            ctx.lineTo(p.x - dm, p.y);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();

        if (state.snapPoint) {
            ctx.save();
            const { x, y, z } = state.snapPoint;
            const isMidpoint = state.snapPoint.tipo === 'medio';
            const r_snap = 6;
            ctx.lineWidth = 2;
            ctx.strokeStyle = isMidpoint ? '#9C27B0' : '#FF9800';
            
            const p = toScreen(x, y, z);

            if (isMidpoint) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - r_snap * 1.4);
                ctx.lineTo(p.x + r_snap * 1.4, p.y);
                ctx.lineTo(p.x, p.y + r_snap * 1.4);
                ctx.lineTo(p.x - r_snap * 1.4, p.y);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, r_snap, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (state.angleSnapPoint) {
            ctx.save();
            const { x, y, angle, z, isVertical } = state.angleSnapPoint;
            const p = toScreen(x, y, z !== undefined ? z : (state.viewState.currentZ || 0));
            
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
            ctx.strokeStyle = '#00BCD4';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            for (const guia of state.activeGuides) {
                const p1 = toScreen(guia.x1, guia.y1, guia.z1 || 0);
                const p2 = toScreen(guia.x2, guia.y2, guia.z2 || 0);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }
            ctx.stroke();

            const cr = 3;
            ctx.setLineDash([]);
            ctx.beginPath();
            for (const guia of state.activeGuides) {
                const p = toScreen(guia.x1, guia.y1, guia.z1 || 0);
                ctx.moveTo(p.x - cr, p.y - cr);
                ctx.lineTo(p.x + cr, p.y + cr);
                ctx.moveTo(p.x - cr, p.y + cr);
                ctx.lineTo(p.x + cr, p.y - cr);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (state.resultadosCalculo) {
            ctx.save();
            ctx.font = `bold 12px Arial, sans-serif`; // Tamaño fijo en pantalla
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#00BCD4'; 

            for (const linea of state.resultadosCalculo) {
                if (linea.diametro) {
                    // Omitir etiquetas en 2D para risers/drops (verticales)
                    if (!state.viewState.isIsometric) {
                        const isVertical = (linea.x1 === linea.x2 && linea.y1 === linea.y2);
                        const isSimVertical = (Math.abs(linea.x2 - linea.x1) > 1 && Math.abs(Math.abs(linea.x2 - linea.x1) - Math.abs(linea.y2 - linea.y1)) < 2.0);
                        if (isVertical || isSimVertical) continue;
                    }
                    const mx = (linea.x1 + linea.x2) / 2;
                    const my = (linea.y1 + linea.y2) / 2;
                    let dx = linea.x2 - linea.x1;
                    let dy = linea.y2 - linea.y1;
                    let tx = mx, ty = my;
                    const z1 = linea.z1 || 0;
                    const z2 = linea.z2 || 0;
                    const p1 = toScreen(linea.x1, linea.y1, z1);
                    const p2 = toScreen(linea.x2, linea.y2, z2);
                    dx = p2.x - p1.x;
                    dy = p2.y - p1.y;
                    const pM = toScreen(mx, my, (z1 + z2) / 2);
                    tx = pM.x; ty = pM.y;
                    
                    let angle = Math.atan2(dy, dx);
                    if (angle > Math.PI / 2) angle -= Math.PI;
                    if (angle < -Math.PI / 2) angle += Math.PI;

                    ctx.save();
                    ctx.translate(tx, ty);
                    ctx.rotate(angle);
                    ctx.fillText(`Ø${linea.diametro}`, 0, -8); 
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        if (state.piezasCalculo) {
            ctx.save();
            const rp = 6; // Radio fijo en pantalla
            ctx.font = `bold 10px Arial, sans-serif`; // Fuente fija
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const pieza of state.piezasCalculo) {
                // Omitir iconos de piezas en risers en Vista 2D
                if (!state.viewState.isIsometric) {
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

                const p = toScreen(pieza.x, pieza.y, pieza.z || 0);
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
                else if (pieza.tipo === 'Te + Codo') label = 'T'; // Mostrar T, pero el BOM tendrá ambos
                ctx.fillText(label, px, py);
            }
            ctx.restore();
        }

        if (state.valvulasCalculo) {
            for (const v of state.valvulasCalculo) {
                renderValvula(v.x, v.y, v.z || 0, v.angulo, '#00BCD4');
            }
        }

        const manualValves = state.historial.filter(a => a.tipo === 'valvula_manual');
        for (const mv of manualValves) {
            renderValvula(mv.datos.x, mv.datos.y, mv.datos.z || 0, mv.datos.angulo, '#FFC107'); 
        }

        if (state.modoActual === MODO.VALVULA && state.puntoMouse && !state.isPanning) {
            const snap = getLineSnap(state.puntoMouse.x, state.puntoMouse.y);
            if (snap) {
                renderValvula(snap.x, snap.y, snap.z || 0, snap.angulo, 'rgba(0, 188, 212, 0.6)');
            }
        }

        const notas = state.historial.filter(a => a.tipo === 'nota');
        for (const nota of notas) {
            renderNota(nota.datos.x, nota.datos.y, nota.datos.z || 0, nota.datos.texto);
        }

        const cotas = state.historial.filter(a => a.tipo === 'cota');
        for (const c of cotas) {
            renderCota(c.datos);
        }

        if (state.modoActual === MODO.ACOTAR && state.cotaInicio && state.puntoMouse && !state.isPanning) {
            renderCota({
                x1: state.cotaInicio.x, y1: state.cotaInicio.y, z1: state.cotaInicio.z || 0,
                x2: state.puntoMouse.x, y2: state.puntoMouse.y, z2: state.puntoMouse.z || 0
            }, true);
        }
    } catch (err) {
        console.error("Error en redraw:", err);
    }
}

export function scheduleRedraw() {
    if (!state._rafPending) {
        state._rafPending = true;
        requestAnimationFrame(() => {
            state._rafPending = false;
            redraw();
        });
    }
}
