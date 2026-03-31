# ─────────────────────────────────────────────
# STAGE 1: Frontend Builder (Node.js + Vite)
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# STAGE 2: Backend + Serving (Python + Gunicorn)
# ─────────────────────────────────────────────
FROM python:3.12-slim

# Evitar la creación de __pycache__ y hacer logs instantáneos
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

WORKDIR /app

# Instalar dependencias de sistema (gcc + libpq para psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar librerías
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copiar el Código Fuente Python a la imagen
COPY . .

# INYECCIÓN CRÍTICA: Copiar el dist/ compilado desde el Stage 1 hacia el Stage 2
COPY --from=frontend-builder /app/dist /app/dist

# Crear y dar permisos a carpetas de volúmenes persistentes
RUN mkdir -p /app/server_uploads/backgrounds \
    && mkdir -p /app/instance \
    && chmod -R 777 /app/server_uploads \
    && chmod -R 777 /app/instance

# Railway inyecta $PORT dinámicamente — usar forma shell para interpolación
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 3 --timeout 120 app:app
