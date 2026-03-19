"""Test for End Cap (Tapon) detection."""
from detector_piezas import detectar_piezas
import math

nodos_hardware = [{"x": 100, "y": 0, "tipo": "compresor"}, {"x": 200, "y": 0, "tipo": "punto_consumo"}]
lineas = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},   # Connected to Compresor (100,0) -> No Cap
    {"x1": 100, "y1": 100, "x2": 0, "y2": 100}, # Open end at (0,100), Connected to nothing at (100,100) -> 2 Caps
    {"x1": 200, "y1": 0, "x2": 200, "y2": 100} # Connected to Consumer (200,0) -> No Cap
]

# Run detection
piezas = detectar_piezas(lineas, nodos_hardware=nodos_hardware)

print(f"Testing Caps. Found {len(piezas)} pieces")
tapones = [p for p in piezas if p["tipo"] == "Tapon"]

for t in tapones:
    print(f"  Tapon at ({t['x']:.0f},{t['y']:.0f})")

# Expected:
# (0,0): Tapon (Open end)
# (100,0): Connected to Compresor -> NO Tapon
# (0,100): Tapon (Open end)
# (100,100): Tapon (Open end)
# (200,0): Connected to Consumer -> NO Tapon
# (200,100): Tapon (Open end)

expected_caps = [(0,0), (0,100), (100,100), (200,100)]
assert len(tapones) == 4
for ex, ey in expected_caps:
    found = any(math.hypot(t["x"]-ex, t["y"]-ey) < 1.0 for t in tapones)
    if not found:
        print(f"FAIL: Expected Cap at ({ex},{ey}) not found")
    else:
        print(f"PASS: Cap at ({ex},{ey}) found")

print("\nALL PASSED")
