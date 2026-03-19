"""
rectificador.py — AIRpipe Phase 2
Motor de procesamiento geométrico para redes de aire comprimido.

Todas las funciones son independientes y testeables por separado.
Solo usa la librería estándar de Python (math).
"""

import math

# ─────────────────────────────────────────────
#  Constantes globales
# ─────────────────────────────────────────────

MIN_LINE_LENGTH    = 10   # píxeles — longitud mínima para conservar una línea
SNAP_ANGLE_TOLERANCE = 15  # grados — desviación máxima para forzar un eje canónico
SNAP_DISTANCE_PX   = 20   # píxeles — radio de fusión de intersecciones

# Ejes canónicos (grados, en sentido horario desde el eje X positivo)
_EJES_CANONICOS = [0, 45, 90, 135, 180, 225, 270, 315]


# ─────────────────────────────────────────────
#  Utilidades internas
# ─────────────────────────────────────────────

def _longitud(linea: dict) -> float:
    """Calcula la longitud euclidiana de una línea."""
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    return math.hypot(dx, dy)


def _angulo_grados(linea: dict) -> float:
    """
    Devuelve el ángulo de la línea en grados [0, 360).
    Usa atan2 con eje Y invertido (coordenadas de pantalla).
    """
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    angulo = math.degrees(math.atan2(dy, dx))  # rango (-180, 180]
    return angulo % 360                          # normalizar a [0, 360)


def _eje_mas_cercano(angulo: float) -> int:
    """
    Dado un ángulo en grados [0, 360), devuelve el eje canónico más cercano.
    Maneja el wrap-around entre 315° y 0°.
    """
    mejor_eje  = _EJES_CANONICOS[0]
    menor_diff = float("inf")

    for eje in _EJES_CANONICOS:
        diff = abs(angulo - eje)
        # Distancia circular mínima
        diff = min(diff, 360 - diff)
        if diff < menor_diff:
            menor_diff = diff
            mejor_eje  = eje

    return mejor_eje


def _distancia_puntos(ax: float, ay: float, bx: float, by: float) -> float:
    """Distancia euclidiana entre dos puntos."""
    return math.hypot(bx - ax, by - ay)


# ─────────────────────────────────────────────
#  Función 0: fragmentar_intersecciones
# ─────────────────────────────────────────────

def _interseccion_segmentos(p1, p2, p3, p4) -> tuple | None:
    """
    Calcula el punto de intersección entre los segmentos p1-p2 y p3-p4.
    Retorna (x, y) solo si la intersección es interior a ambos segmentos.
    """
    x1, y1 = p1;  x2, y2 = p2
    x3, y3 = p3;  x4, y4 = p4

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-9:  # Paralelas o coincidentes
        return None

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

    eps = 1e-6  # Strictamente interior (no en extremos)
    if eps < t < 1 - eps and eps < u < 1 - eps:
        x = x1 + t * (x2 - x1)
        y = y1 + t * (y2 - y1)
        return (round(x, 4), round(y, 4))
    return None


def _punto_sobre_segmento(px, py, x1, y1, x2, y2, tol=2.0):
    """
    Verifica si el punto (px,py) cae SOBRE el segmento (x1,y1)-(x2,y2)
    en el interior (no en extremos), con tolerancia.
    Retorna el punto proyectado o None.
    """
    dx = x2 - x1
    dy = y2 - y1
    long2 = dx * dx + dy * dy
    if long2 < 1e-9:
        return None

    t = ((px - x1) * dx + (py - y1) * dy) / long2

    eps = 0.01  # No en los extremos
    if t <= eps or t >= 1.0 - eps:
        return None

    # Punto proyectado sobre la línea
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy

    dist = math.hypot(px - proj_x, py - proj_y)
    if dist <= tol:
        return (proj_x, proj_y)
    return None


