"""
generador_bom.py — AIRpipe
Módulo para generar el prototipo de Lista de Materiales (BOM) a partir de los datos rectificados.

Resume:
- Tuberías por diámetro (metros totales).
- Accesorios (Codos, Tes, Cruces, Uniones, Tapones) por tipo y diámetro.
- Válvulas por diámetro.
"""

def generar_bom(lineas: list[dict], piezas: list[dict], valvulas: list[dict]) -> dict:
    """
    Agrupa y suma los materiales de la red.
    """
    bom = {
        "tuberias": [],
        "accesorios": [],
        "valvulas": []
    }

    # --- 1. Agrupar Tuberías ---
    METROS_POR_TUBO = 5.7912 # 19 ft
    tuberia_map = {} # diametro -> metros
    for L in lineas:
        d = L.get("diametro", "N/A")
        m = L.get("longitud_metros", 0)
        tuberia_map[d] = tuberia_map.get(d, 0) + m

    import math
    for d, m in tuberia_map.items():
        # Metros totales
        bom["tuberias"].append({
            "descripcion": f"Tubería Aluminio {d}",
            "cantidad": round(m, 2),
            "unidad": "m"
        })
        # Cantidad de tubos (tramos de 19ft)
        bom["tuberias"].append({
            "descripcion": f"Tramos de Tubería (19ft) {d}",
            "cantidad": math.ceil(m / METROS_POR_TUBO),
            "unidad": "uds"
        })

    # --- 2. Agrupar Accesorios ---
    # Usamos un mapa para agrupar por (tipo, diametro)
    acc_map = {} # (tipo, d) -> cantidad
    for P in piezas:
        t = P.get("tipo", "Desconocido")
        d = P.get("diametro", "N/A")
        # Formatear tipo para que sea más legible
        tipo_es = {
            "Codo": "Codo 90°",
            "Codo 45": "Codo 45°",
            "Te Igual": "Te Igual (90°)",
            "Te Lateral 45": "Te Lateral 45°",
            "Te": "Te (Otro)",
            "Cruz": "Cruz",
            "Union": "Unión Recta / Cople",
            "Tapon": "Tapón Final"
        }.get(t, t)
        
        key = (tipo_es, d)
        acc_map[key] = acc_map.get(key, 0) + 1

    for (tipo_es, d), cant in sorted(acc_map.items()):
        bom["accesorios"].append({
            "descripcion": f"{tipo_es} {d}",
            "cantidad": cant,
            "unidad": "uds"
        })

    # --- 3. Agrupar Válvulas ---
    valv_map = {} # diametro -> cantidad
    for V in valvulas:
        d = V.get("diametro", "N/A")
        valv_map[d] = valv_map.get(d, 0) + 1
    
    for d, cant in sorted(valv_map.items()):
        bom["valvulas"].append({
            "descripcion": f"Válvula de Esfera {d}",
            "cantidad": cant,
            "unidad": "uds"
        })

    return bom
