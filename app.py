import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from extensions import db

# Blueprint imports
from routers.auth import auth_bp
from routers.projects import projects_bp
from routers.processing import processing_bp

app = Flask(__name__, static_folder='.')

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost,http://127.0.0.1")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

if app.debug:
    CORS(app)
else:
    CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "airpipe-secret-key-change-me")
jwt = JWTManager(app)

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(processing_bp)

@app.route("/", methods=["GET"])
def index():
    return send_from_directory('.', 'index.html')

@app.route("/js/<path:filename>", methods=["GET"])
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route("/server_uploads/<path:filename>", methods=["GET"])
def serve_uploads(filename):
    return send_from_directory('server_uploads', filename)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "servicio": "AIRpipe API"}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
