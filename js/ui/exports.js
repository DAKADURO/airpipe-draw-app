import { state } from '../state.js';
import { procesarPlano, downloadPDF, downloadPDFDirect } from '../api.js';
import { setStatus } from './tools.js';

export function setupExports(canvas) {
    const svgContainer = document.getElementById('svg-container');
    const svgModal = document.getElementById('svg-modal');
    const btnGenerar = document.getElementById('btn-generar');

    if (btnGenerar) btnGenerar.onclick = async () => {
        const plano = {
            lineas: state.historial.filter(a => a.tipo === 'linea').map(a => a.datos),
            nodos: state.historial.filter(a => a.tipo === 'nodo').map(a => a.datos),
            valvulas_manuales: state.historial.filter(a => a.tipo === 'valvula_manual').map(a => a.datos),
            notas: state.historial.filter(a => a.tipo === 'nota').map(a => a.datos),
            tipo_red: document.getElementById('select-tipo-red').value || 'lineal',
            caudal_scfm: parseFloat(document.getElementById('input-caudal').value) || 0,
            is_isometric: state.viewState.isIsometric || false
        };

        setStatus('Generando plano, por favor espera...');
        try {
            const response = await procesarPlano(plano);
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const data = await response.json();

            if (data.svg) {
                svgContainer.innerHTML = data.svg;
                svgModal.classList.remove('hidden');
                setStatus('Plano generado exitosamente.');

                state.resultadosCalculo = data.lineas;
                state.piezasCalculo = data.piezas;
                state.valvulasCalculo = data.valvulas;
                state.bomCalculo = data.bom; 
                if (window.actualizarTablaBOM) window.actualizarTablaBOM(data.bom);

                if (data.lineas) {
                    const otrosElementos = state.historial.filter(a => a.tipo !== 'linea');
                    const nuevasLineasHistorial = data.lineas.map(l => ({
                        tipo: 'linea',
                        datos: { ...l }
                    }));

                    state.historial = [...otrosElementos, ...nuevasLineasHistorial];

                    state.historial.forEach(item => {
                        if (item.tipo === 'nodo') {
                            const matching = data.nodos.find(n => Math.hypot(n.x - item.datos.x, n.y - item.datos.y) < 50);
                            if (matching) {
                                item.datos.x = matching.x; item.datos.y = matching.y; item.datos.z = matching.z || 0;
                            }
                        } else if (item.tipo === 'valvula_manual') {
                            const matching = data.valvulas.find(v => Math.hypot(v.x - item.datos.x, v.y - item.datos.y) < 50);
                            if (matching) {
                                item.datos.x = matching.x; item.datos.y = matching.y; item.datos.z = matching.z || 0;
                                item.datos.diametro = matching.diametro;
                            }
                        }
                    });
                }
                
                import('../drawing.js').then(d => d.redraw());

                document.getElementById('btn-download').onclick = () => {
                    const blob = new Blob([data.svg], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'plano_airpipe.svg';
                    document.body.appendChild(a); a.click();
                    document.body.removeChild(a); URL.revokeObjectURL(url);
                };

                const btnDownloadDxf = document.getElementById('btn-download-dxf');
                if (data.dxf) {
                    btnDownloadDxf.style.display = 'inline-block';
                    btnDownloadDxf.onclick = () => {
                        const byteCharacters = atob(data.dxf);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'application/dxf' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'plano_airpipe.dxf';
                        document.body.appendChild(a); a.click();
                        document.body.removeChild(a); URL.revokeObjectURL(url);
                    };
                } else {
                    btnDownloadDxf.style.display = 'none';
                }

                document.getElementById('btn-close').onclick = () => {
                    svgModal.classList.add('hidden');
                    svgContainer.innerHTML = '';
                };
            }
        } catch (err) {
            setStatus('Error al generar plano: ' + err.message);
        }
    };

    const triggerPDFDownload = async () => {
        setStatus('Generando PDF, por favor espera...');
        const btn1 = document.getElementById('btn-download-pdf');
        const btn2 = document.getElementById('btn-download-pdf-bom');
        if (btn1) btn1.disabled = true;
        if (btn2) btn2.disabled = true;

        try {
            const drawingDataUrl = canvas.toDataURL('image/png');
            let resp;
            if (state.proyectoActualId) {
                resp = await downloadPDF(state.proyectoActualId, drawingDataUrl);
            } else {
                const plano = {
                    lineas: state.historial.filter(a => a.tipo === 'linea').map(a => a.datos),
                    nodos: state.historial.filter(a => a.tipo === 'nodo').map(a => a.datos),
                    valvulas_manuales: state.historial.filter(a => a.tipo === 'valvula_manual').map(a => a.datos),
                    notas: state.historial.filter(a => a.tipo === 'nota').map(a => a.datos),
                    tipo_red: document.getElementById('select-tipo-red').value || 'lineal',
                    caudal_scfm: parseFloat(document.getElementById('input-caudal').value) || 0,
                    is_isometric: state.viewState.isIsometric || false
                };
                resp = await downloadPDFDirect(plano, drawingDataUrl, "Plano Temporal", "S/C");
            }
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || 'Error de procesamiento en el servidor');
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_AIRpipe_${state.proyectoActualName || 'Plano'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatus('PDF generado y descargado exitosamente.');
        } catch (err) {
            alert("Error al generar el PDF: " + err.message);
            setStatus('Error al generar PDF: ' + err.message);
        } finally {
            if (btn1) btn1.disabled = false;
            if (btn2) btn2.disabled = false;
        }
    };

    const btnPdf1 = document.getElementById('btn-download-pdf');
    if (btnPdf1) btnPdf1.onclick = triggerPDFDownload;
    
    const btnPdf2 = document.getElementById('btn-download-pdf-bom');
    if (btnPdf2) btnPdf2.onclick = triggerPDFDownload;
}
