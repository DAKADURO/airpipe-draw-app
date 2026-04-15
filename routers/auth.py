from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from passlib.hash import pbkdf2_sha256
from extensions import db
from models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route("/register", methods=["POST"])
def register():
    datos = request.get_json(silent=True)
    if not datos or "email" not in datos or "password" not in datos:
        return jsonify({"error": "Email y password requeridos"}), 400

    existing_user = User.query.filter_by(email=datos["email"]).first()
    if existing_user:
        return jsonify({"error": "El email ya está registrado"}), 409

    hashed = pbkdf2_sha256.hash(datos["password"])
    new_user = User(email=datos["email"], password_hash=hashed)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Usuario registrado exitosamente"}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    datos = request.get_json(silent=True)
    if not datos or "email" not in datos or "password" not in datos:
        return jsonify({"error": "Email y password requeridos"}), 400

    user = User.query.filter_by(email=datos["email"]).first()
    if user is None or not pbkdf2_sha256.verify(datos["password"], user.password_hash):
        return jsonify({"error": "Credenciales inválidas"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token, "user": {"email": user.email}}), 200
