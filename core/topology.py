import math

SNAP_DISTANCE_PX = 20.0

def _interseccion_segmentos(p1, p2, p3, p4) -> tuple | None:
    x1, y1 = p1; x2, y2 = p2
    x3, y3 = p3; x4, y4 = p4
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-9: return None

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

    eps = 1e-6
    if eps < t < 1 - eps and eps < u < 1 - eps:
        return (round(x1 + t * (x2 - x1), 4), round(y1 + t * (y2 - y1), 4))
    return None

def _punto_sobre_segmento_3d(px, py, pz, linea, tol=8.0):
    x1, y1 = linea["x1"], linea["y1"]
    z1 = linea.get("z1", 0)
    x2, y2 = linea["x2"], linea["y2"]
    z2 = linea.get("z2", 0)

    dx, dy, dz = x2 - x1, y2 - y1, z2 - z1
    long2 = dx*dx + dy*dy + dz*dz
    if long2 < 1e-9: return None

    t = ((px - x1) * dx + (py - y1) * dy + (pz - z1) * dz) / long2
    eps = 0.01
    if t <= eps or t >= 1.0 - eps: return None

    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    proj_z = z1 + t * dz

    if math.hypot(px - proj_x, py - proj_y, pz - proj_z) <= tol:
        return (proj_x, proj_y, proj_z)
    return None

def fragmentar_intersecciones(lineas: list[dict]) -> list[dict]:
    """
    Divide líneas cuando se cruzan o cuando un extremo de una línea toca el cuerpo de otra (T-junction).
    Optimizado con chequeo AABB.
    """
    result = [dict(l) for l in lineas]
    cambiado = True
    iterations = 0
    
    while cambiado and iterations < 100:
        cambiado = False
        iterations += 1
        nuevo_result = []
        skip_indices = set()
        
        for i in range(len(result)):
            if i in skip_indices: continue
            la = result[i]
            corte_encontrado = False
            
            for j in range(len(result)):
                if i == j or j in skip_indices: continue
                lb = result[j]
                
                # Optimización AABB
                tol = 0.5 # Pequeño margen para T-junctions
                if (min(la["x1"], la["x2"]) - tol > max(lb["x1"], lb["x2"]) or
                    max(la["x1"], la["x2"]) + tol < min(lb["x1"], lb["x2"]) or
                    min(la["y1"], la["y2"]) - tol > max(lb["y1"], lb["y2"]) or
                    max(la["y1"], la["y2"]) + tol < min(lb["y1"], lb["y2"])):
                    continue

                # 1. Intersección Real (X)
                pt2d = _interseccion_segmentos((la["x1"], la["y1"]), (la["x2"], la["y2"]), 
                                               (lb["x1"], lb["y1"]), (lb["x2"], lb["y2"]))
                if pt2d:
                    def get_z_at(line, pt):
                        d2_total = math.hypot(line["x2"] - line["x1"], line["y2"] - line["y1"])
                        if d2_total < 0.1: return line.get("z1", 0)
                        return line.get("z1", 0) + (math.hypot(pt[0] - line["x1"], pt[1] - line["y1"]) / d2_total) * (line.get("z2", 0) - line.get("z1", 0))

                    za, zb = get_z_at(la, pt2d), get_z_at(lb, pt2d)
                    if abs(za - zb) < 5.0:
                        ix, iy = pt2d
                        avg_z = (za + zb) / 2
                        # Dividir ambas líneas
                        nuevo_result.append({**la, "x2": ix, "y2": iy, "z2": avg_z})
                        nuevo_result.append({**la, "x1": ix, "y1": iy, "z1": avg_z})
                        nuevo_result.append({**lb, "x2": ix, "y2": iy, "z2": avg_z})
                        nuevo_result.append({**lb, "x1": ix, "y1": iy, "z1": avg_z})
                        skip_indices.add(i)
                        skip_indices.add(j)
                        corte_encontrado = True
                        cambiado = True
                        break

                # 2. Unión en T (Extremo de B sobre A)
                for pt_idx, (px, py, pz) in enumerate([(lb["x1"], lb["y1"], lb.get("z1", 0)), (lb["x2"], lb["y2"], lb.get("z2", 0))]):
                    proj = _punto_sobre_segmento_3d(px, py, pz, la, tol=SNAP_DISTANCE_PX)
                    if proj:
                        ix, iy, iz = proj
                        # Dividir A, ajustar B
                        nuevo_result.append({**la, "x2": ix, "y2": iy, "z2": iz})
                        nuevo_result.append({**la, "x1": ix, "y1": iy, "z1": iz})
                        new_lb = dict(lb)
                        if pt_idx == 0: 
                            new_lb["x1"], new_lb["y1"], new_lb["z1"] = ix, iy, iz
                        else:
                            new_lb["x2"], new_lb["y2"], new_lb["z2"] = ix, iy, iz
                        nuevo_result.append(new_lb)
                        
                        skip_indices.add(i)
                        skip_indices.add(j)
                        corte_encontrado = True
                        cambiado = True
                        break
                
                if corte_encontrado: break
            
            if not corte_encontrado:
                nuevo_result.append(la)
        
        result = nuevo_result
    
    return result

