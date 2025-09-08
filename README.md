inicio - README.txt
Projeto: Consulta EscolaAberta SP

Projeto: Consulta de escolas municipais de São Paulo via API EscolaAberta.

Permite buscar escolas pelo nome (com erros de digitação) e exibir informações como endereço, número e DRE, utilizando backend em Python (Flask) e frontend em HTML/JS/CSS.

1. Estrutura de Pastas

consulta-escola-sme/
│
├── backend/
│       └──__pycache__/
│       └── venv/         ← ambiente virtual (não versionar no Git)
│   ├── .env              # arquivo real usado pelo backend (não subir para Git)
│   ├── .env.example      # Exemplo de variáveis de ambiente
│   ├── add.py            # Servidor Flask principal
│   ├── api_client.py     # Cliente para API EscolaAberta
│   ├── config.py         # Configurações e variáveis de ambiente
│   ├── README_BACKEND.md       ← documentação específica do backend (opcional)
│   ├── requirements.txt       ← lista de dependências Python (opcional, mas recomendada)
│   ├── server_control.py     # NOVO: controla start/stop do add.py e verifica Plesk
│   └── utils.py          # Funções de normalização e fuzzy match
│   
├── frontend/
│   ├── index.html        # Interface do usuário
│   ├── script.js         # Lógica de frontend: conexão, busca, resultados
│   └── style.css         # Estilos e responsividade
│
├── .gitignore
├── git
└── README.md            # Este arquivo           

2. Configuração

2.1 Backend

1. Instale Python >=3.9
2. Crie um ambiente virtual (opcional, mas recomendado):

python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

3. Instale dependências:

pip install flask requests python-dotenv rapidfuzz

4. Crie um arquivo .env na pasta backend/ baseado em .env.example:

HOST=127.0.0.1
PORT=5000
HTTP_TIMEOUT=20
APILIB_BASE_PROD=http://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1
APILIB_BASE_SANDBOX=https://gateway.apilib.prefeitura.sp.gov.br/sme/EscolaAberta/v1
TOKEN_URL=https://gateway.apilib.prefeitura.sp.gov.br/token
CONSUMER_KEY=1rQmU8QENUAmUHWxnvupVUeNwPwa
CONSUMER_SECRET=Zd9fp7G41pDE8Jn6A4FsfnbKmTEa
ACCESS_TOKEN_TESTE=64c494b2-fca5-3e27-b82e-7b6f88ed5855

2.2 Frontend

- Certifique-se de que os arquivos index.html, style.css e script.js estejam na pasta frontend/.
- Não é necessário instalar nada extra para o frontend, apenas um navegador moderno.

3. Executando o projeto

3.1 Iniciar backend Flask

Na pasta backend/:

python add.py

- A aplicação estará disponível em http://127.0.0.1:5000
- Endpoint de saúde: GET /health

3.2 Abrir frontend

- Abra frontend/index.html no navegador.
- Campos e botões:

1. Chave do Consumidor: preencha com CONSUMER_KEY
2. Segredo do Consumidor: preencha com CONSUMER_SECRET
3. Token de Acesso: preenchido automaticamente ao clicar em Conectar
4. Nome da Escola: digite a escola que deseja buscar
5. Botão Conectar: gera token via backend e API
6. Botão Servidor: alterna estado do servidor (Liga/Desliga)
7. Botão Buscar: realiza busca de escola
8. Botões Apagar: limpam inputs ou resultados
9. Resultado da Busca: boxes separados com ícone de cópia 📋
10. Toast flutuante: exibe mensagens de sucesso ou erro

4. Funcionalidades

- Conexão segura com a API EscolaAberta via token Bearer
- Busca tolerante a erros de digitação (fuzzy match)
- Resultados normalizados: nome, endereço, número, DRE
- Responsivo para PC, tablet e mobile (Bootstrap + CSS custom)
- Botões intuitivos e cores distintas:
  - Conectar: vermelho → azul ao conectar
  - Busca: verde
  - Apagar: laranja
  - Copiar resultado: azul
- Toasts flutuantes para feedback visual
- Backend Flask com endpoints:
  - /api/connect → conecta na API e retorna token
  - /api/search → busca escola pelo nome
  - /api/server/shutdown → encerra servidor dev
  - /health → retorna status do servidor

5. Testando

1. Abra o frontend no navegador.
2. Clique Conectar → token será preenchido.
3. Digite o nome da escola.
4. Clique Buscar → resultados aparecerão em boxes.
5. Use 📋 para copiar os dados.
6. Clique Servidor para ligar/desligar backend local (apenas dev).

6. Observações

- Token de acesso expira em 3600 segundos; recarregar via botão Conectar se necessário.
- Sandbox e Produção podem ser alternados alterando base_url no frontend ou .env.
- Todos os erros de conexão, busca ou servidor aparecem via toast flutuante.
- Backend deve estar rodando antes de usar o frontend.

7. Licença

Este projeto é demo/teste para integração com API EscolaAberta SP.






final
