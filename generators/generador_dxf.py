import ezdxf
import math
import os
import tempfile
from ezdxf.enums import TextEntityAlignment
from core.geometry import project_iso

def generar_dxf(plano: dict) -> str:
    """
    Genera un archivo DXF 3D a partir de un plano.
    """
    # Factor de escala: 100 px = 1 metro
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
    if 'VALVULAS' not in doc.layers:
        doc.layers.new(name='VALVULAS', dxfattribs={'color': 6})
    if 'NOTAS' not in doc.layers:
        doc.layers.new(name='NOTAS', dxfattribs={'color': 7})
    if 'FONDO' not in doc.layers:
        doc.layers.new(name='FONDO', dxfattribs={'color': 8})

    # 1. Dibujar fondo DXF (Z=0)
    bg_lines = plano.get('bgLines', [])
    bg_scale = plano.get('bgScale', 1.0)
    for l in bg_lines:
        is_text = l.get('type') == 'text'
        if is_text:
            x, y, h = l.get('x', 0) * bg_scale, l.get('y', 0) * bg_scale, l.get('h', 0) * bg_scale
            tx, ty, tz = tr(x, y, 0)
            text_str = l.get('text', '')
            msp.add_text(text_str, dxfattribs={'layer': 'FONDO', 'height': h * SCALE_FACTOR}).set_placement((tx, -ty, 0))
        else:
            x1, y1 = l.get('x1', 0) * bg_scale, l.get('y1', 0) * bg_scale
            x2, y2 = l.get('x2', 0) * bg_scale, l.get('y2', 0) * bg_scale
            tx1, ty1, tz1 = tr(x1, y1, 0)
            tx2, ty2, tz2 = tr(x2, y2, 0)
            msp.add_line((tx1, -ty1, 0), (tx2, -ty2, 0), dxfattribs={'layer': 'FONDO'})

    # 2. Dibujar tuberías en 3D (Cilindros Básicos)
    lineas = plano.get('lineas', [])
    for linea in lineas:
        x1, y1, z1 = linea['x1'], linea['y1'], linea.get('z1', 0)
        x2, y2, z2 = linea['x2'], linea['y2'], linea.get('z2', 0)
        start, end = tr(x1, y1, z1), tr(x2, y2, z2)
        
        # Radio según diámetro
        try:
            d_str = str(linea.get('diametro', '1')).replace('"', '')
            if '/' in d_str:
                n, d = d_str.split('/'); d_val = float(n)/float(d)
            else: d_val = float(d_str)
            radius = (d_val * 0.0254) / 2.0
        except: radius = 0.02

        dx, dy, dz = end[0]-start[0], end[1]-start[1], end[2]-start[2]
        dist = math.sqrt(dx**2 + dy**2 + dz**2)
        
        if dist > 0.001:
            v_perp = (1, 0, 0) if abs(dz)/dist > 0.9 else (0, 0, 1)
            def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
            vt = (dx/dist, dy/dist, dz/dist)
            u = cross(v_perp, vt)
            mu = math.sqrt(sum(x**2 for x in u)); u = (u[0]/mu, u[1]/mu, u[2]/mu)
            v = cross(vt, u)
            
            verts = []
            for ang in [0, 90, 180, 270]:
                rad = math.radians(ang); c, s = math.cos(rad), math.sin(rad)
                verts.append((start[0]+radius*(c*u[0]+s*v[0]), start[1]+radius*(c*u[1]+s*v[1]), start[2]+radius*(c*u[2]+s*v[2])))
                verts.append((end[0]+radius*(c*u[0]+s*v[0]), end[1]+radius*(c*u[1]+s*v[1]), end[2]+radius*(c*u[2]+s*v[2])))
            
            for i in range(0, 8, 2):
                p1, p2, p3, p4 = verts[i], verts[i+1], verts[(i+3)%8], verts[(i+2)%8]
                msp.add_3dface([p1, p2, p3, p4], dxfattribs={'layer': 'TUBERIAS'})
        else:
            msp.add_line(start, end, dxfattribs={'layer': 'TUBERIAS'})

        # Etiqueta de diámetro
        diam = linea.get('diametro')
        if diam:
            mx, my, mz = (start[0]+end[0])/2, (start[1]+end[1])/2, (start[2]+end[2])/2
            ang = math.degrees(math.atan2(end[1]-start[1], end[0]-start[0]))
            if ang > 90 or ang < -90: ang += 180
            label = f"Ø{diam}"
            msp.add_text(label, dxfattribs={'layer': 'DIAMETROS', 'height': 0.15, 'rotation': ang}).set_placement((mx, my+0.1, mz), align=TextEntityAlignment.MIDDLE_CENTER)

    # 3. Dibujar nodos
    for n in plano.get('nodos', []):
        tx, ty, tz = tr(n['x'], n['y'], n.get('z', 0))
        layer = 'COMPRESORES' if n.get('tipo') == 'compresor' else 'CONSUMOS'
        msp.add_circle((tx, -ty, tz), radius=0.2, dxfattribs={'layer': layer})
        msp.add_text("C" if n.get('tipo')=='compresor' else "P", dxfattribs={'layer': layer, 'height': 0.2}).set_placement((tx, -ty, tz), align=TextEntityAlignment.MIDDLE_CENTER)

    # 4. Dibujar Piezas
    for p in plano.get("piezas", []):
        tx, ty, tz = tr(p["x"], p["y"], p.get("z", 0))
        msp.add_circle((tx, -ty, tz), radius=0.1, dxfattribs={'layer': 'PIEZAS'})
        label = p.get("tipo", "P")[0].upper()
        msp.add_text(label, dxfattribs={'layer': 'PIEZAS', 'height': 0.1}).set_placement((tx, -ty, tz+0.1))

    # 5. Válvulas
    for v in plano.get("valvulas_manuales", []):
        tx, ty, tz = tr(v["x"], v["y"], v.get("z", 0))
        msp.add_circle((tx, -ty, tz), radius=0.15, dxfattribs={'layer': 'VALVULAS'})

    # 6. Notas
    for n in plano.get("notas", []):
        tx, ty, tz = tr(n["x"], n["y"], n.get("z", 0))
        msp.add_text(n["texto"], dxfattribs={'layer': 'NOTAS', 'height': 0.25}).set_placement((tx, -ty, tz), align=TextEntityAlignment.LEFT)

    # Exportar
    with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False, mode='w', encoding='utf-8') as tmp:
        tmp_path = tmp.name
    try:
        doc.saveas(tmp_path)
        with open(tmp_path, 'rb') as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
