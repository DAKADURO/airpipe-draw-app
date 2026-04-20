import { initCanvas, redraw } from './drawing.js';
import { initCanvasEvents } from './canvas_events.js';
import { setupUI } from './ui.js';
import { updateAuthUI } from './api.js';
import { showToast } from './ui/toast.js';
import { loadModals } from './ui/modals_loader.js';

window.onerror = function(msg, url, line) { showToast("JS Crash: " + msg + " at line " + line, 'error', 8000); };

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Airpipe DRAW v3.0.1 - Initializing...");
        
        // 0. Load HTML Modal Templates
        await loadModals();

        const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    // 1. Check Login Context
    updateAuthUI();

    // 2. Initialize pure drawing system bindings
    initCanvas(canvas, ctx);

    // 3. Initialize user button hooks and HTML modal events
    setupUI(canvas);
    
    // 4. Hook up geometric mouse calculations on the canvas zone
    initCanvasEvents(canvas);

    // 5. Present the canvas to the user
    redraw();
    } catch (e) {
        showToast("Startup CRASH: " + e.message, 'error', 8000);
    }
});
