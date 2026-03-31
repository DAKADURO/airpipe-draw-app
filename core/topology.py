import math

SNAP_DISTANCE_PX = 20

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

def _punto_sobre_segmento_3d(px, py, pz, linea, tol=5.0):
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
    result = list(lineas)
    cambiado = True
    while cambiado:
        cambiado = False
        nuevo = []
        usadas = set()
        for i, la in enumerate(result):
            if i in usadas: continue
            corte = False
            for j, lb in enumerate(result):
                if j <= i or j in usadas: continue

                # X-crossing
                pt2d = _interseccion_segmentos((la["x1"], la["y1"]), (la["x2"], la["y2"]), (lb["x1"], lb["y1"]), (lb["x2"], lb["y2"]))
                if pt2d:
                    def get_z_at(line, pt):
                        d2_total = math.hypot(line["x2"] - line["x1"], line["y2"] - line["y1"])
                        if d2_total < 0.1: return line.get("z1", 0)
                        return line.get("z1", 0) + (math.hypot(pt[0] - line["x1"], pt[1] - line["y1"]) / d2_total) * (line.get("z2", 0) - line.get("z1", 0))

                    za, zb = get_z_at(la, pt2d), get_z_at(lb, pt2d)
                    if abs(za - zb) < 5.0:
                        ix, iy = pt2d
                        avg_z = (za + zb) / 2
                        nuevo.extend([
                            {**la, "x2": ix, "y2": iy, "z2": avg_z}, {**la, "x1": ix, "y1": iy, "z1": avg_z},
                            {**lb, "x2": ix, "y2": iy, "z2": avg_z}, {**lb, "x1": ix, "y1": iy, "z1": avg_z}
                        ])
                        usadas.add(j); cambiado = True; corte = True; break

                # T-junction
                for pt_idx, (px, py, pz) in enumerate([(lb["x1"], lb["y1"], lb.get("z1", 0)), (lb["x2"], lb["y2"], lb.get("z2", 0))]):
                    proj = _punto_sobre_segmento_3d(px, py, pz, la)
                    if proj:
                        ix, iy, iz = proj
                        nuevo.extend([{**la, "x2": ix, "y2": iy, "z2": iz}, {**la, "x1": ix, "y1": iy, "z1": iz}])
                        new_lb = {**lb}
                        if pt_idx == 0: new_lb["x1"], new_lb["y1"], new_lb["z1"] = ix, iy, iz
                        else: new_lb["x2"], new_lb["y2"], new_lb["z2"] = ix, iy, iz
                        nuevo.append(new_lb)
                        usadas.add(j); cambiado = True; corte = True; break
                if corte: break
            if not corte: nuevo.append(la)
        result = nuevo
    return result

def fusionar_intersecciones(lineas: list[dict], nodos: list[dict]) -> tuple[list[dict], list[dict]]:
    lineas = [dict(ln) for ln in lineas]
    nodos  = [dict(nd) for nd in nodos]
    puntos = []
    
    for linea in lineas:
        puntos.extend([
            [linea["x1"], linea["y1"], linea.get("z1", 0), linea, "1"],
            [linea["x2"], linea["y2"], linea.get("z2", 0), linea, "2"]
        ])
    for nodo in nodos:
        puntos.append([nodo["x"], nodo["y"], nodo.get("z", 0), nodo, "n"])

    n = len(puntos)
    for i in range(n):
        for j in range(i + 1, n):
            if math.hypot(puntos[i][0]-puntos[j][0], puntos[i][1]-puntos[j][1], puntos[i][2]-puntos[j][2]) <= SNAP_DISTANCE_PX:
                mx, my, mz = (puntos[i][0]+puntos[j][0])/2, (puntos[i][1]+puntos[j][1])/2, (puntos[i][2]+puntos[j][2])/2
                puntos[i][0] = puntos[j][0] = mx
                puntos[i][1] = puntos[j][1] = my
                puntos[i][2] = puntos[j][2] = mz

    for px, py, pz, ref, t in puntos:
        if t == "1":
            ref["x1"], ref["y1"], ref["z1"] = round(px, 4), round(py, 4), round(pz, 4)
        elif t == "2":
            ref["x2"], ref["y2"], ref["z2"] = round(px, 4), round(py, 4), round(pz, 4)
        else:
            ref["x"], ref["y"], ref["z"] = round(px, 4), round(py, 4), round(pz, 4)

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
