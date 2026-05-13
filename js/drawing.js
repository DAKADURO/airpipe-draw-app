import { state } from './state.js';
import { drawBackground } from './renderers/BackgroundRenderer.js';
import { drawNetwork } from './renderers/NetworkRenderer.js';
import { drawOverlay } from './renderers/OverlayRenderer.js';
import { getViewportWorldBounds } from './math.js';

export let canvases = {};
export let contexts = {};

let resizeTimer = null;
export function initCanvases(wrapper) {
    const layerIds = ['bgCanvas', 'mainCanvas', 'activeCanvas', 'uiCanvas'];
    layerIds.forEach(id => {
        const c = document.getElementById(id);
        if (c) {
            canvases[id] = c;
            contexts[id] = c.getContext('2d', { alpha: id !== 'bgCanvas' });
        }
    });
    
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvases, 150);
    });
    resizeCanvases();
}

function resizeCanvases() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    
    Object.values(canvases).forEach(c => {
        c.width = rect.width;
        c.height = rect.height;
    });
    state.canvasRect = rect;
    scheduleRedraw();
}

export function redrawLayer(layerId) {
    const ctx = contexts[layerId];
    const canvas = canvases[layerId];
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
        if (layerId === 'bgCanvas') {
            drawBackground(ctx, canvas, state);
        } else if (layerId === 'mainCanvas') {
            drawNetwork(ctx, canvas, state);
        } else if (layerId === 'activeCanvas') {
            drawOverlay(ctx, canvas, state, 'active');
        } else if (layerId === 'uiCanvas') {
            drawOverlay(ctx, canvas, state, 'ui');
        }
    } catch (err) {
        console.error(`Error en redrawLayer (${layerId}):`, err);
    }
}

export function redraw() {
    state._currentViewport = getViewportWorldBounds();
    redrawLayer('bgCanvas');
    redrawLayer('mainCanvas');
    redrawLayer('activeCanvas');
    redrawLayer('uiCanvas');
}

export function scheduleRedraw(layerId = null) {
    if (layerId) {
        if (!state._pendingLayers) state._pendingLayers = new Set();
        state._pendingLayers.add(layerId);
    } else {
        state._needsFullRedraw = true;
    }

    if (!state._rafPending) {
        state._rafPending = true;
        requestAnimationFrame(() => {
            state._rafPending = false;
            state._currentViewport = getViewportWorldBounds();
            
            if (state._needsFullRedraw) {
                if (state._pendingLayers) state._pendingLayers.clear();
                state._needsFullRedraw = false;
                redraw();
            } else if (state._pendingLayers && state._pendingLayers.size > 0) {
                state._pendingLayers.forEach(l => redrawLayer(l));
                state._pendingLayers.clear();
            }
        });
    }
}

/**
 * Captura todas las capas en una sola imagen para exportación (PDF/PNG)
 */
export function flattenCanvases() {
    const main = canvases['mainCanvas'];
    if (!main) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = main.width;
    tempCanvas.height = main.height;
    const tCtx = tempCanvas.getContext('2d');

    // Dibujar en orden de Z-index
    const layers = ['bgCanvas', 'mainCanvas', 'activeCanvas', 'uiCanvas'];
    layers.forEach(id => {
        const c = canvases[id];
        if (c) tCtx.drawImage(c, 0, 0);
    });

    return tempCanvas.toDataURL('image/png');
}
