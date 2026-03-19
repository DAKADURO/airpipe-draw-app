
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from detector_piezas import detectar_piezas

def test_lateral_te():
    print("Testing 45° Lateral Tee Detection...")
    
    # Simulate a lateral tee at (100, 100)
    # Line 1: Main line left (0, 100) to (100, 100) -> angle 0 at node
    # Line 2: Main line right (100, 100) to (200, 100) -> angle 180 at node
    # Line 3: 45 degree branch (100, 100) to (150, 150) -> angle 45 at node
    
    lineas = [
        {"x1": 0, "y1": 100, "x2": 100, "y2": 100, "diametro": "50mm"},
        {"x1": 100, "y1": 100, "x2": 200, "y2": 100, "diametro": "50mm"},
        {"x1": 100, "y1": 100, "x2": 150, "y2": 150, "diametro": "50mm"}
    ]
    
    piezas = detectar_piezas(lineas)
    
    print(f"Detected pieces: {len(piezas)}")
    for p in piezas:
        print(f"  - Type: {p['tipo']} at ({p['x']}, {p['y']})")
        
    te_pieces = [p for p in piezas if p['tipo'] == "Te Lateral 45"]
    
    if len(te_pieces) > 0:
        print("\nSUCCESS: 45° Lateral Tee detected!")
    else:
        print("\nFAILURE: 45° Lateral Tee NOT detected.")

if __name__ == "__main__":
    test_lateral_te()
