
const fs = require('fs');
const content = fs.readFileSync('H:\\DRAW 1.0\\canvas.js', 'utf8');
const lines = content.split('\n');
const declarations = {};

lines.forEach((line, index) => {
    const match = line.match(/^\s*(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
    if (match) {
        const name = match[2];
        if (declarations[name]) {
            console.log(`Duplicate found: ${name} at line ${index + 1} and ${declarations[name]}`);
        } else {
            declarations[name] = index + 1;
        }
    }
});
