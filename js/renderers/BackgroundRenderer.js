import { COLOR_GRID_CAD, COLOR_GRID_SUB_CAD, PASO_GRID, PIXELS_POR_METRO, COLOR_FONDO_CAD } from '../config.js';
import { toWorld, projectIso } from '../math.js';

export function drawBackground(ctx, canvas, state) {
    // Fondo AutoCAD (Antigris)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLOR_FONDO_CAD;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
    ctx.scale(state.viewState.scale, state.viewState.scale);

    drawGrid(ctx, canvas, state);

    if (state.bgImageObj) {
        ctx.save();
        ctx.globalAlpha = state.bgOpacity;
        ctx.drawImage(state.bgImageObj, 0, 0, state.bgImageObj.width * state.bgScale, state.bgImageObj.height * state.bgScale);
        ctx.restore();
    }

    if (state.bgLines && state.bgLines.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#607D8B';
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
    ctx.restore();
}

function drawGrid(ctx, canvas, state) {
    const s = state.viewState.scale;
    const isIso = state.viewState.isIsometric;

    if (isIso) {
        ctx.save();
        ctx.strokeStyle = COLOR_GRID_CAD;
        ctx.lineWidth = 0.5 / s;
        ctx.beginPath();
        
        const worldCenter = toWorld(canvas.width / 2, canvas.height / 2, 0, state);
        const centerX = Math.round(worldCenter.x / PASO_GRID) * PASO_GRID;
        const centerY = Math.round(worldCenter.y / PASO_GRID) * PASO_GRID;
        
        const range = 10000;
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
