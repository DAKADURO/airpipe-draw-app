/**
 * Spatial Index (QuadTree) for O(log N) hit-detection and culling.
 * Optimizes performance when dealing with thousands of CAD elements.
 */

class QuadTree {
    constructor(boundary, capacity = 16, depth = 0) {
        this.boundary = boundary; // {x, y, w, h}
        this.capacity = capacity;
        this.depth = depth;
        this.maxDepth = 12; // Prevent infinite recursion in case of overlapping points
        this.elements = [];
        this.divided = false;
    }

    subdivide() {
        const { x, y, w, h } = this.boundary;
        const hw = w / 2;
        const hh = h / 2;

        this.nw = new QuadTree({ x, y, w: hw, h: hh }, this.capacity, this.depth + 1);
        this.ne = new QuadTree({ x: x + hw, y, w: hw, h: hh }, this.capacity, this.depth + 1);
        this.sw = new QuadTree({ x, y: y + hh, w: hw, h: hh }, this.capacity, this.depth + 1);
        this.se = new QuadTree({ x: x + hw, y: y + hh, w: hw, h: hh }, this.capacity, this.depth + 1);

        this.divided = true;
    }

    insert(element) {
        if (!this.contains(this.boundary, element.bounds)) {
            return false;
        }

        if ((this.elements.length < this.capacity && !this.divided) || this.depth >= this.maxDepth) {
            this.elements.push(element);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
            for(const e of this.elements) {
                this._insertToChildren(e);
            }
            this.elements = [];
        }

        return this._insertToChildren(element);
    }

    _insertToChildren(element) {
        return (
            this.nw.insert(element) ||
            this.ne.insert(element) ||
            this.sw.insert(element) ||
            this.se.insert(element)
        );
    }

    contains(boundary, bounds) {
        return (
            bounds.x >= boundary.x &&
            bounds.x + bounds.w <= boundary.x + boundary.w &&
            bounds.y >= boundary.y &&
            bounds.y + bounds.h <= boundary.y + boundary.h
        );
    }

    intersects(a, b) {
        return !(
            b.x > a.x + a.w ||
            b.x + b.w < a.x ||
            b.y > a.y + a.h ||
            b.y + b.h < a.y
        );
    }

    query(range, found = []) {
        if (!this.intersects(this.boundary, range)) {
            return found;
        }

        for (const p of this.elements) {
            if (this.intersects(p.bounds, range)) {
                found.push(p.data);
            }
        }

        if (this.divided) {
            this.nw.query(range, found);
            this.ne.query(range, found);
            this.sw.query(range, found);
            this.se.query(range, found);
        }

        return found;
    }
}

export class SpatialIndex {
    constructor() {
        this.tree = null;
        // Start with a large enough boundary, but it can be expanded if needed
        this.boundary = { x: -50000, y: -50000, w: 100000, h: 100000 };
    }

    update(elements, bgLines = null, bgScale = 1.0) {
        // Dynamic boundary calculation for massive projects
        const bounds = this.calculateGlobalBounds(elements, bgLines, bgScale);
        this.boundary = bounds;
        
        this.tree = new QuadTree(this.boundary);
        
        for (const el of elements) {
            const b = this.getElementBounds(el);
            if (b) this.tree.insert({ bounds: b, data: el });
        }

        if (bgLines && bgLines instanceof Float32Array) {
            const maxIndexable = 200000;
            const count = Math.min(bgLines.length / 4, maxIndexable);
            for (let i = 0; i < count; i++) {
                const x1 = bgLines[i*4] * bgScale, y1 = bgLines[i*4+1] * bgScale;
                const x2 = bgLines[i*4+2] * bgScale, y2 = bgLines[i*4+3] * bgScale;
                const bx = Math.min(x1, x2), by = Math.min(y1, y2);
                const bw = Math.abs(x1-x2) || 0.1, bh = Math.abs(y1-y2) || 0.1;
                
                this.tree.insert({ 
                    bounds: { x: bx, y: by, w: bw, h: bh }, 
                    data: { tipo: 'bg_line', datos: { x1, y1, x2, y2 } } 
                });
            }
        }
    }

    calculateGlobalBounds(elements, bgLines, bgScale) {
        // Límites base más amplios para evitar truncamiento
        let minX = -10000, minY = -10000, maxX = 10000, maxY = 10000;
        
        for (const el of elements) {
            const b = this.getElementBounds(el);
            if (b) {
                minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
            }
        }
        
        if (bgLines && bgLines instanceof Float32Array && bgLines.length > 0) {
            for (let i = 0; i < bgLines.length; i += 2) { 
                const val = bgLines[i] * bgScale;
                if (i % 4 < 2) { // x
                    if (val < minX) minX = val; if (val > maxX) maxX = val;
                } else { // y
                    if (val < minY) minY = val; if (val > maxY) maxY = val;
                }
            }
        }

        const w = maxX - minX, h = maxY - minY;
        // Margen extra generoso (2000 unidades) para evitar cualquier error de borde
        return { x: minX - 1000, y: minY - 1000, w: w + 2000, h: h + 2000 };
    }

    getElementBounds(el) {
        if (el.tipo === 'linea') {
            const x = Math.min(el.datos.x1, el.datos.x2);
            const y = Math.min(el.datos.y1, el.datos.y2);
            const w = Math.abs(el.datos.x1 - el.datos.x2);
            const h = Math.abs(el.datos.y1 - el.datos.y2);
            // Añadir un margen de "grosor" virtual para que el QuadTree los encuentre siempre
            return { x: x - 20, y: y - 20, w: w + 40, h: h + 40 };
        }
        if (el.tipo === 'nodo' || el.tipo === 'valvula_manual' || el.tipo === 'nota') {
            return { x: el.datos.x - 50, y: el.datos.y - 50, w: 100, h: 100 };
        }
        if (el.tipo === 'cota') {
            const x = Math.min(el.datos.x1, el.datos.x2), y = Math.min(el.datos.y1, el.datos.y2);
            const w = Math.abs(el.datos.x1 - el.datos.x2), h = Math.abs(el.datos.y1 - el.datos.y2);
            return { x: x - 100, y: y - 100, w: w + 200, h: h + 200 };
        }
        return null;
    }

    search(range) {
        if (!this.tree) return [];
        // Expandimos el rango de búsqueda un poco para asegurar que traiga todo lo visible
        const expandedRange = {
            x: range.x - 100,
            y: range.y - 100,
            w: range.w + 200,
            h: range.h + 200
        };
        return this.tree.query(expandedRange);
    }
}
