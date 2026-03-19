
const fs = require('fs');
const content = fs.readFileSync('H:\\DRAW 1.0\\canvas.js', 'utf8');
const lines = content.split('\n');
const globalDeclarations = {};

lines.forEach((line, index) => {
    // Only match declarations that are NOT inside a function (i.e. start of line or near start)
    // Actually, let's just match everything that starts with const/let/var at indentation level 0
    const match = line.match(/^(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
    if (match) {
        const name = match[2];
        if (globalDeclarations[name]) {
            console.log(`Duplicate Global: ${name} at line ${index + 1} and ${globalDeclarations[name]}`);
        } else {
            globalDeclarations[name] = index + 1;
        }
    }
});
