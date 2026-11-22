# -*- coding: utf-8 -*-
"""
开机自启管理模块：通过 winreg 读写 HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
"""
import os
import sys
import winreg
import logging

logger = logging.getLogger("DesktopBoard.AutoStart")

RUN_KEY_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_REG_NAME = "DesktopBoardWallpaper"


def get_startup_command() -> str:
    """
    获取写入注册表的启动命令：
    - 打包为 .exe 后：直接指向 sys.executable（带引号）
    - 源码运行时：指向 pythonw.exe / python.exe + main.py 路径
    """
    if getattr(sys, "frozen", False):
        return f'"{os.path.abspath(sys.executable)}"'
    main_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "main.py"))
    exe = sys.executable
    pythonw = os.path.join(os.path.dirname(exe), "pythonw.exe")
    runner = pythonw if os.path.exists(pythonw) else exe
    return f'"{runner}" "{main_script}"'


def is_autostart_enabled() -> bool:
    """检查当前是否已配置开机自启"""
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_READ
        ) as key:
            val, _ = winreg.QueryValueEx(key, APP_REG_NAME)
            expected = get_startup_command()
            return bool(val) and (val.strip().lower() == expected.strip().lower())
    except FileNotFoundError:
        return False
    except Exception as e:
        logger.error("查询开机自启注册表失败: %s", e)
        return False


def set_autostart(enable: bool) -> bool:
    """开启或关闭开机自启"""
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_SET_VALUE
        ) as key:
            if enable:
                cmd = get_startup_command()
                winreg.SetValueEx(key, APP_REG_NAME, 0, winreg.REG_SZ, cmd)
                logger.info("已启用开机自启: %s -> %s", APP_REG_NAME, cmd)
            else:
                try:
                    winreg.DeleteValue(key, APP_REG_NAME)
                    logger.info("已移除开机自启项: %s", APP_REG_NAME)
                except FileNotFoundError:
                    pass
        return True
    except Exception as e:
        logger.error("设置开机自启(%s)失败: %s", enable, e)
        return False
