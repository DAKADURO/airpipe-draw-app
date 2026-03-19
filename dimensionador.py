"""
dimensionador.py — AIRpipe
Módulo de auto-cálculo de diámetro de tubería basado en tablas de dimensionamiento.

Soporta dos tipos de red:
  - "lineal"  (open loop / tramo lineal)
  - "bucle"   (closed loop / instalación en bucle)

Las tablas provienen de estándares de dimensionamiento de tubería
para aire comprimido (Caudal SCFM vs Longitud en Pies).
"""

import math

# ─────────────────────────────────────────────
#  Constantes
# ─────────────────────────────────────────────

PIXELS_POR_METRO = 50      # Coincide con canvas.js
METROS_A_PIES = 3.28084    # 1 metro = 3.28084 pies

# Longitudes de referencia (en pies) — columnas de las tablas
LONGITUDES_REF = [50, 150, 300, 400, 500, 1000, 2000, 3000, 4000, 5000]

# Caudales de referencia (SCFM) — filas de las tablas
CAUDALES_REF_LINEAL = [10, 25, 50, 75, 100, 150, 250, 500, 750, 900, 1000, 1350, 1500, 3500, 4650, 6500, 9500]
CAUDALES_REF_BUCLE  = [10, 25, 50, 75, 100, 150, 250, 500, 750, 900, 1000, 1350, 1500, 3500, 4200, 6500, 9500]

# Diámetros nominales disponibles en orden creciente (pulgadas como strings)
DIAMETROS_DISPONIBLES = [
    '3/4"', '1"', '1 1/2"', '2"', '2 1/2"', '3"', '4"', '6"', '8"', '10"'
]

# Mapa de diámetros a valores numéricos (pulgadas) para comparaciones
DIAMETRO_A_VALOR = {
    '3/4"':    0.75,
    '1"':      1.0,
    '1 1/2"':  1.5,
    '2"':      2.0,
    '2 1/2"':  2.5,
    '3"':      3.0,
    '4"':      4.0,
    '6"':      6.0,
    '8"':      8.0,
    '10"':     10.0,
}


# ─────────────────────────────────────────────
#  Tabla de Dimensionamiento: Ramos Lineales
#  (Pies vs. SCFM)
# ─────────────────────────────────────────────
# Cada fila: caudal_scfm -> [diámetro para cada longitud en LONGITUDES_REF]

