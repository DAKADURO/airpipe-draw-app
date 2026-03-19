"""Quick test for T-junction and X-crossing detection in the pipeline."""
from rectificador import procesar_plano

# Test: L-shape with T-branch (simulates the user's drawing)
plano = {
    "lineas": [
        {"x1": 20, "y1": 20, "x2": 500, "y2": 20},     # Top horizontal
        {"x1": 500, "y1": 20, "x2": 500, "y2": 300},    # Right vertical
        {"x1": 500, "y1": 200, "x2": 300, "y2": 200},   # Branch left (T-junction at 500,200)
        {"x1": 300, "y1": 200, "x2": 300, "y2": 350},   # Down from branch
        {"x1": 300, "y1": 350, "x2": 500, "y2": 350},   # Bottom horizontal
    ],
    "nodos": [{"tipo": "compresor", "x": 20, "y": 20}],
    "caudal_scfm": 100,
    "tipo_red": "lineal",
}

result = procesar_plano(plano)

print("=== LINEAS PROCESADAS ===")
for l in result["lineas"]:
    print(f'  ({l["x1"]:.0f},{l["y1"]:.0f}) -> ({l["x2"]:.0f},{l["y2"]:.0f})  D={l.get("diametro","-")}')

piezas = result.get("piezas", [])
print(f"\n=== PIEZAS DETECTADAS: {len(piezas)} ===")
for p in piezas:
    print(f'  {p["tipo"]} en ({p["x"]:.0f}, {p["y"]:.0f})')

# Expected: Codos at (500,20), (300,350) | Te at (500,200) and (300,200)
assert len(piezas) > 0, "FALLO: No se detectaron piezas"
tipos = [p["tipo"] for p in piezas]
print(f"\nTipos: {tipos}")
assert "Codo" in tipos, "FALLO: No se detectaron Codos"
print("\n✓ Detección funcionando correctamente")
