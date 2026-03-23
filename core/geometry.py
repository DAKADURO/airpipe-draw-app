import math

def project_iso(world_x: float, world_y: float, world_z: float = 0.0) -> tuple[float, float]:
    """
    Proyecta coordenadas 3D (x, y, z) a 2D Isométrico.
    Misma lógica que projectIso en js/math.js
    """
    cos30 = 0.86602540378
    iso_x = (world_x - world_y) * cos30
    iso_y = (world_x + world_y) * 0.5 - world_z
    return iso_x, iso_y
