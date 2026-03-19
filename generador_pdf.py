"""
generador_pdf.py — AIRpipe
Genera un reporte PDF profesional que incluye:
1. Información del Proyecto y Cliente.
2. Imagen del plano (recibida desde el frontend).
3. Tabla de Lista de Materiales (BOM).
"""

from fpdf import FPDF
import base64
import os
from datetime import datetime

class AIRpipeReport(FPDF):
    def header(self):
        # Logo o Título
        self.set_font('Arial', 'B', 15)
        self.set_text_color(22, 33, 62) # Azul oscuro AIRpipe
        self.cell(0, 10, 'REPORTE DE PROYECTO - AIRpipe DRAW 1.0', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Página {self.page_no()} | AIRpipe System Performance', 0, 0, 'C')

def generar_reporte_pdf(proyecto_nombre, cliente, bom, imagen_b64=None):
    """
    Crea el PDF y lo devuelve como bytes.
    """
    print(f"DEBUG PDF: Generando reporte para {proyecto_nombre}")
    print(f"DEBUG PDF: BOM keys: {list(bom.keys()) if isinstance(bom, dict) else 'NOT A DICT'}")
    if isinstance(bom, dict):
        print(f"DEBUG PDF: Tuberias count: {len(bom.get('tuberias', []))}")
        print(f"DEBUG PDF: Accesorios count: {len(bom.get('accesorios', []))}")
        print(f"DEBUG PDF: Valvulas count: {len(bom.get('valvulas', []))}")

    pdf = AIRpipeReport()
    pdf.add_page()
    
    # --- Información del Proyecto ---
    pdf.set_font('Arial', 'B', 12)
    pdf.set_fill_color(240, 240, 255)
    pdf.cell(0, 10, f" Proyecto: {proyecto_nombre}", 0, 1, 'L', fill=True)
    pdf.set_font('Arial', '', 10)
    pdf.cell(0, 8, f" Cliente: {cliente if cliente else 'N/A'}", 0, 1, 'L')
    pdf.cell(0, 8, f" Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}", 0, 1, 'L')
    pdf.ln(10)

    # --- Imagen del Plano ---
    if imagen_b64:
        try:
            # Decodificar imagen temporal
            img_data = base64.b64decode(imagen_b64.split(',')[-1])
            img_path = "temp_plano.png"
            with open(img_path, "wb") as f:
                f.write(img_data)
            
            pdf.set_font('Arial', 'B', 11)
            pdf.cell(0, 8, "VISTA PREVIA DEL PLANO", 0, 1, 'L')
            # Insertar imagen (centrada y ajustada)
            pdf.image(img_path, x=10, w=190)
            pdf.ln(5)
            os.remove(img_path)
        except Exception as e:
            pdf.set_text_color(255, 0, 0)
            pdf.cell(0, 10, f"Error al insertar imagen: {e}", 0, 1)
            pdf.set_text_color(0)

    # --- Lista de Materiales (BOM) ---
    pdf.ln(10)
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, "LISTA DE MATERIALES (BOM)", 0, 1, 'L')
    
    # Estilo de tabla
    pdf.set_font('Arial', 'B', 10)
    pdf.set_fill_color(22, 33, 62)
    pdf.set_text_color(255)
    
    # Cabeceras
    pdf.cell(130, 8, " Descripción", 1, 0, 'L', fill=True)
    pdf.cell(30, 8, " Cantidad", 1, 0, 'C', fill=True)
    pdf.cell(30, 8, " Unidad", 1, 1, 'C', fill=True)
    
    pdf.set_text_color(0)
    pdf.set_font('Arial', '', 9)
    
    # Filas (agrupadas como en generador_bom)
    def agregar_seccion(titulo, items):
        if not items: return
        pdf.set_font('Arial', 'B', 9)
        pdf.set_fill_color(230, 230, 230)
        pdf.cell(190, 6, f" {titulo}", 1, 1, 'L', fill=True)
        pdf.set_font('Arial', '', 9)
        for item in items:
            pdf.cell(130, 7, f" {item['descripcion']}", 1, 0, 'L')
            pdf.cell(30, 7, str(item['cantidad']), 1, 0, 'C')
            pdf.cell(30, 7, item['unidad'], 1, 1, 'C')

    agregar_seccion("TUBERÍA", bom.get("tuberias", []))
    agregar_seccion("ACCESORIOS", bom.get("accesorios", []))
    agregar_seccion("VÁLVULAS", bom.get("valvulas", []))

    return bytes(pdf.output())
