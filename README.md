# AIRpipe — Generador de Planos v3.0.1

AIRpipe es una herramienta profesional diseñada para el dibujo, rectificación y exportación de planos de redes de aire comprimido. Convierte bocetos rápidos en planos técnicos precisos con Bill of Materials (BOM) integrado.

## 🚀 Características Principales (v3.0.1)

### 1. Diseño Inteligente y Multidimensional
- **Vista Isométrica (3D) & 2D**: Cambio dinámico entre representación plana y axonométrica.
- **Lienzo Infinito**: Sistema de navegación (Zoom/Pan) optimizado para grandes instalaciones.
- **Snapping Avanzado**: Atracción magnética a puntos existentes, ángulos canónicos (0°, 45°, 90°) y guías inteligentes.

### 2. Motor de Inteligencia Geométrica
- **Detección de Piezas**: Clasificación automática de Codos (90°/45°), Tes (Iguales/Laterales), Cruces, Uniones y Tapones.
- **Dimensionamiento Automático**: Cálculo de diámetros basado en Caudal (SCFM) y Longitud, utilizando tablas estándar de la industria.
- **Rectificación de Red**: Fusión de intersecciones y limpieza de ruido visual para un acabado profesional.
- **Borrado Inteligente**: Herramienta de borrado que respeta las uniones de la red.

### 3. Herramientas de Documentación
- **Notas y Anotaciones**: Inserción de texto directamente en el plano con persistencia en exportaciones.
- **BOM en Tiempo Real**: Generación automática de la Lista de Materiales (Tuberías, Accesorios y Válvulas).
- **Control de Fondo**: Soporte para cargar imágenes (PNG/JPG) o archivos DXF como referencia de calco.

### 4. Exportación y Nube
- **Formatos Profesionales**:
  - **DXF (AutoCAD)**: Capas organizadas (NOTAS, TUBERIAS, PIEZAS, etc.) y escala real.
  - **SVG**: Vectorial de alta calidad para web.
  - **PDF**: Reporte técnico completo con BOM e imagen del proyecto.
- **Gestión de Proyectos**: Sistema de autenticación y guardado en la nube para acceder a tus diseños desde cualquier lugar.

## 🛠️ Arquitectura del Proyecto

El proyecto sigue una estructura modular y profesional:

- `/core`: Motor lógico (Rectificador, Dimensionador, Detectores).
- `/generators`: Generadores de archivos (SVG, DXF, PDF, BOM).
- `/routers`: Endpoints de la API (Auth, Projects, Processing).
- `/js`: Frontend modular (Canvas, UI, API, Events).
- `/tests`: Suite de pruebas unitarias.

## 📦 Instalación y Uso

1. Instalar dependencias: `pip install -r requirements.txt`
2. Ejecutar servidor: `python app.py`
3. Abrir `index.html` en el navegador.

---
*AIRpipe DRAW — Eficiencia en el diseño de ingeniería de fluidos.*
