import ezdxf
import io

def dxf_a_lineas_json(dxf_content: bytes) -> list[dict]:
    """
    Convierte un archivo DXF en una lista de líneas {x1, y1, x2, y2} 
    para ser usadas como fondo en el canvas.
    """
    try:
        # Leer el contenido binario del DXF
        stream = io.BytesIO(dxf_content)
        # Intentar cargar con diferentes encodings si falla el default
        try:
            doc = ezdxf.read(stream)
        except ezdxf.DXFError:
            stream.seek(0)
            doc = ezdxf.read(stream, encoding='latin-1')
            
        msp = doc.modelspace()
        lineas = []
        
        # Consultamos líneas y polilíneas ligeras
        for entity in msp.query('LINE LWPOLYLINE POLYLINE'):
            # Saltamos capas que suelen ser de anotaciones si queremos (opcional)
            # layer = entity.dxf.layer.upper()
            
            if entity.dxftype() == 'LINE':
                lineas.append({
                    'x1': round(entity.dxf.start.x, 3),
                    'y1': round(entity.dxf.start.y, 3),
                    'x2': round(entity.dxf.end.x, 3),
                    'y2': round(entity.dxf.end.y, 3)
                })
            elif entity.dxftype() in ('LWPOLYLINE', 'POLYLINE'):
                # Expandir polilínea en segmentos de línea individuales
                pts = list(entity.get_points('xy'))
                for i in range(len(pts) - 1):
                    lineas.append({
                        'x1': round(pts[i][0], 3),
                        'y1': round(pts[i][1], 3),
                        'x2': round(pts[i+1][0], 3),
                        'y2': round(pts[i+1][1], 3)
                    })
                # Si está cerrada, añadir segmento final
                if entity.is_closed and len(pts) > 2:
                    lineas.append({
                        'x1': round(pts[-1][0], 3),
                        'y1': round(pts[-1][1], 3),
                        'x2': round(pts[0][0], 3),
                        'y2': round(pts[0][1], 3)
                    })
        
        # --- Normalización básica ---
        if not lineas:
            return []
            
        # Calcular límites (Bounding Box)
        xs = [l['x1'] for l in lineas] + [l['x2'] for l in lineas]
        ys = [l['y1'] for l in lineas] + [l['y2'] for l in lineas]
        min_x, min_y = min(xs), min(ys)
        
        # Desplazar al origen (0,0) para que sea fácil de manejar en el canvas
        for l in lineas:
            l['x1'] -= min_x
            l['y1'] -= min_y
            l['x2'] -= min_x
            l['y2'] -= min_y
            
            # Invertir Y (DXF es Y-arriba, Canvas es Y-abajo)
            # Nota: Al normalizar al origen, simplemente invertimos el signo 
            # de la coordenada relativa si queremos, o manejamos la inversión en el front.
            # Mejor dejarlo positivo para el front.
            
        return lineas
        
    except Exception as e:
        print(f"Error parsing DXF: {e}")
        return []
