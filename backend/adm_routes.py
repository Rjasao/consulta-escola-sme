# backend/adm_routes.py
import json
import os
import threading
from flask import Blueprint, request, jsonify

adm_bp = Blueprint("adm", __name__)

_LOCK = threading.Lock()


def _data_path():
    """Retorna o caminho absoluto de backend/dados/usuario.json."""
    base_dir = os.path.dirname(os.path.abspath(__file__))  # .../backend
    data_dir = os.path.join(base_dir, "dados")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "usuario.json")


def _write_items_unlocked(path, items):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=2)


def _ensure_item_ids(items):
    """Garante IDs únicos persistentes para cada registro."""
    changed = False
    used = set()

    for item in items:
        current = str(item.get("id", "")).strip()
        if current.isdigit() and current not in used:
            used.add(current)
        else:
            item.pop("id", None)

    next_id = 1

    def _assign_new(item):
        nonlocal next_id, changed
        while True:
            candidate = str(next_id)
            next_id += 1
            if candidate not in used:
                item["id"] = candidate
                used.add(candidate)
                changed = True
                break

    for item in items:
        if "id" not in item:
            _assign_new(item)
        else:
            try:
                next_id = max(next_id, int(item["id"]) + 1)
            except ValueError:
                _assign_new(item)
    return changed


def _load_items_unlocked(path):
    """Carrega registros existentes do JSON sem adquirir o lock global."""
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return []

    items = []
    if isinstance(data, list):
        for entry in data:
            if not isinstance(entry, dict):
                continue
            nome = str(entry.get("nome", "")).strip()
            rf = str(entry.get("rf", "")).strip()
            telefone = str(entry.get("telefone", "")).strip()
            if nome and rf and telefone:
                items.append(
                    {
                        "id": str(entry.get("id", "")).strip(),
                        "nome": nome,
                        "rf": rf,
                        "telefone": telefone,
                    }
                )
    if _ensure_item_ids(items):
        _write_items_unlocked(path, items)
    return items


@adm_bp.route("/api/adm/append", methods=["POST"])
def adm_append():
    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    rf = (data.get("rf") or "").strip()
    telefone = (data.get("telefone") or "").strip()

    if not nome or not rf or not telefone:
        return jsonify({"ok": False, "error": "Campos obrigatórios: nome, rf, telefone"}), 400

    path = _data_path()
    with _LOCK:
        items = _load_items_unlocked(path)
        try:
            next_id = max(int(item.get("id", "0") or 0) for item in items) + 1
        except ValueError:
            next_id = len(items) + 1
        items.append({"id": str(next_id), "nome": nome, "rf": rf, "telefone": telefone})
        _write_items_unlocked(path, items)

    return jsonify({"ok": True})


@adm_bp.route("/api/adm/list", methods=["GET"])
def adm_list():
    path = _data_path()
    with _LOCK:
        items = _load_items_unlocked(path)
    items_sorted = sorted(items, key=lambda x: x["nome"].lower())
    return jsonify({"items": items_sorted})


@adm_bp.route("/api/adm/delete", methods=["POST"])
def adm_delete():
    data = request.get_json(silent=True) or {}
    record_id = str(data.get("id", "")).strip()
    if not record_id:
        return jsonify({"ok": False, "error": "ID inválido."}), 400

    path = _data_path()
    with _LOCK:
        items = _load_items_unlocked(path)
        new_items = [item for item in items if item.get("id") != record_id]
        if len(new_items) == len(items):
            return jsonify({"ok": False, "error": "Registro não encontrado."}), 404
        _write_items_unlocked(path, new_items)
    return jsonify({"ok": True})
