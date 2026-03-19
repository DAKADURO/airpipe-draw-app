"""Test for Union detection (straight lines and long segments)."""
from detector_piezas import detectar_piezas
import math

# 1. Test Straight Union (180deg)
# Line 1: (0,0)->(100,0)
# Line 2: (100,0)->(200,0)
# Expected: Union at (100,0)
lineas_rectas = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},
    {"x1": 100, "y1": 0, "x2": 200, "y2": 0}
]
piezas = detectar_piezas(lineas_rectas)
print(f"Straight Union Test: Found {len(piezas)} pieces")
for p in piezas:
    print(f"  {p['tipo']} at ({p['x']},{p['y']})")

# Nota: detectar_piezas devuelve lista. Verificar contenido.
offset = 0
found_union = False
for p in piezas:
    if p["tipo"] == "Union" and abs(p["x"] - 100) < 1:
        found_union = True
        break
if not found_union:
    print("FAIL: Straight Union not found")
else:
    print("PASS: Straight Union found")


# 2. Test Long Line Segmentation
# 19ft = ~289.56 px
# Line: (0,100)->(600,100)  (length 600 > 289.56)
# Expected: Unions at approx 290 and 580
# 600 / 289.56 = 2.07 -> 2 unions.
lineas_largas = [
    {"x1": 0, "y1": 100, "x2": 600, "y2": 100}
]
piezas_long = detectar_piezas(lineas_largas)
print(f"\nLong Line Test: Found {len(piezas_long)} pieces")
count_unions = 0
for p in piezas_long:
    print(f"  {p['tipo']} at ({p['x']:.1f},{p['y']:.1f})")
    if p["tipo"] == "Union":
        count_unions += 1

if count_unions >= 2:
    print("PASS: Long line segmented")
else:
    print(f"FAIL: Expected at least 2 unions, found {count_unions}")
