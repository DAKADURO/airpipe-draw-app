
# AIRpipe — Generador de Planos para Redes de Aire Comprimido

AIRpipe es una herramienta web diseñada para facilitar el dibujo, rectificación y exportación de planos para instalaciones de aire comprimido. Su objetivo es convertir bocetos rápidos hechos en navegador en planos técnicos precisos y estandarizados.

## 🎯 Alcance del Proyecto

El sistema permite a un usuario dibujar esquemáticamente una red de tuberías y componentes (compresores, puntos de consumo) en un lienzo infinito, y automáticamente "limpia" y rectifica el dibujo para alinearlo a ejes ortogonales, uniendo conexiones cercanas. Finalmente, permite exportar el resultado a formatos universales (SVG para web/documentación y DXF para CAD).

## 🚀 Características Principales

### 1. Dibujo Inteligente (Frontend)
- **Lienzo Infinito:** Zoom y Pan (desplazamiento) fluido para trabajar en planos de cualquier tamaño.
- **Herramientas de Diseño:**
  - **Tubería:** Dibuja líneas que representan la red de aire.
  - **Compresor:** Nodo de origen (Color Gris, "C").
  - **Punto de Consumo:** Nodo final (Color Rojo, "P").
- **Asistentes de Precisión (Snapping):**
  - **Snap a Punto:** El cursor se imanta a los extremos de líneas y nodos existentes.
  - **Snap Angular:** Sugiere alineaciones a 0°, 45°, 90°, etc.
  - **Guías Inteligentes:** Muestra líneas guía cuando el cursor se alinea horizontal o verticalmente con otros elementos.
- **Grid Dinámico:** Cuadrícula de fondo que se adapta al nivel de zoom (1 celda = 1 metro).

### 2. Motor de Rectificación (Backend)
El "cerebro" del sistema, escrito en Python, procesa los datos crudos del dibujo para asegurar consistencia técnica:
- **Filtrado de Ruido:** Elimina líneas accidentales o demasiado cortas (< 10px).
- **Rectificación de Ejes:** Fuerza las líneas a ángulos canónicos (0°, 45°, 90°) si están cerca (tolerancia de 15°).
- **Fusión de Intersecciones:** Une automáticamente los extremos de líneas y nodos que están cerca (< 20px), corrigiendo errores de "dedo" o clic inexacto.

### 3. Exportación Profesional
Convierte el modelo rectificado a formatos estándar de la industria:
- **SVG (Scalable Vector Graphics):**
  - Ideal para visualización web, informes y documentación ligera.
  - Estilizado con colores técnicos (Azul=Aire, Rojo=Consumo).
  - Incluye grid de fondo paramétrico.
- **DXF (Drawing Exchange Format):**
  - Compatible con **AutoCAD**, Revit, SolidWorks, etc.
  - **Escala Real:** Configurado para que **50 píxeles = 1 metro**.
  - **Capas Organizadas:** `TUBERIAS` (Azul), `COMPRESORES` (Blanco/Gris), `CONSUMOS` (Rojo).
  - Unidades configuradas en Metros ($INSUNITS = 6).

## 🛠️ Arquitectura Técnica

### Frontend (Interfaz)
- **Tecnología:** HTML5, CSS3, JavaScript (Vanilla ES6+).
- **Canvas API:** Renderizado de alto rendimiento para el dibujo en tiempo real.
- **Sin Frameworks:** Ligero y rápido, sin dependencias externas pesadas.

### Backend (API & Lógica)
- **Servidor:** Flask (Python) exponiendo una API REST (`POST /procesar`).
- **Librerías:**
  - `ezdxf`: Generación de archivos CAD.
  - `flask-cors`: Manejo de seguridad para peticiones cruzadas.
- **Módulos:**
  - `rectificador.py`: Lógica geométrica pura (sin dependencias externas).
  - `generador_svg.py`: Renderizado XML para SVG.
  - `generador_dxf.py`: Renderizado CAD para DXF.

## 📦 Estructura de Archivos
- `index.html`: Interfaz de usuario completa.
- `canvas.js`: Lógica de interacción, dibujo y comunicación con backend.
- `app.py`: Punto de entrada del servidor web.
- `rectificador.py`: Algoritmos de corrección geométrica.
- `generador_*.py`: Módulos de exportación.

---
*Desarrollado para optimizar el flujo de diseño de ingeniería de fluidos.*
