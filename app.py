from datetime import timedelta
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from extensions import db

# Blueprint imports
from routers.auth import auth_bp
from routers.projects import projects_bp
from routers.processing import processing_bp

app = Flask(__name__, static_folder='.')

# ── CORS ────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost,http://127.0.0.1")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

if app.debug:
    CORS(app)
else:
    CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

# ── JWT ─────────────────────────────────────────────────────────
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "airpipe-secret-key-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
jwt = JWTManager(app)

# ── Database ────────────────────────────────────────────────────
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'instance', 'app.db')}")

# Railway usa "postgres://" pero SQLAlchemy 2.x requiere "postgresql://"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
migrate = Migrate(app, db)

# ── Blueprints ──────────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(processing_bp)

# ── Auto-crear tablas en producción ─────────────────────────────
with app.app_context():
    import models  # noqa: F401 — Registra los modelos con SQLAlchemy
    db.create_all()

# ── Security Headers (producción) ──────────────────────────────
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https: wss:; img-src 'self' data: blob: https:;"
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# ── Routes ──────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    if os.environ.get("FLASK_ENV") == "production":
        return send_from_directory('dist', 'index.html')
    return send_from_directory('.', 'index.html')

@app.route("/assets/<path:filename>", methods=["GET"])
def serve_vite_assets(filename):
    if os.environ.get("FLASK_ENV") == "production":
        return send_from_directory('dist/assets', filename)
    return "Not Found", 404

@app.route("/js/<path:filename>", methods=["GET"])
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route("/server_uploads/<path:filename>", methods=["GET"])
def serve_uploads(filename):
    return send_from_directory('server_uploads', filename)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "servicio": "AIRpipe API"}), 200

# ── Entry Point ─────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
