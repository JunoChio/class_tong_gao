# -*- coding: utf-8 -*-
"""
系统托盘控制模块（独立守护线程运行，不阻塞 pywebview GUI 主循环）
功能：
1. 切换模式（默认双击项）：「切换为置顶交互模式」 ↔ 「贴回桌面壁纸模式」
2. 刷新看板：重新加载当前网页
3. 修改配置：用系统默认编辑器打开 config.json，并提供「重载配置并刷新」
4. 在默认浏览器中打开：调用系统默认浏览器打开当前看板网址
5. 开机自启开关（带勾选状态）：读写注册表 Run 键
6. 退出程序：安全销毁 WebView 窗口、停止托盘并触发桌面原壁纸重绘
7. 动态图标生成：若根目录无 icon.ico，使用 Pillow 自动绘制并保存简洁现代的看板图标
"""
import os
import time
import logging
import threading
import webbrowser
from typing import Callable, Optional
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as Item, Menu

from config_manager import get_base_dir
import autostart

logger = logging.getLogger("DesktopBoard.Tray")


def create_or_load_tray_icon() -> Image.Image:
    """
    若项目根目录存在 icon.ico 则直接加载；
    否则使用 Pillow 动态绘制一个简洁现代的深蓝渐变看板图标，并保存为 icon.ico。
    """
    icon_path = os.path.join(get_base_dir(), "icon.ico")
    if os.path.exists(icon_path):
        try:
            img = Image.open(icon_path)
            img.load()
            return img
        except Exception as e:
            logger.warning("读取现有 icon.ico 失败 (%s)，将使用 Pillow 动态生成图标", e)

    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 绘制圆角深色背景外框
    draw.rounded_rectangle(
        [(2, 2), (size - 3, size - 3)],
        radius=14,
        fill=(18, 24, 38, 255),
        outline=(56, 189, 248, 255),
        width=3,
    )

    # 绘制顶部状态栏卡片
    draw.rounded_rectangle(
        [(10, 10), (size - 11, 21)],
        radius=4,
        fill=(56, 189, 248, 255),
    )

    # 绘制左侧主看板区块（青蓝高亮）
    draw.rounded_rectangle(
        [(10, 26), (34, size - 11)],
        radius=5,
        fill=(14, 165, 233, 230),
    )

    # 绘制右侧上下两个数据卡片区块（翠绿与琥珀点缀）
    draw.rounded_rectangle(
        [(39, 26), (size - 11, 38)],
        radius=4,
        fill=(52, 211, 153, 235),
    )
    draw.rounded_rectangle(
        [(39, 42), (size - 11, size - 11)],
        radius=4,
        fill=(129, 140, 248, 235),
    )

    # 尝试保存一份 icon.ico 到同级目录，供打包及窗口图标复用
    try:
        img.save(icon_path, format="ICO", sizes=[(64, 64), (32, 32), (16, 16)])
        logger.info("已动态生成默认托盘图标: %s", icon_path)
    except Exception as e:
        logger.debug("保存默认 icon.ico 失败（不影响内存托盘加载）: %s", e)

    return img


