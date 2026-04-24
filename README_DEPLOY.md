# Guía de Despliegue en Railway (AIRpipe DRAW 1.0)

Para asegurar que tu aplicación no falle en Railway, hemos implementado y verificado los siguientes puntos:

### 1. Comando de Inicio (Procfile)
Se ha creado un archivo `Procfile` que le indica a Railway exactamente cómo iniciar el servidor usando **Gunicorn**. Esto evita errores de puerto y asegura que la app sea escalable.

### 2. Base de Datos Persistente
**¡IMPORTANTE!** Railway utiliza un sistema de archivos efímero. Si usas SQLite, tus proyectos se borrarán cada vez que despliegues o reinicies la app.
- **Acción:** Crea un servicio de **PostgreSQL** en Railway.
- **Configuración:** Railway inyectará automáticamente la variable `DATABASE_URL`. El código ya está preparado para detectarla y usar Postgres en lugar de SQLite.

### 3. Build de Frontend
Railway (usando Nixpacks) detectará tanto `package.json` como `requirements.txt`. Ejecutará `npm run build` automáticamente. 
- Hemos corregido la codificación de `index.html`, por lo que el comando `vite build` ya no fallará.

### 4. Variables de Entorno Recomendadas
Añade estas variables en el panel de Railway para mayor seguridad:
- `SECRET_KEY`: Una cadena larga y aleatoria.
- `JWT_SECRET_KEY`: Otra cadena aleatoria para los tokens de sesión.
- `FLASK_ENV`: set to `production`.

### 5. Librerías Actualizadas
He verificado `requirements.txt`. Se han mantenido versiones estables y modernas de:
- **ezdxf (1.4.3)**: Motor CAD.
- **Flask (3.1.3)**: Servidor web.
- **SQLAlchemy (2.0.48)**: Motor de base de datos.
- **Gunicorn (21.2.0)**: Servidor de producción.
