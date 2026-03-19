import { state } from './state.js';
import { 
    COLOR_GRID, COLOR_GRID_SUB, COLOR_LINEA, COLOR_LINEA_PREV,
    COLOR_COMPRESOR, COLOR_CONSUMO, COLOR_COMPRESOR_BORDER, COLOR_CONSUMO_BORDER,
    GROSOR_LINEA, RADIO_NODO, PIXELS_POR_METRO, PASO_GRID, MODO 
} from './config.js';
import { getLineSnap } from './math.js';

export let canvas = null;
export let ctx = null;

export function initCanvas(c, cx) {
    canvas = c;
    ctx = cx;
}

export function drawGrid() {
    const s = state.viewState.scale;

    const left = -state.viewState.offsetX / s;
    const top = -state.viewState.offsetY / s;
    const right = (canvas.width - state.viewState.offsetX) / s;
    const bottom = (canvas.height - state.viewState.offsetY) / s;

    let gridStep = PASO_GRID;
    while (gridStep * s < 20) gridStep *= 2;

    const startX = Math.max(0, Math.floor(left / gridStep) * gridStep);
    const startY = Math.max(0, Math.floor(top / gridStep) * gridStep);

    const thinLine = 0.5 / s; 

    ctx.save();

    ctx.strokeStyle = COLOR_GRID;
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
        ctx.strokeStyle = COLOR_GRID_SUB;
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

    ctx.fillStyle = '#9E9E9E';
    ctx.font = `${10 / s}px Consolas, monospace`;
    for (let x = startX; x <= right; x += gridStep) {
        ctx.fillText(`${Math.round(x / PIXELS_POR_METRO)}m`, x + 2 / s, top + 12 / s);
    }
    for (let y = startY; y <= bottom; y += gridStep) {
        ctx.fillText(`${Math.round(y / PIXELS_POR_METRO)}m`, left + 2 / s, y - 2 / s);
    }

    ctx.strokeStyle = '#666';
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

export function drawLinea(x1, y1, x2, y2, preview = false) {
    ctx.save();
    ctx.strokeStyle = preview ? COLOR_LINEA_PREV : COLOR_LINEA;
    ctx.lineWidth = GROSOR_LINEA / state.viewState.scale;
    ctx.lineCap = 'round';
    if (preview) {
        const d = 6 / state.viewState.scale;
        const g = 4 / state.viewState.scale;
        ctx.setLineDash([d, g]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

export function renderValvula(x, y, anguloGrados, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(anguloGrados * Math.PI / 180);

    const S = 6 / state.viewState.scale;
    ctx.beginPath();
    ctx.moveTo(-S, -S / 1.5); ctx.lineTo(0, 0); ctx.lineTo(-S, S / 1.5); ctx.closePath();
    ctx.moveTo(S, -S / 1.5); ctx.lineTo(0, 0); ctx.lineTo(S, S / 1.5); ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1 / state.viewState.scale;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
}

export function renderCota(datos, isPreview = false) {
    const { x1, y1, x2, y2, offset } = datos;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;

    const off = offset || 30 / state.viewState.scale;

    const cx1 = x1 + px * off;
    const cy1 = y1 + py * off;
    const cx2 = x2 + px * off;
    const cy2 = y2 + py * off;

    const ext = 5 / state.viewState.scale;
    const alpha = isPreview ? 0.5 : 1.0;
    const color = isPreview ? `rgba(255, 215, 0, ${alpha})` : '#FFD700';
    const lineWidth = 1 / state.viewState.scale;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(isPreview ? [4 / state.viewState.scale, 4 / state.viewState.scale] : []);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cx1 + px * ext, cy1 + py * ext);
    ctx.moveTo(x2, y2);
    ctx.lineTo(cx2 + px * ext, cy2 + py * ext);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.stroke();

    const arrowSize = 8 / state.viewState.scale;
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

    const metros = (length / PIXELS_POR_METRO).toFixed(2);
    const midX = (cx1 + cx2) / 2;
    const midY = (cy1 + cy2) / 2;
    const fontSize = Math.max(10, 12 / state.viewState.scale);

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
    ctx.fillText(`${metros} m`, 0, -3 / state.viewState.scale);
    ctx.restore();
    ctx.restore();
}

export function redraw() {
    if (!ctx) return;
    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
        ctx.scale(state.viewState.scale, state.viewState.scale);

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
                ctx.moveTo(l.x1 * state.bgScale, l.y1 * state.bgScale);
                ctx.lineTo(l.x2 * state.bgScale, l.y2 * state.bgScale);
            }
            ctx.stroke();
            ctx.restore();
        }

        drawGrid();

        const lineasHistorial = state.historial.filter(a => a.tipo === 'linea');
        if (lineasHistorial.length > 0) {
            ctx.save();
            ctx.strokeStyle = COLOR_LINEA;
            ctx.lineWidth = GROSOR_LINEA / state.viewState.scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const accion of lineasHistorial) {
                const { x1, y1, x2, y2 } = accion.datos;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
            ctx.stroke();
            ctx.restore();
        }

        const compresores = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'compresor');
        const consumos = state.historial.filter(a => a.tipo === 'nodo' && a.datos.tipo === 'consumo');
        const r = RADIO_NODO / state.viewState.scale;

        if (compresores.length > 0) {
            ctx.save();
            ctx.fillStyle = COLOR_COMPRESOR;
            ctx.strokeStyle = COLOR_COMPRESOR_BORDER;
            ctx.lineWidth = 2 / state.viewState.scale;
            for (const accion of compresores) {
                const { x, y } = accion.datos;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#BDBDBD';
            ctx.font = `${9 / state.viewState.scale}px Segoe UI, sans-serif`;
            ctx.textAlign = 'center';
            for (const accion of compresores) {
                const { x, y } = accion.datos;
                ctx.fillText('C', x, y + r + 11 / state.viewState.scale);
            }
            ctx.restore();
        }

        if (consumos.length > 0) {
            ctx.save();
            ctx.fillStyle = COLOR_CONSUMO;
            ctx.strokeStyle = COLOR_CONSUMO_BORDER;
            ctx.lineWidth = 2 / state.viewState.scale;
            for (const accion of consumos) {
                const { x, y } = accion.datos;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#EF9A9A';
            ctx.font = `${9 / state.viewState.scale}px Segoe UI, sans-serif`;
            ctx.textAlign = 'center';
            for (const accion of consumos) {
                const { x, y } = accion.datos;
                ctx.fillText('P', x, y + r + 11 / state.viewState.scale);
            }
            ctx.restore();
        }

        if (state.modoActual === MODO.LINEA && state.lineaIniciada && state.puntoInicio && state.puntoMouse) {
            drawLinea(state.puntoInicio.x, state.puntoInicio.y, state.puntoMouse.x, state.puntoMouse.y, true);
            ctx.save();
            ctx.beginPath();
            ctx.arc(state.puntoInicio.x, state.puntoInicio.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_LINEA;
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = '#9C27B0'; 
        ctx.lineWidth = 1.5 / state.viewState.scale;
        const dm = 4 / state.viewState.scale; 
        for (const accion of state.historial) {
            if (accion.tipo !== 'linea') continue;
            const { x1, y1, x2, y2 } = accion.datos;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            ctx.beginPath();
            ctx.moveTo(mx, my - dm);
            ctx.lineTo(mx + dm, my);
            ctx.lineTo(mx, my + dm);
            ctx.lineTo(mx - dm, my);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();

        if (state.snapPoint) {
            ctx.save();
            const isMidpoint = state.snapPoint.tipo === 'medio';
            const r_snap = 6 / state.viewState.scale;
            ctx.lineWidth = 2 / state.viewState.scale;
            ctx.strokeStyle = isMidpoint ? '#9C27B0' : '#FF9800';

            if (isMidpoint) {
                ctx.beginPath();
                ctx.moveTo(state.snapPoint.x, state.snapPoint.y - r_snap * 1.4);
                ctx.lineTo(state.snapPoint.x + r_snap * 1.4, state.snapPoint.y);
                ctx.lineTo(state.snapPoint.x, state.snapPoint.y + r_snap * 1.4);
                ctx.lineTo(state.snapPoint.x - r_snap * 1.4, state.snapPoint.y);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(state.snapPoint.x, state.snapPoint.y, r_snap, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (state.angleSnapPoint) {
            ctx.save();
            ctx.fillStyle = COLOR_LINEA;
            ctx.font = `${12 / state.viewState.scale}px Consolas, monospace`;
            ctx.fillText(`${state.angleSnapPoint.angle}°`,
                state.angleSnapPoint.x + 10 / state.viewState.scale,
                state.angleSnapPoint.y - 10 / state.viewState.scale);
            ctx.restore();
        }

        if (state.activeGuides && state.activeGuides.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#00BCD4';
            ctx.lineWidth = 1 / state.viewState.scale;
            const dashLen = 5 / state.viewState.scale;
            ctx.setLineDash([dashLen, dashLen]);
            ctx.beginPath();
            for (const guia of state.activeGuides) {
                ctx.moveTo(guia.x1, guia.y1);
                ctx.lineTo(guia.x2, guia.y2);
            }
            ctx.stroke();

            const cr = 3 / state.viewState.scale;
            ctx.setLineDash([]);
            ctx.beginPath();
            for (const guia of state.activeGuides) {
                ctx.moveTo(guia.x1 - cr, guia.y1 - cr);
                ctx.lineTo(guia.x1 + cr, guia.y1 + cr);
                ctx.moveTo(guia.x1 - cr, guia.y1 + cr);
                ctx.lineTo(guia.x1 + cr, guia.y1 - cr);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (state.resultadosCalculo) {
            ctx.save();
            ctx.font = `bold ${12 / state.viewState.scale}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#00BCD4'; 

            for (const linea of state.resultadosCalculo) {
                if (linea.diametro) {
                    const mx = (linea.x1 + linea.x2) / 2;
                    const my = (linea.y1 + linea.y2) / 2;
                    const dx = linea.x2 - linea.x1;
                    const dy = linea.y2 - linea.y1;
                    let angle = Math.atan2(dy, dx);
                    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                        angle += Math.PI;
                    }
                    ctx.save();
                    ctx.translate(mx, my);
                    ctx.rotate(angle);
                    const offset = -8 / state.viewState.scale;
                    ctx.fillText(`Ø${linea.diametro}`, 0, offset);
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        if (state.piezasCalculo) {
            ctx.save();
            const rp = 6 / state.viewState.scale; 
            ctx.font = `bold ${10 / state.viewState.scale}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const pieza of state.piezasCalculo) {
                if (pieza.tipo === 'Union') {
                    const sz = rp * 1.8;
                    ctx.fillStyle = '#2196F3'; 
                    ctx.fillRect(pieza.x - sz / 2, pieza.y - sz / 2, sz, sz);
                    ctx.lineWidth = 1 / state.viewState.scale;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.strokeRect(pieza.x - sz / 2, pieza.y - sz / 2, sz, sz);
                } else if (pieza.tipo === 'Te Igual') {
                    const sz = rp * 1.8;
                    ctx.fillStyle = '#FF9800'; 
                    ctx.fillRect(pieza.x - sz / 2, pieza.y - sz / 2, sz, sz);
                    ctx.lineWidth = 1 / state.viewState.scale;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.strokeRect(pieza.x - sz / 2, pieza.y - sz / 2, sz, sz);
                } else if (pieza.tipo === 'Tapon') {
                    ctx.beginPath();
                    ctx.arc(pieza.x, pieza.y, rp, 0, 2 * Math.PI);
                    ctx.fillStyle = '#F44336'; 
                    ctx.fill();
                    ctx.lineWidth = 1 / state.viewState.scale;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.stroke();
                } else if (pieza.tipo === 'Codo 45' || pieza.tipo === 'Te Lateral 45') {
                    ctx.fillStyle = '#FF9800'; 
                    ctx.beginPath();
                    ctx.moveTo(pieza.x, pieza.y - rp * 1.2);
                    ctx.lineTo(pieza.x + rp * 1.2, pieza.y);
                    ctx.lineTo(pieza.x, pieza.y + rp * 1.2);
                    ctx.lineTo(pieza.x - rp * 1.2, pieza.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.lineWidth = 1 / state.viewState.scale;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(pieza.x, pieza.y, rp, 0, 2 * Math.PI);
                    if (pieza.tipo === 'Codo') ctx.fillStyle = '#4CAF50'; 
                    else if (pieza.tipo === 'Te') ctx.fillStyle = '#FF9800'; 
                    else if (pieza.tipo === 'Cruz') ctx.fillStyle = '#9C27B0'; 
                    else ctx.fillStyle = '#FF9800'; 
                    ctx.fill();
                    ctx.lineWidth = 1 / state.viewState.scale;
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
                ctx.fillText(label, pieza.x, pieza.y);
            }
            ctx.restore();
        }

        if (state.valvulasCalculo) {
            ctx.save();
            for (const v of state.valvulasCalculo) {
                renderValvula(v.x, v.y, v.angulo, '#00BCD4');
            }
            ctx.restore();
        }

        const manualValves = state.historial.filter(a => a.tipo === 'valvula_manual');
        for (const mv of manualValves) {
            renderValvula(mv.datos.x, mv.datos.y, mv.datos.angulo, '#FFC107'); 
        }

        if (state.modoActual === MODO.VALVULA && state.puntoMouse && !state.isPanning) {
            const snap = getLineSnap(state.puntoMouse.x, state.puntoMouse.y);
            if (snap) {
                renderValvula(snap.x, snap.y, snap.angulo, 'rgba(0, 188, 212, 0.6)');
            }
        }

        const cotas = state.historial.filter(a => a.tipo === 'cota');
        for (const c of cotas) {
            renderCota(c.datos);
        }

        if (state.modoActual === MODO.ACOTAR && state.cotaInicio && state.puntoMouse && !state.isPanning) {
            renderCota({
                x1: state.cotaInicio.x, y1: state.cotaInicio.y,
                x2: state.puntoMouse.x, y2: state.puntoMouse.y,
                offset: 30 / state.viewState.scale
            }, true);
        }

        ctx.restore(); 
    } catch (e) {
        console.error("Error en redraw:", e);
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
