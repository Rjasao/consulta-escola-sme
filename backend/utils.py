# inicio - utils.py
# -*- coding: utf-8 -*-
"""
Arquivo: utils.py
Função: Normalização de respostas da API e fuzzy match para nome da escola.
"""
from rapidfuzz import fuzz

CAND_KEYS = {
    "endereco": ["endereco", "Endereco", "logradouro", "Logradouro", "address"],
    "numero": ["numero", "Numero", "número", "num", "Number"],
    "dre": [
        "dre", "DRE", "diretoriaRegional", "DiretoriaRegional",
        "diretoria_regional", "regional", "Diretoria",
        "diretoria", "diretoriaRegionalDeEducacao"
    ],
    "nome": ["nome", "Nome", "escola", "Unidade", "denominacao", "school_name"]
}

def pick_first(d: dict, keys: list):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None

def normalize_school_item(item: dict) -> dict:
    """Extrai nome, endereço, número e DRE, quando possível."""
    if not isinstance(item, dict):
        return {"nome": None, "endereco": None, "numero": None, "dre": None, "raw": item}
    return {
        "nome": pick_first(item, CAND_KEYS["nome"]),
        "endereco": pick_first(item, CAND_KEYS["endereco"]),
        "numero": pick_first(item, CAND_KEYS["numero"]),
        "dre": pick_first(item, CAND_KEYS["dre"]),
        "raw": item,  # mantém o bruto para depuração
    }

def best_match(query: str, candidates: list):
    """Retorna o item com maior similaridade no campo nome."""
    if not candidates:
        return None
    scored = []
    for item in candidates:
        nome = pick_first(item, CAND_KEYS["nome"]) if isinstance(item, dict) else ""
        score = fuzz.token_sort_ratio(query or "", nome or "")
        scored.append((score, item))
    scored.sort(key=lambda t: t[0], reverse=True)
    return scored[0][1] if scored else None


# final
