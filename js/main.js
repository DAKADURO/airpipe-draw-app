import { initCanvas, redraw } from './drawing.js';
import { initCanvasEvents } from './canvas_events.js';
import { setupUI } from './ui.js';
import { updateAuthUI } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Airpipe DRAW 2.0.1 - ES Module Environment Loaded");

    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    const wrapper = document.getElementById('canvas-wrapper');
    const floatingDimInput = document.getElementById('floating-dim-input');
    const lengthInput = document.getElementById('lengthInput');

    // 1. Check Login Context
    updateAuthUI();

    // 2. Initialize pure drawing system bindings
    initCanvas(canvas, ctx);

    // 3. Initialize user button hooks and HTML modal events
    const { setStatus } = setupUI(canvas);
    
    // 4. Hook up geometric mouse calculations on the canvas zone
    initCanvasEvents(canvas, wrapper, floatingDimInput, lengthInput, setStatus);

    // 5. Present the canvas to the user
    redraw();
});
