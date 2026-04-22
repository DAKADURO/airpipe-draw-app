/**
 * Toast Notification System — AIRpipe DRAW v3.0.1
 * Non-blocking notification system replacing browser alert() dialogs.
 * 
 * Usage:
 *   import { showToast } from './ui/toast.js';
 *   showToast('Proyecto guardado', 'success');
 *   showToast('Error de conexión', 'error');
 *   showToast('Sin datos de cálculo', 'warning');
 *   showToast('DXF importado', 'info');
 */

const TOAST_DURATION = 4000;
const TOAST_SLIDE_IN = 320;
const TOAST_SLIDE_OUT = 280;
const TOAST_GAP = 10;

const TOAST_STYLES = {
    success: { icon: '✓', bg: 'rgba(46, 125, 50, 0.92)',  border: '#66BB6A', glow: 'rgba(76, 175, 80, 0.25)' },
    error:   { icon: '✕', bg: 'rgba(198, 40, 40, 0.92)',  border: '#EF5350', glow: 'rgba(244, 67, 54, 0.25)' },
    warning: { icon: '⚠', bg: 'rgba(245, 124, 0, 0.92)',  border: '#FFA726', glow: 'rgba(255, 152, 0, 0.25)' },
    info:    { icon: 'ℹ', bg: 'rgba(21, 101, 192, 0.92)',  border: '#42A5F5', glow: 'rgba(66, 165, 245, 0.25)' }
};

let _container = null;

function getContainer() {
    if (_container && document.body.contains(_container)) return _container;

    _container = document.createElement('div');
    _container.id = 'toast-container';
    Object.assign(_container.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: `${TOAST_GAP}px`,
        pointerEvents: 'none',
        maxWidth: '380px',
        width: '100%'
    });
    document.body.appendChild(_container);
    return _container;
}

/**
 * Display a non-blocking toast notification.
 * @param {string} message — Text to display
 * @param {'success'|'error'|'warning'|'info'} type — Notification severity
 * @param {number} [duration] — Auto-dismiss time in ms (default: 4000)
 */
export function showToast(message, type = 'info', duration = TOAST_DURATION) {
    const container = getContainer();
    const style = TOAST_STYLES[type] || TOAST_STYLES.info;

    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    Object.assign(toast.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '8px',
        background: style.bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${style.border}`,
        boxShadow: `0 4px 24px ${style.glow}, 0 2px 8px rgba(0,0,0,0.3)`,
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '13px',
        fontWeight: '500',
        lineHeight: '1.4',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transform: 'translateX(120%)',
        opacity: '0',
        transition: `transform ${TOAST_SLIDE_IN}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${TOAST_SLIDE_IN}ms ease`,
        willChange: 'transform, opacity',
        maxWidth: '100%',
        wordBreak: 'break-word'
    });

    // Icon
    const iconEl = document.createElement('span');
    iconEl.textContent = style.icon;
    Object.assign(iconEl.style, {
        fontSize: '16px',
        flexShrink: '0',
        width: '22px',
        height: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)'
    });

    // Message
    const msgEl = document.createElement('span');
    msgEl.textContent = message;
    msgEl.style.flex = '1';

    // Close button
    const closeEl = document.createElement('span');
    closeEl.textContent = '×';
    Object.assign(closeEl.style, {
        fontSize: '18px',
        flexShrink: '0',
        opacity: '0.6',
        cursor: 'pointer',
        padding: '0 2px',
        lineHeight: '1',
        transition: 'opacity 0.15s'
    });
    closeEl.onmouseenter = () => closeEl.style.opacity = '1';
    closeEl.onmouseleave = () => closeEl.style.opacity = '0.6';

    toast.appendChild(iconEl);
    toast.appendChild(msgEl);
    toast.appendChild(closeEl);
    container.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });
    });

    // Dismiss function
    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        toast.style.transition = `transform ${TOAST_SLIDE_OUT}ms cubic-bezier(0.55, 0, 1, 0.45), opacity ${TOAST_SLIDE_OUT}ms ease`;
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, TOAST_SLIDE_OUT);
    };

    // Click to dismiss
    toast.onclick = dismiss;
    closeEl.onclick = (e) => { e.stopPropagation(); dismiss(); };

    // Auto dismiss
    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    return dismiss;
}