TABLA_LINEAL = {
    10:   ['3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '1"',     '1"',     '1"'    ],
    25:   ['3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"'],
    50:   ['3/4"',   '1"',     '1"',     '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2"',     '2"'    ],
    75:   ['3/4"',   '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2"',     '2"'    ],
    100:  ['1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2"',     '2 1/2"', '2 1/2"'],
    150:  ['1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '2 1/2"'],
    250:  ['1 1/2"', '1 1/2"', '2"',     '2"',     '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"'    ],
    500:  ['1 1/2"', '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"',     '4"',     '4"'    ],
    750:  ['2"',     '2 1/2"', '2 1/2"', '3"',     '3"',     '3"',     '4"',     '4"',     '4"',     '6"'    ],
    900:  ['2"',     '2 1/2"', '3"',     '3"',     '3"',     '3"',     '4"',     '6"',     '6"',     '6"'    ],
    1000: ['2"',     '2 1/2"', '3"',     '3"',     '3"',     '4"',     '4"',     '6"',     '6"',     '6"'    ],
    1350: ['2 1/2"', '2 1/2"', '3"',     '3"',     '3"',     '4"',     '6"',     '6"',     '6"',     '6"'    ],
    1500: ['2 1/2"', '3"',     '3"',     '3"',     '4"',     '4"',     '6"',     '8"',     '8"',     '8"'    ],
    3500: ['3"',     '4"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '8"',     '8"'    ],
    4650: ['3"',     '6"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '8"',     '10"'   ],
    6500: ['4"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '10"',    '10"',    '10"'   ],
    9500: ['6"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '10"',    '10"',    '10"'   ],
}


# ─────────────────────────────────────────────
#  Tabla de Dimensionamiento: Instalación en Bucle
#  (Pies vs. SCFM)
# ─────────────────────────────────────────────

TABLA_BUCLE = {
    10:   ['3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"'  ],
    25:   ['3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '3/4"',   '1"',     '1"',     '1"',     '1"'    ],
    50:   ['3/4"',   '3/4"',   '3/4"',   '3/4"',   '1"',     '1"',     '1"',     '1 1/2"', '1 1/2"', '1 1/2"'],
    75:   ['3/4"',   '3/4"',   '1"',     '1"',     '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"'    ],
    100:  ['3/4"',   '1"',     '1"',     '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"'    ],
    150:  ['3/4"',   '1"',     '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2"',     '2"'    ],
    250:  ['1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '1 1/2"', '2"',     '2"',     '2 1/2"', '2 1/2"', '2 1/2"'],
    500:  ['1 1/2"', '1 1/2"', '2"',     '2"',     '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"'    ],
    750:  ['1 1/2"', '2"',     '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"',     '3"',     '3"'    ],
    900:  ['1 1/2"', '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"',     '3"',     '4"'    ],
    1000: ['1 1/2"', '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"',     '3"',     '4"'    ],
    1350: ['2"',     '2"',     '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '4"',     '4"',     '4"',     '6"'    ],
    1500: ['2"',     '2 1/2"', '2 1/2"', '2 1/2"', '3"',     '3"',     '4"',     '4"',     '4"',     '6"'    ],
    3500: ['2 1/2"', '3"',     '3"',     '3"',     '4"',     '4"',     '6"',     '6"',     '6"',     '6"'    ],
    4200: ['3"',     '3"',     '4"',     '4"',     '4"',     '4"',     '6"',     '6"',     '6"',     '8"'    ],
    6500: ['3"',     '4"',     '6"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '8"'    ],
    9500: ['3"',     '6"',     '6"',     '6"',     '6"',     '6"',     '8"',     '8"',     '8"',     '10"'   ],
}


# ─────────────────────────────────────────────
#  Funciones de conversión
# ─────────────────────────────────────────────

def px_a_pies(longitud_px: float) -> float:
    """
    Convierte longitud en píxeles a pies.

    Cadena: px → metros (÷ PIXELS_POR_METRO) → pies (× METROS_A_PIES)
    """
    metros = longitud_px / PIXELS_POR_METRO
    return metros * METROS_A_PIES


def px_a_metros(longitud_px: float) -> float:
    """Convierte longitud en píxeles a metros."""
    return longitud_px / PIXELS_POR_METRO


# ─────────────────────────────────────────────
#  Función principal de dimensionamiento
# ─────────────────────────────────────────────

def _buscar_indice_inferior(lista: list, valor: float) -> int:
    """
    Devuelve el índice del elemento inmediatamente ≤ valor en una lista ordenada.
    Si valor es menor que el primer elemento, devuelve 0.
    Si valor es mayor o igual al último, devuelve len(lista)-1.
    """
    if valor <= lista[0]:
        return 0
    if valor >= lista[-1]:
        return len(lista) - 1

    for i in range(len(lista) - 1):
        if lista[i] <= valor < lista[i + 1]:
            return i
    return len(lista) - 1


def _diametro_mayor(d1: str, d2: str) -> str:
    """Devuelve el diámetro de mayor tamaño entre dos strings de diámetro."""
    v1 = DIAMETRO_A_VALOR.get(d1, 0)
    v2 = DIAMETRO_A_VALOR.get(d2, 0)
    return d1 if v1 >= v2 else d2


def calcular_diametro(caudal_scfm: float, longitud_pies: float, tipo_red: str = "lineal") -> str:
    """
    Calcula el diámetro nominal de tubería basándose en las tablas de
    dimensionamiento.

    Estrategia: redondear hacia arriba al valor de tabla más cercano
    (conservador — siempre elige el diámetro mayor entre los candidatos).

    Args:
        caudal_scfm:   Caudal total del sistema en SCFM.
        longitud_pies: Longitud del tramo en pies.
        tipo_red:      "lineal" o "bucle".

    Returns:
        String con el diámetro nominal, e.g. '2 1/2"'
    """
    # Seleccionar tabla y caudales de referencia según tipo de red
    if tipo_red == "bucle":
        tabla = TABLA_BUCLE
        caudales_ref = CAUDALES_REF_BUCLE
    else:
        tabla = TABLA_LINEAL
        caudales_ref = CAUDALES_REF_LINEAL

    # Asegurar valores mínimos razonables
    caudal_scfm = max(caudal_scfm, caudales_ref[0])
    longitud_pies = max(longitud_pies, LONGITUDES_REF[0])

    # Buscar caudal de referencia >= caudal_scfm (conservador: redondear arriba)
    caudal_idx = None
    for i, c in enumerate(caudales_ref):
        if c >= caudal_scfm:
            caudal_idx = i
            break
    if caudal_idx is None:
        caudal_idx = len(caudales_ref) - 1

    caudal_seleccionado = caudales_ref[caudal_idx]

    # Buscar longitud de referencia >= longitud_pies (conservador: redondear arriba)
    longitud_idx = None
    for i, l in enumerate(LONGITUDES_REF):
        if l >= longitud_pies:
            longitud_idx = i
            break
    if longitud_idx is None:
        longitud_idx = len(LONGITUDES_REF) - 1

    # Obtener diámetro de la tabla
    fila = tabla[caudal_seleccionado]
    diametro = fila[longitud_idx]

    return diametro


def dimensionar_lineas(lineas: list[dict], caudal_scfm: float, tipo_red: str = "lineal") -> list[dict]:
    """
    Asigna un diámetro a cada línea del plano basándose en la longitud TOTAL
    de la red y el caudal del sistema.

    Todas las líneas recibirán el mismo diámetro calculado para la longitud
    total equivalente.

    Modifica cada dict de línea añadiendo las claves:
      - "diametro":       diámetro nominal (string, e.g. '2 1/2"')
      - "longitud_pies":  longitud del tramo en pies
      - "longitud_metros": longitud del tramo en metros

    Args:
        lineas:       Lista de dicts con claves x1, y1, x2, y2.
        caudal_scfm:  Caudal total del sistema en SCFM.
        tipo_red:     "lineal" o "bucle".

    Returns:
        La misma lista con los campos de diámetro añadidos.
    """
    # 1. Calcular longitud total de la red (suma de todos los tramos)
    longitud_total_px = 0.0
    for linea in lineas:
        dx = linea["x2"] - linea["x1"]
        dy = linea["y2"] - linea["y1"]
        longitud_total_px += math.hypot(dx, dy)

    longitud_total_pies = px_a_pies(longitud_total_px)

    # 2. Determinar diámetro global para toda la red
    diametro_global = calcular_diametro(caudal_scfm, longitud_total_pies, tipo_red)

    # 3. Asignar diámetro global a cada línea
    for linea in lineas:
        dx = linea["x2"] - linea["x1"]
        dy = linea["y2"] - linea["y1"]
        l_px = math.hypot(dx, dy)
        l_pies = px_a_pies(l_px)
        l_metros = px_a_metros(l_px)

        linea["diametro"] = diametro_global
        linea["longitud_pies"] = round(l_pies, 2)
        linea["longitud_metros"] = round(l_metros, 2)

    return lineas
