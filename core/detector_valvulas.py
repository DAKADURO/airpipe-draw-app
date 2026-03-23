"""
detector_valvulas.py
Módulo para la detección automática de puntos donde deben colocarse válvulas de aislamiento.
Reglas implementadas (Fase 1):
1. Aislamiento de Fuente: Válvula a la salida de cada Compresor.
2. Derivaciones a Consumo: Válvula en el inicio de cada ramal que alimenta un Punto de Consumo.
"""

import math

def _distancia(x1, y1, x2, y2):
    return math.hypot(x1 - x2, y1 - y2)

def detectar_valvulas(lineas: list[dict], nodos: list[dict], piezas: list[dict]) -> list[dict]:
    """
    Analiza la red y devuelve una lista de diccionarios con la ubicación y tipo de válvulas.
    """
    valvulas = []
    TOLERANCIA = 1.0
    DISTANCIA_VALVULA = 30.0 # px (~60cm)

    # 1. Aislamiento de Fuente (Compresores)
    compresores = [n for n in nodos if n.get("tipo") == "compresor"]
    
    for comp in compresores:
        cx, cy = comp["x"], comp["y"]
        # Buscar líneas conectadas al compresor
        for linea in lineas:
            x1, y1, x2, y2 = linea["x1"], linea["y1"], linea["x2"], linea["y2"]
            conectado_inicio = _distancia(x1, y1, cx, cy) < TOLERANCIA
            conectado_fin = _distancia(x2, y2, cx, cy) < TOLERANCIA
            
            if conectado_inicio or conectado_fin:
                # Calcular posición de válvula
                if conectado_inicio:
                    dx, dy = x2 - x1, y2 - y1
                    origen_x, origen_y = x1, y1
                else:
                    dx, dy = x1 - x2, y1 - y2
                    origen_x, origen_y = x2, y2
                
                length = math.hypot(dx, dy)
                if length > 0:
                    ux, uy = dx/length, dy/length
                    # Colocar a distancia fija
                    dist = min(DISTANCIA_VALVULA, length * 0.4) 
                    vx = origen_x + ux * dist
                    vy = origen_y + uy * dist
                    
                    valvulas.append({
                        "tipo": "Valvula",
                        "subtipo": "Fuente",
                        "x": vx,
                        "y": vy,
                        "angulo": math.degrees(math.atan2(dy, dx)),
                        "diametro": linea.get("diametro")
                    })

    # 2. Derivaciones a Consumo (desde Tes)
    tes = [p for p in piezas if "Te" in p.get("tipo", "")]
    puntos_consumo = [(n["x"], n["y"]) for n in nodos if n.get("tipo") == "punto_consumo"]

    for te in tes:
        tx, ty = te["x"], te["y"]
        
        # Identificar las 3 ramas conectadas a la Te
        ramas_conectadas = []
        for linea in lineas:
            x1, y1, x2, y2 = linea["x1"], linea["y1"], linea["x2"], linea["y2"]
            d1 = _distancia(x1, y1, tx, ty)
            d2 = _distancia(x2, y2, tx, ty)
            
            if d1 < TOLERANCIA:
                # La Te está en el inicio de la línea
                ramas_conectadas.append({
                    "linea": linea, 
                    "origen": (x1, y1), 
                    "destino": (x2, y2), 
                    "vector": (x2-x1, y2-y1)
                })
            elif d2 < TOLERANCIA:
                # La Te está en el fin de la línea
                ramas_conectadas.append({
                    "linea": linea, 
                    "origen": (x2, y2), 
                    "destino": (x1, y1), 
                    "vector": (x1-x2, y1-y2)
                })

        # Para cada rama, verificar si lleva DIRECTAMENTE a un punto de consumo
        for rama in ramas_conectadas:
            dest_x, dest_y = rama["destino"]
            
            # Verificar si el destino es un punto de consumo
            es_bajada = False
            for pc_x, pc_y in puntos_consumo:
                if _distancia(dest_x, dest_y, pc_x, pc_y) < TOLERANCIA:
                    es_bajada = True
                    break
            
            if es_bajada:
                dx, dy = rama["vector"]
                length = math.hypot(dx, dy)
                if length > 0:
                    ux, uy = dx/length, dy/length
                    dist = min(DISTANCIA_VALVULA, length * 0.4)
                    vx = tx + ux * dist
                    vy = ty + uy * dist
                    
                    valvulas.append({
                        "tipo": "Valvula",
                        "subtipo": "Bajada",
                        "x": vx,
                        "y": vy,
                        "angulo": math.degrees(math.atan2(dy, dx)),
                        "diametro": rama["linea"].get("diametro")
                    })

    return valvulas
