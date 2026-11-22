# -*- coding: utf-8 -*-
"""
Win32 桌面动态壁纸挂载核心模块（兼容 Win10 & Win11 23H2 及以下 & Win11 24H2+）
参考 Lively Wallpaper 与 weebp 桌面嵌入架构：
1. 高 DPI 感知：SetProcessDpiAwareness(2) / SetProcessDPIAware()
2. 双模式桌面层级兼容：
   - 向 Progman 发送 0x052C (wParam=0xD, lParam=0x1) 触发系统分裂 WorkerW
   - 经典模式（Win10 / Win11 23H2-）：枚举顶层窗口找到含 SHELLDLL_DefView 的窗口，取其后的兄弟 WorkerW 作为父窗口
   - Win11 24H2+ 模式：当 SHELLDLL_DefView 位于 Progman 下且无独立后置 WorkerW（或存在同层 WorkerW）时，
     将窗口挂载到 Progman 下，并将 Z 轴置于 SHELLDLL_DefView 正后方（绝不遮挡桌面图标）
3. 无边框与隐藏：移除 WS_CAPTION | WS_THICKFRAME 等，附加 WS_EX_TOOLWINDOW 隐藏任务栏与 Alt+Tab 图标
4. 退出残影清理：调用 SystemParametersInfoW(SPI_GETDESKWALLPAPER + SPI_SETDESKWALLPAPER) 强制刷新系统原壁纸
"""
import os
import ctypes
from ctypes import wintypes
import time
import logging
import threading
from typing import Optional, Tuple
import win32gui
import win32con
import win32api

logger = logging.getLogger("DesktopBoard.Win32Wallpaper")

user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore
dwmapi = ctypes.windll.dwmapi
kernel32 = ctypes.windll.kernel32

# 常量定义
SMTO_NORMAL = 0x0000
SPI_GETDESKWALLPAPER = 0x0073
SPI_SETDESKWALLPAPER = 0x0014
SPIF_UPDATEINIFILE = 0x01
SPIF_SENDWININICHANGE = 0x02
LWA_ALPHA = 0x00000002
DWMWA_CLOAKED = 14
DESKTOP_READOBJECTS = 0x0001

# 判断桌面被遮挡时需要忽略的系统壳窗口类名
_IGNORED_SHELL_CLASSES = {
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "EdgeUiInputTopWndClass",
    "DummyDWMListenerWindow",
    "ForegroundStaging",
    "TaskListThumbnailWnd",
    "MultitaskingViewFrame",
}


def enable_high_dpi_awareness() -> None:
    """
    启用高 DPI 感知：
    优先调用 SetProcessDpiAwareness(2) (PROCESS_PER_MONITOR_DPI_AWARE)，
    失败则降级调用 SetProcessDPIAware()。
    """
    try:
        # PROCESS_PER_MONITOR_DPI_AWARE = 2
        res = shcore.SetProcessDpiAwareness(2)
        logger.info("SetProcessDpiAwareness(2) 调用完成, 返回值: %s", res)
    except Exception as e:
        logger.warning("SetProcessDpiAwareness(2) 不可用 (%s)，尝试降级 SetProcessDPIAware()", e)
        try:
            user32.SetProcessDPIAware()
            logger.info("SetProcessDPIAware() 降级调用成功")
        except Exception as e2:
            logger.error("启用高 DPI 感知失败: %s", e2)


def get_primary_screen_size() -> Tuple[int, int]:
    """获取主显示器真实物理分辨率"""
    width = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
    height = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
    return width, height


def _is_window_cloaked(hwnd: int) -> bool:
    """判断窗口是否被 DWM 隐藏（如 UWP 后台挂起窗口、非当前虚拟桌面窗口）"""
    try:
        cloaked = ctypes.c_int(0)
        hr = dwmapi.DwmGetWindowAttribute(
            wintypes.HWND(hwnd),
            wintypes.DWORD(DWMWA_CLOAKED),
            ctypes.byref(cloaked),
            ctypes.sizeof(cloaked),
        )
        return hr == 0 and cloaked.value != 0
    except Exception:
        return False