def fusionar_intersecciones(lineas: list[dict], nodos: list[dict]) -> tuple[list[dict], list[dict]]:
    lineas = [dict(ln) for ln in lineas]
    nodos  = [dict(nd) for nd in nodos]
    
    # 1. Recolectar puntos prioritarios (nodos de hardware) primero
    # Esto asegura que ellos establezcan la posición del cluster
    puntos_prioritarios = []
    for nodo in nodos:
        puntos_prioritarios.append({"x": nodo["x"], "y": nodo["y"], "z": nodo.get("z", 0), "ref": nodo, "attr": "n"})

    # 2. Recolectar puntos secundarios (extremos de tuberías)
    puntos_secundarios = []
    for linea in lineas:
        puntos_secundarios.append({"x": linea["x1"], "y": linea["y1"], "z": linea.get("z1", 0), "ref": linea, "attr": "1"})
        puntos_secundarios.append({"x": linea["x2"], "y": linea["y2"], "z": linea.get("z2", 0), "ref": linea, "attr": "2"})

    if not puntos_prioritarios and not puntos_secundarios:
        return lineas, nodos

    # --- Optimización Espacial (Grid Snapping) ---
    cluster_leaders = {} # cell -> leader_coords (x, y, z)
    
    def get_cell(x, y, z):
        return (int(x // SNAP_DISTANCE_PX), int(y // SNAP_DISTANCE_PX), int(z // SNAP_DISTANCE_PX))

    def snap_point(p, is_prioritario):
        cell = get_cell(p["x"], p["y"], p["z"])
        found_leader = None
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                for dz in [-1, 0, 1]:
                    neighbor_cell = (cell[0] + dx, cell[1] + dy, cell[2] + dz)
                    if neighbor_cell in cluster_leaders:
                        lx, ly, lz = cluster_leaders[neighbor_cell]
                        dist = math.hypot(p["x"] - lx, p["y"] - ly, p["z"] - lz)
                        if dist <= SNAP_DISTANCE_PX:
                            found_leader = (lx, ly, lz)
                            break
                if found_leader: break
            if found_leader: break
        
        if found_leader:
            p["new_x"], p["new_y"], p["new_z"] = found_leader
        else:
            leader_coords = (p["x"], p["y"], p["z"])
            cluster_leaders[cell] = leader_coords
            p["new_x"], p["new_y"], p["new_z"] = leader_coords

    # Procesar prioritarios primero para que "manden" sobre las tuberías
    for p in puntos_prioritarios: snap_point(p, True)
    for p in puntos_secundarios: snap_point(p, False)

    # Paso 2: Aplicar coordenadas
    todos = puntos_prioritarios + puntos_secundarios
    for p in todos:
        nx, ny, nz = round(p["new_x"], 4), round(p["new_y"], 4), round(p["new_z"], 4)
        ref, attr = p["ref"], p["attr"]
        if attr == "1":
            ref["x1"], ref["y1"], ref["z1"] = nx, ny, nz
        elif attr == "2":
            ref["x2"], ref["y2"], ref["z2"] = nx, ny, nz
        else: # nodo
            ref["x"], ref["y"], ref["z"] = nx, ny, nz

    return lineas, nodos

def simplificar_red(lineas: list[dict]) -> list[dict]:
    if not lineas: return []
    def get_k(px, py, pz): return (round(px, 2), round(py, 2), round(pz, 2))
    
    nodos = {}
    for i, l in enumerate(lineas):
        nodos.setdefault(get_k(l["x1"], l["y1"], l.get("z1", 0)), []).append(i)
        nodos.setdefault(get_k(l["x2"], l["y2"], l.get("z2", 0)), []).append(i)

    nuevas_lineas = []
    proc = [False] * len(lineas)

    for i in range(len(lineas)):
        if proc[i]: continue
        act = lineas[i]
        proc[i] = True
        
        cambio = True
        while cambio:
            cambio = False
            k1 = get_k(act["x1"], act["y1"], act.get("z1", 0))
            k2 = get_k(act["x2"], act["y2"], act.get("z2", 0))
            
            for k in [k1, k2]:
                neighbors = [j for j in nodos.get(k, []) if not proc[j]]
                if len(neighbors) == 1 and len(nodos[k]) == 2:
                    n_idx = neighbors[0]
                    nl = lineas[n_idx]
                    
                    if act.get("diametro") == nl.get("diametro"):
                        def gv(l):
                            dx, dy, dz = l["x2"]-l["x1"], l["y2"]-l["y1"], l.get("z2",0)-l.get("z1",0)
                            mag = math.hypot(dx, dy, dz)
                            if mag < 0.1: return (0,0,0)
                            return (dx/mag, dy/mag, dz/mag)
                        v1, v2 = gv(act), gv(nl)
                        dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]
                        
                        is_k2a, is_k1n = (k == k2), (get_k(nl["x1"], nl["y1"], nl.get("z1", 0)) == k)
                        
                        suc = False
                        if is_k2a:
                            if is_k1n and dot > 0.999:
                                act = {**act, "x2": nl["x2"], "y2": nl["y2"], "z2": nl.get("z2", 0)}; suc = True
                            elif not is_k1n and dot < -0.999:
                                act = {**act, "x2": nl["x1"], "y2": nl["y1"], "z2": nl.get("z1", 0)}; suc = True
                        else:
                            if is_k1n and dot < -0.999:
                                act = {**act, "x1": nl["x2"], "y1": nl["y2"], "z1": nl.get("z2", 0)}; suc = True
                            elif not is_k1n and dot > 0.999:
                                act = {**act, "x1": nl["x1"], "y1": nl["y1"], "z1": nl.get("z1", 0)}; suc = True

                        if suc:
                            proc[n_idx] = True; cambio = True; break
        nuevas_lineas.append(act)
    return nuevas_lineas
