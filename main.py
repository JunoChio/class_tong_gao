# -*- coding: utf-8 -*-
"""
DesktopBoard - 轻量级 Windows 桌面动态壁纸看板客户端
主程序入口：
1. 初始化高 DPI 感知与同级目录 app.log 日志系统
2. 读取/自动生成同级目录 config.json，同步开机自启配置
3. 创建 pywebview (强制使用 Windows 原生 edgechromium / Edge WebView2 内核)，
   配置独立持久化缓存目录 (%LOCALAPPDATA%\\DesktopBoard\\WebView2Data) 保持 Cookie / LocalStorage
4. 启动独立系统托盘线程，支持一键切换「桌面壁纸模式」与「置顶交互模式」
5. 退出时安全销毁 WebView、停止托盘并调用 SystemParametersInfoW 刷新原壁纸防止残影
"""
import os
import io
import sys
import json
import time
import base64
import ctypes
import logging
import argparse
import threading
import urllib.request
from typing import Optional

import win32gui
import win32con
from PIL import Image, ImageOps

from config_manager import (
    ConfigManager,
    get_log_path,
    get_webview_data_dir,
)
from win32_wallpaper import (
    enable_high_dpi_awareness,
    get_primary_screen_size,
    get_system_wallpaper_path,
    is_desktop_occluded,
    trim_process_memory,
    WallpaperController,
)
from tray import SystemTrayController
import autostart

ERROR_ALREADY_EXISTS = 183
_SINGLE_INSTANCE_MUTEX = None


def acquire_single_instance_lock() -> bool:
    """创建全局互斥体，确保客户端只运行一个实例（防止 WebView2 缓存目录被多进程抢占）"""
    global _SINGLE_INSTANCE_MUTEX
    mutex_name = "Local\\DesktopBoard_Wallpaper_SingleInstance_Mutex"
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    last_err = ctypes.windll.kernel32.GetLastError()
    _SINGLE_INSTANCE_MUTEX = handle
    if last_err == ERROR_ALREADY_EXISTS:
        return False
    return True


def setup_logging() -> logging.Logger:
    """配置全局日志：同时输出到同级目录 app.log（方便无黑框模式下排查问题）"""
    log_path = get_log_path()
    handlers = [logging.FileHandler(log_path, encoding="utf-8")]
    # 如果是有控制台的调试环境，也输出到 stdout
    if sys.stdout is not None and hasattr(sys.stdout, "write"):
        handlers.append(logging.StreamHandler(sys.stdout))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
        force=True,
    )
    return logging.getLogger("DesktopBoard.Main")


