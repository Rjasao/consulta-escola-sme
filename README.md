# Consulta EscolaAberta SP

Aplicação full-stack para consulta de escolas municipais de São Paulo utilizando a API Escola Aberta. O backend em Flask gerencia autenticação OAuth2 e requisições REST, enquanto o frontend em HTML/CSS/JS apresenta as informações de forma responsiva.

## Estrutura

```
consulta-escola-sme/
├── backend/
│   ├── add.py               # servidor Flask principal
│   ├── api_client.py        # cliente HTTP da API EscolaAberta
│   ├── adm_routes.py        # rotas administrativas (CRUD em usuario.json)
│   ├── config.py            # carregamento de variáveis de ambiente (.env)
│   ├── server_control.py    # utilitário para iniciar/parar add.py via PowerShell
│   ├── utils.py             # normalização e fuzzy-match
│   ├── dados/usuario.json   # base local de contatos administrativos
│   └── requirements.txt
├── frontend/
│   ├── index.html           # SPA com abas (consulta, pesquisa avançada, ADM)
│   ├── script.js            # lógica principal (token, consultas, grid/mapa)
│   ├── pesquisaue.js        # aba de pesquisa avançada, autocomplete
│   ├── adm_masks.js         # máscaras e validação de formulários ADM
│   ├── styles.css / pesquisaue.css
│   └── assets (favicon, imagens)
├── README.md                # este arquivo
└── INSTALACAO_USO.txt       # passo a passo detalhado (Windows)
```

## Requisitos

- Python 3.9+
- Pip + virtualenv (opcional)
- Navegador moderno

## Configuração do Backend

1. Entre na pasta `backend/`.
2. Crie um ambiente virtual (opcional):
   ```bash
   python -m venv venv
   venv\Scripts\activate    # Windows
   source venv/bin/activate # Linux/macOS
   ```
3. Instale dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Copie `.env.example` para `.env` e ajuste variáveis:
   ```
   HOST=127.0.0.1
   PORT=5000
   HTTP_TIMEOUT=20
   APILIB_BASE_PROD=http://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1
   APILIB_BASE_SANDBOX=https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1
   TOKEN_URL=https://gateway.apilib.prefeitura.sp.gov.br/token
   ADMIN_TOKEN=...  # opcional, protege rotas /api/server/*
   ```
   - As chaves `CONSUMER_KEY` e `CONSUMER_SECRET` são informadas pelo usuário via frontend.

## Execução

### Backend

```bash
cd backend
python add.py
```

Endpoints relevantes:
- `GET /health` — status do servidor.
- `POST /api/connect` — gera token OAuth2 (grant client_credentials).
- `POST /api/search` — busca simples com heurística legacy.
- `POST /api/schools` — busca oficial paginada com filtros.
- `POST /api/server/shutdown` — encerra servidor (exige `ADMIN_TOKEN`).

### Frontend

Abra `frontend/index.html` diretamente no navegador. A SPA inclui:
- Offcanvas lateral com filtros e painel de conexão.
- Aba principal para consulta rápida.
- Aba “Buscar Unidade Escolar” com autocomplete, múltiplas seleções e grid exportável.
- Aba “ADM” para cadastrar/remover contatos (sincroniza com `backend/dados/usuario.json`).

## Fluxo Administrativo

Rotas em `/api/adm/*` gravam dados locais em `backend/dados/usuario.json`. O formato esperado é:

```json
[
  {
    "id": "3",
    "nome": "Fulano da Silva",
    "rf": "123456-7",
    "telefone": "(11) 99999-9999"
  }
]
```

- `POST /api/adm/append` adiciona registro (campos obrigatórios: `nome`, `rf`, `telefone`).
- `GET /api/adm/list` lista itens ordenados por nome.
- `POST /api/adm/delete` remove registro pelo `id`.

IDs são numéricos, atribuídos automaticamente e persistidos. O arquivo é criado se não existir.

## Testes

Os testes unitários ficam em `backend/tests/` e utilizam `pytest`. Para executá-los:

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Os testes cobrem:
- Normalização e fuzzy-match em `utils.py`.
- Comportamento do cliente HTTP (`api_client.py`) com chamadas mockadas.

## Observações

- Tokens expiram em ~3600 segundos; gere novamente via botão “Conectar”.
- Altere o ambiente (Sandbox/Produção) ajustando `api_base` (frontend) ou `.env`.
- Proteja suas credenciais; evite versionar `.env`.
- Consulte `INSTALACAO_USO.txt` para passo a passo completo no Windows.

---

Projeto demonstrativo para integração com a API EscolaAberta — Secretaria Municipal de Educação de São Paulo.
