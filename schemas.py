from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any

class Linea(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    diametro: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class Nodo(BaseModel):
    tipo: str
    x: float
    y: float
    model_config = ConfigDict(extra='allow')

class ValvulaManual(BaseModel):
    x: float
    y: float
    angulo: float
    diametro: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class ProcesarRequest(BaseModel):
    lineas: List[Linea] = Field(default_factory=list)
    nodos: List[Nodo] = Field(default_factory=list)
    valvulas_manuales: Optional[List[ValvulaManual]] = Field(default_factory=list)
    tipo_red: Optional[str] = "lineal"
    caudal_scfm: Optional[float] = 0.0
    is_isometric: Optional[bool] = False
    model_config = ConfigDict(extra='allow')