def is_workstation_locked_or_sleeping() -> bool:
    """检测系统是否处于锁屏、屏保或显示屏休眠状态"""
    try:
        hdesk = user32.OpenInputDesktop(0, False, DESKTOP_READOBJECTS)
        if not hdesk:
            return True
        user32.CloseDesktop(hdesk)
        return False
    except Exception:
        return False


def is_desktop_occluded(self_hwnd: Optional[int] = None) -> bool:
    """
    参考 Wallpaper Engine 回放节能规则检测当前是否“不在桌面”：
    - 锁屏/屏保时 -> True（停止渲染并释放内存）
    - 任意其他应用最大化或全屏覆盖主显示器（>=88% 面积）时 -> True（暂停渲染）
    - 仅小窗口获得焦点但未遮挡桌面时 -> False（保持运行）
    """
    if is_workstation_locked_or_sleeping():
        return True

    try:
        screen_w, screen_h = get_primary_screen_size()
        screen_area = max(1, screen_w * screen_h)
    except Exception:
        return False

    occluded = False

    def _enum_cb(hwnd: int, _extra: object) -> bool:
        nonlocal occluded
        if occluded:
            return False
        if self_hwnd and hwnd == self_hwnd:
            return True
        if not win32gui.IsWindowVisible(hwnd) or win32gui.IsIconic(hwnd):
            return True
        if _is_window_cloaked(hwnd):
            return True

        try:
            cls = win32gui.GetClassName(hwnd)
        except Exception:
            return True
        if cls in _IGNORED_SHELL_CLASSES:
            return True

        try:
            ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            # 忽略透明悬浮小工具窗，除非它真正全屏覆盖
            is_tool = bool(ex_style & win32con.WS_EX_TOOLWINDOW)
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        except Exception:
            return True

        # 计算与主显示器 [0, 0, screen_w, screen_h] 的交集面积
        inter_w = max(0, min(right, screen_w) - max(left, 0))
        inter_h = max(0, min(bottom, screen_h) - max(top, 0))
        if inter_w <= 0 or inter_h <= 0:
            return True

        coverage = (inter_w * inter_h) / screen_area

        # 1. 其他应用程序最大化（在主屏占比 >= 65% 即判定为主屏最大化窗口）
        if (not is_tool) and user32.IsZoomed(wintypes.HWND(hwnd)) and coverage >= 0.65:
            occluded = True
            return False

        # 2. 其他应用程序全屏（PPT 放映、希沃白板全屏、全屏视频/游戏等覆盖 >= 88%）
        if coverage >= 0.88:
            occluded = True
            return False

        return True

    try:
        win32gui.EnumWindows(_enum_cb, None)
    except Exception:
        pass

    return occluded


def trim_process_memory() -> None:
    """在看板休眠/暂停时通知 Windows 回收闲置工作集内存"""
    try:
        hproc = kernel32.GetCurrentProcess()
        kernel32.SetProcessWorkingSetSize(hproc, ctypes.c_size_t(-1), ctypes.c_size_t(-1))
    except Exception:
        pass


def get_system_wallpaper_path() -> Optional[str]:
    """
    获取当前 Windows 系统桌面静态壁纸图片路径：
    优先调用 SPI_GETDESKWALLPAPER，若为空或文件不存在则尝试回退至 TranscodedWallpaper。
    """
    try:
        buf = ctypes.create_unicode_buffer(512)
        ok = user32.SystemParametersInfoW(SPI_GETDESKWALLPAPER, len(buf), buf, 0)
        if ok and buf.value and os.path.isfile(buf.value):
            return buf.value
    except Exception as e:
        logger.warning("读取 SPI_GETDESKWALLPAPER 失败: %s", e)

    try:
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            transcoded = os.path.join(
                appdata, "Microsoft", "Windows", "Themes", "TranscodedWallpaper"
            )
            if os.path.isfile(transcoded):
                return transcoded
    except Exception:
        pass
    return None