class SystemTrayController:
    def __init__(
        self,
        is_wallpaper_mode_fn: Callable[[], bool],
        on_toggle_mode: Callable[[], None],
        on_refresh: Callable[[], None],
        on_reload_config: Callable[[], None],
        get_current_url_fn: Callable[[], str],
        get_config_path_fn: Callable[[], str],
        on_autostart_changed: Callable[[bool], None],
        on_exit: Callable[[], None],
    ) -> None:
        self.is_wallpaper_mode_fn = is_wallpaper_mode_fn
        self.on_toggle_mode = on_toggle_mode
        self.on_refresh = on_refresh
        self.on_reload_config = on_reload_config
        self.get_current_url_fn = get_current_url_fn
        self.get_config_path_fn = get_config_path_fn
        self.on_autostart_changed = on_autostart_changed
        self.on_exit = on_exit

        self.icon: Optional[pystray.Icon] = None
        self._thread: Optional[threading.Thread] = None
        self._last_toggle_ts: float = 0.0

    def _get_toggle_label(self, _item: Item) -> str:
        if self.is_wallpaper_mode_fn():
            return "切換為置頂互動模式"
        return "貼回桌面桌布模式"

    def _handle_toggle_mode(self, _icon: pystray.Icon, _item: Item) -> None:
        # 防抖：Windows 下 pystray 左键单击也会触发 default 项，用户双击会在 0.3s 内连续触发两次，
        # 加 0.65 秒防抖确保单击或双击都只稳定切换一次。
        now = time.monotonic()
        if now - self._last_toggle_ts < 0.65:
            logger.debug("忽略 0.65s 内的重复切换事件（防双击连击）")
            return
        self._last_toggle_ts = now

        logger.info("托盘触发：切换壁纸/交互模式")
        threading.Thread(target=self._run_toggle_and_update, daemon=True).start()

    def _run_toggle_and_update(self) -> None:
        try:
            self.on_toggle_mode()
            if self.icon:
                self.icon.update_menu()
        except Exception as e:
            logger.error("切换模式执行异常: %s", e)

    def _handle_refresh(self, _icon: pystray.Icon, _item: Item) -> None:
        logger.info("托盘触发：刷新看板")
        threading.Thread(target=self.on_refresh, daemon=True).start()

    def _handle_open_config(self, _icon: pystray.Icon, _item: Item) -> None:
        cfg_path = self.get_config_path_fn()
        logger.info("托盘触发：打开配置文件 %s", cfg_path)
        try:
            os.startfile(cfg_path)
        except Exception as e:
            logger.error("打开配置文件失败: %s", e)

    def _handle_reload_config(self, _icon: pystray.Icon, _item: Item) -> None:
        logger.info("托盘触发：重载配置并刷新")
        threading.Thread(target=self._run_reload_and_update, daemon=True).start()

    def _run_reload_and_update(self) -> None:
        try:
            self.on_reload_config()
            if self.icon:
                self.icon.update_menu()
        except Exception as e:
            logger.error("重载配置执行异常: %s", e)

    def _handle_open_browser(self, _icon: pystray.Icon, _item: Item) -> None:
        url = self.get_current_url_fn()
        logger.info("托盘触发：在默认浏览器中打开 %s", url)
        try:
            webbrowser.open(url)
        except Exception as e:
            logger.error("打开默认浏览器失败: %s", e)

    def _handle_open_admin(self, _icon: pystray.Icon, _item: Item) -> None:
        base_url = self.get_current_url_fn().rstrip("/")
        admin_url = base_url if base_url.endswith("/admin") else f"{base_url}/admin"
        logger.info("托盘触发：打开网页编辑后台 %s", admin_url)
        try:
            webbrowser.open(admin_url)
        except Exception as e:
            logger.error("打开网页编辑后台失败: %s", e)

    def _is_autostart_checked(self, _item: Item) -> bool:
        return autostart.is_autostart_enabled()

    def _handle_toggle_autostart(self, _icon: pystray.Icon, _item: Item) -> None:
        current = autostart.is_autostart_enabled()
        target = not current
        if autostart.set_autostart(target):
            self.on_autostart_changed(target)
        if self.icon:
            self.icon.update_menu()

    def _handle_exit(self, _icon: pystray.Icon, _item: Item) -> None:
        logger.info("托盘触发：退出程序")
        threading.Thread(target=self.on_exit, daemon=True).start()

    def build_menu(self) -> Menu:
        return Menu(
            Item(
                self._get_toggle_label,
                self._handle_toggle_mode,
                default=True,
            ),
            Item("重新整理看板", self._handle_refresh),
            Item("開啟網頁編輯後台 (/admin)", self._handle_open_admin),
            Menu.SEPARATOR,
            Item("修改設定 (開啟 config.json)", self._handle_open_config),
            Item("重載設定並重新整理", self._handle_reload_config),
            Item("在預設瀏覽器中開啟看板", self._handle_open_browser),
            Menu.SEPARATOR,
            Item(
                "開機自動啟動",
                self._handle_toggle_autostart,
                checked=self._is_autostart_checked,
            ),
            Menu.SEPARATOR,
            Item("結束程式", self._handle_exit),
        )

    def start(self) -> None:
        """在獨立守護執行緒中啟動系統托盤圖示"""
        image = create_or_load_tray_icon()
        self.icon = pystray.Icon(
            "DesktopBoard",
            image,
            "班級桌面動態看板（點擊切換互動／桌布模式）",
            menu=self.build_menu(),
        )
        self._thread = threading.Thread(
            target=self._run_tray, name="SystemTrayThread", daemon=True
        )
        self._thread.start()
        logger.info("系统托盘线程已启动")

    def _run_tray(self) -> None:
        try:
            if self.icon:
                self.icon.run()
        except Exception as e:
            logger.exception("系统托盘运行异常: %s", e)

    def stop(self) -> None:
        """停止并销毁系统托盘图标"""
        if self.icon:
            try:
                self.icon.stop()
                logger.info("系统托盘已停止")
            except Exception as e:
                logger.error("停止系统托盘失败: %s", e)
