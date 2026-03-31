import { state } from '../state.js';
import { MODO } from '../config.js';
import { DrawTool } from './DrawTool.js';
import { SelectTool } from './SelectTool.js';
import { OffsetTool } from './OffsetTool.js';
import { NodeTool } from './NodeTool.js';
import { DimensionTool } from './DimensionTool.js';

export const ToolManager = {
    tools: {
        [MODO.NINGUNO]: SelectTool,
        [MODO.MOVER]: SelectTool,
        [MODO.BORRAR]: SelectTool,
        [MODO.LINEA]: DrawTool,
        [MODO.DESFASE]: OffsetTool,
        [MODO.COMPRESOR]: NodeTool,
        [MODO.CONSUMO]: NodeTool,
        [MODO.VALVULA]: NodeTool,
        [MODO.NOTA]: NodeTool,
        [MODO.ACOTAR]: DimensionTool
    },
    
    handleEvent(eventType, e, mouseData) {
        const activeTool = this.tools[state.modoActual] || SelectTool;
        if (activeTool && typeof activeTool[eventType] === 'function') {
            activeTool[eventType](e, mouseData);
        }
    }
};
