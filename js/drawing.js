import { state } from './state.js';
import { drawBackground } from './renderers/BackgroundRenderer.js';
import { drawNetwork } from './renderers/NetworkRenderer.js';
import { drawOverlay } from './renderers/OverlayRenderer.js';

export let canvas = null;
export let ctx = null;

export function initCanvas(c, cx) {
    canvas = c;
    ctx = cx;
}

export function redraw() {
    if (!ctx) return;
    try {
        // Render 1: The background Layer (manages its own ctx transform internally)
        drawBackground(ctx, canvas, state);
        
        // Render 2: The Physical Pipe Network
        // NOTE: No ctx.translate/scale here — toScreen() already applies viewState offset+scale.
        // A redundant transform here caused double-offset after panning (cursor desync bug).
        drawNetwork(ctx, canvas, state);
        
        // Render 3: HUD, Dimensions, Annotations, Previews and Visual Feedback
        drawOverlay(ctx, canvas, state);
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