def fragmentar_intersecciones(lineas: list[dict]) -> list[dict]:
    """
    Detecta cruces e intersecciones T entre segmentos y los divide.

    Maneja dos casos:
      - X-crossing: dos segmentos se cruzan en sus interiores.
      - T-junction: un extremo de un segmento cae sobre el interior de otro.

    Asegura que todas las intersecciones topológicas sean visibles como
    endpoints compartidos, para que `fusionar_intersecciones` y `detector_piezas`
    las procesen correctamente.

    Args:
        lineas: Lista de dicts con claves x1, y1, x2, y2.

    Returns:
        Lista expandida con los segmentos divididos.
    """
    result = list(lineas)
    cambiado = True

    while cambiado:
        cambiado = False
        nuevo = []
        usadas = set()

        for i, la in enumerate(result):
            if i in usadas:
                continue
            p1 = (la["x1"], la["y1"])
            p2 = (la["x2"], la["y2"])

            corte = False
            for j, lb in enumerate(result):
                if j <= i or j in usadas:
                    continue
                p3 = (lb["x1"], lb["y1"])
                p4 = (lb["x2"], lb["y2"])

                # Caso 1: X-crossing (ambos interiores)
                pt = _interseccion_segmentos(p1, p2, p3, p4)
                if pt:
                    ix, iy = pt
                    nuevo.append({**la, "x2": ix, "y2": iy})
                    nuevo.append({**la, "x1": ix, "y1": iy})
                    nuevo.append({**lb, "x2": ix, "y2": iy})
                    nuevo.append({**lb, "x1": ix, "y1": iy})
                    usadas.add(j)
                    cambiado = True
                    corte = True
                    break

                # Caso 2: T-junction — endpoint de lb cae sobre interior de la
                for px, py in [p3, p4]:
                    proj = _punto_sobre_segmento(px, py, p1[0], p1[1], p2[0], p2[1])
                    if proj:
                        ix, iy = px, py  # usar coords del endpoint
                        nuevo.append({**la, "x2": ix, "y2": iy})
                        nuevo.append({**la, "x1": ix, "y1": iy})
                        nuevo.append(lb)  # lb no se divide, su extremo YA está ahí
                        usadas.add(j)
                        cambiado = True
                        corte = True
                        break

                if corte:
                    break

                # Caso 2b: T-junction — endpoint de la cae sobre interior de lb
                for px, py in [p1, p2]:
                    proj = _punto_sobre_segmento(px, py, p3[0], p3[1], p4[0], p4[1])
                    if proj:
                        ix, iy = px, py
                        nuevo.append(la)  # la no se divide
                        nuevo.append({**lb, "x2": ix, "y2": iy})
                        nuevo.append({**lb, "x1": ix, "y1": iy})
                        usadas.add(j)
                        cambiado = True
                        corte = True
                        break

                if corte:
                    break

            if not corte:
                nuevo.append(la)

        result = nuevo

    return result


# ─────────────────────────────────────────────
#  Función 1: filtrar_ruido
# ─────────────────────────────────────────────

def filtrar_ruido(lineas: list[dict]) -> list[dict]:
    """
    Elimina líneas cuya longitud sea menor a MIN_LINE_LENGTH píxeles.

    Args:
        lineas: Lista de dicts con claves x1, y1, x2, y2.

    Returns:
        Nueva lista con solo las líneas que superan el umbral de longitud.

    Example:
        >>> filtrar_ruido([{"x1":0,"y1":0,"x2":5,"y2":5}, {"x1":0,"y1":0,"x2":100,"y2":0}])
        [{"x1":0,"y1":0,"x2":100,"y2":0}]
    """
    resultado = []
    for linea in lineas:
        if _longitud(linea) >= MIN_LINE_LENGTH:
            resultado.append(dict(linea))  # copia defensiva
    return resultado


# ─────────────────────────────────────────────
#  Función 2: rectificar_ejes
# ─────────────────────────────────────────────

