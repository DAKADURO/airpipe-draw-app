"""
test_dimensionador.py — Verificación del módulo de dimensionamiento
Ejecutar: python test_dimensionador.py
"""
import sys
sys.path.insert(0, r"H:\DRAW 1.0")

from dimensionador import (
    calcular_diametro,
    dimensionar_lineas,
    px_a_pies,
    px_a_metros,
    TABLA_LINEAL,
    TABLA_BUCLE,
    LONGITUDES_REF,
    CAUDALES_REF_LINEAL,
    CAUDALES_REF_BUCLE,
    PIXELS_POR_METRO,
)

total_tests = 0
passed_tests = 0


def test(nombre, condicion):
    global total_tests, passed_tests
    total_tests += 1
    if condicion:
        passed_tests += 1
        print(f"  ✓ {nombre}")
    else:
        print(f"  ✗ FALLO: {nombre}")


print("=" * 60)
print("  TEST SUITE: dimensionador.py")
print("=" * 60)
print()

# ─────────────────────────────────────────────
#  1. Conversiones
# ─────────────────────────────────────────────
print("── 1. Conversiones de unidades ──────────────────────")

test("px_a_metros(50) = 1.0m",
     abs(px_a_metros(50) - 1.0) < 0.001)

test("px_a_metros(100) = 2.0m",
     abs(px_a_metros(100) - 2.0) < 0.001)

test("px_a_pies(50) ≈ 3.28 pies (1 metro)",
     abs(px_a_pies(50) - 3.28084) < 0.01)

test("px_a_pies(500) ≈ 32.81 pies (10 metros)",
     abs(px_a_pies(500) - 32.8084) < 0.1)

print()

# ─────────────────────────────────────────────
#  2. Valores exactos de tabla lineal
# ─────────────────────────────────────────────
print("── 2. Valores exactos — Tabla Lineal ────────────────")

test("Lineal: 10 SCFM, 50' → 3/4\"",
     calcular_diametro(10, 50, "lineal") == '3/4"')

test("Lineal: 500 SCFM, 300' → 2 1/2\"",
     calcular_diametro(500, 300, "lineal") == '2 1/2"')

test("Lineal: 750 SCFM, 1000' → 3\"",
     calcular_diametro(750, 1000, "lineal") == '3"')

test("Lineal: 1500 SCFM, 2000' → 6\"",
     calcular_diametro(1500, 2000, "lineal") == '6"')

test("Lineal: 9500 SCFM, 5000' → 10\"",
     calcular_diametro(9500, 5000, "lineal") == '10"')

test("Lineal: 100 SCFM, 4000' → 2 1/2\"",
     calcular_diametro(100, 4000, "lineal") == '2 1/2"')

print()

# ─────────────────────────────────────────────
#  3. Valores exactos de tabla bucle
# ─────────────────────────────────────────────
print("── 3. Valores exactos — Tabla Bucle ─────────────────")

test("Bucle: 10 SCFM, 50' → 3/4\"",
     calcular_diametro(10, 50, "bucle") == '3/4"')

test("Bucle: 500 SCFM, 300' → 2\"",
     calcular_diametro(500, 300, "bucle") == '2"')

test("Bucle: 750 SCFM, 1000' → 2 1/2\"",
     calcular_diametro(750, 1000, "bucle") == '2 1/2"')

test("Bucle: 1500 SCFM, 2000' → 4\"",
     calcular_diametro(1500, 2000, "bucle") == '4"')

test("Bucle: 9500 SCFM, 5000' → 10\"",
     calcular_diametro(9500, 5000, "bucle") == '10"')

print()

# ─────────────────────────────────────────────
#  4. Bucle da diámetros menores que lineal
# ─────────────────────────────────────────────
print("── 4. Bucle vs Lineal (bucle ≤ lineal) ──────────────")

from dimensionador import DIAMETRO_A_VALOR

casos_comparacion = [
    (500, 500),
    (750, 1000),
    (1000, 2000),
    (1500, 3000),
]

for caudal, longitud in casos_comparacion:
    d_lineal = calcular_diametro(caudal, longitud, "lineal")
    d_bucle  = calcular_diametro(caudal, longitud, "bucle")
    v_lineal = DIAMETRO_A_VALOR[d_lineal]
    v_bucle  = DIAMETRO_A_VALOR[d_bucle]
    test(f"{caudal} SCFM, {longitud}': bucle({d_bucle}) ≤ lineal({d_lineal})",
         v_bucle <= v_lineal)

print()

# ─────────────────────────────────────────────
#  5. Interpolación conservadora (redondeo arriba)
# ─────────────────────────────────────────────
print("── 5. Interpolación conservadora ────────────────────")

# Caudal entre 100 y 150, debería usar 150 (arriba)
d = calcular_diametro(120, 500, "lineal")
d_150 = calcular_diametro(150, 500, "lineal")
test("120 SCFM redondea a 150 SCFM",
     d == d_150)

# Longitud entre 150 y 300, debería usar 300 (arriba)
d = calcular_diametro(500, 200, "lineal")
d_300 = calcular_diametro(500, 300, "lineal")
test("200' redondea a 300'",
     d == d_300)

print()

# ─────────────────────────────────────────────
#  6. Valores extremos
# ─────────────────────────────────────────────
print("── 6. Valores extremos ──────────────────────────────")

test("Caudal ultra bajo (1 SCFM) → al menos 3/4\"",
     calcular_diametro(1, 50, "lineal") == '3/4"')

test("Caudal ultra alto (15000 SCFM) → 10\" (max tabla)",
     calcular_diametro(15000, 5000, "lineal") == '10"')

test("Longitud ultra corta (5') → usa 50' (mínima tabla)",
     calcular_diametro(500, 5, "lineal") == calcular_diametro(500, 50, "lineal"))

print()

# ─────────────────────────────────────────────
#  7. dimensionar_lineas (batch)
# ─────────────────────────────────────────────
print("── 7. dimensionar_lineas (batch) ────────────────────")

# Crear una línea de 500px = 10 metros ≈ 32.8 pies
# Otra de 2500px = 50 metros ≈ 164 pies
# Total = 60m ≈ 196.8 pies
# Caudal = 500 SCFM
# Tabla Lineal 500 SCFM: 150'->2", 300'->2 1/2".
# Como 196.8 > 150, debe ser 2 1/2".

lineas_test = [
    {"x1": 0, "y1": 0, "x2": 500, "y2": 0},   # 10m
    {"x1": 0, "y1": 0, "x2": 0, "y2": 2500},  # 50m
]

resultado = dimensionar_lineas(lineas_test, 500, "lineal")

test("Línea 1 tiene campo 'diametro'",
     "diametro" in resultado[0])

test("Línea 2 tiene campo 'diametro'",
     "diametro" in resultado[1])

d1 = resultado[0]["diametro"]
d2 = resultado[1]["diametro"]

print(f"  Diámetro Línea 1: {d1}")
print(f"  Diámetro Línea 2: {d2}")

test("Ambas líneas tienen el MISMO diámetro (lógica de red completa)",
     d1 == d2)

test("Diámetro calculado es 2 1/2\" (para total ~197')",
     d1 == '2 1/2"')

print()

# ─────────────────────────────────────────────
#  Resumen
# ─────────────────────────────────────────────
print("=" * 60)
print(f"  TOTAL: {passed_tests}/{total_tests} tests pasados")
status = "✓ TODOS PASARON" if passed_tests == total_tests else "✗ HAY FALLOS"
print(f"  {status}")
print("=" * 60)
