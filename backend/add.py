# add.py
# -*- coding: utf-8 -*-
"""
Servidor Flask que expoe endpoints internos para o frontend
e serve os arquivos estaticos do frontend.
"""
from __future__ import annotations
import os
import logging
import secrets
import json
import re
import shutil
from typing import Optional
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import config
import api_client
from adm_routes import adm_bp
import reporting

try:
    import win32ui
    import win32con
except ImportError:
    win32ui = None  # type: ignore
    win32con = None  # type: ignore

# Configuracao basica de log
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
LOGGER = logging.getLogger(__name__)

# Cria app Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='')  # serve CSS/JS do frontend
CORS(app)  # permite chamadas do frontend local
app.register_blueprint(adm_bp)


def _validate_admin_token():
    expected = getattr(config, "ADMIN_TOKEN", "") or ""
    if not expected:
        return False, "ADMIN_TOKEN nao configurado no servidor."
    provided = (request.headers.get("X-Admin-Token") or request.args.get("admin_token", "")).strip()
    if not provided:
        return False, "Token administrativo ausente."
    try:
        if secrets.compare_digest(provided, expected):
            return True, ""
    except Exception:
        pass
    return False, "Token administrativo invalido."

def _clean_string(value):
    if value is None:
        return ""
    return str(value).strip()


def _filename_safe(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]+', "", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned.rstrip(".")
    return cleaned


def _build_pdf_filename(users: list[dict[str, str]], data_saida: str) -> str:
    primary_name = ""
    if users:
        primary_name = _clean_string(users[0].get("nome"))
    if not primary_name:
        primary_name = "ficha"
    date_part = _clean_string(data_saida) or datetime.utcnow().date().isoformat()
    base = f"{primary_name} - {date_part}".strip()
    safe_base = _filename_safe(base) or "ficha"
    return f"{safe_base}.pdf"


def _sanitize_relative_path(raw_value: str) -> str:
    cleaned = raw_value.replace("\\", "/")
    parts: list[str] = []
    for fragment in cleaned.split("/"):
        frag = fragment.strip()
        if not frag or frag in {".", ".."}:
            continue
        safe = _filename_safe(frag)
        if safe:
            parts.append(safe)
    return "/".join(parts)


def _prompt_pdf_destination(default_filename: str, initial_dir: str) -> str:
    if win32ui is None or win32con is None:
        return ""
    try:
        dlg = win32ui.CreateFileDialog(
            0,
            "pdf",
            default_filename,
            win32con.OFN_OVERWRITEPROMPT | win32con.OFN_EXPLORER,
            "PDF (*.pdf)|*.pdf||",
        )
        dlg.SetOFNInitialDir(initial_dir)
        if dlg.DoModal() == win32con.IDOK:
            return dlg.GetPathName()
    except Exception as exc:
        LOGGER.warning("Falha ao abrir dialogo de salvamento de PDF: %s", exc)
    return ""


def _resolve_pdf_destination(
    users: list[dict[str, str]],
    data_saida: str,
    pdf_save_path: str,
    dados_dir: str,
) -> tuple[str, str, str, Optional[str]]:
    base_filename = _build_pdf_filename(users, data_saida)
    rel_path = base_filename
    dados_abs = os.path.abspath(dados_dir)

    extra_copy_path: Optional[str] = None

    if pdf_save_path:
        candidate = pdf_save_path.strip().strip('"')
        if os.path.isabs(candidate):
            target_abs = os.path.normpath(candidate)
            if not target_abs.lower().endswith(".pdf"):
                target_abs += ".pdf"
            if target_abs.startswith(dados_abs):
                rel_path = os.path.relpath(target_abs, dados_abs).replace("\\", "/")
            else:
                extra_copy_path = target_abs
        else:
            sanitized = _sanitize_relative_path(candidate)
            if sanitized:
                if not sanitized.lower().endswith(".pdf"):
                    sanitized = sanitized.rstrip("/")
                    sanitized = f"{sanitized}/{base_filename}" if sanitized else base_filename
                rel_path = sanitized

    rel_path = rel_path.replace("\\", "/")
    abs_path = os.path.normpath(os.path.join(dados_dir, rel_path))
    if not abs_path.startswith(dados_abs):
        raise RuntimeError("Caminho informado para salvar o PDF e invalido.")

    return abs_path, rel_path, os.path.basename(abs_path), extra_copy_path


