# inicio - api_client.py
# -*- coding: utf-8 -*-
"""
Arquivo: api_client.py
Função: Cliente para comunicação com API EscolaAberta.
Gerencia tokens, busca escolas e normaliza respostas.
"""
import requests
from typing import Any, Dict, List, Optional
import config
import utils

_state: Dict[str, Any] = {}

def set_base_url(url: str):
    """Configura a URL base da API."""
    _state["base_url"] = url.rstrip("/")

def get_access_token(
    consumer_key: str,
    consumer_secret: str,
    base_url: Optional[str] = None,
    grant_type: str = "client_credentials",
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> str:
    """Obtém token de acesso."""
    base = (base_url or _state.get("base_url") or "").rstrip("/")
    if not base:
        raise RuntimeError("Base URL not configured.")
    token_url = f"{base}/token" if not base.endswith("/token") else base
    auth = (consumer_key, consumer_secret)
    data = {"grant_type": grant_type}
    if grant_type == "password":
        if not (username and password):
            raise RuntimeError("username/password required for password grant_type")
        data["username"] = username
        data["password"] = password
    resp = requests.post(token_url, auth=auth, data=data, timeout=config.HTTP_TIMEOUT)
    resp.raise_for_status()
    payload = resp.json()
    _state.update({
        "access_token": payload.get("access_token"),
        "token_type": payload.get("token_type", "Bearer"),
        "expires_in": payload.get("expires_in"),
        "scope": payload.get("scope"),
    })
    return payload.get("access_token")

CANDIDATE_PATHS = ["/escolas", "/Escolas", "/consulta", "/buscar", "/escola"]

def _extract_items_from_response(data: Any) -> List[Dict[str, Any]]:
    """Normaliza resposta da API."""
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("items", "itens", "lista", "data", "result"):
            v = data.get(k)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        for v in data.values():
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []

def search_school(name: str, token: Optional[str] = None, base_url: Optional[str] = None) -> Dict[str, Any]:
    """Busca escola pelo nome."""
    base = (base_url or _state.get("base_url") or "").rstrip("/")
    if not base:
        raise RuntimeError("Base URL not configured.")
    access_token = token or _state.get("access_token")
    if not access_token:
        raise RuntimeError("Access token missing.")
    headers = {"Authorization": f"Bearer {access_token}"}
    last_error: Optional[str] = None
    for path in CANDIDATE_PATHS:
        url = f"{base}{path}"
        try:
            resp = requests.get(url, headers=headers, params={"nome": name}, timeout=config.HTTP_TIMEOUT)
            if resp.status_code == 404:
                last_error = f"Endpoint {path} returned 404"
                continue
            resp.raise_for_status()
            data = resp.json()
            items = _extract_items_from_response(data)
            normalized = [utils.normalize_school_item(x) for x in items]
            chosen_raw = utils.best_match(name, items)
            chosen_norm = utils.normalize_school_item(chosen_raw) if chosen_raw else None
            return {"endpoint": url, "items": normalized, "match": chosen_norm, "raw": data}
        except requests.RequestException as ex:
            last_error = str(ex)
            continue
    raise RuntimeError(last_error or "No endpoint succeeded.")
# final
