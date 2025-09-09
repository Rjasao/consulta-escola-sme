Aplicativo: Backend Controller
==============================

Este aplicativo é um utilitário externo para controlar o backend Flask do projeto 
"consulta-escola-sme", sem precisar abrir o terminal.

Ele fornece uma interface gráfica simples com um botão Liga (azul) / Desliga (vermelho).

------------------------------------------------------------
1. Estrutura
------------------------------------------------------------
controller_app/
│
├── backend_controller.py     # código fonte em Python (Tkinter)
├── backend_controller.spec   # config do PyInstaller
├── build/                    # pasta temporária criada pelo PyInstaller
├── dist/
│   └── BackendController.exe # 🚀 executável pronto para uso
└── README.txt                # este manual

------------------------------------------------------------
2. Uso rápido
------------------------------------------------------------

1. Abra `dist/BackendController.exe`
2. Status inicial: "Desligado" (botão vermelho)
3. Clique no botão:
   - 🔵 Azul → Backend rodando (iniciado por este app)
   - 🔴 Vermelho → Backend parado
   - "Ligado (externo)" → Backend já estava rodando (ex.: via Plesk)

4. Botão "Abrir no navegador" → abre http://127.0.0.1:5000 no navegador padrão.

⚠️ O app **só consegue desligar** o backend se ele tiver sido iniciado por ele mesmo.
Se o backend estiver rodando via **Plesk** ou outro serviço, o app apenas detecta e mostra o status.

------------------------------------------------------------
3. Requisitos
------------------------------------------------------------
- Python 3.9 ou superior
- Bibliotecas: `psutil`, `tkinter` (já incluso no Python)

Para instalar psutil:

    pip install psutil

------------------------------------------------------------
4. Gerando o .exe novamente
------------------------------------------------------------

1. Ative o ambiente virtual do backend:

    venv\Scripts\activate      # Windows
    source venv/bin/activate   # Linux/Mac

2. Instale o PyInstaller (se não tiver):

    pip install pyinstaller

3. Rode o comando:

    pyinstaller --onefile --noconsole --name BackendController backend_controller.py

4. O executável ficará disponível em:

    dist/BackendController.exe

------------------------------------------------------------
5. Observações
------------------------------------------------------------
- O app detecta automaticamente se a porta 5000 já estiver ocupada.
- Se o backend estiver rodando externamente (via Plesk), não inicia outro processo.
- Não subir `dist/`, `build/` ou `.spec` para o GitHub.
