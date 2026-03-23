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
SNAP_ANGLE_TOLERANCE = 10  # grados — desviación máxima para forzar un eje canónico
SNAP_DISTANCE_PX   = 20   # píxeles — radio de fusión de intersecciones

# Ejes canónicos (grados, en sentido horario desde el eje X positivo)
_EJES_CANONICOS = [0, 45, 90, 135, 180, 225, 270, 315]


# ─────────────────────────────────────────────
#  Utilidades internas
# ─────────────────────────────────────────────

def _longitud(linea: dict) -> float:
    """Calcula la longitud euclidiana de una línea en 3D."""
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    dz = linea.get("z2", 0) - linea.get("z1", 0)
    return math.sqrt(dx*dx + dy*dy + dz*dz)


def _angulo_grados(linea: dict) -> float | None:
    """
    Devuelve el ángulo de la línea en grados [0, 360).
    Si la línea es vertical (dx, dy ≈ 0), devuelve None.
    """
    dx = linea["x2"] - linea["x1"]
    dy = linea["y2"] - linea["y1"]
    if abs(dx) < 0.1 and abs(dy) < 0.1:
        return None
    angulo = math.degrees(math.atan2(dy, dx))
    return angulo % 360


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


def _punto_sobre_segmento_3d(px, py, pz, linea, tol=5.0):
    """
    Verifica si el punto (px,py,pz) cae SOBRE el segmento, con tolerancia 3D.
    Retorna el punto si hay impacto, None si no.
    """
    x1, y1 = linea["x1"], linea["y1"]
    z1 = linea.get("z1", 0)
    x2, y2 = linea["x2"], linea["y2"]
    z2 = linea.get("z2", 0)

    dx, dy, dz = x2 - x1, y2 - y1, z2 - z1
    long2 = dx*dx + dy*dy + dz*dz
    if long2 < 1e-9: return None

    # Parámetro de proyección t
    t = ((px - x1) * dx + (py - y1) * dy + (pz - z1) * dz) / long2
    
    eps = 0.01
    if t <= eps or t >= 1.0 - eps: return None

    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    proj_z = z1 + t * dz

    dist = math.sqrt((px - proj_x)**2 + (py - proj_y)**2 + (pz - proj_z)**2)
    if dist <= tol:
        return (proj_x, proj_y, proj_z)
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

                # Caso 1: X-crossing (Intersección 2D que DEBE ser validada en 3D)
                pt2d = _interseccion_segmentos(
                    (la["x1"], la["y1"]), (la["x2"], la["y2"]),
                    (lb["x1"], lb["y1"]), (lb["x2"], lb["y2"])
                )
                if pt2d:
                    # Calcular Z en el punto de intersección para ambas líneas
                    def get_z_at(line, pt):
                        d2_total = math.hypot(line["x2"] - line["x1"], line["y2"] - line["y1"])
                        if d2_total < 0.1: return line.get("z1", 0)
                        d2_part = math.hypot(pt[0] - line["x1"], pt[1] - line["y1"])
                        t = d2_part / d2_total
                        return line.get("z1", 0) + t * (line.get("z2", 0) - line.get("z1", 0))

                    za = get_z_at(la, pt2d)
                    zb = get_z_at(lb, pt2d)

                    if abs(za - zb) < 5.0: # Umbral de conexión 3D
                        ix, iy = pt2d
                        avg_z = (za + zb) / 2
                        nuevo.append({**la, "x2": ix, "y2": iy, "z2": avg_z})
                        nuevo.append({**la, "x1": ix, "y1": iy, "z1": avg_z})
                        nuevo.append({**lb, "x2": ix, "y2": iy, "z2": avg_z})
                        nuevo.append({**lb, "x1": ix, "y1": iy, "z1": avg_z})
                        usadas.add(j)
                        cambiado = True
                        corte = True
                        break

                # Caso 2: T-junction (Un extremo de una toca el cuerpo de otra en 3D)
                for pt_idx, (px, py, pz) in enumerate([
                    (lb["x1"], lb["y1"], lb.get("z1", 0)), 
                    (lb["x2"], lb["y2"], lb.get("z2", 0))
                ]):
                    proj = _punto_sobre_segmento_3d(px, py, pz, la)
                    if proj:
                        ix, iy, iz = proj
                        # Dividir 'la'
                        nuevo.append({**la, "x2": ix, "y2": iy, "z2": iz})
                        nuevo.append({**la, "x1": ix, "y1": iy, "z1": iz})
                        # Actualizar solo el extremo de 'lb' que toca 'la'
                        new_lb = {**lb}
                        if pt_idx == 0:
                            new_lb["x1"], new_lb["y1"], new_lb["z1"] = ix, iy, iz
                        else:
                            new_lb["x2"], new_lb["y2"], new_lb["z2"] = ix, iy, iz
                        
                        nuevo.append(new_lb)
                        usadas.add(j)
                        cambiado = True
                        corte = True
                        break
                if corte: break

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
    Fuerza cada línea al eje canónico más cercano si no es vertical.
    Para verticales, rectifica X e Y para que coincidan (vertical pura).
    """
    resultado = []
    for linea in lineas:
        angulo_real = _angulo_grados(linea)
        
        if angulo_real is None:
            # Es vertical pura o casi pura. Rectificar X e Y para que sean idénticos.
            resultado.append({
                **linea,
                "x2": linea["x1"],
                "y2": linea["y1"],
                "_tipo_rect": "vertical"
            })
            continue

        eje_cercano = _eje_mas_cercano(angulo_real)
        diff = min(abs(angulo_real - eje_cercano), 360 - abs(angulo_real - eje_cercano))
        
        if diff < SNAP_ANGLE_TOLERANCE:
            long_3d = _longitud(linea)
            dz = linea.get("z2", 0) - linea.get("z1", 0)
            
            # Longitud proyectada en el plano XY (Teorema de Pitágoras)
            long_xy = math.sqrt(max(0, long_3d**2 - dz**2))
            
            rad = math.radians(eje_cercano)
            nuevo_x2 = linea["x1"] + long_xy * math.cos(rad)
            nuevo_y2 = linea["y1"] + long_xy * math.sin(rad)

            resultado.append({
                **linea,
                "x2": round(nuevo_x2, 4),
                "y2": round(nuevo_y2, 4),
                "_snap_angulo": eje_cercano,
                "_tipo_rect": "planar"
            })
        else:
            # Mantener original si la desviación es muy grande (> TOLERANCIA)
            resultado.append({**linea, "_tipo_rect": "original"})

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

    # Construir lista de puntos mutables: cada entrada es [x, y, z, referencia, tipo_ref]
    puntos: list[list] = []
    
    for linea in lineas:
        puntos.append([linea["x1"], linea["y1"], linea.get("z1", 0), linea, "x1y1z1"])
        puntos.append([linea["x2"], linea["y2"], linea.get("z2", 0), linea, "x2y2z2"])

    for nodo in nodos:
        puntos.append([nodo["x"], nodo["y"], nodo.get("z", 0), nodo, "xyz"])

    # Fusión por pares — complejidad O(n²).
    n = len(puntos)
    for i in range(n):
        for j in range(i + 1, n):
            px_i, py_i, pz_i = puntos[i][0], puntos[i][1], puntos[i][2]
            px_j, py_j, pz_j = puntos[j][0], puntos[j][1], puntos[j][2]

            dist_3d = math.sqrt((px_i - px_j)**2 + (py_i - py_j)**2 + (pz_i - pz_j)**2)
            if dist_3d <= SNAP_DISTANCE_PX:
                # Promedio de las tres posiciones
                mx = (px_i + px_j) / 2
                my = (py_i + py_j) / 2
                mz = (pz_i + pz_j) / 2

                # Actualizar coordenadas en la lista de puntos
                puntos[i][0] = puntos[j][0] = mx
                puntos[i][1] = puntos[j][1] = my
                puntos[i][2] = puntos[j][2] = mz

    # Propagar coordenadas fusionadas a los dicts originales
    for px, py, pz, ref, tipo_ref in puntos:
        if tipo_ref == "x1y1z1":
            ref["x1"] = round(px, 4)
            ref["y1"] = round(py, 4)
            ref["z1"] = round(pz, 4)
        elif tipo_ref == "x2y2z2":
            ref["x2"] = round(px, 4)
            ref["y2"] = round(py, 4)
            ref["z2"] = round(pz, 4)
        else:  # "xyz" (Nodos)
            ref["x"] = round(px, 4)
            ref["y"] = round(py, 4)
            ref["z"] = round(pz, 4)

    return lineas, nodos


def simplificar_red(lineas: list[dict]) -> list[dict]:
    """
    Fusiona segmentos colineales que comparten un nodo de grado 2 y tienen el mismo diámetro.
    Esto reduce drásticamente el número de Uniones (U) innecesarias.
    """
    if not lineas: return []

    # 1. Construir mapa de conectividad
    nodos = {} # (x,y,z) -> [lista de indices de lineas]
    def get_key(px, py, pz): return (round(px, 2), round(py, 2), round(pz, 2))

    for i, l in enumerate(lineas):
        k1 = get_key(l["x1"], l["y1"], l.get("z1", 0))
        k2 = get_key(l["x2"], l["y2"], l.get("z2", 0))
        nodos.setdefault(k1, []).append(i)
        nodos.setdefault(k2, []).append(i)

    segmentos_fusionados = set()
    nuevas_lineas = []
    procesadas_global = [False] * len(lineas)

    for i in range(len(lineas)):
        if procesadas_global[i]: continue
        
        # Intentar extender la línea i en ambas direcciones
        actual = lineas[i]
        procesadas_global[i] = True
        
        cambio = True
        while cambio:
            cambio = False
            # Extremos actuales
            k1 = get_key(actual["x1"], actual["y1"], actual.get("z1", 0))
            k2 = get_key(actual["x2"], actual["y2"], actual.get("z2", 0))
            
            for k in [k1, k2]:
                neighbors = [idx for idx in nodos.get(k, []) if not procesadas_global[idx]]
                if len(neighbors) == 1:
                    # Candidato a fusión (nodo grado 2 en total, 1 procesado, 1 no)
                    # Pero el grado real del nodo en el grafo original debe ser exactamente 2
                    if len(nodos[k]) == 2:
                        idx_next = neighbors[0]
                        next_l = lineas[idx_next]
                        
                        # Mismo diámetro
                        if actual.get("diametro") == next_l.get("diametro"):
                            # Verificar colinealidad
                            def get_vec(l):
                                dx, dy, dz = l["x2"]-l["x1"], l["y2"]-l["y1"], l.get("z2", 0)-l.get("z1", 0)
                                mag = math.sqrt(dx*dx + dy*dy + dz*dz)
                                if mag < 0.1: return (0,0,0)
                                return (dx/mag, dy/mag, dz/mag)

                            v_actual = get_vec(actual)
                            v_next = get_vec(next_l)
                            
                            # Dot product debe ser 1 (mismo sentido) o -1 (sentido opuesto)
                            # dependiendo de qué extremo estemos uniendo.
                            # Si unimos k2 de 'actual' con algun extremo de 'next_l':
                            # k2 es (x2, y2) de actual.
                            # Si k2 es x1,y1 de next_l -> v_actual y v_next deben ser iguales (dot ~ 1)
                            # Si k2 es x2,y2 de next_l -> v_actual y v_next deben ser opuestos (dot ~ -1)
                            
                            # Simplificamos: Si k es k2 de actual:
                            dot = v_actual[0]*v_next[0] + v_actual[1]*v_next[1] + v_actual[2]*v_next[2]
                            
                            is_k2_actual = (k == k2)
                            is_k1_next = (get_key(next_l["x1"], next_l["y1"], next_l.get("z1", 0)) == k)
                            
                            # Si k2_actual se une a k1_next -> vectores deben ir en el mismo sentido (dot ≈ 1)
                            # Si k2_actual se une a k2_next -> vectores deben ser opuestos (dot ≈ -1)
                            # Si k1_actual se une a k1_next -> vectores deben ser opuestos (dot ≈ -1)
                            # Si k1_actual se une a k2_next -> vectores deben ir en el mismo sentido (dot ≈ 1)
                            
                            success = False
                            if is_k2_actual:
                                if is_k1_next and dot > 0.999: # 1.0
                                    actual = {**actual, "x2": next_l["x2"], "y2": next_l["y2"], "z2": next_l.get("z2", 0)}
                                    success = True
                                elif not is_k1_next and dot < -0.999: # -1.0
                                    actual = {**actual, "x2": next_l["x1"], "y2": next_l["y1"], "z2": next_l.get("z1", 0)}
                                    success = True
                            else: # is_k1_actual
                                if is_k1_next and dot < -0.999: # -1.0
                                    actual = {**actual, "x1": next_l["x2"], "y1": next_l["y2"], "z1": next_l.get("z2", 0)}
                                    success = True
                                elif not is_k1_next and dot > 0.999: # 1.0
                                    actual = {**actual, "x1": next_l["x1"], "y1": next_l["y1"], "z1": next_l.get("z1", 0)}
                                    success = True

                            if success:
                                procesadas_global[idx_next] = True
                                cambio = True
                                break
        nuevas_lineas.append(actual)

    return nuevas_lineas

def procesar_plano(plano: dict) -> dict:
    """
    Aplica el pipeline completo de rectificación al plano recibido.

    Orden:
      0. fragmentar_intersecciones — corta líneas que se cruzan en el interior
      1. filtrar_ruido     — elimina líneas demasiado cortas
      2. rectificar_ejes   — fuerza ángulos a ejes canónicos
      3. fusionar_intersecciones — une puntos cercanos
      4. dimensionar_lineas — calcula diámetro de cada tramo (si hay caudal)
      4b. simplificar_red — FUSIONA tramos colineales del mismo diámetro
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
    is_isometric = plano.get("is_isometric", False)

    # Paso 0: fragmentar cruces interiores
    lineas = fragmentar_intersecciones(lineas)

    lineas = filtrar_ruido(lineas)
    lineas = rectificar_ejes(lineas)
    lineas, nodos = fusionar_intersecciones(lineas, nodos)

    # Paso 4: dimensionamiento (siempre se calcula para tener longitudes en el BOM)
    from dimensionador import dimensionar_lineas
    lineas = dimensionar_lineas(lineas, caudal_scfm or 0, tipo_red or "lineal")

    # Paso 4b: Simplificar tramos colineales para evitar Uniones redundantes
    lineas = simplificar_red(lineas)

    # Paso 5: detección de piezas (codos, tes, cruces, uniones, tapones)
    from detector_piezas import detectar_piezas
    piezas = detectar_piezas(lineas, nodos_hardware=nodos, is_isometric=is_isometric)

    # Paso 6: Válvulas
    # Se eliminan las automáticas y se usan las manuales enviadas por el usuario.
    valvulas = plano.get("valvulas_manuales", [])
    
    # Actualizar diámetros de las válvulas según la tubería en la que están
    for v in valvulas:
        if not v.get("diametro"):
            vx, vy = v["x"], v["y"]
            best_d = "N/A"
            
            for line in lineas:
                # Distancia punto-segmento (simplificada ya que se ajustó en el frontend)
                lx1, ly1, lx2, ly2 = line["x1"], line["y1"], line["x2"], line["y2"]
                # Calculamos distancia al punto medio de la línea como proxy rápido 
                # (en el frontend ya se garantizó que está sobre la línea)
                if min(lx1, lx2) - 5 <= vx <= max(lx1, lx2) + 5 and \
                   min(ly1, ly2) - 5 <= vy <= max(ly1, ly2) + 5:
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
