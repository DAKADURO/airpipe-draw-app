"""
test_snap.py — Verificación del snap a 45° para una línea de ~47°
Ejecutar: python test_snap.py
"""
import sys
import math

sys.path.insert(0, r"H:\DRAW 1.0")
from rectificador import (
    rectificar_ejes,
    _angulo_grados,
    _longitud,
    _eje_mas_cercano,
    SNAP_ANGLE_TOLERANCE,
)

# ── Caso 1: línea de 47° (debe hacer snap a 45°) ──────────────────────────────
# tan(47°) ≈ 1.0724  →  x2=100, y2=107.24
linea_47 = {"x1": 0, "y1": 0, "x2": 100, "y2": 107.24}

angulo_real = _angulo_grados(linea_47)
longitud    = _longitud(linea_47)
eje         = _eje_mas_cercano(angulo_real)
diff        = min(abs(angulo_real - eje), 360 - abs(angulo_real - eje))

print("=" * 55)
print("  TEST: rectificar_ejes — snap a 45°")
print("=" * 55)
print(f"  Input:            x1=0, y1=0, x2=100, y2=107.24")
print(f"  Ángulo real:      {angulo_real:.4f}°")
print(f"  Longitud:         {longitud:.4f} px")
print(f"  Eje más cercano:  {eje}°")
print(f"  Desviación:       {diff:.4f}°  (tolerancia={SNAP_ANGLE_TOLERANCE}°)")
print()

resultado = rectificar_ejes([linea_47])
r = resultado[0]

print(f"  Output:           x1={r['x1']}, y1={r['y1']}, x2={r['x2']}, y2={r['y2']}")
print(f"  Snap aplicado:    {r.get('_snap_angulo')}°")
print(f"  Ángulo original:  {r.get('_angulo_original')}°")

dx = r["x2"] - r["x1"]
dy = r["y2"] - r["y1"]
angulo_final = math.degrees(math.atan2(dy, dx)) % 360
print(f"  Ángulo final:     {angulo_final:.6f}°")
print()
ok = abs(angulo_final - 45) < 0.001
print(f"  RESULTADO:  {'✓ SNAP A 45° CORRECTO' if ok else '✗ FALLO'}")
print()

# ── Caso 2: línea de 30° (NO debe hacer snap, desviación > 15°) ──────────────
# tan(30°) ≈ 0.5774  →  x2=100, y2=57.74
linea_30 = {"x1": 0, "y1": 0, "x2": 100, "y2": 57.74}
angulo_30 = _angulo_grados(linea_30)
eje_30    = _eje_mas_cercano(angulo_30)
diff_30   = min(abs(angulo_30 - eje_30), 360 - abs(angulo_30 - eje_30))

resultado_30 = rectificar_ejes([linea_30])
r30 = resultado_30[0]

print("=" * 55)
print("  TEST: línea de 30° — NO debe hacer snap (diff > 15°)")
print("=" * 55)
print(f"  Input:            x1=0, y1=0, x2=100, y2=57.74")
print(f"  Ángulo real:      {angulo_30:.4f}°")
print(f"  Eje más cercano:  {eje_30}°")
print(f"  Desviación:       {diff_30:.4f}°  (tolerancia={SNAP_ANGLE_TOLERANCE}°)")
snap_aplicado = "_snap_angulo" in r30
print(f"  Snap aplicado:    {snap_aplicado}")
ok2 = not snap_aplicado
print(f"  RESULTADO:  {'✓ SIN SNAP (CORRECTO)' if ok2 else '✗ FALLO — snap aplicado incorrectamente'}")
print()

# ── Caso 3: línea de 0° exacto (horizontal perfecta) ─────────────────────────
linea_0 = {"x1": 10, "y1": 50, "x2": 110, "y2": 50}
resultado_0 = rectificar_ejes([linea_0])
r0 = resultado_0[0]
angulo_0_final = math.degrees(math.atan2(r0["y2"] - r0["y1"], r0["x2"] - r0["x1"])) % 360

print("=" * 55)
print("  TEST: línea horizontal exacta (0°) — debe permanecer igual")
print("=" * 55)
print(f"  Input:   x1=10, y1=50, x2=110, y2=50")
print(f"  Output:  x1={r0['x1']}, y1={r0['y1']}, x2={r0['x2']}, y2={r0['y2']}")
ok3 = abs(angulo_0_final - 0) < 0.001 and abs(r0["y2"] - r0["y1"]) < 0.001
print(f"  RESULTADO:  {'✓ HORIZONTAL CONSERVADA' if ok3 else '✗ FALLO'}")
print()

# ── Resumen ───────────────────────────────────────────────────────────────────
total = sum([ok, ok2, ok3])
print("=" * 55)
print(f"  TOTAL: {total}/3 tests pasados")
print("=" * 55)
