FROM python:3.10-slim

# Evitar la creación de __pycache__ y hacer logs instantáneos
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV FLASK_APP=app.py

WORKDIR /app

# Instalar dependencias de sistema mínimas si ezdxf o algo las requiere
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar librerías
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install gunicorn

# Copiar el Código Fuente a la imagen
COPY . .

EXPOSE 5000

# Crear y dar permisos a carpetas de volúmenes persistentes
RUN mkdir -p /app/server_uploads/backgrounds \
    && mkdir -p /app/instance \
    && chmod -R 777 /app/server_uploads \
    && chmod -R 777 /app/instance

# Arrancar Gunicorn en el puerto 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]
