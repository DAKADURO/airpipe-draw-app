import { MODO } from './config.js';

export const state = {
    modoActual: MODO.NINGUNO,
    lineaIniciada: false,
    puntoInicio: null,   // {x, y} (World Coords)
    puntoMouse: null,    // {x, y} (World Coords)
    cotaInicio: null,    // {x, y} primer punto de la cota
    cotaSiendoEditada: null, // Cota que se está editando actualmente

    viewState: {
        scale: 1.0,
        offsetX: 0,
        offsetY: 0
    },

    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    historial: [],

    // Resultados de cálculo (Dimensionamiento, Piezas, Válvulas)
    resultadosCalculo: null,
    piezasCalculo: null,
    valvulasCalculo: null,
    bomCalculo: null,

    // Geometría transitoria y snap
    snapPoint: null,
    angleSnapPoint: null,
    smartSnapPoint: null,
    activeGuides: [],

    // Variables de Plano de Fondo (Blueprint)
    bgImageObj: null,
    bgBase64: null,
    bgUrl: null,
    bgScale: 1.0,
    bgOpacity: 0.5,

    // UI Cache 
    canvasRect: null,
    _rafPending: false,
    _snapPointsCache: null,

    // Global Project Info
    proyectoActualId: null,
    proyectoActualName: ''
};

export function invalidateSnapCache() {
    state._snapPointsCache = null;
    state.resultadosCalculo = null;
    state.piezasCalculo = null;
    state.valvulasCalculo = null;
}

export function updateCanvasRect(canvas) {
    if (canvas) {
        state.canvasRect = canvas.getBoundingClientRect();
    }
}
