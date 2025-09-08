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

# ---------------------------------------------------------------------------
# Função: search_schools
#
# Permite consultar a lista de escolas utilizando diversos parâmetros de
# pesquisa (paginação, nome, DRE, tipo, distrito, bairro e subprefeitura).
# Esta função encapsula a chamada à API oficial EscolaAberta exposta pelo
# município de São Paulo. Ela monta a URL do endpoint `/api/escolas/` a
# partir da base de URL informada, inclui o token de acesso no cabeçalho e
# injeta apenas os parâmetros que estiverem preenchidos.
#
# Parâmetros:
#   token (str): Token de acesso (obrigatório).
#   base_url (str): URL base (prefixo) para a API. Se não informado,
#                   utiliza-se a URL previamente configurada via
#                   `set_base_url` ou as definições de configuração.
#   page (int|str|None): Número da página a ser consultada (opcional).
#   search (str|None): Texto de busca para o nome da escola (opcional).
#   dre (str|None): Sigla da DRE (opcional).
#   tipoesc (str|None): Tipo da escola (opcional).
#   distrito (str|None): Nome do distrito (opcional).
#   bairro (str|None): Nome do bairro (opcional).
#   subpref (str|None): Nome da subprefeitura (opcional).
#
# Retorna:
#   Dict[str, Any]: O JSON retornado pela API, conforme documentação.

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
    """Realiza consulta de escolas com múltiplos filtros."""
    base = (base_url or _state.get("base_url") or "").rstrip("/")
    if not base:
        raise RuntimeError("Base URL not configured.")
    access_token = token or _state.get("access_token")
    if not access_token:
        raise RuntimeError("Access token missing.")
    # Monta a URL do endpoint oficial. A API oficial expõe os dados em
    # `.../api/escolas/`, portanto concatenamos essa rota ao base_url.
    url = f"{base}/api/escolas/"
    headers = {"Authorization": f"Bearer {access_token}"}
    params: Dict[str, Any] = {}
    # Inclui apenas os parâmetros informados (não vazios)
    if page not in (None, ""):
        params["page"] = page
    if search:
        params["search"] = search
    if dre:
        params["dre"] = dre
    if tipoesc:
        params["tipoesc"] = tipoesc
    if distrito:
        params["distrito"] = distrito
    if bairro:
        params["bairro"] = bairro
    if subpref:
        params["subpref"] = subpref
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=config.HTTP_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as ex:
        raise RuntimeError(str(ex)) from ex
    
    
# final