def rectificar_ejes(lineas: list[dict]) -> list[dict]:
    """
    Fuerza cada línea al eje canónico más cercano si la desviación es
    menor a SNAP_ANGLE_TOLERANCE grados. El punto de inicio (x1, y1)
    permanece fijo; se recalcula (x2, y2) manteniendo la longitud original.

    Ejes canónicos: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°

    Args:
        lineas: Lista de dicts con claves x1, y1, x2, y2.

    Returns:
        Nueva lista con las líneas rectificadas.

    Example:
        Input:  {"x1":0,"y1":0,"x2":97,"y2":90}  → ángulo ≈ 42.9° → snap a 45°
        Output: {"x1":0,"y1":0,"x2":93.97,"y2":93.97}
    """
    resultado = []
    for linea in lineas:
        angulo_real = _angulo_grados(linea)
        eje_cercano = _eje_mas_cercano(angulo_real)

        # NORMALIZACIÓN TOTAL: Forzar siempre al eje más cercano
        # Recalcular x2, y2 sobre el eje forzado
        longitud  = _longitud(linea)
        rad       = math.radians(eje_cercano)
        nuevo_x2  = linea["x1"] + longitud * math.cos(rad)
        nuevo_y2  = linea["y1"] + longitud * math.sin(rad)

        resultado.append({
            "x1": linea["x1"],
            "y1": linea["y1"],
            "x2": round(nuevo_x2, 4),
            "y2": round(nuevo_y2, 4),
            "_snap_angulo": eje_cercano,   # metadato de diagnóstico
            "_angulo_original": round(angulo_real, 4),
        })

    return resultado


# ─────────────────────────────────────────────
#  Función 3: fusionar_intersecciones
# ─────────────────────────────────────────────

