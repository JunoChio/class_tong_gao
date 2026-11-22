# -*- coding: utf-8 -*-
"""
配置管理模块：负责在 .exe（或脚本）同级目录自动读取与生成 config.json，
并提供持久化 WebView2 缓存目录与日志路径管理。
"""
import os
import sys
import json
import logging
from typing import Dict, Any

logger = logging.getLogger("DesktopBoard.Config")

DEFAULT_CONFIG: Dict[str, Any] = {
    "url": "http://localhost:3000",
    "auto_start": False,
    "start_as_wallpaper": True,
    "sync_system_wallpaper": True,
    "pause_when_occluded": True,
    "window_title": "DesktopBoard_Wallpaper_Host",
    "interactive_width": 1280,
    "interactive_height": 800,
}


def get_base_dir() -> str:
    """获取程序运行所在目录（兼容 PyInstaller 单文件打包与源码运行）"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def get_config_path() -> str:
    """获取同级目录下的 config.json 完整路径"""
    return os.path.join(get_base_dir(), "config.json")


def get_log_path() -> str:
    """获取同级目录下的 app.log 完整路径"""
    return os.path.join(get_base_dir(), "app.log")


def get_webview_data_dir() -> str:
    """
    获取 WebView2 独立本地持久化缓存目录：
    %LOCALAPPDATA%\\DesktopBoard\\WebView2Data
    """
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        local_app_data = os.path.join(os.path.expanduser("~"), "AppData", "Local")
    data_dir = os.path.join(local_app_data, "DesktopBoard", "WebView2Data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


class ConfigManager:
    def __init__(self) -> None:
        self.config_path = get_config_path()
        self.data: Dict[str, Any] = dict(DEFAULT_CONFIG)
        self.load()

    def load(self) -> Dict[str, Any]:
        """读取配置文件；若不存在或损坏则自动生成/补全默认配置"""
        if not os.path.exists(self.config_path):
            logger.info("配置文件不存在，正在生成默认配置: %s", self.config_path)
            self.save()
            return self.data

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                merged = dict(DEFAULT_CONFIG)
                merged.update(loaded)
                self.data = merged
                # 如果缺少新字段，自动写回补全
                if set(DEFAULT_CONFIG.keys()) - set(loaded.keys()):
                    self.save()
            else:
                logger.warning("config.json 格式非 JSON 对象，已重置为默认配置")
                self.data = dict(DEFAULT_CONFIG)
                self.save()
        except Exception as e:
            logger.error("读取 config.json 失败 (%s)，使用默认配置", e)
            self.data = dict(DEFAULT_CONFIG)
        return self.data

    def save(self) -> bool:
        """保存当前配置到 config.json"""
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=4)
            logger.info("配置已保存至: %s", self.config_path)
            return True
        except Exception as e:
            logger.error("保存 config.json 失败: %s", e)
            return False

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def set(self, key: str, value: Any, auto_save: bool = True) -> None:
        self.data[key] = value
        if auto_save:
            self.save()
