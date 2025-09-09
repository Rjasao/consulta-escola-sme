# inicio - config.py  Rico
# -*- coding: utf-8 -*-
"""
Arquivo: config.py
Função: Carrega variáveis de ambiente para o backend.
Configura host, porta, timeout e URLs da API.
"""



import os
from dotenv import load_dotenv

# Carrega .env
load_dotenv()

# Porta do Flask
PORT = int(os.getenv("PORT", "5000"))
# Host de bind (localhost por padrão)
HOST = os.getenv("HOST", "127.0.0.1")

# Timeout padrão para requests externos (segundos)
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "20"))

# Base URLs (Produção/Sandbox)
APILIB_BASE_PROD = os.getenv(
    "APILIB_BASE_PROD",
    "http://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1"
)
APILIB_BASE_SANDBOX = os.getenv(
    "APILIB_BASE_SANDBOX",
    "https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1"
)

# Token endpoint (usado para solicitar tokens)
TOKEN_URL = os.getenv(
    "TOKEN_URL",
    "https://gateway.apilib.prefeitura.sp.gov.br/token"
)
# final
