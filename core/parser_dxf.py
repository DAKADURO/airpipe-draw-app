import ezdxf
import ezdxf.path
import tempfile
import os
import sys
import math

# Aumentar limite de recursion
sys.setrecursionlimit(10000)

def dxf_a_lineas_json(dxf_content: bytes) -> list[dict]:
    try:
        print(f"\n--- PROCESANDO DXF ({len(dxf_content) / 1024 / 1024:.1f} MB) ---")
        
        with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False) as tmp:
            tmp.write(dxf_content)
            tmp_path = tmp.name

        try:
            doc = ezdxf.readfile(tmp_path)
        except Exception as e:
            print(f"ERROR ezdxf: {e}")
            return []
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        msp = doc.modelspace()
        
        # --- Análisis de Escala Inteligente ---
        insunits = doc.header.get('$INSUNITS', 0)
        try:
            # bbox puede tardar en archivos gigantes, pero es necesario
            bbox = ezdxf.bbox.extents(msp)
            max_dim = max(bbox.size.x, bbox.size.y) if bbox.has_data else 0
            print(f"DEBUG: Dimension maxima detectada: {max_dim:.2f} unidades")
        except:
            max_dim = 0

        factors = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0}
        unit_to_meter = factors.get(insunits, 1.0)
        
        # Heurística: si no hay unidades y el plano es enorme, probablemente son mm
        if insunits == 0 and max_dim > 5000:
            unit_to_meter = 0.001
            print("DEBUG: Plano sin unidades pero muy grande. Asumiendo Milímetros.")
        
        PIXELS_PER_METER = 100
        SCALE = unit_to_meter * PIXELS_PER_METER
        print(f"DEBUG: Escala aplicada: {SCALE:.4f}")

        lineas = []
        MAX_LINES = 500000 
        
        def extract_lines_from_entity(entity, depth=0):
            if len(lineas) >= MAX_LINES or depth > 8:
                return

            dxftype = entity.dxftype()
            
            if dxftype == 'LINE':
                lineas.append({
                    'x1': round(entity.dxf.start.x * SCALE, 2),
                    'y1': round(entity.dxf.start.y * SCALE, 2),
                    'x2': round(entity.dxf.end.x * SCALE, 2),
                    'y2': round(entity.dxf.end.y * SCALE, 2)
                })
            elif dxftype in ('LWPOLYLINE', 'POLYLINE'):
                try:
                    pts = list(entity.get_points('xy'))
                    for i in range(len(pts) - 1):
                        if len(lineas) >= MAX_LINES: break
                        lineas.append({
                            'x1': round(pts[i][0] * SCALE, 2),
                            'y1': round(pts[i][1] * SCALE, 2),
                            'x2': round(pts[i+1][0] * SCALE, 2),
                            'y2': round(pts[i+1][1] * SCALE, 2)
                        })
                except: pass
            elif dxftype == 'INSERT':
                try:
                    for v_ent in entity.virtual_entities():
                        extract_lines_from_entity(v_ent, depth + 1)
                        if len(lineas) >= MAX_LINES: break
                except: pass
            elif dxftype in ('ARC', 'CIRCLE'):
                try:
                    p = ezdxf.path.make_path(entity)
                    pts = list(p.flattening(distance=1.0))
                    for i in range(len(pts) - 1):
                        if len(lineas) >= MAX_LINES: break
                        lineas.append({
                            'x1': round(pts[i].x * SCALE, 2), 'y1': round(pts[i].y * SCALE, 2),
                            'x2': round(pts[i+1].x * SCALE, 2), 'y2': round(pts[i+1].y * SCALE, 2)
                        })
                except: pass

        for entity in msp:
            if len(lineas) >= MAX_LINES: break
            extract_lines_from_entity(entity)

        if not lineas:
            print("DEBUG: El plano no contenia lineas validas.")
            return []
            
        # --- Normalización ---
        min_x = min(min(l['x1'], l['x2']) for l in lineas)
        min_y = min(min(l['y1'], l['y2']) for l in lineas)
        
        print(f"DEBUG: Plano normalizado. Origen: ({min_x}, {min_y})")
        
        for l in lineas:
            l['x1'] -= min_x
            l['y1'] -= min_y
            l['x2'] -= min_x
            l['y2'] -= min_y
            
        print(f"DEBUG: EXITO. {len(lineas)} lineas listas para dibujar.\n")
        return lineas
        
    except Exception as e:
        print(f"ERROR CRITICO: {e}")
        return []
