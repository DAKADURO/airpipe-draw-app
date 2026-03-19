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

def detectar_piezas(lineas: list[dict], nodos_hardware: list[dict] = None) -> list[dict]:
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

    def get_or_create_node(px, py):
        for node in conexiones:
            if math.hypot(node["x"] - px, node["y"] - py) < TOLERANCIA_NODO:
                return node
        new_node = {"x": px, "y": py, "angulos": [], "diametros": []}
        conexiones.append(new_node)
        return new_node

    for linea in lineas:
        x1, y1 = linea["x1"], linea["y1"]
        x2, y2 = linea["x2"], linea["y2"]
        
        # Ángulo desde P1 hacia P2
        ang1 = _angulo_linea(x1, y1, x2, y2)
        # Ángulo desde P2 hacia P1 (opuesto)
        ang2 = (ang1 + 180) % 360
        
        n1 = get_or_create_node(x1, y1)
        n1["angulos"].append(ang1)
        n1["diametros"].append(linea.get("diametro"))
        
        n2 = get_or_create_node(x2, y2)
        n2["angulos"].append(ang2)
        n2["diametros"].append(linea.get("diametro"))

    # 2. Clasificar cada nodo según su grado (número de conexiones)
    piezas = []

    for data in conexiones:
        x, y = data["x"], data["y"]
        angulos = data["angulos"]
        grado = len(angulos)

        if grado == 1:
            # Extremo libre: Verificar si es conexión a equipo o tapa
            # Si coincide con un compresor o consumo, es conexión válida.
            # Si NO coincide, debe llevar un TABÓN (End Cap).
            es_equipo = False
            for nh in nodos_hardware:
                if math.hypot(nh["x"] - x, nh["y"] - y) < 5.0: # Tolerancia 5px
                    es_equipo = True
                    break
            
            if not es_equipo:
                piezas.append({
                    "tipo": "Tapon",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })

        elif grado == 2:
            # Verificar si es una recta (180°), un codo 90° o un codo 45°
            diff = abs(angulos[0] - angulos[1])
            diff = min(diff, 360 - diff)
            
            # Si el ángulo es ~180, es una CONTINUACIÓN RECTA (Union/Cople)
            if abs(diff - 180) <= 2.0:
                piezas.append({
                    "tipo": "Union",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            # Si el ángulo es ~90, es un CODO 90
            elif abs(diff - 90) <= 5.0:
                piezas.append({
                    "tipo": "Codo",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            # Si el ángulo de deflexión es ~45 (ej: 45 o 135 interno/externo según como se mida)
            # En tuberías, un codo de 45° significa un cambio de dirección de 45°.
            # Por lo tanto, el ángulo entre líneas es 135° (o 225°).
            elif abs(diff - 135) <= 5.0 or abs(diff - 45) <= 5.0:
                piezas.append({
                    "tipo": "Codo 45",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            else:
                # Otros ángulos (ej. 15, 30, 60): se registra como Codo genérico o nada
                piezas.append({
                    "tipo": "Codo",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
        
        elif grado == 3:
            # Differentiate between Standard Tee (90°) and Lateral Tee (45°)
            angs_sorted = sorted(angulos)
            diffs = [
                (angs_sorted[1] - angs_sorted[0]) % 360,
                (angs_sorted[2] - angs_sorted[1]) % 360,
                (angs_sorted[0] - angs_sorted[2]) % 360
            ]
            # Standard Tee (90°): has a ~180 branch and two ~90 branches
            # Lateral 45 Tee: has a ~180 branch, one ~45 and one ~135 branch
            
            tipo_te = "Te"
            has_180 = any(abs(d - 180) <= 5.0 for d in diffs)
            has_90 = any(abs(d - 90) <= 5.0 or abs(d - 270) <= 5.0 for d in diffs)
            has_45 = any(abs(d - 45) <= 5.0 or abs(d - 315) <= 5.0 for d in diffs)
            has_135 = any(abs(d - 135) <= 5.0 or abs(d - 225) <= 5.0 for d in diffs)
            
            if has_180:
                if has_90:
                    tipo_te = "Te Igual"
                elif has_45 or has_135:
                    tipo_te = "Te Lateral 45"

            piezas.append({
                "tipo": tipo_te,
                "x": x,
                "y": y,
                "angulos": angulos,
                "diametro": data["diametros"][0] if data["diametros"] else None
            })
            
        elif grado == 4:
            # Cruces: Deben ser estrictamente ortogonales (90°)
            angulos_sorted = sorted(angulos)
            # Calcular diferencias entre ángulos consecutivos
            diffs = []
            for i in range(4):
                d = (angulos_sorted[(i+1)%4] - angulos_sorted[i]) % 360
                diffs.append(d)
            
            # Verificar si todas las diferencias son ~90 grados
            es_ortogonal = all(abs(d - 90) <= 2.0 for d in diffs)
            
            if es_ortogonal:
                piezas.append({
                    "tipo": "Cruz",
                    "x": x,
                    "y": y,
                    "angulos": angulos,
                    "diametro": data["diametros"][0] if data["diametros"] else None
                })
            else:
                 # Si no es ortogonal, no es una "Cruz" estándar de inventario
                 # Podríamos dejarlo sin etiqueta o usar una genérica
                 pass

    # ... aplicar diametro a las demas piezas arriba ...

    # 3. Detectar Tramos Largos (> 19ft) e insertar Uniones Virtuales
    # 19 ft = 5.7912 m. A 50 px/m -> ~289.56 px
    MAX_LEN_PX = 289.56
    
    # Mapa de piezas existentes para evitar superposiciones
    piezas_existentes = {(p["x"], p["y"]) for p in piezas}

    for linea in lineas:
        lx = linea["x2"] - linea["x1"]
        ly = linea["y2"] - linea["y1"]
        longitud_px = math.hypot(lx, ly)
        
        if longitud_px > MAX_LEN_PX:
            # Calcular cuántas uniones se necesitan
            num_uniones = int(longitud_px // MAX_LEN_PX)
            
            # Vector unitario
            ux = lx / longitud_px
            uy = ly / longitud_px
            
            for i in range(1, num_uniones + 1):
                dist = i * MAX_LEN_PX
                px = linea["x1"] + ux * dist
                py = linea["y1"] + uy * dist
                
                # Verificar si ya existe una pieza cerca (Tolerancia 5px)
                existe = False
                for ex, ey in piezas_existentes:
                     if math.hypot(px - ex, py - ey) < 5.0:
                         existe = True
                         break
                
                if not existe:
                    piezas.append({
                        "tipo": "Union",
                        "x": px,
                        "y": py,
                        "angulos": [], # Virtual
                        "diametro": linea.get("diametro")
                    })
                    piezas_existentes.add((px, py))

    return piezas
