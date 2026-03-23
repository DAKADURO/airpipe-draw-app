"""
generador_svg.py — AIRpipe Phase 3
Módulo para generar el XML SVG del plano.

OPT-6: El grid se genera con un <pattern> SVG en lugar de N líneas individuales.
       Antes: ~150 elementos <line> hardcoded → SVG pesado.
       Ahora: 1 <pattern> + 1 <rect> → SVG mínimo, mismo resultado visual.
"""

import math

# Colores (coinciden con frontend)
COLOR_GRID        = "#E0E0E0"
COLOR_LINEA       = "#005EAA"
COLOR_COMPRESOR   = "#424242"
COLOR_CONSUMO     = "#D32F2F"

GRID_SIZE = 20  # px — tamaño de celda del grid exportado


def generar_svg(plano: dict, ancho: int = 1920, alto: int = 1080) -> str:
    """
    Genera un string XML SVG a partir de un plano rectificado.

    Args:
        plano: Dict con claves "lineas" y "nodos".
        ancho: Ancho del viewBox (default 1920).
        alto: Alto del viewBox (default 1080).

    Returns:
        String con el contenido XML del SVG.
    """
    lineas = plano.get("lineas", [])
    nodos  = plano.get("nodos", [])

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho} {alto}">',
        '  <desc>Generado por AIRpipe</desc>',
        '  <defs>',
        # OPT-6: pattern para el grid — reemplaza ~150 elementos <line>
        f'    <pattern id="grid" width="{GRID_SIZE}" height="{GRID_SIZE}" patternUnits="userSpaceOnUse">',
        f'      <path d="M {GRID_SIZE} 0 L 0 0 0 {GRID_SIZE}" fill="none" stroke="{COLOR_GRID}" stroke-width="0.5"/>',
        '    </pattern>',
        '    <style>',
        f'      .tuberia {{ stroke: {COLOR_LINEA}; stroke-width: 2; fill: none; stroke-linecap: round; }}',
        f'      .compresor {{ fill: {COLOR_COMPRESOR}; stroke: none; }}',
        f'      .consumo {{ fill: {COLOR_CONSUMO}; stroke: none; }}',
        '    </style>',
        '  </defs>',
        # Fondo blanco
        f'  <rect width="{ancho}" height="{alto}" fill="white"/>',
        # Grid como pattern (1 elemento en lugar de ~150)
        f'  <rect width="{ancho}" height="{alto}" fill="url(#grid)"/>',
    ]

    # Tuberías
    svg.append('  <g id="tuberias">')
    for linea in lineas:
        x1, y1 = linea["x1"], linea["y1"]
        x2, y2 = linea["x2"], linea["y2"]
        svg.append(f'    <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="tuberia"/>')


        # Etiqueta de diámetro (si existe)
        diametro = linea.get("diametro")
        if diametro:
            # Calcular punto medio y ángulo de rotación
            mx = (x1 + x2) / 2
            my = (y1 + y2) / 2
            angulo = math.degrees(math.atan2(y2 - y1, x2 - x1))
            # Mantener el texto legible (no boca abajo)
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
        x, y = nodo["x"], nodo["y"]
        clase = "compresor" if tipo == "compresor" else "consumo"
        label = "C" if tipo == "compresor" else "P"
        svg.append(f'    <circle cx="{x}" cy="{y}" r="8" class="{clase}"/>')
        svg.append(
            f'    <text x="{x}" y="{y + 4}" text-anchor="middle" '
            f'fill="white" font-family="Arial" font-size="10" font-weight="bold">{label}</text>'
        )
    svg.append('  </g>')

    # Piezas (Codos, Tes, Cruces)
    piezas = plano.get("piezas", [])
    if piezas:
        svg.append('  <g id="piezas">')
        for pieza in piezas:
            cx, cy = pieza["x"], pieza["y"]
            tipo = pieza["tipo"]
            if tipo == "Union":
                # Cuadrado azul
                label = "U"
                sz = 14
                color = "#2196F3"
                svg.append(f'    <rect x="{cx-sz/2}" y="{cy-sz/2}" width="{sz}" height="{sz}" fill="{color}" stroke="white" stroke-width="1"/>')
            elif tipo == "Tapon":
                # Circulo rojo
                label = "X"
                color = "#F44336"
                svg.append(f'    <circle cx="{cx}" cy="{cy}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
            elif tipo == "Codo 45":
                # Rombo naranja
                label = "45"
                color = "#FF9800"
                # Un rombo se define por sus puntos (Diamante)
                pts = f"{cx},{cy-8} {cx+8},{cy} {cx},{cy+8} {cx-8},{cy}"
                svg.append(f'    <polygon points="{pts}" fill="{color}" stroke="white" stroke-width="1"/>')
            else:
                    # Círculo coloreado segun tipo
                label = "C"
                color = "#4CAF50" # Codo: Verde
                if tipo == "Te" or tipo == "Te Igual": 
                    label = "T"
                    color = "#FF9800" # Te: Naranja
                    if tipo == "Te Igual":
                        # Cuadrado para Te Igual (consistente con index.html)
                        sz = 14
                        svg.append(f'    <rect x="{cx-sz/2}" y="{cy-sz/2}" width="{sz}" height="{sz}" fill="{color}" stroke="white" stroke-width="1"/>')
                    else:
                        svg.append(f'    <circle cx="{cx}" cy="{cy}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
                elif tipo == "Te Lateral 45":
                    label = "L"
                    color = "#FF9800"
                    pts = f"{cx},{cy-8} {cx+8},{cy} {cx},{cy+8} {cx-8},{cy}"
                    svg.append(f'    <polygon points="{pts}" fill="{color}" stroke="white" stroke-width="1"/>')
                elif tipo == "Cruz": 
                    label = "+"
                    color = "#9C27B0" # Cruz: Morado
                    svg.append(f'    <circle cx="{cx}" cy="{cy}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
                else:
                    svg.append(f'    <circle cx="{cx}" cy="{cy}" r="8" fill="{color}" stroke="white" stroke-width="1"/>')
            
            svg.append(
                f'    <text x="{cx}" y="{cy}" dy="4" text-anchor="middle" '
                f'fill="white" font-family="Arial" font-size="9" font-weight="bold">{label}</text>'
            )
        svg.append('  </g>')
    
        svg.append('  </g>')
    
    # Válvulas Manuales (Añadidas desde el historial en el frontend)
    valvulas_manuales = plano.get("valvulas_manuales", [])
    if valvulas_manuales:
        svg.append('  <g id="valvulas_manuales">')
        for v in valvulas_manuales:
            cx, cy = v["x"], v["y"]
            angulo = v.get("angulo", 0)
            svg.append(f'    <g transform="translate({cx},{cy}) rotate({angulo})">')
            svg.append('      <path d="M -6 -4 L 0 0 L -6 4 Z M 6 -4 L 0 0 L 6 4 Z" fill="#FFC107" stroke="white" stroke-width="1"/>')
            svg.append('    </g>')
        svg.append('  </g>')

    # Notas / Anotaciones
    notas = plano.get("notas", [])
    if notas:
        svg.append('  <g id="notas">')
        for n in notas:
            nx, ny = n["x"], n["y"]
            txt = n["texto"]
            # Estilo similar al canvas: fondo + texto
            # Estimación simple de ancho: 7px por caracter
            estimate_w = len(txt) * 7 + 8
            svg.append(f'    <rect x="{nx}" y="{ny}" width="{estimate_w}" height="16" fill="rgba(30,30,30,0.6)" stroke="#007acc" stroke-width="0.5"/>')
            svg.append(f'    <text x="{nx+4}" y="{ny+12}" fill="black" font-family="Arial" font-size="10">{txt}</text>')
        svg.append('  </g>')

    svg.append('</svg>')
    return "\n".join(svg)