def refresh_desktop_wallpaper() -> None:
    """
    退出或脱离壁纸层时清理桌面残影：
    通过 SPI_GETDESKWALLPAPER 读取当前壁纸路径，再通过 SPI_SETDESKWALLPAPER 强制触发桌面重绘。
    """
    try:
        buf = ctypes.create_unicode_buffer(512)
        ok = user32.SystemParametersInfoW(SPI_GETDESKWALLPAPER, len(buf), buf, 0)
        if ok and buf.value:
            user32.SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                buf.value,
                SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE,
            )
            logger.info("已通过 SystemParametersInfoW 强制重绘系统原壁纸: %s", buf.value)
        else:
            # 兜底：向 Progman 发送重绘消息
            progman = win32gui.FindWindow("Progman", None)
            if progman:
                win32gui.InvalidateRect(progman, None, True)
                win32gui.UpdateWindow(progman)
            logger.info("已对 Progman 执行 InvalidateRect 刷新")
    except Exception as e:
        logger.error("刷新桌面原壁纸失败: %s", e)


def _trigger_workerw_creation() -> int:
    """
    向 Progman 发送未公开消息 0x052C（参数 wParam=0xD, lParam=0x1），
    触发 Explorer 生成承载壁纸层的 WorkerW。
    返回 Progman 句柄。
    """
    progman = win32gui.FindWindow("Progman", None)
    if not progman:
        raise RuntimeError("未找到桌面窗口 Progman")

    result = wintypes.DWORD()
    # 发送 0x052C (wParam=0xD, lParam=0x1) 兼容 Win10 & Win11
    user32.SendMessageTimeoutW(
        wintypes.HWND(progman),
        0x052C,
        wintypes.WPARAM(0xD),
        wintypes.LPARAM(0x1),
        SMTO_NORMAL,
        1000,
        ctypes.byref(result),
    )
    # 同时发送标准 0, 0 以确保老版本 Win10 兼容
    user32.SendMessageTimeoutW(
        wintypes.HWND(progman),
        0x052C,
        wintypes.WPARAM(0),
        wintypes.LPARAM(0),
        SMTO_NORMAL,
        1000,
        ctypes.byref(result),
    )
    return progman


