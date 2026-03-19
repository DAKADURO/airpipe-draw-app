import base64
from flask import Blueprint, request, jsonify

processing_bp = Blueprint('processing', __name__)

@processing_bp.route("/procesar", methods=["POST"])
def procesar():
    if not request.is_json:
        return jsonify({"error": "Content-Type debe ser application/json"}), 415

    datos = request.get_json(silent=True)
    if datos is None:
        return jsonify({"error": "JSON inválido o vacío"}), 400

    from schemas import ProcesarRequest
    from pydantic import ValidationError

    try:
        req = ProcesarRequest.model_validate(datos)
    except ValidationError as e:
        return jsonify({"error": "Error de validacion en la estructura de datos", "details": e.errors()}), 422

    try:
        plano = {
            "lineas":      [l.model_dump() for l in req.lineas],
            "nodos":       [n.model_dump() for n in req.nodos],
            "valvulas_manuales": [v.model_dump() for v in (req.valvulas_manuales or [])],
            "caudal_scfm": req.caudal_scfm or 0,
            "tipo_red":    req.tipo_red or "lineal",
        }

        from rectificador import procesar_plano
        plano_procesado = procesar_plano(plano)
        
        from generador_svg import generar_svg
        svg_xml = generar_svg(plano_procesado)
        plano_procesado["svg"] = svg_xml
        
        from generador_dxf import generar_dxf
        dxf_content = generar_dxf(plano_procesado)

        if isinstance(dxf_content, str):
            dxf_b64 = base64.b64encode(dxf_content.encode('utf-8')).decode('utf-8')
        else:
            dxf_b64 = base64.b64encode(dxf_content).decode('utf-8')
             
        plano_procesado["dxf"] = dxf_b64

    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Error interno al procesar el plano: {exc}"}), 500

    return jsonify(plano_procesado), 200

@processing_bp.route("/dxf-to-json", methods=["POST"])
def dxf_to_json():
    """
    Recibe un archivo DXF y retorna una lista de líneas para el fondo.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No se proporcionó ningún archivo"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nombre de archivo vacío"}), 400
        
    try:
        content = file.read()
        from parser_dxf import dxf_a_lineas_json
        lineas = dxf_a_lineas_json(content)
        
        return jsonify({
            "status": "success",
            "count": len(lineas),
            "lines": lineas
        }), 200
    except Exception as e:
        return jsonify({"error": f"Error procesando DXF: {str(e)}"}), 500