def _next_available_prefixed_path(path: str, prefix: str = "2-") -> str:
    directory, filename = os.path.split(path)
    base_name = filename
    candidate = os.path.join(directory, f"{prefix}{base_name}")
    if not os.path.exists(candidate):
        return candidate
    counter = 2
    while True:
        candidate = os.path.join(directory, f"{counter}-{base_name}")
        if not os.path.exists(candidate):
            return candidate
        counter += 1


def _handle_existing_path(path: str, prompt_user: bool = True) -> tuple[str, bool]:
    """
    Se o arquivo existir, pergunta se deve sobrescrever ou criar uma copia com prefixo.
    Retorna caminho final e flag indicando se o nome foi alterado.
    """
    if not os.path.exists(path):
        return path, False

    directory, filename = os.path.split(path)
    alt_path = _next_available_prefixed_path(path, prefix="2-")

    if win32ui is not None and win32con is not None and prompt_user:
        message = (
            f"O arquivo '{filename}' ja existe em:\n{directory}\n\n"
            f"Sim: substituir o arquivo existente.\n"
            f"Nao: salvar como '{os.path.basename(alt_path)}'.\n"
            "Cancelar: cancelar a operacao."
        )
        choice = win32ui.MessageBox(message, "Salvar ficha PDF", win32con.MB_ICONQUESTION | win32con.MB_YESNOCANCEL)
        if choice == win32con.IDYES:
            return path, False
        if choice == win32con.IDNO:
            return alt_path, True
        raise RuntimeError("Operacao cancelada pelo usuario.")

    # Sem interacao (ou pywin32 ausente): usa nome alternativo automaticamente
    return alt_path, True

# -------------------------
# Rotas do Frontend
# -------------------------
@app.get('/dados/usuario.json')
def dados_usuario():
    base_dir = os.path.dirname(__file__)  # .../backend
    dados_dir = os.path.join(base_dir, 'dados')
    return send_from_directory(dados_dir, 'usuario.json', mimetype='application/json')

@app.get('/dados/pdfs/<path:filename>')
def dados_ficha_pdf(filename):
    base_dir = os.path.dirname(__file__)
    dados_dir = os.path.join(base_dir, 'dados')
    return send_from_directory(dados_dir, filename, mimetype='application/pdf')

@app.get('/backend/dados/<path:filename>')
def backend_dados(filename):
    """Serve arquivos da pasta backend/dados (ex.: CadUE.json)."""
    base_dir = os.path.dirname(__file__)
    dados_dir = os.path.join(base_dir, 'dados')
    return send_from_directory(dados_dir, filename)

