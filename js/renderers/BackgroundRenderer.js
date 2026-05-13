import { COLOR_GRID_CAD, COLOR_GRID_SUB_CAD, PASO_GRID, PIXELS_POR_METRO, COLOR_FONDO_CAD } from '../config.js';
import { toWorld, projectIso } from '../math.js';

let cachedBgData = null;
let cachedIsoState = null;
let cachedScale = null;
let cachedPath2D = null;

export function drawBackground(ctx, canvas, state) {
    // 1. Fondo sólido
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLOR_FONDO_CAD;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
    ctx.scale(state.viewState.scale, state.viewState.scale);

    // 2. Grilla Dinámica
    drawGrid(ctx, canvas, state);

    // 3. Imagen de Fondo
    if (state.bgImageObj) {
        ctx.save();
        ctx.globalAlpha = state.bgOpacity;
        ctx.drawImage(state.bgImageObj, 0, 0, state.bgImageObj.width * state.bgScale, state.bgImageObj.height * state.bgScale);
        ctx.restore();
    }

    // 4. Líneas Vectoriales (DXF) - Soporta tanto Array como Float32Array (Binario)
    if (state.bgLines && (state.bgLines.length > 0 || (state.bgLines.byteLength && state.bgLines.length > 0))) {
        drawVectorBackground(ctx, state);
    }
    ctx.restore();
}

function drawVectorBackground(ctx, state) {
    ctx.save();
    ctx.strokeStyle = '#607D8B';
    ctx.globalAlpha = state.bgOpacity;
    ctx.lineWidth = 1 / state.viewState.scale;
    
    // Si la referencia del objeto de datos cambió, regeneramos el Path2D
    if (cachedBgData !== state.bgLines || cachedIsoState !== state.viewState.isIsometric || cachedScale !== state.bgScale) {
        cachedBgData = state.bgLines;
        cachedIsoState = state.viewState.isIsometric;
        cachedScale = state.bgScale;
        cachedPath2D = new Path2D();

        const isIso = state.viewState.isIsometric;
        const s = state.bgScale;

        if (state.bgLines instanceof Float32Array) {
            // OPTIMIZACIÓN BINARIA: Iterar sobre el buffer continuo [x1, y1, x2, y2, ...]
            for (let i = 0; i < state.bgLines.length; i += 4) {
                const x1 = state.bgLines[i] * s;
                const y1 = state.bgLines[i+1] * s;
                const x2 = state.bgLines[i+2] * s;
                const y2 = state.bgLines[i+3] * s;

                if (isIso) {
                    const p1 = projectIso(x1, y1, 0);
                    const p2 = projectIso(x2, y2, 0);
                    cachedPath2D.moveTo(p1.x, p1.y);
                    cachedPath2D.lineTo(p2.x, p2.y);
                } else {
                    cachedPath2D.moveTo(x1, y1);
                    cachedPath2D.lineTo(x2, y2);
                }
            }
        } else {
            // Fallback para arrays de objetos (compatibilidad)
            for (const l of state.bgLines) {
                if (l.type === 'text') continue;
                const p1x = l.x1 * s, p1y = l.y1 * s, p2x = l.x2 * s, p2y = l.y2 * s;
                if (isIso) {
                    const p1 = projectIso(p1x, p1y, 0);
                    const p2 = projectIso(p2x, p2y, 0);
                    cachedPath2D.moveTo(p1.x, p1.y);
                    cachedPath2D.lineTo(p2.x, p2.y);
                } else {
                    cachedPath2D.moveTo(p1x, p1y);
                    cachedPath2D.lineTo(p2x, p2y);
                }
            }
        }
    }
    
    ctx.stroke(cachedPath2D);
    ctx.restore();
}

function drawGrid(ctx, canvas, state) {
    const s = state.viewState.scale;
    const isIso = state.viewState.isIsometric;

    // Viewport bounds en world coordinates
    const viewport = state._currentViewport || { x: -state.viewState.offsetX/s, y: -state.viewState.offsetY/s, w: canvas.width/s, h: canvas.height/s };
    const { x: left, y: top, w, h } = viewport;
    const right = left + w;
    const bottom = top + h;

    let gridStep = PASO_GRID;
    while (gridStep * s < 25) gridStep *= 2; 

    ctx.save();
    ctx.strokeStyle = COLOR_GRID_CAD;
    ctx.lineWidth = 0.5 / s;
    ctx.beginPath();

    if (isIso) {
        const step = gridStep;
        const startX = Math.floor(left / step) * step - step * 20;
        const endX = Math.ceil(right / step) * step + step * 20;
        const startY = Math.floor(top / step) * step - step * 20;
        const endY = Math.ceil(bottom / step) * step + step * 20;

        for (let x = startX; x <= endX; x += step) {
            const p1 = projectIso(x, startY);
            const p2 = projectIso(x, endY);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        }
        for (let y = startY; y <= endY; y += step) {
            const p1 = projectIso(startX, y);
            const p2 = projectIso(endX, y);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        }
    } else {
        const startX = Math.floor(left / gridStep) * gridStep;
        const startY = Math.floor(top / gridStep) * gridStep;

        for (let x = startX; x <= right; x += gridStep) {
            ctx.moveTo(x, top); ctx.lineTo(x, bottom);
        }
        for (let y = startY; y <= bottom; y += gridStep) {
            ctx.moveTo(left, y); ctx.lineTo(right, y);
        }
    }
    ctx.stroke();

    // Ejes principales
    ctx.beginPath();
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    if (isIso) {
        const p1 = projectIso(-10000, 0); const p2 = projectIso(10000, 0);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        const p3 = projectIso(0, -10000); const p4 = projectIso(0, 10000);
        ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
    } else {
        ctx.moveTo(0, top); ctx.lineTo(0, bottom);
        ctx.moveTo(left, 0); ctx.lineTo(right, 0);
    }
    ctx.stroke();
    ctx.restore();
}