class DesktopBoardApp:
    def __init__(self, self_test_seconds: float = 0.0) -> None:
        self.logger = logging.getLogger("DesktopBoard.App")
        self.self_test_seconds = self_test_seconds
        self.config_mgr = ConfigManager()

        self.window_title: str = str(
            self.config_mgr.get("window_title", "DesktopBoard_Wallpaper_Host")
        )
        self.current_url: str = str(
            self.config_mgr.get("url", "https://example.com")
        )
        interactive_w = int(self.config_mgr.get("interactive_width", 1280))
        interactive_h = int(self.config_mgr.get("interactive_height", 800))

        self.wallpaper_ctrl = WallpaperController(
            window_title=self.window_title,
            interactive_size=(interactive_w, interactive_h),
        )
        self.tray_ctrl: Optional[SystemTrayController] = None
        self.window = None
        self._exiting = False
        self._render_paused = False
        self._last_wallpaper_sig: Optional[str] = None
        self._cached_wallpaper_data_uri: Optional[str] = None

        # 同步配置文件中的开机自启状态（如果注册表已开启则以注册表为准写回配置）
        self._sync_autostart_on_boot()

    def _build_wallpaper_data_uri(self) -> Optional[str]:
        """读取系统当前静态壁纸并按主屏尺寸高效编码为 JPEG Data URI，用于无缝穿透原壁纸"""
        if not bool(self.config_mgr.get("sync_system_wallpaper", True)):
            return None
        wp_path = get_system_wallpaper_path()
        if not wp_path:
            return None
        try:
            st = os.stat(wp_path)
            sig = f"{wp_path}|{st.st_mtime_ns}|{st.st_size}"
            if sig == self._last_wallpaper_sig and self._cached_wallpaper_data_uri:
                return self._cached_wallpaper_data_uri

            screen_w, screen_h = get_primary_screen_size()
            # 控制最大编码尺寸在主屏分辨率内（上限 2560px），保证清晰且极省内存
            target_w = min(screen_w, 2560)
            target_h = min(screen_h, 1600)

            with Image.open(wp_path) as img:
                img = ImageOps.exif_transpose(img).convert("RGB")
                # 按系统“填充(Fill/Cover)”策略等比裁切铺满主屏
                fitted = ImageOps.fit(img, (target_w, target_h), method=Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                fitted.save(buf, format="JPEG", quality=88, optimize=True)
                b64 = base64.b64encode(buf.getvalue()).decode("ascii")

            self._last_wallpaper_sig = sig
            self._cached_wallpaper_data_uri = f"data:image/jpeg;base64,{b64}"
            self.logger.info(
                "已同步系统原壁纸用于透明叠加渲染 (%s -> %dx%d)", wp_path, target_w, target_h
            )
            return self._cached_wallpaper_data_uri
        except Exception as e:
            self.logger.warning("读取或编码系统原壁纸失败 (%s): %s", wp_path, e)
            return None

    def inject_desktop_wallpaper_backdrop(self) -> None:
        """向看板网页注入桌面端标识与系统原壁纸 CSS 变量，实现全系统无黑底毛玻璃透明叠加"""
        if not self.window or self._exiting:
            return
        try:
            data_uri = self._build_wallpaper_data_uri()
            if data_uri:
                js = (
                    "document.documentElement.dataset.desktopClient = 'true';"
                    f"document.documentElement.style.setProperty('--desktop-wallpaper', 'url(' + {json.dumps(data_uri)} + ')');"
                )
            else:
                js = "document.documentElement.dataset.desktopClient = 'true';"
            self.window.evaluate_js(js)
        except Exception as e:
            self.logger.debug("注入原壁纸背景脚本暂未就绪: %s", e)

    def _wallpaper_sync_loop(self) -> None:
        """后台低频监测目标电脑是否更换了系统壁纸，若更换则自动无感同步到看板底层"""
        while not self._exiting:
            time.sleep(15)
            if self._exiting:
                break
            if not bool(self.config_mgr.get("sync_system_wallpaper", True)):
                continue
            wp_path = get_system_wallpaper_path()
            if not wp_path:
                continue
            try:
                st = os.stat(wp_path)
                sig = f"{wp_path}|{st.st_mtime_ns}|{st.st_size}"
                if sig != self._last_wallpaper_sig:
                    self.inject_desktop_wallpaper_backdrop()
            except Exception:
                pass

    def _sync_autostart_on_boot(self) -> None:
        try:
            reg_enabled = autostart.is_autostart_enabled()
            cfg_enabled = bool(self.config_mgr.get("auto_start", False))
            if cfg_enabled and not reg_enabled:
                autostart.set_autostart(True)
            elif reg_enabled and not cfg_enabled:
                self.config_mgr.set("auto_start", True, auto_save=True)
        except Exception as e:
            self.logger.warning("启动同步开机自启状态异常: %s", e)

    def is_wallpaper_mode(self) -> bool:
        return self.wallpaper_ctrl.is_wallpaper_mode

    def get_current_url(self) -> str:
        return self.current_url

    def get_config_path(self) -> str:
        return self.config_mgr.config_path

    def toggle_mode(self) -> None:
        # 切换为交互窗口前确保解除休眠暂停状态
        if self._render_paused:
            self._set_render_paused(False)
        ok = self.wallpaper_ctrl.toggle_mode()
        self.logger.info(
            "模式切换结果: %s (当前壁纸模式=%s)", ok, self.wallpaper_ctrl.is_wallpaper_mode
        )

    def _set_render_paused(self, paused: bool) -> None:
        """
        根据桌面是否被最大化/全屏应用遮挡，自动暂停或恢复渲染以节省 CPU/GPU 与内存：
        - paused=True : 冻结网页动画与轮询 + 隐藏 WebView2 触发 Chromium 原生后台节流 + 回收闲置内存
        - paused=False: 立即无焦点恢复显示 + 恢复动画与拉取最新云端数据
        """
        if self._render_paused == paused or self._exiting:
            return
        self._render_paused = paused
        hwnd = self.wallpaper_ctrl.hwnd

        if paused:
            self.logger.info("检测到其他应用最大化/全屏或锁屏，已自动暂停看板渲染并释放内存")
            if self.window:
                try:
                    self.window.evaluate_js(
                        "window.__setDesktopPaused && window.__setDesktopPaused(true);"
                    )
                except Exception:
                    pass
            if hwnd and win32gui.IsWindow(hwnd) and self.wallpaper_ctrl.is_wallpaper_mode:
                try:
                    win32gui.ShowWindow(hwnd, win32con.SW_HIDE)
                except Exception:
                    pass
            trim_process_memory()
        else:
            self.logger.info("已回到桌面，自动恢复看板渲染")
            if hwnd and win32gui.IsWindow(hwnd) and self.wallpaper_ctrl.is_wallpaper_mode:
                try:
                    win32gui.ShowWindow(hwnd, win32con.SW_SHOWNA)
                except Exception:
                    pass
            if self.window:
                try:
                    self.window.evaluate_js(
                        "window.__setDesktopPaused && window.__setDesktopPaused(false);"
                    )
                except Exception:
                    pass

    def _probe_url_online(self, url: str) -> bool:
        """輕量探測目標看板網址是否可連通（用於教室開機斷網自動重載）"""
        if not url or not url.startswith(("http://", "https://")):
            return True
        try:
            req = urllib.request.Request(
                url, method="HEAD", headers={"User-Agent": "DesktopBoard/1.0"}
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                return 200 <= getattr(resp, "status", 200) < 500
        except Exception:
            try:
                req = urllib.request.Request(
                    url, method="GET", headers={"User-Agent": "DesktopBoard/1.0"}
                )
                with urllib.request.urlopen(req, timeout=4) as resp:
                    return 200 <= getattr(resp, "status", 200) < 500
            except Exception:
                return False

    def _network_boot_guard_loop(self) -> None:
        """
        開機斷網自動重試守衛：
        若教室電腦剛開機時尚未連上網路，每 4 秒靜默重試；
        一旦偵測到網路恢復可連通，自動重新載入看板網址，避免停留在離線錯誤頁。
        """
        was_offline = False
        # 啟動後 2 秒先檢查一次開機連線狀態
        time.sleep(2.0)
        while not self._exiting:
            online = self._probe_url_online(self.current_url)
            if not online:
                if not was_offline:
                    was_offline = True
                    self.logger.warning(
                        "偵測到目前無法連線至看板 (%s)，將每 4 秒自動重試直至網路恢復...",
                        self.current_url,
                    )
                time.sleep(4.0)
            else:
                if was_offline:
                    was_offline = False
                    self.logger.info("網路已恢復連線，自動重新載入看板網頁: %s", self.current_url)
                    if self.window and not self._exiting:
                        try:
                            self.window.load_url(self.current_url)
                        except Exception as e:
                            self.logger.error("網路恢復後重載看板失敗: %s", e)
                # 連線正常時降低檢查頻率至每 20 秒，幾乎不佔系統資源
                time.sleep(20.0)

    def _occlusion_guard_loop(self) -> None:
        """后台每 0.6 秒轻量检测一次桌面是否被遮挡（模仿 Wallpaper Engine 智能节能规则）"""
        while not self._exiting:
            time.sleep(0.6)
            if self._exiting:
                break
            if not bool(self.config_mgr.get("pause_when_occluded", True)):
                if self._render_paused:
                    self._set_render_paused(False)
                continue
            if not self.wallpaper_ctrl.is_wallpaper_mode:
                if self._render_paused:
                    self._set_render_paused(False)
                continue
            try:
                occluded = is_desktop_occluded(self.wallpaper_ctrl.hwnd)
                if occluded != self._render_paused:
                    self._set_render_paused(occluded)
            except Exception as e:
                self.logger.debug("检测桌面遮挡状态异常: %s", e)

    def refresh_page(self) -> None:
        if not self.window:
            return
        try:
            self.logger.info("正在刷新看板页面: %s", self.current_url)
            self.window.evaluate_js("window.location.reload();")
        except Exception as e:
            self.logger.warning("JS reload 失败 (%s)，尝试重新 load_url", e)
            try:
                self.window.load_url(self.current_url)
            except Exception as e2:
                self.logger.error("重新加载 URL 失败: %s", e2)

    def reload_config_and_refresh(self) -> None:
        self.logger.info("正在重新读取 config.json...")
        data = self.config_mgr.load()
        new_url = str(data.get("url", "https://example.com")).strip()
        new_auto_start = bool(data.get("auto_start", False))
        new_start_wallpaper = bool(data.get("start_as_wallpaper", True))

        # 同步开机自启
        if new_auto_start != autostart.is_autostart_enabled():
            autostart.set_autostart(new_auto_start)

        # 同步窗口模式
        if new_start_wallpaper != self.wallpaper_ctrl.is_wallpaper_mode:
            if new_start_wallpaper:
                self.wallpaper_ctrl.attach_to_desktop()
            else:
                self.wallpaper_ctrl.detach_to_interactive()

        # 同步并刷新 URL
        if new_url and new_url != self.current_url:
            self.logger.info("检测到看板 URL 变更: %s -> %s", self.current_url, new_url)
            self.current_url = new_url
            if self.window:
                try:
                    self.window.load_url(self.current_url)
                except Exception as e:
                    self.logger.error("加载新 URL 失败: %s", e)
        else:
            self.refresh_page()

    def on_autostart_changed(self, enabled: bool) -> None:
        self.config_mgr.set("auto_start", enabled, auto_save=True)

    def safe_exit(self) -> None:
        if self._exiting:
            return
        self._exiting = True
        self.logger.info("正在安全退出 DesktopBoard...")

        # 1. 停止系统托盘
        if self.tray_ctrl:
            self.tray_ctrl.stop()

        # 2. 脱离壁纸层并清理桌面残影
        try:
            self.wallpaper_ctrl.cleanup()
        except Exception as e:
            self.logger.error("清理壁纸层异常: %s", e)

        # 3. 销毁 pywebview 窗口
        if self.window:
            try:
                self.window.destroy()
            except Exception as e:
                self.logger.debug("销毁 WebView 窗口异常: %s", e)

        self.logger.info("DesktopBoard 已安全退出。")

    def _on_webview_started(self) -> None:
        """pywebview GUI 循环启动后的后台初始化回调"""
        try:
            # 等待窗口句柄就绪并根据配置挂载到桌面壁纸层或置顶交互层
            time.sleep(0.35)
            start_as_wallpaper = bool(self.config_mgr.get("start_as_wallpaper", True))
            if start_as_wallpaper:
                self.wallpaper_ctrl.attach_to_desktop()
            else:
                self.wallpaper_ctrl.detach_to_interactive()

            # 启动系统托盘
            self.tray_ctrl = SystemTrayController(
                is_wallpaper_mode_fn=self.is_wallpaper_mode,
                on_toggle_mode=self.toggle_mode,
                on_refresh=self.refresh_page,
                on_reload_config=self.reload_config_and_refresh,
                get_current_url_fn=self.get_current_url,
                get_config_path_fn=self.get_config_path,
                on_autostart_changed=self.on_autostart_changed,
                on_exit=self.safe_exit,
            )
            self.tray_ctrl.start()

            # 启动后台壁纸变更无感监测线程
            threading.Thread(
                target=self._wallpaper_sync_loop, name="WallpaperSyncThread", daemon=True
            ).start()

            # 啟動背景桌面遮擋/全螢幕節能休眠守衛執行緒（不在桌面時停止渲染、釋放記憶體）
            threading.Thread(
                target=self._occlusion_guard_loop, name="OcclusionGuardThread", daemon=True
            ).start()

            # 啟動開機斷網自動重連守衛執行緒（網路恢復自動重載看板）
            threading.Thread(
                target=self._network_boot_guard_loop, name="NetworkBootGuardThread", daemon=True
            ).start()

            # 如果传入了自动化自检参数 (--self-test)，在指定秒数后自动安全退出
            if self.self_test_seconds > 0:
                self.logger.info(
                    "自动化自检模式已激活，将在 %.1f 秒后自动执行安全退出验证...",
                    self.self_test_seconds,
                )
                time.sleep(self.self_test_seconds)
                self.safe_exit()
        except Exception as e:
            self.logger.exception("WebView 启动后初始化异常: %s", e)

    def run(self) -> None:
        import webview

        # 配置 pywebview 关闭默认清理存储，开启持久化缓存
        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.settings["OPEN_DEVTOOLS_IN_DEBUG"] = False

        screen_w, screen_h = get_primary_screen_size()
        storage_dir = get_webview_data_dir()
        self.logger.info(
            "正在创建 WebView2 窗口 [URL=%s, 分辨率=%dx%d, 缓存目录=%s]",
            self.current_url,
            screen_w,
            screen_h,
            storage_dir,
        )

        self.window = webview.create_window(
            title=self.window_title,
            url=self.current_url,
            width=screen_w,
            height=screen_h,
            x=0,
            y=0,
            frameless=True,
            easy_drag=False,
            resizable=True,
            background_color="#F8F5EE",
        )
        self.window.events.loaded += self._on_page_loaded
        self.window.events.closed += self._on_window_closed

        # 强制使用 edgechromium (Edge WebView2) 内核，并设置 private_mode=False + storage_path 持久化 Cookie/LocalStorage
        webview.start(
            func=self._on_webview_started,
            gui="edgechromium",
            debug=False,
            private_mode=False,
            storage_path=storage_dir,
        )

    def _on_page_loaded(self) -> None:
        """网页每次加载完成后自动注入桌面端标记与目标电脑当前系统壁纸"""
        threading.Thread(
            target=self.inject_desktop_wallpaper_backdrop, daemon=True
        ).start()

    def _on_window_closed(self) -> None:
        if not self._exiting:
            self.safe_exit()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DesktopBoard Windows 桌面动态壁纸看板客户端")
    parser.add_argument(
        "--self-test",
        type=float,
        default=0.0,
        help="自动化自检运行秒数（挂载壁纸+启动托盘后在指定秒数自动安全退出）",
    )
    return parser.parse_args()


def main() -> None:
    # 1. 最优先启用高 DPI 感知，防止任何 GUI 窗口创建前被系统 DPI 虚拟化缩放
    enable_high_dpi_awareness()

    # 2. 初始化日志系统
    logger = setup_logging()
    logger.info("========== DesktopBoard 启动 ==========")

    args = parse_args()

    # 3. 单实例防重检查
    if not acquire_single_instance_lock():
        logger.warning("检测到 DesktopBoard 已在运行中，本次启动自动退出（避免 WebView2 缓存冲突）。")
        sys.exit(0)

    try:
        app = DesktopBoardApp(self_test_seconds=args.self_test)
        app.run()
    except Exception as e:
        logger.exception("DesktopBoard 主循环发生未捕获致命异常: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
