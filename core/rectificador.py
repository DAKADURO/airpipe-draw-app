"""
rectificador.py — AIRpipe Phase 2
Orquestador Principal (Pipeline de Procesamiento).
Llama secuencialmente a las fases matemáticas, de dimensionamiento y BOM.
"""

from .geometry_cleaner import filtrar_ruido, rectificar_ejes
from .topology import fragmentar_intersecciones, fusionar_intersecciones, simplificar_red
from .dimensionador import dimensionar_lineas
from .detector_piezas import detectar_piezas
from generators.generador_bom import generar_bom

def procesar_plano(plano: dict) -> dict:
    """
    Aplica el pipeline completo de rectificación al plano recibido.

    Pipeline Ordenado:
      1. fragmentar_intersecciones — corta líneas que se cruzan en el interior
      2. filtrar_ruido     — elimina líneas demasiado cortas
      3. rectificar_ejes   — fuerza ángulos a ejes canónicos
      4. fusionar_intersecciones — une puntos cercanos
      5. dimensionar_lineas — calcula diámetro de cada tramo (si hay caudal)
      6. simplificar_red — fusiona tramos colineales del mismo diámetro
      7. detectar_piezas   — identifica Codos, Tes y Cruces
      8. Fix de válvulas   — ajusta las válvulas enviadas
      9. generar_bom       — conteo de piezas
    """
    lineas = plano.get("lineas", [])
    nodos  = plano.get("nodos",  [])
    valvulas = plano.get("valvulas_manuales", [])
    caudal_scfm = plano.get("caudal_scfm", 0)
    tipo_red    = plano.get("tipo_red", "lineal")
    is_isometric = plano.get("is_isometric", False)

    # (1-2) Sanitización Geométrica Inicial
    lineas = filtrar_ruido(lineas)
    lineas = rectificar_ejes(lineas)

    # (3) Unión de Nodos Topológicos post-rectificación (Join messy endpoints)
    lineas, nodos = fusionar_intersecciones(lineas, nodos)

    # (4) Fragmentación de Intersecciones y Uniones T
    # Ahora que los ejes están rectos, es más probable que las T se detecten correctamente
    lineas = fragmentar_intersecciones(lineas)

    # (4.5) Segunda unión para consolidar fragmentos y nuevas intersecciones
    lineas, nodos = fusionar_intersecciones(lineas, nodos)

    # (5) Cálculos Hidráulicos (Diámetros)
    lineas = dimensionar_lineas(lineas, caudal_scfm or 0, tipo_red or "lineal")

    # (6) Simplificación de Uniones Innecesarias
    lineas = simplificar_red(lineas)

    # (7) Ensamblaje Físico (Fittings)
    piezas = detectar_piezas(lineas, nodos_hardware=nodos, is_isometric=is_isometric)

    # (8) Ensamblaje de Válvulas
    for v in valvulas:
        if not v.get("diametro"):
            vx, vy = v["x"], v["y"]
            best_d = "N/A"
            for line in lineas:
                lx1, ly1, lx2, ly2 = line["x1"], line["y1"], line["x2"], line["y2"]
                if min(lx1, lx2) - 5 <= vx <= max(lx1, lx2) + 5 and \
                   min(ly1, ly2) - 5 <= vy <= max(ly1, ly2) + 5:
                    best_d = line.get("diametro", "N/A")
                    break 
            v["diametro"] = best_d

    # (8.5) Procesamiento de Bajadas (Drops)
    bajadas = [n for n in nodos if n.get("tipo") == "bajada"]
    for b in bajadas:
        bx, by = b["x"], b["y"]
        best_d = "N/A"
        for line in lineas:
            lx1, ly1, lx2, ly2 = line["x1"], line["y1"], line["x2"], line["y2"]
            if min(lx1, lx2) - 5 <= bx <= max(lx1, lx2) + 5 and \
               min(ly1, ly2) - 5 <= by <= max(ly1, ly2) + 5:
                best_d = line.get("diametro", "N/A")
                break
        b["diametro_principal"] = best_d

    # (9) Cuenta final y Formateo
    bom = generar_bom(lineas, piezas, valvulas, bajadas)

    return {
        "lineas": lineas,
        "nodos": nodos,
        "piezas": piezas,
        "valvulas": valvulas,
        "caudal_scfm": caudal_scfm,
        "tipo_red": tipo_red,
        "is_isometric": is_isometric,
        "bgLines": plano.get("bgLines", []),
        "bgScale": plano.get("bgScale", 1.0),
        "bom": bom
    }