@app.route('/')
def serve_frontend():
    """Serve o index.html do frontend"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve CSS, JS e outros arquivos estaticos do frontend"""
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
    - O endpoint de token correto e config.TOKEN_URL (fora do /v1).
    - api_base (v1) e apenas para as consultas de escolas.
    """
    data = request.get_json(force=True, silent=True) or {}
    consumer_key = data.get("consumer_key")
    consumer_secret = data.get("consumer_secret")
    api_base = (data.get("api_base") or config.APILIB_BASE_SANDBOX).rstrip("/")
    token_base = config.TOKEN_URL.rstrip("/")  # p.ex.: https://gateway.apilib.prefeitura.sp.gov.br/token
    grant_type = data.get("grant_type", "client_credentials")

    if not consumer_key or not consumer_secret:
        return jsonify({"ok": False, "error": "consumer_key e consumer_secret sao obrigatorios"}), 400

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
        return jsonify({"ok": False, "error": "O campo 'name' e obrigatorio"}), 400
    if not token:
        return jsonify({"ok": False, "error": "O campo 'token' e obrigatorio"}), 400

    try:
        result = api_client.search_school(name, token=token, base_url=base_url)
        return jsonify({"ok": True, "data": result})
    except Exception as e:
        app.logger.exception("Erro na busca simples: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/schools")
def api_schools():
    """
    Busca escolas com multiplos filtros.
    Espera JSON com: token (obrigatorio), base_url (opcional), page, search, dre, tipoesc, distrito, bairro, subpref.
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
        return jsonify({"ok": False, "error": "O campo 'token' e obrigatorio"}), 400

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
        app.logger.exception("Erro na busca avancada: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/export/pdf-json")
