# inicio - add.py
# add.py
# -*- coding: utf-8 -*-
"""
Servidor Flask que expõe endpoints internos para o frontend
e serve os arquivos estáticos do frontend.
"""
from __future__ import annotations
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import config
import api_client

# Cria app Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='')  # Servir CSS/JS corretamente
CORS(app)  # Permite chamadas do frontend local

# -------------------------
# Rotas do Frontend
# -------------------------
@app.route('/')
def serve_frontend():
    """Serve o index.html do frontend"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve CSS, JS e outros arquivos estáticos do frontend"""
    return send_from_directory(app.static_folder, path)


# -------------------------
# Endpoints da API
# -------------------------
@app.get("/health")
def health():
    return jsonify({"status": "ok", "server": "flask", "pid": os.getpid()})

@app.post("/api/connect")
def api_connect():
    """Gera token de acesso usando consumer_key e consumer_secret"""
    data = request.get_json(force=True, silent=True) or {}
    consumer_key = data.get("consumer_key")
    consumer_secret = data.get("consumer_secret")
    base_url = data.get("base_url", config.APILIB_BASE_SANDBOX)
    grant_type = data.get("grant_type", "client_credentials")
    
    if not consumer_key or not consumer_secret:
        return jsonify({"error": "consumer_key e consumer_secret são obrigatórios"}), 400

    try:
        access_token = api_client.get_access_token(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            base_url=base_url,
            grant_type=grant_type
        )
        return jsonify({"access_token": access_token})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/search")
def api_search():
    """Busca escolas pelo nome"""
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name")
    token = data.get("token")
    base_url = data.get("base_url", config.APILIB_BASE_SANDBOX)
    
    if not name:
        return jsonify({"error": "O campo 'name' é obrigatório"}), 400
    if not token:
        return jsonify({"error": "O campo 'token' é obrigatório"}), 400

    try:
        result = api_client.search_school(name, token=token, base_url=base_url)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Endpoint: /api/schools
#
# Permite consultar a lista de escolas utilizando múltiplos filtros de
# pesquisa. Recebe um corpo JSON contendo:
#   - token: (obrigatório) o token Bearer para autenticação.
#   - base_url: (opcional) base da API. Se omitido, utiliza config.APILIB_BASE_SANDBOX.
#   - page, search, dre, tipoesc, distrito, bairro, subpref: filtros opcionais.
#
# Este endpoint delega a chamada à função `search_schools` do módulo
# api_client e retorna o JSON diretamente ao frontend.
@app.post("/api/schools")
def api_schools():
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token")
    base_url = data.get("base_url", config.APILIB_BASE_SANDBOX)
    page = data.get("page")
    search = data.get("search")
    dre = data.get("dre")
    tipoesc = data.get("tipoesc")
    distrito = data.get("distrito")
    bairro = data.get("bairro")
    subpref = data.get("subpref")

    if not token:
        return jsonify({"error": "O campo 'token' é obrigatório"}), 400
    try:
        result = api_client.search_schools(
            token=token,
            base_url=base_url,
            page=page,
            search=search,
            dre=dre,
            tipoesc=tipoesc,
            distrito=distrito,
            bairro=bairro,
            subpref=subpref,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/server/shutdown")
def shutdown_server():
    """Encerra o servidor Flask (apenas dev)"""
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        return jsonify({"error": "Not running with the Werkzeug Server"}), 500
    func()
    return jsonify({"status": "server shutting down"})

@app.post("/api/server/start")
def start_server():
    if is_plesk_running():  # você pode implementar essa função
        return jsonify({"status": "running", "message": "Plesk já está ativo"}), 200
    return jsonify({"status": "running", "message": "Servidor Flask já ativo"}), 200

# -------------------------
# Executa o servidor
# -------------------------
if __name__ == "__main__":
    host = config.HOST
    port = config.PORT
    print(f"Starting Flask server on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)


# final
