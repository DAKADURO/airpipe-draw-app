import os
import uuid
import base64
import json
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Project

projects_bp = Blueprint('projects', __name__, url_prefix='/projects')

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'server_uploads', 'backgrounds')
os.makedirs(UPLOADS_DIR, exist_ok=True)

def procesar_imagenes_base64(data_dict: dict) -> dict:
    if "bgBase64" in data_dict and data_dict["bgBase64"]:
        b64_str = data_dict["bgBase64"]
        if b64_str.startswith("data:image/"):
            header, encoded = b64_str.split(",", 1)
            ext = "png"
            if "jpeg" in header or "jpg" in header: ext = "jpg"
            elif "webp" in header: ext = "webp"
            
            filename = f"bg_{uuid.uuid4().hex[:8]}.{ext}"
            filepath = os.path.join(UPLOADS_DIR, filename)
            
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(encoded))
            
            data_dict["bgUrl"] = f"/server_uploads/backgrounds/{filename}"
        del data_dict["bgBase64"]
    return data_dict

@projects_bp.route("", methods=["GET"])
@jwt_required()
def list_projects():
    user_id = int(get_jwt_identity())
    proyectos = Project.query.filter_by(user_id=user_id).order_by(Project.updated_at.desc()).all()
    res = [{"id": p.id, "name": p.name, "client": p.client, "created_at": p.created_at, "updated_at": p.updated_at} for p in proyectos]
    return jsonify(res), 200

@projects_bp.route("", methods=["POST"])
@jwt_required()
def create_project():
    user_id = int(get_jwt_identity())
    datos = request.get_json(silent=True)
    if not datos or "name" not in datos or "data" not in datos:
        return jsonify({"error": "Se requiere 'name' y 'data'"}), 400

    procesada = procesar_imagenes_base64(datos["data"])

    nuevo_proyecto = Project(
        name=datos["name"],
        client=datos.get("client", ""),
        data=json.dumps(procesada),
        user_id=user_id
    )
    db.session.add(nuevo_proyecto)
    db.session.commit()

    return jsonify({"id": nuevo_proyecto.id, "message": "Proyecto guardado exitosamente"}), 201

@projects_bp.route("/<int:project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    user_id = int(get_jwt_identity())
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Proyecto no encontrado"}), 404
    
    if project.user_id != user_id:
        return jsonify({"error": "No tienes permiso para ver este proyecto"}), 403
        
    return jsonify({
        "id": project.id,
        "name": project.name,
        "client": project.client,
        "data": json.loads(project.data),
        "user_id": project.user_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at
    }), 200

@projects_bp.route("/<int:project_id>", methods=["PUT"])
@jwt_required()
def update_project(project_id):
    user_id = int(get_jwt_identity())
    datos = request.get_json(silent=True)
    if not datos or "data" not in datos:
        return jsonify({"error": "Se requiere 'data'"}), 400

    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Proyecto no encontrado"}), 404
    
    if project.user_id != user_id:
        return jsonify({"error": "No tienes permiso para modificar este proyecto"}), 403

    procesada = procesar_imagenes_base64(datos["data"])
    
    project.name = datos.get("name", project.name)
    project.client = datos.get("client", project.client)
    project.data = json.dumps(procesada)

    db.session.commit()
    return jsonify({"message": "Proyecto actualizado exitosamente"}), 200

@projects_bp.route("/<int:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(project_id):
    user_id = int(get_jwt_identity())
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    if project.user_id != user_id:
        return jsonify({"error": "No tienes permiso para eliminar este proyecto"}), 403

    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": "Proyecto eliminado"}), 200

@projects_bp.route("/<int:project_id>/delete", methods=["DELETE"])
@jwt_required()
def delete_project_alt(project_id): 
     return delete_project(project_id)

@projects_bp.route("/<int:project_id>/pdf", methods=["POST"])
@jwt_required()
def export_pdf(project_id):
    user_id = int(get_jwt_identity())
    project = db.session.get(Project, project_id)
    
    if project is None or project.user_id != user_id:
        return jsonify({"error": "No encontrado o sin permiso"}), 404
    
    try:
        datos_post = request.get_json(silent=True) or {}
        imagen_b64 = datos_post.get("imagen")
        
        project_data = json.loads(project.data)
        from rectificador import procesar_plano
        plano_procesado = procesar_plano(project_data)
        
        from detector_piezas import detectar_piezas
        from detector_valvulas import detectar_valvulas
        from generador_bom import generar_bom
        
        piezas = detectar_piezas(plano_procesado["lineas"])
        valvulas = detectar_valvulas(plano_procesado["lineas"], plano_procesado["nodos"], piezas)
        bom = generar_bom(plano_procesado["lineas"], piezas, valvulas)
        
        from generador_pdf import generar_reporte_pdf
        pdf_content = generar_reporte_pdf(
            proyecto_nombre=project.name,
            cliente=project.client,
            bom=bom,
            imagen_b64=imagen_b64
        )
        
        if isinstance(pdf_content, str):
            pdf_bytes = pdf_content.encode('latin-1')
        else:
            pdf_bytes = pdf_content

        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=Reporte_{project.name}.pdf'
        return response
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return jsonify({"error": f"Error al generar PDF: {e}", "details": error_details}), 500
