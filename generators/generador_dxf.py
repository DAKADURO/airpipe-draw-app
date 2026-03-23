
import ezdxf
import math
import os
import tempfile
from ezdxf.enums import TextEntityAlignment

def generar_dxf(plano: dict) -> str:
    """
    Genera un archivo DXF a partir de un plano.
    
    Args:
        plano: Dict con claves "lineas", "nodos" y "piezas".
        
    Returns:
        String con el contenido del archivo DXF (en formato texto para ser codificado).
    """

    # Crear un nuevo dibujo DXF (R2010 es muy compatible)
    doc = ezdxf.new('R2010')
    
    # Configurar unidades a Metros (6)
    doc.header['$INSUNITS'] = 6
    
    msp = doc.modelspace()

    # Factor de escala: 50 px = 1 metro
    SCALE_FACTOR = 1.0 / 50.0

    # Definir capas
    # Colores ACI: 1=Rojo, 5=Azul, 7=Blanco/Negro, 3=Verde, 2=Amarillo
    if 'TUBERIAS' not in doc.layers:
        doc.layers.new(name='TUBERIAS', dxfattribs={'color': 5})
    if 'COMPRESORES' not in doc.layers:
        doc.layers.new(name='COMPRESORES', dxfattribs={'color': 7})
    if 'CONSUMOS' not in doc.layers:
        doc.layers.new(name='CONSUMOS', dxfattribs={'color': 1})
    if 'DIAMETROS' not in doc.layers:
        doc.layers.new(name='DIAMETROS', dxfattribs={'color': 3})
    if 'PIEZAS' not in doc.layers:
        doc.layers.new(name='PIEZAS', dxfattribs={'color': 2})

    # Dibujar tuberías
    lineas = plano.get('lineas', [])
    for linea in lineas:
        # Nota: En SVG el eje Y crece hacia abajo. En DXF/CAD crece hacia arriba.
        # Invertimos Y para mantener la orientación visual.
        # Aplicamos escala de píxeles a metros.
        start = (linea['x1'] * SCALE_FACTOR, -linea['y1'] * SCALE_FACTOR) 
        end = (linea['x2'] * SCALE_FACTOR, -linea['y2'] * SCALE_FACTOR)
        msp.add_line(start, end, dxfattribs={'layer': 'TUBERIAS'})

        # Etiqueta de diámetro (si existe)
        diametro = linea.get('diametro')
        if diametro:
            mx = (start[0] + end[0]) / 2
            my = (start[1] + end[1]) / 2
            dx = end[0] - start[0]
            dy = end[1] - start[1]
            angulo = math.degrees(math.atan2(dy, dx))
            # Mantener legible
            if angulo > 90 or angulo < -90:
                angulo += 180

            longitud_m = linea.get('longitud_metros', '')
            label = f"Ø{diametro}"
            if longitud_m:
                label += f" ({longitud_m}m)"

            msp.add_text(label, dxfattribs={
                'layer': 'DIAMETROS',
                'height': 0.15,
                'rotation': angulo,
                'color': 3,
            }).set_placement((mx, my + 0.1), align=TextEntityAlignment.MIDDLE_CENTER)

    # Dibujar nodos
    nodos = plano.get('nodos', [])
    for nodo in nodos:
        tipo = nodo.get('tipo')
        x = nodo['x'] * SCALE_FACTOR
        y = -nodo['y'] * SCALE_FACTOR # Invertir Y y escalar
        
        layer = 'COMPRESORES' if tipo == 'compresor' else 'CONSUMOS'
        # Radio visual en CAD (ajustar según escala, 0.2 unidades = 20cm radio visual aprox)
        msp.add_circle((x, y), radius=0.2, dxfattribs={'layer': layer})
        
        # Añadir texto
        label = "C" if tipo == 'compresor' else "P"
        # Text alignment MIDDLE_CENTER
        msp.add_text(label, dxfattribs={
            'layer': layer,
            'height': 0.2, # Altura de texto escalada
            'color': 7
        }).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    # Dibujar Piezas (Codos, Tes, Cruces, Uniones)
    piezas = plano.get("piezas", [])
    for pieza in piezas:
        # DXF coordinates (Y inverted)
        x = pieza["x"] * SCALE_FACTOR
        y = -pieza["y"] * SCALE_FACTOR
        tipo = pieza["tipo"]
        
        if tipo == "Union":
            label = "U"
            # Cuadrado (LWPOLYLINE)
            r = 0.25
            msp.add_lwpolyline([
                (x-r, y-r), (x+r, y-r), (x+r, y+r), (x-r, y+r), (x-r, y-r)
            ], dxfattribs={'layer': 'PIEZAS', 'color': 5}) # 5=Blue ideally
        elif tipo == "Tapon":
            label = "X"
            # Circulo rojo
            msp.add_circle((x, y), radius=0.25, dxfattribs={'layer': 'PIEZAS', 'color': 1}) # 1=Red
        else:
            label = "C"
            color = 3 # 3=Green (Codo)
            if tipo == "Te": 
                label = "T"
                color = 2 # 2=Yellow (Te)
            elif tipo == "Cruz": 
                label = "+"
                color = 6 # 6=Magenta (Cruz)

            # Circulo alrededor
            msp.add_circle((x, y), radius=0.25, dxfattribs={'layer': 'PIEZAS', 'color': color})

        msp.add_text(label, dxfattribs={
            'layer': 'PIEZAS',
            'height': 0.2,
            'color': 7
        }).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)


    # Válvulas Automáticas
    valvulas = plano.get("valvulas", [])
    if valvulas:
        if 'VALVULAS' not in doc.layers:
            doc.layers.new(name='VALVULAS', dxfattribs={'color': 4})

        for v in valvulas:
            # Coordenadas DXF (Y invertido y escala de metros)
            cx = v["x"] * SCALE_FACTOR
            cy = -v["y"] * SCALE_FACTOR
            ang_deg = -v["angulo"] # Invertir ángulo para CAD
            
            # Geometria Bowtie (Dos triángulos)
            # Tamaño aprox 0.24m total
            rad = math.radians(ang_deg)
            cos_a = math.cos(rad)
            sin_a = math.sin(rad)
            
            # Triángulo 1 (Izq)
            t1 = [(-0.12, -0.08), (0, 0), (-0.12, 0.08)]
            # Triángulo 2 (Der)
            t2 = [(0.12, -0.08), (0, 0), (0.12, 0.08)]
            
            def transform(pts):
                res = []
                for px, py in pts:
                    rx = px * cos_a - py * sin_a
                    ry = px * sin_a + py * cos_a
                    res.append((cx + rx, cy + ry))
                return res
            
            msp.add_lwpolyline(transform(t1), dxfattribs={'layer': 'VALVULAS', 'closed': True})
            msp.add_lwpolyline(transform(t2), dxfattribs={'layer': 'VALVULAS', 'closed': True})

    # Válvulas Manuales (Color Oro/Amarillo)
    valvulas_manuales = plano.get("valvulas_manuales", [])
    if valvulas_manuales:
        if 'VALVULAS_MAN' not in doc.layers:
            doc.layers.new(name='VALVULAS_MAN', dxfattribs={'color': 2}) # 2=Yellow
        for v in valvulas_manuales:
            cx = v["x"] * SCALE_FACTOR
            cy = -v["y"] * SCALE_FACTOR
            ang_deg = -v.get("angulo", 0)
            rad = math.radians(ang_deg)
            cos_a = math.cos(rad)
            sin_a = math.sin(rad)
            t1 = [(-0.12, -0.08), (0, 0), (-0.12, 0.08)]
            t2 = [(0.12, -0.08), (0, 0), (0.12, 0.08)]
            def transform_m(pts):
                return [(cx + (px*cos_a - py*sin_a), cy + (px*sin_a + py*cos_a)) for px, py in pts]
            msp.add_lwpolyline(transform_m(t1), dxfattribs={'layer': 'VALVULAS_MAN', 'closed': True})
            msp.add_lwpolyline(transform_m(t2), dxfattribs={'layer': 'VALVULAS_MAN', 'closed': True})

    # Notas / Anotaciones
    notas = plano.get("notas", [])
    if notas:
        if 'NOTAS' not in doc.layers:
            doc.layers.new(name='NOTAS', dxfattribs={'color': 7})
        for n in notas:
            nx = n["x"] * SCALE_FACTOR
            ny = -n["y"] * SCALE_FACTOR
            msp.add_text(n["texto"], dxfattribs={
                'layer': 'NOTAS',
                'height': 0.25,
                'color': 7
            }).set_placement((nx, ny), align=TextEntityAlignment.LEFT)

    # Retornar el contenido del archivo como string
    with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False, mode='w', encoding='utf-8') as tmp:
        tmp_path = tmp.name
    
    try:
        doc.saveas(tmp_path)
        with open(tmp_path, 'r', encoding='utf-8') as f:
            return f.read()
    finally:
        os.unlink(tmp_path)