def find_wallpaper_host() -> Tuple[int, Optional[int], str]:
    """
    探测桌面壁纸宿主窗口，支持双模式：
    返回: (host_parent_hwnd, shelldll_defview_hwnd, mode_name)
    - classic_workerw: 经典模式（Win10 / Win11 23H2 及以下），父窗口为独立的 WorkerW
    - win11_24h2_progman: Win11 24H2+ 模式，父窗口为 Progman（需将窗口 Z 轴排在 SHELLDLL_DefView 后方）
    """
    progman = _trigger_workerw_creation()

    shelldll_hwnd: Optional[int] = None
    workerw_after_shelldll: Optional[int] = None

    # 1. 检查 SHELLDLL_DefView 是否直接作为 Progman 的子窗口（Win11 24H2 常见结构）
    defview_in_progman = win32gui.FindWindowEx(progman, 0, "SHELLDLL_DefView", None)

    # 2. 枚举所有顶层窗口查找包含 SHELLDLL_DefView 的窗口及其后的 WorkerW（经典模式）
    def _enum_windows_cb(hwnd: int, _extra: object) -> bool:
        nonlocal shelldll_hwnd, workerw_after_shelldll
        defview = win32gui.FindWindowEx(hwnd, 0, "SHELLDLL_DefView", None)
        if defview:
            shelldll_hwnd = defview
            # 查找该顶层窗口之后的下一个顶层 WorkerW
            next_workerw = win32gui.FindWindowEx(0, hwnd, "WorkerW", None)
            if next_workerw:
                workerw_after_shelldll = next_workerw
        return True

    win32gui.EnumWindows(_enum_windows_cb, None)

    # 判断是否属于 Win11 24H2+ 结构：
    # 在 Win11 24H2 中，Progman 内部直接包含 SHELLDLL_DefView（有时还有一个子级 WorkerW），
    # 或者顶层没有生成独立的、位于 SHELLDLL_DefView 宿主之后的顶层 WorkerW。
    child_workerw_in_progman = win32gui.FindWindowEx(progman, 0, "WorkerW", None)

    if defview_in_progman and (not workerw_after_shelldll or child_workerw_in_progman):
        logger.info(
            "检测到 Win11 24H2+ 桌面结构 (Progman=0x%X, SHELLDLL_DefView=0x%X, ChildWorkerW=0x%X)",
            progman,
            defview_in_progman,
            child_workerw_in_progman or 0,
        )
        return progman, defview_in_progman, "win11_24h2_progman"

    if workerw_after_shelldll:
        logger.info(
            "检测到经典 WorkerW 桌面结构 (WorkerW=0x%X, SHELLDLL_DefView=0x%X)",
            workerw_after_shelldll,
            shelldll_hwnd or 0,
        )
        return workerw_after_shelldll, shelldll_hwnd, "classic_workerw"

    # 兜底：若顶层未找到 WorkerW，但找到 SHELLDLL_DefView，挂载到 Progman
    fallback_defview = defview_in_progman or shelldll_hwnd
    logger.info(
        "未找到独立顶层 WorkerW，启用 Progman 挂载模式 (Progman=0x%X, DefView=0x%X)",
        progman,
        fallback_defview or 0,
    )
    return progman, fallback_defview, "win11_24h2_progman"


def apply_desktop_bottom_fallback(hwnd: int, screen_w: int, screen_h: int) -> None:
    """
    当处于无 Explorer Shell（如独立沙盒桌面或 Explorer 重启中）导致未找到 Progman 时的安全降级：
    将窗口置于当前桌面最底层 (HWND_BOTTOM)，铺满全屏且不抢夺焦点。
    """
    win32gui.SetParent(hwnd, 0)
    win32gui.SetWindowPos(
        hwnd,
        win32con.HWND_BOTTOM,
        0,
        0,
        screen_w,
        screen_h,
        win32con.SWP_NOACTIVATE | win32con.SWP_FRAMECHANGED | win32con.SWP_SHOWWINDOW,
    )
    win32gui.ShowWindow(hwnd, win32con.SW_SHOW)


