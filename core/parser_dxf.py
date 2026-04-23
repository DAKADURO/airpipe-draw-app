import ezdxf
import ezdxf.path
import tempfile
import os

def dxf_a_lineas_json(dxf_content: bytes) -> list[dict]:
    """
    Convierte un archivo DXF en una lista de líneas {x1, y1, x2, y2} 
    para ser usadas como fondo en el canvas.
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

        msp = doc.modelspace()
        lineas = []

        def extract_lines_from_entity(entity):
            dxftype = entity.dxftype()
            
            if dxftype == 'LINE':
                lineas.append({
                    'x1': round(entity.dxf.start.x, 3),
                    'y1': round(entity.dxf.start.y, 3),
                    'x2': round(entity.dxf.end.x, 3),
                    'y2': round(entity.dxf.end.y, 3)
                })
            elif dxftype in ('LWPOLYLINE', 'POLYLINE'):
                pts = list(entity.get_points('xy'))
                for i in range(len(pts) - 1):
                    lineas.append({
                        'x1': round(pts[i][0], 3),
                        'y1': round(pts[i][1], 3),
                        'x2': round(pts[i+1][0], 3),
                        'y2': round(pts[i+1][1], 3)
                    })
                if entity.is_closed and len(pts) > 2:
                    lineas.append({
                        'x1': round(pts[-1][0], 3),
                        'y1': round(pts[-1][1], 3),
                        'x2': round(pts[0][0], 3),
                        'y2': round(pts[0][1], 3)
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
                            'x1': round(pts[i].x, 3),
                            'y1': round(pts[i].y, 3),
                            'x2': round(pts[i+1].x, 3),
                            'y2': round(pts[i+1].y, 3)
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
