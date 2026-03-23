import math
from core.geometry import project_iso

# Colores (coinciden con frontend)
COLOR_GRID        = "#E0E0E0"
COLOR_LINEA       = "#005EAA"
COLOR_COMPRESOR   = "#424242"
COLOR_CONSUMO     = "#D32F2F"

GRID_SIZE = 20  # px — tamaño de celda del grid exportado


def generar_svg(plano: dict, ancho: int = 1920, alto: int = 1080) -> str:
    """
    Genera un string XML SVG a partir de un plano rectificado.
    """
    lineas = plano.get("lineas", [])
    nodos  = plano.get("nodos", [])
    is_iso = plano.get("is_isometric", False)

    def tr(x, y, z=0):
        if is_iso:
            return project_iso(x, y, z)
        return x, y

    # Ajustar dimensiones de la vista para isométrico (puede requerir más espacio)
    # Por ahora mantenemos ancho/alto pero desplazamos el contenido al centro si es necesario
    offset_x, offset_y = 0, 0
    if is_iso:
        offset_x = ancho / 2
        offset_y = alto / 4 # Un poco arriba para que las bajadas no se corten

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho} {alto}">',
        '  <desc>Generado por AIRpipe</desc>',
        '  <defs>',
        f'    <pattern id="grid" width="{GRID_SIZE}" height="{GRID_SIZE}" patternUnits="userSpaceOnUse">',
        f'      <path d="M {GRID_SIZE} 0 L 0 0 0 {GRID_SIZE}" fill="none" stroke="{COLOR_GRID}" stroke-width="0.5"/>',
        '    </pattern>',
        '    <style>',
        f'      .tuberia {{ stroke: {COLOR_LINEA}; stroke-width: 2; fill: none; stroke-linecap: round; }}',
        f'      .compresor {{ fill: {COLOR_COMPRESOR}; stroke: none; }}',
        f'      .consumo {{ fill: {COLOR_CONSUMO}; stroke: none; }}',
        '    </style>',
        '  </defs>',
        f'  <rect width="{ancho}" height="{alto}" fill="white"/>',
        f'  <rect width="{ancho}" height="{alto}" fill="url(#grid)"/>',
    ]

    # Tuberías
    svg.append('  <g id="tuberias">')
    for linea in lineas:
        x1, y1, z1 = linea["x1"], linea["y1"], linea.get("z1", 0)
        x2, y2, z2 = linea["x2"], linea["y2"], linea.get("z2", 0)
        
        tx1, ty1 = tr(x1, y1, z1)
        tx2, ty2 = tr(x2, y2, z2)
        
        tx1 += offset_x; ty1 += offset_y
        tx2 += offset_x; ty2 += offset_y

        svg.append(f'    <line x1="{tx1}" y1="{ty1}" x2="{tx2}" y2="{ty2}" class="tuberia"/>')

        # Etiqueta de diámetro
        diametro = linea.get("diametro")
        if diametro:
            mx = (tx1 + tx2) / 2
            my = (ty1 + ty2) / 2
            angulo = math.degrees(math.atan2(ty2 - ty1, tx2 - tx1))
            if angulo > 90 or angulo < -90:
                angulo += 180
            longitud_m = linea.get("longitud_metros", "")
            label_text = f"Ø{diametro}"
            if longitud_m:
                label_text += f" ({longitud_m}m)"
            svg.append(
                f'    <text x="{mx}" y="{my - 6}" text-anchor="middle" '
                f'fill="#005EAA" font-family="Arial" font-size="9" font-weight="bold" '
                f'transform="rotate({angulo:.1f},{mx},{my})">{label_text}</text>'
            )
    svg.append('  </g>')

    # Nodos
    svg.append('  <g id="nodos">')
    for nodo in nodos:
        tipo = nodo.get("tipo", "")
        nx, ny, nz = nodo["x"], nodo["y"], nodo.get("z", 0)
        tx, ty = tr(nx, ny, nz)
        tx += offset_x; ty += offset_y
        
        clase = "compresor" if tipo == "compresor" else "consumo"
        label = "C" if tipo == "compresor" else "P"
        svg.append(f'    <circle cx="{tx}" cy="{ty}" r="8" class="{clase}"/>')
        svg.append(
            f'    <text x="{tx}" y="{ty + 4}" text-anchor="middle" '
            f'fill="white" font-family="Arial" font-size="10" font-weight="bold">{label}</text>'
        )
    svg.append('  </g>')

    # Piezas
    piezas = plano.get("piezas", [])
    if piezas:
        svg.append('  <g id="piezas">')
        for pieza in piezas:
            px, py, pz = pieza["x"], pieza["y"], pieza.get("z", 0)
            tx, ty = tr(px, py, pz)
            tx += offset_x; ty += offset_y
            
            tipo = pieza["tipo"]
            if tipo == "Union":
                label, color, sz = "U", "#2196F3", 14
                svg.append(f'    <rect x="{tx-sz/2}" y="{ty-sz/2}" width="{sz}" height="{sz}" fill="{color}" stroke="white" stroke-width="1"/>')
            elif tipo == "Tapon":
                label, color = "X", "#F44336"
                svg.append(f'    <circle cx="{tx}" cy="{ty}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
            elif tipo == "Codo 45":
                label, color = "45", "#FF9800"
                pts = f"{tx},{ty-8} {tx+8},{ty} {tx},{ty+8} {tx-8},{ty}"
                svg.append(f'    <polygon points="{pts}" fill="{color}" stroke="white" stroke-width="1"/>')
            else:
                label = "T" if "Te" in tipo else "+" if tipo == "Cruz" else "C"
                color = "#FF9800" if "Te" in tipo else "#9C27B0" if tipo == "Cruz" else "#4CAF50"
                if tipo == "Te Igual":
                    sz = 14
                    svg.append(f'    <rect x="{tx-sz/2}" y="{ty-sz/2}" width="{sz}" height="{sz}" fill="{color}" stroke="white" stroke-width="1"/>')
                elif tipo == "Te Lateral 45":
                    pts = f"{tx},{ty-8} {tx+8},{ty} {tx},{ty+8} {tx-8},{ty}"
                    svg.append(f'    <polygon points="{pts}" fill="{color}" stroke="white" stroke-width="1"/>')
                else:
                    svg.append(f'    <circle cx="{tx}" cy="{ty}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
            
            svg.append(
                f'    <text x="{tx}" y="{ty}" dy="4" text-anchor="middle" '
                f'fill="white" font-family="Arial" font-size="9" font-weight="bold">{label}</text>'
            )
        svg.append('  </g>')
    
    # Válvulas Manuales
    valvulas_manuales = plano.get("valvulas_manuales", [])
    if valvulas_manuales:
        svg.append('  <g id="valvulas_manuales">')
        for v in valvulas_manuales:
            vx, vy, vz = v["x"], v["y"], v.get("z", 0)
            tx, ty = tr(vx, vy, vz)
            tx += offset_x; ty += offset_y
            angulo = v.get("angulo", 0)
            svg.append(f'    <g transform="translate({tx},{ty}) rotate({angulo})">')
            svg.append('      <path d="M -6 -4 L 0 0 L -6 4 Z M 6 -4 L 0 0 L 6 4 Z" fill="#FFC107" stroke="white" stroke-width="1"/>')
            svg.append('    </g>')
        svg.append('  </g>')

    # Notas
    notas = plano.get("notas", [])
    if notas:
        svg.append('  <g id="notas">')
        for n in notas:
            nx, ny, nz = n["x"], n["y"], n.get("z", 0)
            tx, ty = tr(nx, ny, nz)
            tx += offset_x; ty += offset_y
            txt = n["texto"]
            estimate_w = len(txt) * 7 + 8
            svg.append(f'    <rect x="{tx}" y="{ty}" width="{estimate_w}" height="16" fill="rgba(30,30,30,0.6)" stroke="#007acc" stroke-width="0.5"/>')
            svg.append(f'    <text x="{tx+4}" y="{ty+12}" fill="black" font-family="Arial" font-size="10">{txt}</text>')
        svg.append('  </g>')

    svg.append('</svg>')
    return "\n".join(svg)
