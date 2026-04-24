"""
detector_piezas.py — AIRpipe
Módulo para detectar y clasificar piezas (fittings) en las uniones de tuberías.

Clasificación basada en conectividad (grado del nodo) y geometría:
- Grado 2 (ángulo != 180°): Codo (Elbow)
- Grado 3: Te (Tee)
- Grado 4: Cruz (Cross)
"""

import math

def _angulo_linea(x1, y1, x2, y2):
    """Calcula el ángulo de una línea en grados [0, 360)."""
    dx = x2 - x1
    dy = y2 - y1
    ang = math.degrees(math.atan2(dy, dx))
    return ang % 360

from core.dimensionador import DIAMETRO_A_VALOR

def obtener_ruta_transicion(from_d: str, to_d: str) -> list[tuple[str, str]]:
    """Usa BFS para encontrar la ruta más corta de transiciones de from_d a to_d."""
    if from_d == to_d or not from_d or not to_d: return []
    
    graph = {
        '1"': ['3/4"'],
        '1 1/2"': ['1"'],
        '2"': ['1"', '1 1/2"'],
        '2 1/2"': ['1 1/2"', '2"'],
        '3"': ['2"', '2 1/2"'],
        '4"': ['2 1/2"', '3"'],
        '6"': ['3"', '4"'],
        '8"': ['6"'],
        '10"': ['8"']
    }
    
    queue = [[from_d]]
    visited = {from_d}
    
    while queue:
        path = queue.pop(0)
        node = path[-1]
        
        if node == to_d:
            return [(path[i], path[i+1]) for i in range(len(path)-1)]
            
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                new_path = list(path)
                new_path.append(neighbor)
                queue.append(new_path)
                
    # Fallback si no hay ruta en el grafo (no debería ocurrir con el grafo completo)
    return [(from_d, to_d)]

def _puntos_iguales(x1, y1, x2, y2, tol=1.0):
    return math.hypot(x1 - x2, y1 - y2) < tol

