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
    
    # Factor de escala: 100 px = 1 metro (Consistente con el canvas)
    SCALE_FACTOR = 1.0 / 100.0

    def tr(x, y, z=0):
        # Retornamos coordenadas 3D reales en metros
        # Invertimos Y para alinearnos con el estándar de CAD (Y+ hacia arriba en el canvas es Y- en mundo real)
        return x * SCALE_FACTOR, -y * SCALE_FACTOR, z * SCALE_FACTOR

    # Crear un nuevo dibujo DXF
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6 # Metros
    msp = doc.modelspace()

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
    if 'FONDO' not in doc.layers:
        doc.layers.new(name='FONDO', dxfattribs={'color': 8}) # Gris

    # Dibujar fondo DXF
    bg_lines = plano.get('bgLines', [])
    bg_scale = plano.get('bgScale', 1.0)
    for l in bg_lines:
        is_text = l.get('type') == 'text'
        if is_text:
            x, y, h = l.get('x', 0) * bg_scale, l.get('y', 0) * bg_scale, l.get('h', 0) * bg_scale
            tx, ty = tr(x, y, 0)
            text_str = l.get('text', '')
            msp.add_text(
                text_str,
                dxfattribs={
                    'layer': 'FONDO',
                    'height': h * SCALE_FACTOR
                }
            ).set_placement((tx * SCALE_FACTOR, -ty * SCALE_FACTOR))
        else:
            x1, y1 = l.get('x1', 0) * bg_scale, l.get('y1', 0) * bg_scale
            x2, y2 = l.get('x2', 0) * bg_scale, l.get('y2', 0) * bg_scale
            tx1, ty1 = tr(x1, y1, 0)
            tx2, ty2 = tr(x2, y2, 0)
            msp.add_line(
                (tx1, -ty1),
                (tx2, -ty2),
                dxfattribs={'layer': 'FONDO'}
            )

    # Dibujar tuberías en 3D (Cilindros Básicos)
    lineas = plano.get('lineas', [])
    for linea in lineas:
        x1, y1, z1 = linea['x1'], linea['y1'], linea.get('z1', 0)
        x2, y2, z2 = linea['x2'], linea['y2'], linea.get('z2', 0)
        
        start = tr(x1, y1, z1)
        end = tr(x2, y2, z2)
        
        # Obtener radio según diámetro (o defecto 0.02m)
        try:
            d_str = str(linea.get('diametro', '1')).replace('"', '')
            if '/' in d_str: # Manejar fracciones como 1/2
                num, den = d_str.split('/')
                d_val = float(num) / float(den)
            else:
                d_val = float(d_str)
            radius = (d_val * 0.0254) / 2.0
        except:
            radius = 0.02 # ~1.5" por defecto

        # Dibujar el "tubo" como una malla simple de 4 caras (prisma cuadrado)
        # Esto es muy ligero y se ve 3D en AutoCAD
        dx, dy, dz = end[0] - start[0], end[1] - start[1], end[2] - start[2]
        dist = math.sqrt(dx**2 + dy**2 + dz**2)
        
        if dist > 0.001:
            # Crear un vector perpendicular para el radio
            # Intentamos usar Z como referencia, si la tubería es vertical usamos X
            if abs(dz) / dist > 0.9: 
                v_perp = (1, 0, 0)
            else:
                v_perp = (0, 0, 1)
            
            # Producto cruz para obtener el sistema de coordenadas local del tubo
            def cross(a, b):
                return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
            
            vec_tubo = (dx/dist, dy/dist, dz/dist)
            u = cross(v_perp, vec_tubo)
            mag_u = math.sqrt(sum(x**2 for x in u))
            u = (u[0]/mag_u, u[1]/mag_u, u[2]/mag_u)
            v = cross(vec_tubo, u)
            
            # Generar los 4 puntos de la base y los 4 del final
            vertices = []
            for ang in [0, 90, 180, 270]:
                rad = math.radians(ang)
                cos, sin = math.cos(rad), math.sin(rad)
                # Punto en la base
                vertices.append((
                    start[0] + radius * (cos * u[0] + sin * v[0]),
                    start[1] + radius * (cos * u[1] + sin * v[1]),
                    start[2] + radius * (cos * u[2] + sin * v[2])
                ))
                # Punto en el final
                vertices.append((
                    end[0] + radius * (cos * u[0] + sin * v[0]),
                    end[1] + radius * (cos * u[1] + sin * v[1]),
                    end[2] + radius * (cos * u[2] + sin * v[2])
                ))
            
            # Añadir las 4 caras laterales
            for i in range(0, 8, 2):
                p1, p2, p3, p4 = vertices[i], vertices[i+1], vertices[(i+3)%8], vertices[(i+2)%8]
                msp.add_3dface([p1, p2, p3, p4], dxfattribs={'layer': 'TUBERIAS'})
        else:
            # Si el tramo es minúsculo, solo una línea
            msp.add_line(start, end, dxfattribs={'layer': 'TUBERIAS'})

        # Etiqueta de diámetro
        diametro = linea.get('diametro')
        if diametro:
            mx, my, mz = (start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2
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
