# AIRpipe DRAW v3.0.1 — Documentación Técnica y Arquitectura

AIRpipe DRAW es una aplicación web avanzada para el diseño, dimensionamiento y cotización de redes de aire comprimido. El sistema permite a los ingenieros trazar redes en 2D o en vista isométrica (3D), calculando automáticamente las conexiones, piezas necesarias, y diámetros óptimos, para posteriormente exportar el desarrollo a formatos industriales (DXF, SVG, PDF).

---

## 🏗️ 1. Arquitectura del Sistema

El proyecto sigue una arquitectura **Cliente-Servidor (Monolito Modular)**.

### 🌐 Frontend (Cliente)
Aplicación "Single Page Application" (SPA) construida con Vanilla JavaScript modular y Canvas HTML5. No utiliza frameworks pesados (como React o Angular) para maximizar el rendimiento del renderizado de geometría pura.

*   **`js/canvas_events.js`**: El núcleo de la interacción humana. Captura eventos del ratón (Click, Movimiento, Drag & Drop), maneja las herramientas (Tubería, Borrador, Cotas, Desfase) y mantiene el hilo principal del dibujo.
*   **`js/drawing.js`**: Motor de Renderizado. Transforma los datos matemáticos virtuales en trazos visuales sobre el lienzo (Cilindros falsos isométricos, textos, iconos de válvulas y cuadrículas).
*   **`js/math.js`**: El "Cerebro Geométrico" del cliente. Se encarga de proyectar las coordenadas 3D en la pantalla 2D (Renderizado Isométrico), procesar el "Snapping" (imantación del cursor a otras líneas), y calcular vectores algebraicos interactivos.
*   **`js/state.js`**: Almacén global de estados (Patrón Singleton o Store). Mantiene el `historial` de todas las líneas dibujadas, configuraciones de cámara, zoom y variables en memoria.
*   **`js/api.js`**: Capa de comunicación asíncrona (Fetch API) encargada de enviar payloads JSON al backend, manejar la autenticación JWT y recibir binarios (PDF/DXF).
*   **`js/ui.js`**: Control del DOM HTML, inyección de variables, manejo de modales, alertas y botones del "Ribbon".

### ⚙️ Backend (Servidor)
API REST desarrollada en **Python 3** usando el framework **Flask**, respaldada por una base de datos **SQLite** (mediante SQLAlchemy) y protección vía **Flask-JWT-Extended**.

**Estructura del Backend:**
*   **`/routers`**: Archivos que exponen los Endpoints HTTP.
    *   `auth.py`: Autenticación, login y registro.
    *   `projects.py`: Plataforma de nube (CRUD) para que el usuario guarde y recupere sus diagramas, maneja inyecciones de imágenes en base 64.
    *   `processing.py`: Puente de conexión que recibe el JSON puro de la red para procesarlo en el Motor Core.
*   **`/core`**: Motor de Física y Lógica de Construcción.
    *   `rectificador.py`: Recibe el lienzo sucio y une líneas fracturadas, cruza esquinas y genera nodos limpios (Grafos geométricos).
    *   `piezas.py`: Escanea los ángulos de las líneas conectadas para decidir si se necesita un "Codo de 90°", "Codo de 45°", "Tees" o "Cruces".
    *   `dimensionador.py`: Aplica las leyes de fluidos para sugerir o calcular los milímetros del tubo en función del SCFM (Caudal) indicado.
*   **`/generators`**: Exportadores y Traductores.
    *   `generador_dxf.py`: Utiliza la librería `ezdxf` para inyectar cada tubería y pieza en capas (Layers) nativas de AutoCAD manteniendo escala real 1:1.
    *   `generador_svg.py`: Renderiza vectores planos limpios para documentos web.
    *   `generador_pdf.py`: Orquesta librerías que unen el cálculo de Lista de Materiales (BOM) con la imagen capturada para entregar un documento formal final.
*   **`models.py / schemas.py`**: Modelado ORM y Validación de las tablas de la base de datos (Project y User).

---

## 🚀 2. Capacidades de la Aplicación