def fusionar_intersecciones(
    lineas: list[dict],
    nodos:  list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Unifica puntos finales de líneas y posiciones de nodos que estén
    a una distancia ≤ SNAP_DISTANCE_PX entre sí, promediando sus coordenadas.

    Algoritmo:
      1. Recopila todos los "puntos de interés": extremos de líneas (x2,y2)
         y posiciones de nodos.
      2. Para cada par de puntos cuya distancia ≤ SNAP_DISTANCE_PX, los
         fusiona al promedio y propaga el cambio a todas las referencias.

    Args:
        lineas: Lista de dicts con claves x1, y1, x2, y2.
        nodos:  Lista de dicts con claves tipo, x, y.

    Returns:
        Tupla (lineas_fusionadas, nodos_fusionados).
    """
    # Trabajamos con copias para no mutar los originales
    lineas = [dict(ln) for ln in lineas]
    nodos  = [dict(nd) for nd in nodos]

    # Construir lista de puntos mutables: cada entrada es [x, y, referencia]
    # La referencia permite actualizar el dict original tras la fusión.
    puntos: list[list] = []

    for linea in lineas:
        puntos.append([linea["x2"], linea["y2"], linea, "x2y2"])

    for nodo in nodos:
        puntos.append([nodo["x"], nodo["y"], nodo, "xy"])

    # Fusión por pares — complejidad O(n²).
    # Aceptable para planos de tamaño humano (< 200 puntos).
    # MEJORA FUTURA (OPT-7): si el número de puntos crece significativamente,
    # reemplazar por spatial hashing con celdas de tamaño SNAP_DISTANCE_PX.
    # Eso reduciría la complejidad a O(n) comparando solo celdas vecinas (máx. 9).
    n = len(puntos)
    for i in range(n):
        for j in range(i + 1, n):
            px_i, py_i = puntos[i][0], puntos[i][1]
            px_j, py_j = puntos[j][0], puntos[j][1]

            dist = _distancia_puntos(px_i, py_i, px_j, py_j)
            if dist <= SNAP_DISTANCE_PX:
                # Promedio de las dos posiciones
                mx = (px_i + px_j) / 2
                my = (py_i + py_j) / 2

                # Actualizar coordenadas en la lista de puntos
                puntos[i][0] = puntos[j][0] = mx
                puntos[i][1] = puntos[j][1] = my

    # Propagar coordenadas fusionadas a los dicts originales
    for px, py, ref, tipo_ref in puntos:
        if tipo_ref == "x2y2":
            ref["x2"] = round(px, 4)
            ref["y2"] = round(py, 4)
        else:  # "xy"
            ref["x"] = round(px, 4)
            ref["y"] = round(py, 4)

    return lineas, nodos


# ─────────────────────────────────────────────
#  Pipeline completo (orquestador interno)
# ─────────────────────────────────────────────

def procesar_plano(plano: dict) -> dict:
    """
    Aplica el pipeline completo de rectificación al plano recibido.

    Orden:
      0. fragmentar_intersecciones — corta líneas que se cruzan en el interior
      1. filtrar_ruido     — elimina líneas demasiado cortas
      2. rectificar_ejes   — fuerza ángulos a ejes canónicos
      3. fusionar_intersecciones — une puntos cercanos
      4. dimensionar_lineas — calcula diámetro de cada tramo (si hay caudal)
      5. detectar_piezas   — identifica Codos, Tes y Cruces

    Args:
        plano: Dict con claves "lineas", "nodos", y opcionalmente
               "caudal_scfm" y "tipo_red".

    Returns:
        Dict procesado con las mismas claves.
    """
    lineas = plano.get("lineas", [])
    nodos  = plano.get("nodos",  [])
    caudal_scfm = plano.get("caudal_scfm", 0)
    tipo_red    = plano.get("tipo_red", "lineal")

    # Paso 0: fragmentar cruces interiores
    lineas = fragmentar_intersecciones(lineas)

    lineas = filtrar_ruido(lineas)
    lineas = rectificar_ejes(lineas)
    lineas, nodos = fusionar_intersecciones(lineas, nodos)

    # Paso 4: dimensionamiento (siempre se calcula para tener longitudes en el BOM)
    from dimensionador import dimensionar_lineas
    lineas = dimensionar_lineas(lineas, caudal_scfm or 0, tipo_red or "lineal")

    # Paso 5: detección de piezas (codos, tes, cruces, uniones, tapones)
    from detector_piezas import detectar_piezas
    piezas = detectar_piezas(lineas, nodos_hardware=nodos)

    # Paso 6: Válvulas
    # Se eliminan las automáticas y se usan las manuales enviadas por el usuario.
    valvulas = plano.get("valvulas_manuales", [])
    
    # Actualizar diámetros de las válvulas según la tubería en la que están
    for v in valvulas:
        if not v.get("diametro"):
            vx, vy = v["x"], v["y"]
            min_dist = 10.0 # px tolerancia
            best_d = "N/A"
            
            for line in lineas:
                # Distancia punto-segmento (simplificada ya que se ajustó en el frontend)
                x1, y1, x2, y2 = line["x1"], line["y1"], line["x2"], line["y2"]
                # Calculamos distancia al punto medio de la línea como proxy rápido 
                # (en el frontend ya se garantizó que está sobre la línea)
                px = (x1 + x2) / 2
                py = (y1 + y2) / 2
                dist = math.hypot(vx - px, vy - py)
                # mejoramos: chequear si el punto está dentro del bounding box de la línea
                if min(x1, x2) - 5 <= vx <= max(x1, x2) + 5 and \
                   min(y1, y2) - 5 <= vy <= max(y1, y2) + 5:
                    best_d = line.get("diametro", "N/A")
                    break # Encontrado
            
            v["diametro"] = best_d

    # Paso 7: Generar BOM (Lista de Materiales)
    from generador_bom import generar_bom
    bom = generar_bom(lineas, piezas, valvulas)

    return {
        "lineas": lineas,
        "nodos": nodos,
        "piezas": piezas,
        "valvulas": valvulas,
        "caudal_scfm": caudal_scfm,
        "tipo_red": tipo_red,
        "bom": bom
    }
