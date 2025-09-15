# add.py
# -*- coding: utf-8 -*-
"""
Servidor Flask que expõe endpoints internos para o frontend
e serve os arquivos estáticos do frontend.
"""
from __future__ import annotations
import os
import logging
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import config
import api_client

# Configuração básica de log
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

# Cria app Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='')  # serve CSS/JS do frontend
CORS(app)  # permite chamadas do frontend local

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
    """
    Gera token de acesso usando consumer_key e consumer_secret.

    IMPORTANTE:
    - O endpoint de token correto é config.TOKEN_URL (fora do /v1).
    - api_base (v1) é apenas para as consultas de escolas.
    """
    data = request.get_json(force=True, silent=True) or {}
    consumer_key = data.get("consumer_key")
    consumer_secret = data.get("consumer_secret")
    api_base = (data.get("api_base") or config.APILIB_BASE_SANDBOX).rstrip("/")
    token_base = config.TOKEN_URL.rstrip("/")  # p.ex.: https://gateway.apilib.prefeitura.sp.gov.br/token
    grant_type = data.get("grant_type", "client_credentials")

    if not consumer_key or not consumer_secret:
        return jsonify({"ok": False, "error": "consumer_key e consumer_secret são obrigatórios"}), 400

    # registra a base da API de escolas no cliente (usada pelas buscas)
    try:
        api_client.set_base_url(api_base)
    except Exception as e:
        app.logger.warning("Falha ao setar base_url no cliente: %s", e)

    try:
        access_token = api_client.get_access_token(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            base_url=token_base,          # usa o endpoint correto de token
            grant_type=grant_type
        )
        app.logger.info("Token obtido com sucesso.")
        return jsonify({"ok": True, "access_token": access_token})
    except Exception as e:
        app.logger.exception("Erro ao obter token: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/search")
def api_search():
    """Busca escolas pelo nome (modo simples)."""
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name")
    token = data.get("token")
    base_url = (data.get("base_url") or config.APILIB_BASE_SANDBOX).rstrip("/")

    if not name:
        return jsonify({"ok": False, "error": "O campo 'name' é obrigatório"}), 400
    if not token:
        return jsonify({"ok": False, "error": "O campo 'token' é obrigatório"}), 400

    try:
        result = api_client.search_school(name, token=token, base_url=base_url)
        return jsonify({"ok": True, "data": result})
    except Exception as e:
        app.logger.exception("Erro na busca simples: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/schools")
def api_schools():
    """
    Busca escolas com múltiplos filtros.
    Espera JSON com: token (obrigatório), base_url (opcional), page, search, dre, tipoesc, distrito, bairro, subpref.
    """
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token")
    base_url = (data.get("base_url") or api_client._state.get("base_url") or config.APILIB_BASE_SANDBOX).rstrip("/")
    page = data.get("page")
    search = data.get("search")
    dre = data.get("dre")
    tipoesc = data.get("tipoesc")
    distrito = data.get("distrito")
    bairro = data.get("bairro")
    subpref = data.get("subpref")

    if not token:
        return jsonify({"ok": False, "error": "O campo 'token' é obrigatório"}), 400

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
        app.logger.exception("Erro na busca avançada: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/server/shutdown")
def shutdown_server():
    """Encerra o servidor Flask (apenas dev)"""
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        return jsonify({"ok": False, "error": "Not running with the Werkzeug Server"}), 500
    func()
    return jsonify({"ok": True, "status": "server shutting down"})

@app.post("/api/server/start")
def start_server():
    # placeholder — ajuste se for necessário checar Plesk
    return jsonify({"ok": True, "status": "running", "message": "Servidor Flask já ativo"}), 200

# -------------------------
# Executa o servidor
# -------------------------
if __name__ == "__main__":
    host = config.HOST
    port = config.PORT
    print(f"Starting Flask server on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)
# final
