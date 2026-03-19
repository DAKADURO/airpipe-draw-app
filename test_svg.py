"""
test_svg.py — Verificación de la generación de SVG
"""
import sys
sys.path.insert(0, r"H:\DRAW 1.0")
from generador_svg import generar_svg

# Datos de prueba (ya rectificados)
plano = {
    "lineas": [
        {"x1": 0, "y1": 0, "x2": 100, "y2": 100},
        {"x1": 100, "y1": 100, "x2": 200, "y2": 100}
    ],
    "nodos": [
        {"tipo": "compresor", "x": 0, "y": 0},
        {"tipo": "consumo", "x": 200, "y": 100}
    ]
}

print("Generando SVG...")
svg = generar_svg(plano)

print(f"Longitud del SVG: {len(svg)} caracteres")
print("Primeras 5 lineas:")
print("\n".join(svg.split("\n")[:5]))

if "<svg" in svg and "</svg>" in svg:
    print("\n✓ Estructura SVG correcta")
else:
    print("\n✗ Faltan etiquetas SVG")

if "class=\"tuberia\"" in svg:
    print("✓ Clases de tubería presentes")

if "class=\"compresor\"" in svg:
    print("✓ Clases de compresor presentes")

if "viewBox=\"0 0 1920 1080\"" in svg:
    print("✓ viewBox correcto")
