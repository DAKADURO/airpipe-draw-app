import { MODO } from './config.js';

export const state = {
    modoActual: MODO.NINGUNO,
    lineaIniciada: false,
    puntoInicio: null,   // {x, y} (World Coords)
    puntoMouse: null,    // {x, y} (World Coords)
    cotaInicio: null,    // {x, y} primer punto de la cota
    cotaSiendoEditada: null, // Cota que se está editando actualmente
    draggingCota: null,      // Cota que se está arrastrando en la pantalla

    // --- Variables de Selección y Mover ---
    seleccionados: new Set(), // Conjunto de items en el historial que están seleccionados
    isSelecting: false,       // ¿Estamos dibujando la caja de selección?
    selectionStart: null,     // {x, y} de la pantalla donde inició el clic de caja
    selectionBox: null,       // {x, y, w, h} de la pantalla
    moveAnchor: null,         // Punto base 3D {x, y, z} para el comando Mover
    movePreview: null,        // Cursor drag 3D {x, y, z} para proyectar los fantasmas
    // ------------------------------------

    viewState: {
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        isIsometric: localStorage.getItem('airpipe_isometric_view') === 'true', // Modo isométrico persistente
        currentZ: 0         // Nivel de altura actual para dibujos nuevos
    },

    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    lastMouseX: 0,
    lastMouseY: 0,

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
    bgLines: [], // Líneas vectoriales de fondo (ej: de un DXF)

    // UI Cache 
    canvasRect: null,
    _rafPending: false,
    _viewDirty: true,        // Flag: viewport changed, needs redraw
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
