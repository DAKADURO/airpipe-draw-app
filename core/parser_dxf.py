import ezdxf
import ezdxf.path
import tempfile
import os

def dxf_a_lineas_json(dxf_content: bytes) -> list[dict]:
    """
    Convierte un archivo DXF en una lista de líneas {x1, y1, x2, y2} 
    para ser usadas como fondo en el canvas.
    Aplica escala para que 1 unidad de AutoCAD = 1 metro = 100 píxeles.
    """
    try:
        # Guardar en archivo temporal para que ezdxf maneje encodings y formato binario
        with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False) as tmp:
            tmp.write(dxf_content)
            tmp_path = tmp.name

        try:
            doc = ezdxf.readfile(tmp_path)
        finally:
            os.unlink(tmp_path)

        # --- Manejo de Unidades y Escala ---
        # $INSUNITS: 1=Inches, 4=Millimeters, 5=Centimeters, 6=Meters
        insunits = doc.header.get('$INSUNITS', 0)
        factors = {
            1: 0.0254,   # Pulgadas
            2: 0.3048,   # Pies
            4: 0.001,    # Milímetros
            5: 0.01,     # Centímetros
            6: 1.0,      # Metros
        }
        unit_to_meter = factors.get(insunits, 1.0)
        
        # DRAW 1.0 usa 100 píxeles por metro en el canvas (World Units = Pixels)
        PIXELS_PER_METER = 100
        SCALE = unit_to_meter * PIXELS_PER_METER

        msp = doc.modelspace()
        lineas = []

        def extract_lines_from_entity(entity):
            dxftype = entity.dxftype()
            
            if dxftype == 'LINE':
                lineas.append({
                    'x1': round(entity.dxf.start.x * SCALE, 3),
                    'y1': round(entity.dxf.start.y * SCALE, 3),
                    'x2': round(entity.dxf.end.x * SCALE, 3),
                    'y2': round(entity.dxf.end.y * SCALE, 3)
                })
            elif dxftype in ('LWPOLYLINE', 'POLYLINE'):
                pts = list(entity.get_points('xy'))
                for i in range(len(pts) - 1):
                    lineas.append({
                        'x1': round(pts[i][0] * SCALE, 3),
                        'y1': round(pts[i][1] * SCALE, 3),
                        'x2': round(pts[i+1][0] * SCALE, 3),
                        'y2': round(pts[i+1][1] * SCALE, 3)
                    })
                if entity.is_closed and len(pts) > 2:
                    lineas.append({
                        'x1': round(pts[-1][0] * SCALE, 3),
                        'y1': round(pts[-1][1] * SCALE, 3),
                        'x2': round(pts[0][0] * SCALE, 3),
                        'y2': round(pts[0][1] * SCALE, 3)
                    })
            elif dxftype == 'INSERT':
                try:
                    for v_ent in entity.virtual_entities():
                        extract_lines_from_entity(v_ent)
                except Exception:
                    pass
            elif dxftype in ('ARC', 'CIRCLE', 'ELLIPSE', 'SPLINE'):
                try:
                    p = ezdxf.path.make_path(entity)
                    pts = list(p.flattening(distance=0.1))
                    for i in range(len(pts) - 1):
                        lineas.append({
                            'x1': round(pts[i].x * SCALE, 3),
                            'y1': round(pts[i].y * SCALE, 3),
                            'x2': round(pts[i+1].x * SCALE, 3),
                            'y2': round(pts[i+1].y * SCALE, 3)
                        })
                except Exception:
                    pass

        # Extraer todas las entidades soportadas
        for entity in msp:
            extract_lines_from_entity(entity)

        # --- Normalización básica ---
        if not lineas:
            return []
            
        # Calcular límites (Bounding Box)
        xs = [l['x1'] for l in lineas] + [l['x2'] for l in lineas]
        ys = [l['y1'] for l in lineas] + [l['y2'] for l in lineas]
        min_x, min_y = min(xs), min(ys)
        
        # Desplazar al origen (0,0)
        for l in lineas:
            l['x1'] -= min_x
            l['y1'] -= min_y
            l['x2'] -= min_x
            l['y2'] -= min_y
            
        return lineas
        
    except Exception as e:
        print(f"Error parsing DXF: {e}")
        return []
