from PIL import Image

# Nome do arquivo original
input_file = "SME.png"

# Carrega a imagem base
img = Image.open(input_file).convert("RGBA")

# Lista de tamanhos que vamos gerar
sizes = [(16, 16), (32, 32), (48, 48)]

# Gera PNGs individuais
for size in sizes:
    resized = img.resize(size, Image.LANCZOS)
    filename = f"favicon-{size[0]}x{size[1]}.png"
    resized.save(filename, format="PNG")
    print(f"[✔] Gerado: {filename}")

# Gera o favicon.ico com múltiplos tamanhos
img.save("favicon.ico", sizes=[(16,16), (32,32), (48,48)])
print("[✔] Gerado: favicon.ico com 16x16, 32x32 e 48x48")

print("\n✅ Todos os arquivos foram gerados com sucesso!")
print("📁 Criados:")
print(" - favicon-16x16.png")
print(" - favicon-32x32.png")
print(" - favicon-48x48.png")
print(" - favicon.ico")
