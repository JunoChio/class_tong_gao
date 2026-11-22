# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# 收集 webview 所有子模块及内嵌资源（如 WebView2 DLL / JS 桥接文件）
webview_hiddenimports = collect_submodules("webview")
pystray_hiddenimports = collect_submodules("pystray")
webview_datas = collect_data_files("webview")

hiddenimports = (
    webview_hiddenimports
    + pystray_hiddenimports
    + [
        "clr",
        "pythonnet",
        "win32gui",
        "win32con",
        "win32api",
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
        "PIL.ImageOps",
    ]
)

icon_file = "icon.ico" if os.path.exists("icon.ico") else None

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=[],
    datas=webview_datas,
    hiddenimports=hiddenimports,
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
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="DesktopBoard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # --noconsole 无命令行黑框
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file,
)