### Diseño Inteligente y Visualización
*   **Motor Isométrico 2.5D**: Los usuarios pueden interactuar dibujando sobre una cuadrícula plana, pero al cambiar al Modo "3D" (`isIsometric`), el motor matemático transforma y deforma instantáneamente la cámara a ángulos isométricos, permitiendo incluir variables de "Altura" real en el Eje Z.
*   **Soporte Magnético Avanzado (Snapping)**: Al dibujar, el motor detecta automáticamente el tubo más cercano, bloquea los giros a ángulos canónicos (0°, 45°, 90°) y provee pistas visuales.
*   **Dibujo Sobre Planos Base**: El usuario puede subir un JPG, PNG o DXF como "Plantilla" o Blueprint. Se aloja bajo la cuadrícula con opacidad y escala ajustable para facilitar calcar rutas complejas.

### Modificación Quirúrgica y CAD
*   **Desfase Interactivo (Paralelas)**: Gracias a algoritmos de búsqueda profunda (BFS), con un solo clic se rastrea la totalidad de una ruta entrelazada de tubos, clonándola a paralelismos X, Y y Z precisos de forma automática.
*   **Smart Delete (Borrado Inteligente)**: Borrar un componente en el medio de la red auto-parcha inteligentemente las fisuras o recalculca la pérdida de las intersecciones.
*   **Cotas Arrastrables e Inteligentes**: Acotado arquitectónico implementado que escala su desfase visual de forma inteligente junto con el Zoom de la cámara, además de permitirle al usuario arrastrar el texto libremente sobre el plano sin corromper el diseño.

### Ingeniería Automática Pura (Back-End)
*   **Generador BOM en Tiempo Real**: Un algoritmo recorre las conexiones detectando tubos, abrazaderas, uniones (coples) de 3m/6m y contabiliza compresores y válvulas mariposa para generar una cotización industrial precisa.
*   **Dimensionamiento**: Soporte de escalamiento para dimensionar tramos de red Principal (Anillos) contra derivaciones (Tramos lineales o Bajante) de forma automática.

### Nube Segura
*   **Acceso Universal Multi-Device**: Permite trabajar el diseño en la oficina, guardarlo en la nube bajo la cuenta del instalador y abrir los "Blueprints" en modo lectura y descarga PDF directo en una Tablet.

---

## 🛠️ 3. Flujo de Datos Principal (Data Flow)

Cuando un usuario presiona **"Generar Plano"** ocurre el siguiente ciclo completo:
1. El `state.historial` (un gran Arreglo en JS con datos `{tipo: 'linea', x1:..., y1:... }`) se empaqueta en JSON.
2. `api.js` solicita una captura `Base64` del Canvas y la adjunta al payload JSON enviándola a `/processing/run`.
3. El backend recibe las "Líneas crudas" y las pasa por `core.rectificador`.
4. El Rectificador construye una Matriz de Grafo Geométrico, limpia los fragmentos superpuestos y mapea las colisiones (Uniones en Vértices).
5. Se invoca el motor de `piezas.py` evaluando la entrada/salida de cada "Nodo de unión", inyectando Objetos tipo `Codo/Te` lógicos en el JSON.
6. El Calculador de Material iterará por la geometría para generar el `BOM` final.
7. Se retorna el JSON purificado hacia el Frontend con el listado final.
8. El Frontend presenta visualmente el PDF, las cantidades, y habilita los archivos puros DXF y SVG (los cuales el backend genera al vuelo devolviendo bytes planos).

---

## 🐳 4. Deployment y Ejecución

*   **Variables de Entorno necesarias:** `JWT_SECRET_KEY`, `FLASK_APP=app.py`, entre otras listadas en la configuración.
*   **Contenedores**: Compatible y empaquetado vía `Dockerfile` y `docker-compose`.
*   **Comandos Locales**:
    ```bash
    # Crear entrono
    python -m venv .venv
    # Activar
    .venv\Scripts\activate
    # Instalar specs
    pip install -r requirements.txt
    # Ejecutar en modo desarrollo
    python app.py
    ```
La app vivirá localmente exponiendo en el puerto `5000`.
