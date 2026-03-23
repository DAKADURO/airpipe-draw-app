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
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })

        elif grado == 2:
            v1, v2 = vectores[0], vectores[1]
            dot = max(-1.0, min(1.0, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]))
            angle_3d = math.degrees(math.acos(dot))
            
            # DEBUG
            print(f"DEBUG PIEZA: Nodo ({x}, {y}, {z}), Angle3D: {angle_3d:.2f}")

            if abs(angle_3d - 180) <= 5.0:
                piezas.append({
                    "tipo": "Union",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            elif abs(angle_3d - 90) <= 15.0: # Umbral más amplio
                piezas.append({
                    "tipo": "Codo",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            elif abs(angle_3d - 135) <= 15.0 or abs(angle_3d - 45) <= 15.0:
                tipo = "Codo 45"
                if is_isometric:
                    tipo = "Codo" # En isométrico preferimos codos de 90 si están en umbrales intermedios
                piezas.append({
                    "tipo": tipo,
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            else:
                piezas.append({
                    "tipo": "Codo",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": data["diametros"][0] if data["diametros"] else None
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
                # Si hay una línea recta (180), ver el ángulo con la rama (que será ~90 o ~45/135)
                ang_rama = next((a for a in angs_entre if abs(a - 180) > 10.0), 90)
                
                # REGLA ESPECIAL PARA AIRpipe: Si la rama es VERTICAL y el tronco es HORIZONTAL,
                # AIRpipe no tiene "Tes 3D", por lo que se usa una Te normal + un Codo.
                tiene_rama_vertical = False
                for v in vectores:
                    if abs(v[2]) > 0.9: # Es vertical
                        # Verificar si los otros dos son horizontales (tronco plano)
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
                "diametro": data["diametros"][0] if data["diametros"] else None
            })
            
        elif grado == 4:
            # Simplificado: Si hay al menos un par a 180, lo consideramos Cruz
            tiene_180 = False
            for i in range(4):
                for j in range(i + 1, 4):
                    dot = max(-1.0, min(1.0, vectores[i][0]*vectores[j][0] + vectores[i][1]*vectores[j][1] + vectores[i][2]*vectores[j][2]))
                    if abs(math.degrees(math.acos(dot)) - 180) <= 10.0:
                        tiene_180 = True
            
            if tiene_180:
                piezas.append({
                    "tipo": "Cruz",
                    "x": x, "y": y, "z": z, "angulos": angulos_xy,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            else:
                 # Si no es ortogonal, no es una "Cruz" estándar de inventario
                 # Podríamos dejarlo sin etiqueta o usar una genérica
                 pass

    # ... aplicar diametro a las demas piezas arriba ...

    # 3. Detectar Tramos Largos (> 19ft) e insertar Uniones Virtuales
    # 19 ft = 5.7912 m. A 100 px/m -> 579.12 px
    MAX_LEN_PX = 579.12
    
    # Mapa de piezas existentes para evitar superposiciones
    piezas_existentes = {(p["x"], p["y"]) for p in piezas}
    
    for linea in lineas:
        lx = linea["x2"] - linea["x1"]
        ly = linea["y2"] - linea["y1"]
        lz = linea.get("z2", 0) - linea.get("z1", 0)
        longitud_px = math.sqrt(lx**2 + ly**2 + lz**2)
        
        if longitud_px > MAX_LEN_PX:
            # Calcular cuántas uniones se necesitan
            num_uniones = int(longitud_px // MAX_LEN_PX)
            
            # Vector unitario
            ux = lx / longitud_px
            uy = ly / longitud_px
            uz = lz / longitud_px
            
            for i in range(1, num_uniones + 1):
                dist = i * MAX_LEN_PX
                px = linea["x1"] + ux * dist
                py = linea["y1"] + uy * dist
                local_pz = linea.get("z1", 0) + uz * dist
                
                # Verificar si ya existe una pieza cerca (Tolerancia 5px 3D)
                existe = False
                for ex, ey, ez in [(p["x"], p["y"], p.get("z", 0)) for p in piezas]:
                     if math.sqrt((px - ex)**2 + (py - ey)**2 + (local_pz - ez)**2) < 5.0:
                          existe = True
                          break
                
                if not existe:
                    piezas.append({
                        "tipo": "Union",
                        "x": px,
                        "y": py,
                        "z": local_pz,
                        "angulos": [], # Virtual
                        "diametro": linea.get("diametro")
                    })
                    piezas_existentes.add((px, py))

    return piezas
