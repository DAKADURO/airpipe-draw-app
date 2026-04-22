/**
 * ShadowCanvas — Off-screen grid pre-rendering cache for AIRpipe DRAW v3.0.1
 * 
 * Instead of drawing hundreds of grid lines every frame, this module
 * pre-renders the grid onto an OffscreenCanvas and caches the result.
 * The cached image is invalidated only when viewport parameters change
 * (scale, offset, isometric mode, or canvas dimensions).
 */

import { COLOR_GRID_CAD, COLOR_GRID_SUB_CAD, PASO_GRID, PIXELS_POR_METRO } from '../config.js';
import { toWorld, projectIso } from '../math.js';

let _shadowCanvas = null;
let _shadowCtx = null;
let _cachedParams = null; // Serialized viewport params for cache invalidation

/**
 * Returns the serialized viewport params key for cache comparison.
 */
function getParamsKey(canvas, state) {
    const vs = state.viewState;
    return `${canvas.width},${canvas.height},${vs.scale},${vs.offsetX.toFixed(1)},${vs.offsetY.toFixed(1)},${vs.isIsometric}`;
}

/**
 * Ensures the shadow canvas exists and matches dimensions.
 */
function ensureShadowCanvas(width, height) {
    if (!_shadowCanvas || _shadowCanvas.width !== width || _shadowCanvas.height !== height) {
        _shadowCanvas = document.createElement('canvas');
        _shadowCanvas.width = width;
        _shadowCanvas.height = height;
        _shadowCtx = _shadowCanvas.getContext('2d');
        _cachedParams = null; // Force re-render on resize
    }
}

/**
 * Draw 2D orthographic grid onto shadow canvas.
 */
function renderOrthographicGrid(ctx, canvas, state) {
    const s = state.viewState.scale;
    const left = -state.viewState.offsetX / s;
    const top = -state.viewState.offsetY / s;
    const right = (canvas.width - state.viewState.offsetX) / s;
    const bottom = (canvas.height - state.viewState.offsetY) / s;

    let gridStep = PASO_GRID;
    while (gridStep * s < 20) gridStep *= 2;

    const startX = Math.floor(left / gridStep) * gridStep;
    const startY = Math.floor(top / gridStep) * gridStep;
    const thinLine = 1 / s;

    // Main grid
    ctx.save();
    ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
    ctx.scale(s, s);

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

    // Sub-grid
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

    // Meter labels
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

    // Origin axes
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

/**
 * Draw isometric grid onto shadow canvas.
 */
function renderIsometricGrid(ctx, canvas, state) {
    const s = state.viewState.scale;

    ctx.save();
    ctx.translate(state.viewState.offsetX, state.viewState.offsetY);
    ctx.scale(s, s);

    ctx.strokeStyle = COLOR_GRID_CAD;
    ctx.lineWidth = 0.5 / s;
    ctx.beginPath();

    const worldCenter = toWorld(canvas.width / 2, canvas.height / 2, 0, state);
    const centerX = Math.round(worldCenter.x / PASO_GRID) * PASO_GRID;
    const centerY = Math.round(worldCenter.y / PASO_GRID) * PASO_GRID;

    const range = 10000;
    const step = PASO_GRID;

    for (let i = -range; i <= range; i += step) {
        const p1 = projectIso(centerX - range, centerY + i, 0);
        const p2 = projectIso(centerX + range, centerY + i, 0);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        const p3 = projectIso(centerX + i, centerY - range, 0);
        const p4 = projectIso(centerX + i, centerY + range, 0);
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * Get the cached grid image, re-rendering only if viewport changed.
 * @returns {HTMLCanvasElement} The shadow canvas with the grid pre-rendered.
 */
export function getCachedGrid(canvas, state) {
    ensureShadowCanvas(canvas.width, canvas.height);

    const currentKey = getParamsKey(canvas, state);
    if (_cachedParams === currentKey) {
        return _shadowCanvas; // Cache hit — no re-render needed
    }

    // Cache miss — re-render
    _shadowCtx.clearRect(0, 0, _shadowCanvas.width, _shadowCanvas.height);

    if (state.viewState.isIsometric) {
        renderIsometricGrid(_shadowCtx, canvas, state);
    } else {
        renderOrthographicGrid(_shadowCtx, canvas, state);
    }

    _cachedParams = currentKey;
    return _shadowCanvas;
}

/**
 * Force invalidate the grid cache (e.g., when explicitly needed).
 */
export function invalidateGridCache() {
    _cachedParams = null;
}
