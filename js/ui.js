import { setupTools, setStatus } from './ui/tools.js';
import { setupAuth } from './ui/auth.js';
import { setupScenePanel } from './ui/scene_panel.js';
import { setupModals } from './ui/modals.js';
import { setupExports } from './ui/exports.js';

export function setupUI(canvas) {
    // Inicializar cada uno de los bloques de Interfaz Modulares
    setupTools();
    setupAuth();
    setupScenePanel();
    setupModals();
    setupExports(canvas);

    // Retorna métodos clave que canvas_events.js pueda necesitar
    return { setStatus };
}