def detectar_piezas(lineas: list[dict], nodos_hardware: list[dict] = None, is_isometric: bool = False) -> list[dict]:
    """
    Analiza la conectividad de las líneas y devuelve una lista de piezas detectadas.

    Args:
        lineas: Lista de líneas rectificadas [{"x1", "y1", "x2", "y2", ...}]
        nodos_hardware: Lista de nodos de equipamiento (compresores, consumos) para identificar
                        si un extremo libre es una conexión válida o un tapón.

    Returns:
        Lista de dicts: [{"tipo": "Codo", "x": ..., "y": ..., "angulo": ...}, ...]
    """
    if nodos_hardware is None:
        nodos_hardware = []
    # 1. Construir mapa de conectividad: (x, y) -> [lista de ángulos de líneas conectadas]
    # Usamos búsqueda por proximidad para tolerar errores de float
    conexiones = []  # Lista de dicts {"x": x, "y": y, "angulos": []}
    TOLERANCIA_NODO = 1.0  # px

    def get_or_create_node(px, py, pz):
        for node in conexiones:
            dx = node["x"] - px
            dy = node["y"] - py
            dz = node["z"] - pz
            if math.sqrt(dx*dx + dy*dy + dz*dz) < TOLERANCIA_NODO:
                return node
        new_node = {"x": px, "y": py, "z": pz, "vectores": [], "diametros": []}
        conexiones.append(new_node)
        return new_node

    for linea in lineas:
        x1, y1 = linea["x1"], linea["y1"]
        z1 = linea.get("z1", 0)
        x2, y2 = linea["x2"], linea["y2"]
        z2 = linea.get("z2", 0)
        
        dx, dy, dz = x2 - x1, y2 - y1, z2 - z1
        length = math.sqrt(dx*dx + dy*dy + dz*dz)
        if length < 0.1: continue

        # Vector unitario desde P1 hacia P2
        v1 = (dx/length, dy/length, dz/length)
        # Vector unitario desde P2 hacia P1
        v2 = (-v1[0], -v1[1], -v1[2])
        
        n1 = get_or_create_node(x1, y1, z1)
        n1["vectores"].append(v1)
        n1["diametros"].append(linea.get("diametro"))
        
        n2 = get_or_create_node(x2, y2, z2)
        n2["vectores"].append(v2)
        n2["diametros"].append(linea.get("diametro"))

    # 2. Clasificar cada nodo según su grado (número de conexiones)
    piezas = []

    for data in conexiones:
        x, y, z = data["x"], data["y"], data["z"]
        vectores = data["vectores"]
        grado = len(vectores)

        # Fallback de ángulos XY para compatibilidad con Tapones y etiquetas 2D
        angulos_xy = []
        for v in vectores:
            ang = math.degrees(math.atan2(v[1], v[0])) % 360
            angulos_xy.append(ang)

        diametros = data["diametros"]
        d_max = max(diametros, key=lambda d: DIAMETRO_A_VALOR.get(d, 0)) if diametros else None
        
        def generar_transiciones(d_mayor, d_menor):
            rutas = obtener_ruta_transicion(d_mayor, d_menor)
            for (from_d, to_d) in rutas:
                piezas.append({
                    "tipo": "Transicion",
                    "x": x, "y": y, "z": z,
                    "diametro_in": from_d,
                    "diametro_out": to_d,
                    "angulos": angulos_xy
                })

        # Evaluar y emitir transiciones para las ramas menores
        for d in diametros:
            if d and d_max and DIAMETRO_A_VALOR.get(d, 0) < DIAMETRO_A_VALOR.get(d_max, 0):
                generar_transiciones(d_max, d)

        if grado == 1:
            es_equipo = False
            for nh in nodos_hardware:
                nh_dx = nh["x"] - x
                nh_dy = nh["y"] - y
                nh_dz = nh.get("z", 0) - z
                if math.sqrt(nh_dx*nh_dx + nh_dy*nh_dy + nh_dz*nh_dz) < 5.0:
                    es_equipo = True
                    break
            
            if not es_equipo:
                piezas.append({
                    "tipo": "Tapon",
                    "x": x, "y": y, "z": z,
                    "angulos": angulos_xy,
                    "diametro": d_max
                })

        elif grado == 2:
            v1, v2 = vectores[0], vectores[1]
            dot = max(-1.0, min(1.0, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]))
            angle_3d = math.degrees(math.acos(dot))
            
            d1, d2 = diametros[0], diametros[1]
            es_recto = abs(angle_3d - 180) <= 5.0

            if es_recto:
                # Si los diámetros son distintos, ya emitimos transiciones. NO emitimos Unión.
                if d1 == d2:
                    piezas.append({
                        "tipo": "Union",
                        "x": x, "y": y, "z": z, "angulos": angulos_xy,
                        "diametro": d_max
                    })
            elif abs(angle_3d - 90) <= 15.0: # Umbral más amplio
                piezas.append({
                    "tipo": "Codo",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": d_max
                })
            elif abs(angle_3d - 135) <= 15.0 or abs(angle_3d - 45) <= 15.0:
                piezas.append({
                    "tipo": "Codo 45",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": d_max
                })
            else:
                piezas.append({
                    "tipo": "Codo",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": d_max
                })
        
        elif grado == 3:
            tiene_180 = False
            angs_entre = []
            for i in range(3):
                for j in range(i + 1, 3):
                    dot = max(-1.0, min(1.0, vectores[i][0]*vectores[j][0] + vectores[i][1]*vectores[j][1] + vectores[i][2]*vectores[j][2]))
                    ang = math.degrees(math.acos(dot))
                    angs_entre.append(ang)
                    if abs(ang - 180) <= 10.0:
                        tiene_180 = True

            tipo_te = "Te"
            if tiene_180:
                ang_rama = next((a for a in angs_entre if abs(a - 180) > 10.0), 90)
                
                tiene_rama_vertical = False
                for v in vectores:
                    if abs(v[2]) > 0.9: # Es vertical
                        otros = [vec for vec in vectores if vec is not v]
                        if all(abs(o[2]) < 0.1 for o in otros):
                            tiene_rama_vertical = True
                            break
                
                if tiene_rama_vertical:
                    tipo_te = "Te + Codo"
                elif abs(ang_rama - 90) <= 10.0:
                    tipo_te = "Te Igual"
                elif abs(ang_rama - 45) <= 15.0 or abs(ang_rama - 135) <= 15.0:
                    tipo_te = "Te Igual" if is_isometric else "Te Lateral 45"

            piezas.append({
                "tipo": tipo_te,
                "x": x, "y": y, "z": z, "angulos": angulos_xy,
                "diametro": d_max
            })
            
        elif grado >= 4:
            # En redes de aire, las cruces de 4 vías son raras. 
            # Las tratamos como uniones múltiples para no ensuciar con el símbolo '+'.
            piezas.append({
                "tipo": "Union",
                "x": x, "y": y, "z": z, "angulos": angulos_xy,
                "diametro": d_max
            })

    # ... aplicar diametro a las demas piezas arriba ...

    # 3. Detectar Tramos Largos (Coples cada 19 ft / 5.79m)
    # 19 ft = 5.7912 m. A 100 px/m -> 579.12 px
    MAX_LEN_PX = 579.12
    
    for linea in lineas:
        lx = linea["x2"] - linea["x1"]
        ly = linea["y2"] - linea["y1"]
        lz = linea.get("z2", 0) - linea.get("z1", 0)
        longitud_px = math.sqrt(lx**2 + ly**2 + lz**2)
        
        if longitud_px > MAX_LEN_PX:
            num_uniones = int(longitud_px // MAX_LEN_PX)
            if longitud_px % MAX_LEN_PX < 0.1: num_uniones -= 1 # Evitar unión en el extremo exacto
            
            ux, uy, uz = lx / longitud_px, ly / longitud_px, lz / longitud_px
            
            for i in range(1, num_uniones + 1):
                px = linea["x1"] + ux * (i * MAX_LEN_PX)
                py = linea["y1"] + uy * (i * MAX_LEN_PX)
                pz = linea.get("z1", 0) + uz * (i * MAX_LEN_PX)
                
                # Verificar que no estemos duplicando una pieza existente
                cerca = False
                for p_existente in piezas:
                    dist = math.sqrt((px - p_existente["x"])**2 + (py - p_existente["y"])**2 + (pz - p_existente.get("z",0))**2)
                    if dist < 10.0:
                        cerca = True; break
                
                if not cerca:
                    piezas.append({
                        "tipo": "Union",
                        "x": px, "y": py, "z": pz,
                        "angulos": [],
                        "diametro": linea.get("diametro")
                    })

    return piezas
