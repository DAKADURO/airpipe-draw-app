import { initCanvases, redraw } from './drawing.js';
import { initCanvasEvents } from './canvas_events.js';
import { setupUI } from './ui.js';
import { updateAuthUI } from './api.js';

window.onerror = function(msg, url, line) { alert("JS Crash: " + msg + " at line " + line); };

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Airpipe DRAW 2.0.1 - ES Module Environment Loaded");

    const wrapper = document.getElementById('canvas-wrapper');
    const mainCanvas = document.getElementById('mainCanvas');

    // 1. Check Login Context
    updateAuthUI();

    // 2. Initialize pure drawing system bindings (Layered Canvas)
    initCanvases(wrapper);

    // 3. Initialize user button hooks and HTML modal events
    setupUI(mainCanvas);
    
    // 4. Hook up geometric mouse calculations on the canvas zone
    initCanvasEvents(mainCanvas);

    // 5. Present the canvas to the user
    redraw();
    } catch (e) {
        alert("Startup CRASH: " + e.message);
    }
});
