# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['backend_controller.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='BackendController',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # janela de console oculta
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None
)

# Para build "onefile", o PyInstaller usa PKG/onefile internamente quando chamado via CLI.
# Se desejar forçar via spec apenas, remova o COLLECT e use a linha abaixo (PyInstaller >= 6):
# app = EXE(pyz, a.scripts, name='BackendController', console=False)
# Porém, o comando recomendado é usar a flag --onefile ao invocar o PyInstaller com esta spec.

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='BackendController'
)
