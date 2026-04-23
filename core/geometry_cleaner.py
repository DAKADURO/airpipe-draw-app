import math

MIN_LINE_LENGTH = 10
SNAP_ANGLE_TOLERANCE = 10
_EJES_CANONICOS = [0, 45, 90, 135, 180, 225, 270, 315]

def longitud(linea: dict) -> float:
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    dz = linea.get("z2", 0) - linea.get("z1", 0)
    return math.sqrt(dx*dx + dy*dy + dz*dz)

def _angulo_grados(linea: dict) -> float | None:
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    if abs(dx) < 0.1 and abs(dy) < 0.1:
        return None
    return math.degrees(math.atan2(dy, dx)) % 360

def _eje_mas_cercano(angulo: float) -> int:
    mejor_eje = _EJES_CANONICOS[0]
    menor_diff = float("inf")
    for eje in _EJES_CANONICOS:
        diff = min(abs(angulo - eje), 360 - abs(angulo - eje))
        if diff < menor_diff:
            menor_diff = diff
            mejor_eje = eje
    return mejor_eje

def filtrar_ruido(lineas: list[dict]) -> list[dict]:
    return [dict(l) for l in lineas if longitud(l) >= MIN_LINE_LENGTH]

def rectificar_ejes(lineas: list[dict]) -> list[dict]:
    resultado = []
    for linea in lineas:
        angulo_real = _angulo_grados(linea)
        
        if angulo_real is None:
            resultado.append({**linea, "x2": linea["x1"], "y2": linea["y1"], "_tipo_rect": "vertical"})
            continue

        eje_cercano = _eje_mas_cercano(angulo_real)
        diff = min(abs(angulo_real - eje_cercano), 360 - abs(angulo_real - eje_cercano))
        
        if diff < SNAP_ANGLE_TOLERANCE:
            long_3d = longitud(linea)
            dz = linea.get("z2", 0) - linea.get("z1", 0)
            long_xy = math.sqrt(max(0, long_3d**2 - dz**2))
            
            rad = math.radians(eje_cercano)
            resultado.append({
                **linea,
                "x2": round(linea["x1"] + long_xy * math.cos(rad), 4),
                "y2": round(linea["y1"] + long_xy * math.sin(rad), 4),
                "_snap_angulo": eje_cercano,
                "_tipo_rect": "planar"
            })
        else:
            resultado.append({**linea, "_tipo_rect": "original"})
    return resultado

def eliminar_superposiciones(lineas: list[dict]) -> list[dict]:
    """
    Agrupa líneas colineales y fusiona aquellas que se superponen total o parcialmente.
    Se asume que las líneas ya pasaron por rectificar_ejes (tienen _snap_angulo).
    """
    if not lineas: return []
    
    # Agrupar por línea infinita (ángulo mod 180, Z, y distancia al origen perpendicular)
    from collections import defaultdict
    grupos = defaultdict(list)
    
    for l in lineas:
        ang = l.get("_snap_angulo", 0)
        # Normalizar ángulo a 0-179 para colinealidad
        ang_norm = ang % 180
        z_val = round(l.get("z1", 0), 1)
        
        # Calcular distancia perpendicular al origen
        rad = math.radians(ang_norm)
        # Vector normal (-sin, cos)
        nx = -math.sin(rad)
        ny = math.cos(rad)
        dist = round(l["x1"] * nx + l["y1"] * ny, 1)
        
        clave = (ang_norm, z_val, dist)
        grupos[clave].append(l)

    resultado = []
    
    for clave, grupo in grupos.items():
        ang_norm = clave[0]
        rad = math.radians(ang_norm)
        # Vector direccional (cos, sin)
        vx = math.cos(rad)
        vy = math.sin(rad)
        
        # Proyectar todas las líneas del grupo en el vector direccional para obtener intervalos 1D
        intervalos = []
        for l in grupo:
            t1 = l["x1"] * vx + l["y1"] * vy
            t2 = l["x2"] * vx + l["y2"] * vy
            t_min, t_max = min(t1, t2), max(t1, t2)
            intervalos.append([t_min, t_max, l])
            
        # Ordenar por inicio del intervalo
        intervalos.sort(key=lambda x: x[0])
        
        merged = []
        for iv in intervalos:
            if not merged:
                merged.append(iv)
            else:
                last = merged[-1]
                if iv[0] <= last[1] + 1.0: # Tolerancia de 1.0 px para superposición
                    # Hay superposición, expandir el intervalo anterior
                    last[1] = max(last[1], iv[1])
                    # Conservamos los atributos de la primera línea (o la que tenga diámetro)
                    if not last[2].get("diametro") and iv[2].get("diametro"):
                        last[2]["diametro"] = iv[2]["diametro"]
                else:
                    merged.append(iv)
                    
        # Reconstruir las líneas a partir de los intervalos fusionados
        for iv in merged:
            t_min, t_max, orig_l = iv
            # Encontrar un punto base en la línea infinita
            # Sabemos que dist = x*nx + y*ny y t = x*vx + y*vy
            # Como nx,ny y vx,vy son ortogonales, podemos invertir:
            # x = t*vx + dist*nx
            # y = t*vy + dist*ny
            nx = -vy
            ny = vx
            dist = clave[2]
            
            x1 = t_min * vx + dist * nx
            y1 = t_min * vy + dist * ny
            x2 = t_max * vx + dist * nx
            y2 = t_max * vy + dist * ny
            
            nueva_linea = {**orig_l, "x1": round(x1, 4), "y1": round(y1, 4), "x2": round(x2, 4), "y2": round(y2, 4)}
            resultado.append(nueva_linea)
            
    return resultado
