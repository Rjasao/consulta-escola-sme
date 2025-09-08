# inicio - server_control.py
import subprocess
import sys
import os
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Caminho para o script add.py a ser iniciado/parado. Por padrão,
# utiliza o caminho relativo à pasta backend. Para ambientes Windows
# onde o projeto foi extraído em uma localização específica, você pode
# configurar um caminho absoluto através da variável de ambiente
# ADD_PY_PATH ou editar diretamente o valor abaixo. Exemplo:
#   ADD_PY_PATH = r"C:\\Users\\rjasa\\Desktop\\consulta-escola-sme\\backend\\add.py"
ADD_PY_PATH = os.environ.get(
    "ADD_PY_PATH",
    os.path.join(os.path.dirname(__file__), "add.py")
)
flask_process = None

@app.post("/api/server/start")
def start_server():
    global flask_process
    if flask_process and flask_process.poll() is None:
        return jsonify({"status": "running", "message": "Servidor já ativo"}), 200
    try:
        # Executa PowerShell para abrir add.py
        flask_process = subprocess.Popen(
            ["powershell.exe", "-NoExit", "-Command", f"python \"{ADD_PY_PATH}\""]
        )
        return jsonify({"status": "started", "message": "Servidor iniciado via PowerShell"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.post("/api/server/shutdown")
def shutdown_server():
    global flask_process
    if flask_process and flask_process.poll() is None:
        flask_process.terminate()
        return jsonify({"status": "stopped", "message": "Servidor encerrado"}), 200
    return jsonify({"status": "stopped", "message": "Servidor já parado"}), 200

if __name__ == "__main__":
    app.run(port=5050, debug=True)

    
# final