def find_window_by_title(title: str, timeout: float = 8.0) -> Optional[int]:
    """轮询等待指定标题的窗口句柄出现"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        hwnd = win32gui.FindWindow(None, title)
        if hwnd and win32gui.IsWindow(hwnd):
            return hwnd
        time.sleep(0.08)
    return None


class WallpaperController:
    """管理单个 WebView2 窗口在「桌面壁纸层」与「置顶交互窗口」之间的切换"""

    def __init__(self, window_title: str, interactive_size: Tuple[int, int] = (1280, 800)) -> None:
        self.window_title = window_title
        self.interactive_width, self.interactive_height = interactive_size
        self.hwnd: Optional[int] = None
        self.is_wallpaper_mode: bool = False
        self._saved_style: Optional[int] = None
        self._saved_ex_style: Optional[int] = None
        self._lock = threading.Lock()

    def ensure_hwnd(self) -> Optional[int]:
        if self.hwnd and win32gui.IsWindow(self.hwnd):
            return self.hwnd
        self.hwnd = find_window_by_title(self.window_title, timeout=8.0)
        if self.hwnd:
            logger.info("已绑定 WebView 窗口句柄: 0x%X (%s)", self.hwnd, self.window_title)
        else:
            logger.error("未能找到目标窗口句柄: %s", self.window_title)
        return self.hwnd

    def attach_to_desktop(self) -> bool:
        """将当前窗口嵌入 Windows 桌面图标层后方作为动态壁纸"""
        with self._lock:
            return self._attach_to_desktop_locked()

    def _attach_to_desktop_locked(self) -> bool:
        hwnd = self.ensure_hwnd()
        if not hwnd:
            return False

        try:
            screen_w, screen_h = get_primary_screen_size()

            # 首次进入壁纸模式前保存原始窗口样式，以便切换回交互模式时恢复
            cur_style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
            cur_ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            if self._saved_style is None:
                self._saved_style = cur_style
            if self._saved_ex_style is None:
                self._saved_ex_style = cur_ex_style

            # 1. 移除边框、标题栏、系统菜单与最大最小化按钮，设置为无边框可见窗口
            borderless_style = cur_style & ~(
                win32con.WS_CAPTION
                | win32con.WS_THICKFRAME
                | win32con.WS_MINIMIZE
                | win32con.WS_MAXIMIZE
                | win32con.WS_SYSMENU
                | win32con.WS_POPUP
            )

            # 2. 设置 WS_EX_TOOLWINDOW 并移除 WS_EX_APPWINDOW，隐藏任务栏与 Alt+Tab 图标
            tool_ex_style = (cur_ex_style | win32con.WS_EX_TOOLWINDOW) & ~win32con.WS_EX_APPWINDOW
            tool_ex_style &= ~win32con.WS_EX_TOPMOST

            try:
                host_hwnd, defview_hwnd, mode = find_wallpaper_host()
            except RuntimeError as e:
                logger.warning("%s，启用 HWND_BOTTOM 全屏桌面底层降级模式", e)
                win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, tool_ex_style)
                win32gui.SetWindowLong(
                    hwnd, win32con.GWL_STYLE, borderless_style | win32con.WS_POPUP | win32con.WS_VISIBLE
                )
                apply_desktop_bottom_fallback(hwnd, screen_w, screen_h)
                self.is_wallpaper_mode = True
                return True

            # Win11 24H2+ 适配：Progman 使用了 WS_EX_NOREDIRECTIONBITMAP，
            # 挂载到 Progman 的子窗口需附带 WS_EX_LAYERED 并设为不透明 (alpha=255)，
            # 才能被 DWM 正确合成在 SHELLDLL_DefView（图标）正后方、静态壁纸 WorkerW 正上方。
            if mode == "win11_24h2_progman":
                tool_ex_style |= win32con.WS_EX_LAYERED

            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, tool_ex_style)
            if mode == "win11_24h2_progman":
                user32.SetLayeredWindowAttributes(wintypes.HWND(hwnd), 0, 255, LWA_ALPHA)

            borderless_style |= win32con.WS_CHILD | win32con.WS_VISIBLE
            win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, borderless_style)

            # 3. 挂载父窗口
            win32gui.SetParent(hwnd, host_hwnd)

            # 4. 根据桌面模式设置窗口位置、尺寸与 Z 轴顺序
            if mode == "win11_24h2_progman" and defview_hwnd:
                # Win11 24H2+ 模式：父窗口为 Progman，将窗口 Z 轴紧贴排在 SHELLDLL_DefView 正后方
                win32gui.SetWindowPos(
                    hwnd,
                    defview_hwnd,
                    0,
                    0,
                    screen_w,
                    screen_h,
                    win32con.SWP_NOACTIVATE | win32con.SWP_FRAMECHANGED | win32con.SWP_SHOWWINDOW,
                )
                # 将 Progman 下的子级 WorkerW（系统静态壁纸）排在我们的看板之后
                child_workerw = win32gui.FindWindowEx(host_hwnd, 0, "WorkerW", None)
                if child_workerw and child_workerw != hwnd:
                    win32gui.SetWindowPos(
                        child_workerw,
                        hwnd,
                        0,
                        0,
                        0,
                        0,
                        win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOACTIVATE,
                    )
            else:
                # 经典 WorkerW 模式：直接铺满 WorkerW 客户区
                win32gui.SetWindowPos(
                    hwnd,
                    win32con.HWND_TOP,
                    0,
                    0,
                    screen_w,
                    screen_h,
                    win32con.SWP_NOACTIVATE | win32con.SWP_FRAMECHANGED | win32con.SWP_SHOWWINDOW,
                )

            win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
            self.is_wallpaper_mode = True
            logger.info(
                "已挂载至桌面壁纸层 [模式=%s, 父窗口=0x%X, 分辨率=%dx%d]",
                mode,
                host_hwnd,
                screen_w,
                screen_h,
            )
            return True
        except Exception as e:
            logger.exception("挂载至桌面壁纸层失败: %s", e)
            return False

    def detach_to_interactive(self) -> bool:
        """
        脱离桌面壁纸层，恢复为居中、带标题栏的可交互置顶窗口（方便用户点击、输入和登录）
        """
        with self._lock:
            return self._detach_to_interactive_locked()

    def _detach_to_interactive_locked(self) -> bool:
        hwnd = self.ensure_hwnd()
        if not hwnd:
            return False

        try:
            screen_w, screen_h = get_primary_screen_size()
            win_w = min(self.interactive_width, screen_w - 80)
            win_h = min(self.interactive_height, screen_h - 80)
            pos_x = max(0, (screen_w - win_w) // 2)
            pos_y = max(0, (screen_h - win_h) // 2)

            # 1. 将父窗口重置为桌面根窗口 (0 / NULL)
            win32gui.SetParent(hwnd, 0)

            # 2. 恢复标准带边框可调整窗口样式（移除 WS_CHILD）
            normal_style = (
                win32con.WS_OVERLAPPEDWINDOW
                | win32con.WS_VISIBLE
                | win32con.WS_CLIPCHILDREN
                | win32con.WS_CLIPSIBLINGS
            )
            win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, normal_style)

            # 3. 恢复扩展样式（移除 WS_EX_TOOLWINDOW 与 WS_EX_LAYERED，显示在任务栏并置顶）
            normal_ex_style = (
                (self._saved_ex_style or 0)
                & ~win32con.WS_EX_TOOLWINDOW
                & ~win32con.WS_EX_LAYERED
            ) | win32con.WS_EX_APPWINDOW | win32con.WS_EX_TOPMOST
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, normal_ex_style)

            # 4. 居中并置顶窗口
            win32gui.SetWindowPos(
                hwnd,
                win32con.HWND_TOPMOST,
                pos_x,
                pos_y,
                win_w,
                win_h,
                win32con.SWP_FRAMECHANGED | win32con.SWP_SHOWWINDOW,
            )
            win32gui.ShowWindow(hwnd, win32con.SW_SHOWNORMAL)
            try:
                win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass

            self.is_wallpaper_mode = False
            # 脱离壁纸层后立即刷新系统原壁纸，清除壁纸层残影
            refresh_desktop_wallpaper()
            logger.info("已切换为置顶交互窗口模式 (%dx%d)", win_w, win_h)
            return True
        except Exception as e:
            logger.exception("切换为置顶交互窗口失败: %s", e)
            return False

    def toggle_mode(self) -> bool:
        """在「壁纸模式」与「置顶交互模式」之间切换"""
        if self.is_wallpaper_mode:
            return self.detach_to_interactive()
        return self.attach_to_desktop()

    def cleanup(self) -> None:
        """退出程序前清理窗口挂载关系并重绘系统桌面壁纸"""
        try:
            if self.hwnd and win32gui.IsWindow(self.hwnd):
                win32gui.SetParent(self.hwnd, 0)
        except Exception:
            pass
        refresh_desktop_wallpaper()
