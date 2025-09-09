import os
import sys
import socket
import subprocess
import tkinter as tk
from tkinter import messagebox
import webbrowser
import psutil  # pip install psutil

# ========= CONFIG =========Nude aqui seu endereço===========================
BACKEND_DIR = r"C:\Users\rjasa\Desktop\consulta-escola-sme\www\backend"
SCRIPT_TO_RUN = "add.py"
PYTHON_BIN = r"C:\Users\rjasa\Desktop\consulta-escola-sme\www\backend\venv\Scripts\python.exe"
HOST = "127.0.0.1"
PORT = 5000
# ==========================

CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008

class Controller(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Backend Controller")
        self.geometry("420x220")
        self.resizable(False, False)
        self.started_proc_pid = None  # guarda o PID se fomos nós que iniciamos

        # UI
        self.status = tk.Label(self, text="Status: verificando...", font=("Segoe UI", 11))
        self.status.pack(pady=(20, 10))

        self.toggle_btn = tk.Button(self, text="Ligar", font=("Segoe UI", 12, "bold"),
                                    width=18, height=2, command=self.toggle)
        self.toggle_btn.pack(pady=5)

        self.open_btn = tk.Button(self, text="Abrir no navegador", command=self.open_in_browser)
        self.open_btn.pack(pady=(8, 0))

        self.info = tk.Label(self, text="Pasta alvo:\\n" + BACKEND_DIR, justify="center")
        self.info.pack(pady=(10, 0))

        self.protocol("WM_DELETE_WINDOW", self.on_exit)

        # validações
        if not os.path.isdir(BACKEND_DIR):
            messagebox.showerror("Erro", f"Pasta não encontrada:\\n{BACKEND_DIR}")

        # primeira leitura
        self.refresh_status()

    def open_in_browser(self):
        webbrowser.open(f"http://{HOST}:{PORT}")

    def port_in_use(self, host, port) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            return s.connect_ex((host, port)) == 0

    def find_running_addpy(self):
        """Retorna lista de processos do add.py (qualquer origem)."""
        procs = []
        for p in psutil.process_iter(['pid', 'name', 'cmdline', 'cwd']):
            try:
                cmd = " ".join(p.info.get('cmdline') or []).lower()
                cwd = (p.info.get('cwd') or "").lower()
                if "python" in (p.info.get('name') or "").lower() or "python" in cmd:
                    if SCRIPT_TO_RUN.lower() in cmd:
                        procs.append((p, cwd, cmd))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return procs

    def refresh_status(self):
        in_use = self.port_in_use(HOST, PORT)
        procs = self.find_running_addpy()
        ours_running = any(p.pid == self.started_proc_pid for p, _, _ in procs)

        if in_use:
            if ours_running:
                self.set_ui_on("Ligado (por este app)")
            else:
                # Pode ser Plesk ou outro iniciador
                self.set_ui_on("Ligado (externo, porta em uso)")
        else:
            if ours_running:
                # processo nosso caiu, limpa estado
                self.started_proc_pid = None
            self.set_ui_off("Desligado")

        # agenda uma checagem discreta
        self.after(1500, self.refresh_status)

    def set_ui_on(self, label="Ligado"):
        self.status.config(text=f"Status: {label}")
        self.toggle_btn.config(text="Desligar", bg="#1976d2", fg="white", activebackground="#115293")

    def set_ui_off(self, label="Desligado"):
        self.status.config(text=f"Status: {label}")
        self.toggle_btn.config(text="Ligar", bg="#cc0000", fg="white", activebackground="#990000")

    def toggle(self):
        if "Desligar" in self.toggle_btn.cget("text"):
            self.stop_backend()
        else:
            self.start_backend()

    def start_backend(self):
        if self.port_in_use(HOST, PORT):
            messagebox.showinfo("Já está rodando",
                                f"A porta {PORT} já está em uso.\\n"
                                f"Parece que o backend já está ligado (talvez via Plesk).")
            return

        try:
            python_cmd = PYTHON_BIN or sys.executable
            cmd = [python_cmd, SCRIPT_TO_RUN]
            proc = subprocess.Popen(
                cmd,
                cwd=BACKEND_DIR,
                creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            self.started_proc_pid = proc.pid
            self.set_ui_on("Ligado (por este app)")
        except Exception as e:
            messagebox.showerror("Erro ao iniciar", str(e))

    def stop_backend(self):
        if not self.started_proc_pid:
            messagebox.showinfo(
                "Gerenciado externamente",
                "Este app não iniciou o backend.\\n"
                "Se estiver rodando pelo Plesk, pare por lá."
            )
            return

        try:
            p = psutil.Process(self.started_proc_pid)
            p.terminate()
            try:
                p.wait(timeout=4)
            except psutil.TimeoutExpired:
                p.kill()
            self.started_proc_pid = None
            self.set_ui_off("Desligado")
        except psutil.NoSuchProcess:
            self.started_proc_pid = None
            self.set_ui_off("Desligado")
        except Exception as e:
            messagebox.showerror("Erro ao parar", str(e))

    def on_exit(self):
        if self.started_proc_pid:
            try:
                p = psutil.Process(self.started_proc_pid)
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                pass
        self.destroy()

if __name__ == "__main__":
    app = Controller()
    app.mainloop()
