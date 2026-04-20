import { COLOR_FONDO_CAD } from '../config.js';
import { projectIso } from '../math.js';
import { getCachedGrid } from './ShadowCanvas.js';

export function drawBackground(ctx, canvas, state) {
    // Fondo AutoCAD (Antigris)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLOR_FONDO_CAD;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Grid — drawn via ShadowCanvas cache (single drawImage instead of hundreds of line segments)
    const gridImage = getCachedGrid(canvas, state);
    ctx.drawImage(gridImage, 0, 0);

    // Background image and DXF lines — drawn dynamically (they change with opacity/scale controls)
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
