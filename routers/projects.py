import os
import uuid
import base64
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Project
from core.storage import process_project_assets

projects_bp = Blueprint('projects', __name__, url_prefix='/projects')

@projects_bp.route("", methods=["GET"])
@jwt_required()
def list_projects():
    user_id = int(get_jwt_identity())
    proyectos = Project.query.filter_by(user_id=user_id).order_by(Project.updated_at.desc()).all()
    res = [{"id": p.id, "name": p.name, "client": p.client, "created_at": p.created_at.isoformat() if p.created_at else None, "updated_at": p.updated_at.isoformat() if p.updated_at else None} for p in proyectos]
    return jsonify(res), 200

@projects_bp.route("", methods=["POST"])
@jwt_required()
def create_project():
    user_id = int(get_jwt_identity())
    datos = request.get_json(silent=True)
    if not datos or "name" not in datos or "data" not in datos:
        return jsonify({"error": "Se requiere 'name' y 'data'"}), 400

    procesada = process_project_assets(datos["data"])

    nuevo_proyecto = Project(
        name=datos["name"],
        client=datos.get("client", ""),
        data=procesada,
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
        "data": project.data,
        "user_id": project.user_id,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None
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

    procesada = process_project_assets(datos["data"])
    
    project.name = datos.get("name", project.name)
    project.client = datos.get("client", project.client)
    project.data = procesada

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
        
        project_data = project.data
        print(f"DEBUG PDF: project_data keys: {list(project_data.keys())}")
        
        from core.rectificador import procesar_plano
        plano_procesado = procesar_plano(project_data)
        
        print(f"DEBUG PDF: plano_procesado lineas count: {len(plano_procesado.get('lineas', []))}")
        print(f"DEBUG PDF: plano_procesado piezas count: {len(plano_procesado.get('piezas', []))}")
        
        # Usar el BOM que ya calculó procesar_plano internamente
        bom = plano_procesado.get("bom", {})
        
        from generators.generador_pdf import generar_reporte_pdf
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
