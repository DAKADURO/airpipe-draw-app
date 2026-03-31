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
