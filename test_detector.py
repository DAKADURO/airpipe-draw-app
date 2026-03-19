"""
test_detector.py — Verificación del módulo de detección de piezas
Ejecutar: python test_detector.py
"""
import sys
sys.path.insert(0, r"H:\DRAW 1.0")

from detector_piezas import detectar_piezas

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
print("  TEST SUITE: detector_piezas.py")
print("=" * 60)
print()

# 1. Codo 90 grados
print("── 1. Codo (90°) ──────────────────────────────────")
lineas_codo = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},    # Horizontal
    {"x1": 100, "y1": 0, "x2": 100, "y2": 100} # Vertical hacia abajo
]
piezas = detectar_piezas(lineas_codo)
piezas = [p for p in piezas if p["tipo"] != "Tapon" and p.get("angulos")] # Filtro virtuals/tapones
test("Detecta 1 pieza", len(piezas) == 1)
if len(piezas) > 0:
    p = piezas[0]
    test("Es tipo 'Codo'", p["tipo"] == "Codo")
    test("En (100, 0)", p["x"] == 100 and p["y"] == 0)

print()

# 2. Te (Tee)
print("── 2. Te (3 líneas) ───────────────────────────────")
lineas_te = [
    {"x1": 0, "y1": 0, "x2": 200, "y2": 0},    # Horizontal larga
    {"x1": 100, "y1": 0, "x2": 100, "y2": 100} # Bajada desde el medio
]
# Esto creará un nodo en (100,0) con 3 conexiones:
# - Izquierda (0,0) -> (100,0)
# - Derecha (200,0) -> (100,0)
# - Abajo (100,100) -> (100,0)
# PERO cuidado: mi detector usa endpoints. Si paso una línea larga (0->200) y una que baja desde (100),
# el sistema NO corta la línea larga automáticamente aquí. Eso lo hace `rectificador.py` (fusionar_intersecciones).
# Para este unit test, debo simular que YA está rectificado (líneas cortadas).
lineas_te_rectificada = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},    # Izquierda
    {"x1": 100, "y1": 0, "x2": 200, "y2": 0},  # Derecha
    {"x1": 100, "y1": 0, "x2": 100, "y2": 100} # Bajada
]

piezas = detectar_piezas(lineas_te_rectificada)
piezas = [p for p in piezas if p["tipo"] != "Tapon" and p.get("angulos")]
test("Detecta 1 pieza central", len(piezas) == 1)
if len(piezas) > 0:
    p = piezas[0]
    test("Es tipo 'Te Igual'", p["tipo"] in ["Te", "Te Igual"])
    test("En (100, 0)", p["x"] == 100 and p["y"] == 0)

print()

# 3. Cruz
print("── 3. Cruz (4 líneas) ─────────────────────────────")
lineas_cruz = [
    {"x1": 100, "y1": 100, "x2": 0,   "y2": 100}, # Izq
    {"x1": 100, "y1": 100, "x2": 200, "y2": 100}, # Der
    {"x1": 100, "y1": 100, "x2": 100, "y2": 0},   # Arriba
    {"x1": 100, "y1": 100, "x2": 100, "y2": 200}  # Abajo
]
piezas = detectar_piezas(lineas_cruz)
piezas = [p for p in piezas if p["tipo"] != "Tapon" and p.get("angulos")]
test("Detecta tipo 'Cruz'", len(piezas) == 1 and piezas[0]["tipo"] == "Cruz")

print()

# 4. Recta (No debe detectar pieza)
print("── 4. Recta (Unión 180°) ──────────────────────────")
lineas_recta = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},
    {"x1": 100, "y1": 0, "x2": 200, "y2": 0}
]
piezas = detectar_piezas(lineas_recta)
piezas = [p for p in piezas if p["tipo"] != "Tapon" and p.get("angulos")]
test("Detecta Union lineal 180°", len(piezas) == 1 and piezas[0]["tipo"] == "Union")

print()

print("=" * 60)
print(f"  TOTAL: {passed_tests}/{total_tests} tests pasados")
status = "✓ TODOS PASARON" if passed_tests == total_tests else "✗ HAY FALLOS"
print(f"  {status}")
print("=" * 60)
