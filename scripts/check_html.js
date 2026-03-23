
const fs = require('fs');
const content = fs.readFileSync('H:\\DRAW 1.0\\index.html', 'utf8');

function checkTags(content) {
    const stack = [];
    const tagRegex = /<(\/?[a-z0-9]+)(\s+[^>]*?)?>/gi;
    let match;
    const selfClosing = ['img', 'br', 'hr', 'input', 'link', 'meta', '!doctype'];

    while ((match = tagRegex.exec(content)) !== null) {
        let tag = match[1].toLowerCase();
        let isClosing = tag.startsWith('/');
        if (isClosing) tag = tag.substring(1);

        if (selfClosing.includes(tag)) continue;

        if (isClosing) {
            if (stack.length === 0) {
                console.log(`Unexpected closing tag </${tag}> near char ${match.index}`);
            } else {
                const last = stack.pop();
                if (last.tag !== tag) {
                    console.log(`Mismatched closing tag </${tag}> for <${last.tag}> near char ${match.index}`);
                }
            }
        } else {
            stack.push({ tag, index: match.index });
        }
    }

    stack.forEach(unclosed => {
        console.log(`Unclosed tag <${unclosed.tag}> near char ${unclosed.index}`);
    });
}

checkTags(content);
