"""
generador_bom.py — AIRpipe
Módulo para generar el prototipo de Lista de Materiales (BOM) a partir de los datos rectificados.

Resume:
- Tuberías por diámetro (metros totales).
- Accesorios (Codos, Tes, Cruces, Uniones, Tapones) por tipo y diámetro.
- Válvulas por diámetro.
"""

BAJADAS_QD_TABLE = {
    '1"': {
        '1"':   {'qd': '2110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '2210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '1 1/2"': {
        '1"':   {'qd': '4110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '4210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '2"': {
        '1"':   {'qd': '5110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '5210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '2 1/2"': {
        '1"':   {'qd': '6110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '6210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '3"': {
        '1"':   {'qd': '7110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '7210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '4"': {
        '1"':   {'qd': '8110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '8210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '6"': {
        '1"':   {'qd': '9110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': '9210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    },
    '8"': {
        '1"':   {'qd': 'A110', 'valve_qd': '1052', 'Valve Drop One Port Male': '1352', 'Valve Drop One Port Female': '1252', 'Valve Drop Two Port Female': '1152', 'Angle-Valve Drop Two Port Female': '1552'},
        '3/4"': {'qd': 'A210', 'valve_qd': '2052', 'Valve Drop One Port Male': '2352', 'Valve Drop One Port Female': '2252', 'Valve Drop Two Port Female': '2152', 'Angle-Valve Drop Two Port Female': '2552'}
    }
}

def generar_bom(lineas: list[dict], piezas: list[dict], valvulas: list[dict], bajadas: list[dict] = None) -> dict:
    """
    Agrupa y suma los materiales de la red.
    """
    if bajadas is None:
        bajadas = []

    bom = {
        "tuberias": [],
        "accesorios": [],
        "valvulas": []
    }

    tuberia_map = {} # diametro -> metros
    # Procesar bajadas antes de totalizar tuberías
    acc_map = {} # para agregar qds
    
    for b in bajadas:
        main_d = b.get("diametro_principal", "N/A")
        drop_size = b.get("dropSize", '3/4"')
        drop_height = float(b.get("dropHeight", 2.0))
        drop_valve = b.get("dropValve", "Ninguna")

        # Sumar la tubería de la bajada
        tuberia_map[drop_size] = tuberia_map.get(drop_size, 0) + drop_height

        # Lookup en la tabla de QD
        if main_d in BAJADAS_QD_TABLE and drop_size in BAJADAS_QD_TABLE[main_d]:
            parts = BAJADAS_QD_TABLE[main_d][drop_size]
            
            # 1. Quick Drop
            qd_key = (f"Quick Drop (QD) {parts['qd']}", f"{main_d} a {drop_size}")
            acc_map[qd_key] = acc_map.get(qd_key, 0) + 1
            
            # 2. Valve QD
            vqd_key = (f"Válvula QD {parts['valve_qd']}", drop_size)
            acc_map[vqd_key] = acc_map.get(vqd_key, 0) + 1
            
            # 3. Terminal Drop Valve
            if drop_valve in parts:
                term_v_key = (f"Drop Valve ({drop_valve}) {parts[drop_valve]}", drop_size)
                acc_map[term_v_key] = acc_map.get(term_v_key, 0) + 1
        else:
            # Fallback genérico si no se halló QD
            qd_gt = ("Quick Drop Genérico", f"{main_d} a {drop_size}")
            acc_map[qd_gt] = acc_map.get(qd_gt, 0) + 1

    # --- 1. Agrupar Tuberías ---
    METROS_POR_TUBO = 5.7912 # 19 ft
    for L in lineas:
        d = L.get("diametro", "N/A")
        m = L.get("longitud_metros", 0)
        tuberia_map[d] = tuberia_map.get(d, 0) + m

    import math
    for d, m in tuberia_map.items():
        if m > 0:
            bom["tuberias"].append({
                "descripcion": f"Tubería Aluminio {d}",
                "cantidad": round(m, 2),
                "unidad": "m"
            })
            bom["tuberias"].append({
                "descripcion": f"Tramos de Tubería (19ft) {d}",
                "cantidad": math.ceil(m / METROS_POR_TUBO),
                "unidad": "uds"
            })

    # --- 2. Agrupar Accesorios ---
    for P in piezas:
        t = P.get("tipo", "Desconocido")
        d = P.get("diametro", "N/A")
        
        if t == "Te + Codo":
            k_te = ("Te Igual (90°)", d)
            acc_map[k_te] = acc_map.get(k_te, 0) + 1
            k_codo = ("Codo 90°", d)
            acc_map[k_codo] = acc_map.get(k_codo, 0) + 1
            continue

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
