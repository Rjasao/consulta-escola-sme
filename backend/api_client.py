# api_client.py
# -*- coding: utf-8 -*-
"""
Cliente para comunicação com API EscolaAberta.
Gerencia tokens, busca escolas e normaliza respostas.
"""
from typing import Any, Dict, List, Optional
import requests
import config

# estado interno simples
_state: Dict[str, Any] = {}

def set_base_url(url: str):
    """Configura a URL base da API de escolas (v1)."""
    if not url:
        raise RuntimeError("URL base vazia.")
    _state["base_url"] = url.rstrip("/")

def get_access_token(
    consumer_key: str,
    consumer_secret: str,
    base_url: Optional[str] = None,
    grant_type: str = "client_credentials",
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> str:
    """
    Obtém token de acesso.
    - base_url deve apontar para o endpoint de token (ex.: https://gateway.../token)
    """
    base = (base_url or _state.get("token_base") or "").rstrip("/")
    if not base:
        raise RuntimeError("Token base URL not configured.")
    token_url = f"{base}" if base.endswith("/token") else f"{base}/token"

    auth = (consumer_key, consumer_secret)
    data = {"grant_type": grant_type}
    if grant_type == "password":
        if not (username and password):
            raise RuntimeError("username/password required for password grant_type")
        data["username"] = username
        data["password"] = password

    headers = {"Accept": "application/json"}
    resp = requests.post(token_url, auth=auth, data=data, headers=headers, timeout=config.HTTP_TIMEOUT)
    resp.raise_for_status()
    payload = resp.json()

    access_token = payload.get("access_token")
    if not access_token:
        raise RuntimeError(f"Token response missing access_token: {payload}")

    # atualiza estado
    _state.update({
        "access_token": access_token,
        "token_type": payload.get("token_type", "Bearer"),
        "expires_in": payload.get("expires_in"),
        "scope": payload.get("scope"),
        "token_base": base,
    })
    return access_token

# Caminhos candidatos para busca simples por nome (fallbacks)
CANDIDATE_PATHS = ["/escolas", "/Escolas", "/consulta", "/buscar", "/escola"]

def _extract_items_from_response(data: Any) -> List[Dict[str, Any]]:
    """Normaliza resposta da API para uma lista de itens-objeto."""
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("results", "items", "itens", "lista", "data", "result"):
            v = data.get(k)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        for v in data.values():
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []

def search_school(name: str, token: Optional[str] = None, base_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Busca escola pelo nome usando caminhos candidatos (modo legacy).
    Prefira search_schools() para usar o endpoint oficial paginado.
    """
    base = (base_url or _state.get("base_url") or "").rstrip("/")
    if not base:
        raise RuntimeError("Base URL not configured.")
    access_token = token or _state.get("access_token")
    if not access_token:
        raise RuntimeError("Access token missing.")

    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
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
            return {"endpoint": url, "items": items, "raw": data}
        except requests.RequestException as ex:
            last_error = str(ex)
            continue
    raise RuntimeError(last_error or "No endpoint succeeded.")

def search_schools(
    token: str,
    base_url: Optional[str] = None,
    page: Optional[Any] = None,
    search: Optional[str] = None,
    dre: Optional[str] = None,
    tipoesc: Optional[str] = None,
    distrito: Optional[str] = None,
    bairro: Optional[str] = None,
    subpref: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Realiza consulta de escolas com múltiplos filtros no endpoint oficial:
    GET {base}/api/escolas/
    """
    base = (base_url or _state.get("base_url") or "").rstrip("/")
    if not base:
        raise RuntimeError("Base URL not configured.")
    if not token:
        raise RuntimeError("Access token missing.")

    url = f"{base}/api/escolas/"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    params: Dict[str, Any] = {}

    def add_if(k: str, v: Any):
        if v not in (None, ""):
            params[k] = v

    add_if("page", page)
    add_if("search", search)
    add_if("dre", dre)
    add_if("tipoesc", tipoesc)
    add_if("distrito", distrito)
    add_if("bairro", bairro)
    add_if("subpref", subpref)

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=config.HTTP_TIMEOUT)
        # Se falhar, incluir corpo da resposta na mensagem para depuração
        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as ex:
        raise RuntimeError(f"HTTP {resp.status_code} em {url} - detalhe: {detail}") from ex
    except requests.RequestException as ex:
        raise RuntimeError(str(ex)) from ex
# final
