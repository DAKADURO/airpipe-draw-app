/**
 * AIRpipe DRAW v3.0.1 — Modals Loader
 * Dynamically loads HTML modal templates from modals_templates.html
 * and injects them into the document body.
 */

export async function loadModals() {
    try {
        const response = await fetch('modals_templates.html');
        if (!response.ok) throw new Error('Could not load modal templates');
        
        const html = await response.text();
        
        // Use a temporary container to parse the HTML string
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = html;
        
        // Inject all modals into the body, but keep them hidden (they have id/class)
        const modals = tempContainer.querySelectorAll('[id]');
        const appElement = document.getElementById('app');
        
        modals.forEach(modal => {
            // Append outside of #app if it's a fixed/fixed modal, 
            // but for this app it seems they were inside #canvas-wrapper or #app.
            // Let's place them at the end of #app to match original structure.
            if (appElement) {
                appElement.appendChild(modal);
            } else {
                document.body.appendChild(modal);
            }
        });
        
        console.log('INFO: Modals loaded successfully');
        return true;
    } catch (error) {
        console.error('ERROR: Failed to load modals:', error);
        return false;
    }
}
