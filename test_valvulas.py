"""Test for Valve detection."""
from detector_valvulas import detectar_valvulas
import math

nodos = [
    {"x": 0, "y": 0, "tipo": "compresor"}, # Compressor at Origin
    {"x": 200, "y": 100, "tipo": "punto_consumo"} # Consumer at end of branch
]
lineas = [
    {"x1": 0, "y1": 0, "x2": 100, "y2": 0},        # Line 1: Comp -> Elbow
    {"x1": 100, "y1": 0, "x2": 100, "y2": 100},    # Line 2: Elbow -> Tee
    {"x1": 100, "y1": 100, "x2": 200, "y2": 100}   # Line 3: Tee -> Consumer (Drop)
]
piezas = [
    {"x": 100, "y": 0, "tipo": "Codo"}, # Elbow
    {"x": 100, "y": 100, "tipo": "Te"}, # Tee (Branch point)
]

print("Running Valve Detection...")
valvulas = detectar_valvulas(lineas, nodos, piezas)
print(f"Found {len(valvulas)} valves")

for v in valvulas:
    print(f"  Type: {v['subtipo']}, Pos: ({v['x']:.1f}, {v['y']:.1f})")

# Verify Source Valve (near 0,0)
source = next((v for v in valvulas if v["subtipo"] == "Fuente"), None)
if source:
    print(f"PASS: Source Valve found at ({source['x']:.1f}, {source['y']:.1f})")
else:
    print("FAIL: Source Valve missing")

# Verify Drop Valve (near 100,100 towards 200,100)
# Should be at 100 + 30 = 130, y=100
drop = next((v for v in valvulas if v["subtipo"] == "Bajada"), None)
if drop:
    print(f"PASS: Drop Valve found at ({drop['x']:.1f}, {drop['y']:.1f})")
else:
    print("FAIL: Drop Valve missing")

if source and drop:
    print("ALL TESTS PASSED")
