# -*- coding: utf-8 -*-
"""
Configurações de ambiente para o backend Flask.
Carrega variáveis do arquivo .env e expõe constantes de uso interno.
"""

import os

from dotenv import load_dotenv

# Carrega valores do .env (se existir)
load_dotenv()

# Host e porta do servidor Flask
PORT = int(os.getenv("PORT", "5000"))
HOST = os.getenv("HOST", "127.0.0.1")

# Timeout padrão para chamadas HTTP externas (segundos)
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "20"))

# URLs base da API EscolaAberta
APILIB_BASE_PROD = os.getenv(
    "APILIB_BASE_PROD",
    "http://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1",
)
APILIB_BASE_SANDBOX = os.getenv(
    "APILIB_BASE_SANDBOX",
    "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1",
)

# Endpoint de token OAuth2
TOKEN_URL = os.getenv(
    "TOKEN_URL",
    "https://gateway.apilib.prefeitura.sp.gov.br/token",
)

# Token opcional para rotas administrativas (/api/server/*)
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").strip()