def export_pdf_json():
    """Recebe dados da aba de pesquisa e persiste em backend/dados/pdf.json."""
    data = request.get_json(force=True, silent=True) or {}

    raw_schools = data.get("unidades") or []
    if not isinstance(raw_schools, list):
        return jsonify({"ok": False, "error": "Campo 'unidades' invalido."}), 400

    schools: list[dict[str, str]] = []
    for entry in raw_schools:
        if not isinstance(entry, dict):
            continue
        nome = _clean_string(entry.get("nome") or entry.get("nomesc"))
        if not nome:
            continue
        schools.append({
            "nome": nome,
            "endereco": _clean_string(entry.get("endereco")),
            "tipo": _clean_string(entry.get("tipo") or entry.get("tipoesc")),
            "dre": _clean_string(entry.get("dre")),
            "codesc": _clean_string(entry.get("codesc")),
        })

    if not schools:
        return jsonify({"ok": False, "error": "Nenhuma unidade valida informada."}), 400

    raw_users = data.get("usuarios") or []
    users: list[dict[str, str]] = []
    if isinstance(raw_users, list):
        for entry in raw_users:
            if not isinstance(entry, dict):
                continue
            nome = _clean_string(entry.get("nome"))
            if not nome:
                continue
            users.append({
                "nome": nome,
                "rf": _clean_string(entry.get("rf")),
                "telefone": _clean_string(entry.get("telefone")),
            })

    percurso_lista = []
    for value in data.get("percurso_lista") or []:
        cleaned = _clean_string(value)
        if cleaned and cleaned not in percurso_lista:
            percurso_lista.append(cleaned)
    percurso = _clean_string(data.get("percurso") or (percurso_lista[0] if percurso_lista else ""))

    document = {
        "gerado_em": data.get("gerado_em") or datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "unidades": schools,
        "usuarios": users,
        "data_saida": _clean_string(data.get("data_saida")),
        "hora_saida": _clean_string(data.get("hora_saida")),
        "hora_retorno": _clean_string(data.get("hora_retorno")),
        "percurso": percurso,
        "percurso_lista": percurso_lista,
        "justificativa": _clean_string(data.get("justificativa")),
        "observacoes": _clean_string(data.get("observacoes")),
    }

    dados_dir = os.path.join(os.path.dirname(__file__), "dados")
    os.makedirs(dados_dir, exist_ok=True)
    target_path = os.path.join(dados_dir, "pdf.json")

    try:
        with open(target_path, "w", encoding="utf-8") as fh:
            json.dump(document, fh, ensure_ascii=False, indent=2)
    except OSError as exc:
        app.logger.exception("Erro ao salvar pdf.json: %s", exc)
        return jsonify({"ok": False, "error": "Erro ao salvar pdf.json"}), 500

    workbook_path = os.path.join(dados_dir, "ficha.xlsx")
    default_pdf_filename = _build_pdf_filename(users, document["data_saida"])
    pdf_save_path = _clean_string(data.get("pdf_save_path"))
    if not pdf_save_path:
        selected = _prompt_pdf_destination(default_pdf_filename, dados_dir)
        if not selected:
            return jsonify({"ok": False, "error": "Operacao cancelada pelo usuario."}), 400
        pdf_save_path = selected

    dados_abs = os.path.abspath(dados_dir)
    dados_norm = os.path.normcase(dados_abs)
    extra_copy_path: Optional[str] = None
    try:
        pdf_output, _, pdf_filename, extra_copy_path = _resolve_pdf_destination(
            users=users,
            data_saida=document["data_saida"],
            pdf_save_path=pdf_save_path,
            dados_dir=dados_dir,
        )
        pdf_output, _ = _handle_existing_path(pdf_output, prompt_user=True)
        pdf_output = os.path.abspath(pdf_output)
        if extra_copy_path:
            extra_copy_path, _ = _handle_existing_path(extra_copy_path, prompt_user=True)
            extra_copy_path = os.path.abspath(extra_copy_path)
    except RuntimeError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    try:
        reporting.update_ficha_and_export(
            json_path=target_path,
            workbook_path=workbook_path,
            pdf_output_path=pdf_output,
        )
        if extra_copy_path and os.path.normcase(extra_copy_path) != os.path.normcase(pdf_output):
            try:
                os.makedirs(os.path.dirname(extra_copy_path) or ".", exist_ok=True)
                shutil.move(pdf_output, extra_copy_path)
                pdf_output = extra_copy_path
                pdf_filename = os.path.basename(pdf_output)
                extra_copy_path = None
            except OSError as copy_exc:
                LOGGER.warning("Nao foi possivel mover PDF para %s: %s", extra_copy_path, copy_exc)
    except Exception as exc:
        app.logger.exception("Erro ao gerar ficha em PDF: %s", exc)
        error_msg = "Erro ao gerar o PDF da ficha."
        if isinstance(exc, RuntimeError) and "pywin32" in str(exc).lower():
            error_msg += " Verifique se a dependencia pywin32 esta instalada."
        return jsonify({"ok": False, "error": error_msg}), 500

    pdf_output = os.path.abspath(pdf_output)
    pdf_filename = os.path.basename(pdf_output)
    inside_dados = os.path.normcase(pdf_output).startswith(dados_norm)
    if inside_dados:
        pdf_rel_display = os.path.relpath(pdf_output, dados_abs).replace("\\", "/")
        pdf_link = f"/dados/pdfs/{pdf_rel_display}"
    else:
        pdf_rel_display = pdf_output
        pdf_link = None

    success_msg = f"PDF gerado com sucesso em {pdf_rel_display}."

    return jsonify({
        "ok": True,
        "path": "/dados/pdf.json",
        "pdf": pdf_link,
        "pdf_filename": pdf_filename,
        "pdf_copy": extra_copy_path,
        "message": success_msg
    })

@app.post("/api/server/shutdown")
def shutdown_server():
    """Encerra o servidor Flask (apenas dev)"""
    authorized, error_msg = _validate_admin_token()
    if not authorized:
        return jsonify({"ok": False, "error": error_msg}), 403
    func = request.environ.get("werkzeug.server.shutdown")
    if func is None:
        return jsonify({"ok": False, "error": "Not running with the Werkzeug Server"}), 500
    func()
    return jsonify({"ok": True, "status": "server shutting down"})


@app.post("/api/server/start")
def start_server():
    """Endpoint administrativo para verificar o status do servidor."""
    authorized, error_msg = _validate_admin_token()
    if not authorized:
        return jsonify({"ok": False, "error": error_msg}), 403
    return jsonify({"ok": True, "status": "running", "message": "Servidor Flask ja ativo"}), 200

# -------------------------
# Executa o servidor
# -------------------------
if __name__ == "__main__":
    host = config.HOST
    port = config.PORT
    print(f"Starting Flask server on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)
# final

