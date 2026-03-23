import ezdxf
import math
import os
import tempfile
from ezdxf.enums import TextEntityAlignment
from core.geometry import project_iso

def generar_dxf(plano: dict) -> str:
    """
    Genera un archivo DXF a partir de un plano.
    """
    is_iso = plano.get("is_isometric", False)
    
    def tr(x, y, z=0):
        if is_iso:
            return project_iso(x, y, z)
        return x, y

    # Crear un nuevo dibujo DXF
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()

    # Factor de escala: 50 px = 1 metro
    SCALE_FACTOR = 1.0 / 50.0

    # Definir capas
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
        x1, y1, z1 = linea['x1'], linea['y1'], linea.get('z1', 0)
        x2, y2, z2 = linea['x2'], linea['y2'], linea.get('z2', 0)
        
        tx1, ty1 = tr(x1, y1, z1)
        tx2, ty2 = tr(x2, y2, z2)

        # En DXF invertimos Y después de proyectar (si es iso) o directamente (si es 2D)
        start = (tx1 * SCALE_FACTOR, -ty1 * SCALE_FACTOR) 
        end = (tx2 * SCALE_FACTOR, -ty2 * SCALE_FACTOR)
        msp.add_line(start, end, dxfattribs={'layer': 'TUBERIAS'})

        # Etiqueta de diámetro
        diametro = linea.get('diametro')
        if diametro:
            mx, my = (start[0] + end[0]) / 2, (start[1] + end[1]) / 2
            dx, dy = end[0] - start[0], end[1] - start[1]
            angulo = math.degrees(math.atan2(dy, dx))
            if angulo > 90 or angulo < -90:
                angulo += 180

            label = f"Ø{diametro}"
            longitud_m = linea.get('longitud_metros', '')
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
        nx, ny, nz = nodo['x'], nodo['y'], nodo.get('z', 0)
        tx, ty = tr(nx, ny, nz)
        x, y = tx * SCALE_FACTOR, -ty * SCALE_FACTOR
        
        layer = 'COMPRESORES' if tipo == 'compresor' else 'CONSUMOS'
        msp.add_circle((x, y), radius=0.2, dxfattribs={'layer': layer})
        
        label = "C" if tipo == 'compresor' else "P"
        msp.add_text(label, dxfattribs={
            'layer': layer,
            'height': 0.2,
            'color': 7
        }).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    # Dibujar Piezas
    piezas = plano.get("piezas", [])
    for pieza in piezas:
        px, py, pz = pieza["x"], pieza["y"], pieza.get("z", 0)
        tx, ty = tr(px, py, pz)
        x, y = tx * SCALE_FACTOR, -ty * SCALE_FACTOR
        tipo = pieza["tipo"]
        
        if tipo == "Union":
            label, r = "U", 0.25
            msp.add_lwpolyline([(x-r, y-r), (x+r, y-r), (x+r, y+r), (x-r, y+r), (x-r, y-r)], 
                              dxfattribs={'layer': 'PIEZAS', 'color': 5})
        elif tipo == "Tapon":
            label = "X"
            msp.add_circle((x, y), radius=0.25, dxfattribs={'layer': 'PIEZAS', 'color': 1})
        else:
            label = "T" if "Te" in tipo else "+" if tipo == "Cruz" else "C"
            color = 2 if "Te" in tipo else 6 if tipo == "Cruz" else 3
            msp.add_circle((x, y), radius=0.25, dxfattribs={'layer': 'PIEZAS', 'color': color})

        msp.add_text(label, dxfattribs={'layer': 'PIEZAS', 'height': 0.2, 'color': 7}).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    # Válvulas Manuales
    valvulas_manuales = plano.get("valvulas_manuales", [])
    if valvulas_manuales:
        if 'VALVULAS_MAN' not in doc.layers:
            doc.layers.new(name='VALVULAS_MAN', dxfattribs={'color': 2})
        for v in valvulas_manuales:
            vx, vy, vz = v["x"], v["y"], v.get("z", 0)
            tx, ty = tr(vx, vy, vz)
            cx, cy = tx * SCALE_FACTOR, -ty * SCALE_FACTOR
            ang_deg = -v.get("angulo", 0)
            rad = math.radians(ang_deg)
            cos_a, sin_a = math.cos(rad), math.sin(rad)
            t1 = [(-0.12, -0.08), (0, 0), (-0.12, 0.08)]
            t2 = [(0.12, -0.08), (0, 0), (0.12, 0.08)]
            def transform_m(pts):
                return [(cx + (px*cos_a - py*sin_a), cy + (px*sin_a + py*cos_a)) for px, py in pts]
            msp.add_lwpolyline(transform_m(t1), dxfattribs={'layer': 'VALVULAS_MAN', 'closed': True})
            msp.add_lwpolyline(transform_m(t2), dxfattribs={'layer': 'VALVULAS_MAN', 'closed': True})

    # Notas
    notas = plano.get("notas", [])
    if notas:
        if 'NOTAS' not in doc.layers:
            doc.layers.new(name='NOTAS', dxfattribs={'color': 7})
        for n in notas:
            nx, ny, nz = n["x"], n["y"], n.get("z", 0)
            tx, ty = tr(nx, ny, nz)
            x, y = tx * SCALE_FACTOR, -ty * SCALE_FACTOR
            msp.add_text(n["texto"], dxfattribs={'layer': 'NOTAS', 'height': 0.25, 'color': 7}).set_placement((x, y), align=TextEntityAlignment.LEFT)

    # Exportar
    with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False, mode='w', encoding='utf-8') as tmp:
        tmp_path = tmp.name
    try:
        doc.saveas(tmp_path)
        with open(tmp_path, 'r', encoding='utf-8') as f:
            return f.read()
    finally:
        os.unlink(tmp_path)
