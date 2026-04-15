from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import User

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def admin_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({"error": "Acceso denegado. Se requiere rol de administrador."}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

@admin_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([{
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "is_approved": u.is_approved,
        "created_at": u.created_at
    } for u in users]), 200

@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    datos = request.get_json(silent=True)
    if not datos:
        return jsonify({"error": "Datos requeridos"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    
    if "role" in datos:
        user.role = datos["role"]
    if "is_approved" in datos:
        user.is_approved = datos["is_approved"]
    
    db.session.commit()
    return jsonify({"message": "Usuario actualizado exitosamente"}), 200

@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Usuario eliminado exitosamente"}), 200
