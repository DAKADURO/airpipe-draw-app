import math
from detector_piezas import detectar_piezas

def test_vertical_elbow():
    # Línea 1: Riser vertical de (0,0,0) a (0,0,100)
    l1 = {"x1": 0.0, "y1": 0.0, "z1": 0.0, "x2": 0.0, "y2": 0.0, "z2": 100.0, "diametro": "3/4\""}
    
    # Línea 2: Horizontal desde el tope del riser
    l2 = {"x1": 0.0, "y1": 0.0, "z1": 100.0, "x2": 100.0, "y2": 0.0, "z2": 100.0, "diametro": "3/4\""}
    
    # Simular lo que hace rectificador (redondear a 4 decimales)
    for l in [l1, l2]:
        for k in ["x1","y1","x2","y2"]: l[k] = round(l[k], 4)

    piezas = detectar_piezas([l1, l2], is_isometric=True)
    
    print(f"Piezas detectadas ({len(piezas)}):")
    for p in piezas:
        z = p.get('z', 0)
        print(f"Tipo: {p['tipo']}, Coords: ({p['x']}, {p['y']}, {z})")

if __name__ == "__main__":
    test_vertical_elbow()
