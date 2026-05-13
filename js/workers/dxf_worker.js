/**
 * DXF Processing Worker
 * Handles heavy JSON parsing and binary conversion off the main thread.
 */

self.onmessage = function(e) {
    const { lines, bgScale } = e.data;
    
    if (!lines) return;

    const lineCount = lines.length;
    const binaryLines = new Float32Array(lineCount * 4);
    
    // Bounds calculation for the entire drawing
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < lineCount; i++) {
        const l = lines[i];
        const x1 = l.x1, y1 = l.y1, x2 = l.x2, y2 = l.y2;
        
        binaryLines[i * 4] = x1;
        binaryLines[i * 4 + 1] = y1;
        binaryLines[i * 4 + 2] = x2;
        binaryLines[i * 4 + 3] = y2;

        if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1;
        if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2;
        if (y1 < minY) minY = y1; if (y1 > maxY) maxY = y1;
        if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
    }

    // Report progress or results
    self.postMessage({
        status: 'complete',
        binaryLines: binaryLines,
        bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
        count: lineCount
    }, [binaryLines.buffer]); // Transfer the buffer for 0-copy performance
};
