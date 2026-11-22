# DesktopBoard · 班级桌面看板

把班级课表、今日作业、待办提醒和班主任寄语，直接"贴"在 Windows 桌面上——在壁纸之上、桌面图标之下，不影响正常使用电脑。

项目由两部分组成：

| 目录 | 说明 |
| --- | --- |
| 根目录（Python） | Windows 桌面客户端，用 pywebview + Win32 API 把网页渲染成桌面壁纸层 |
| `classboard-web/` | Next.js 静态站点 + Cloudflare Pages Functions + KV，负责在线编辑与数据同步 |

---

## 功能特性

- **壁纸层渲染**：网页直接叠加在系统壁纸之上、桌面图标之下，左侧可留白，不遮挡课件和桌面图标
- **托盘控制**：系统托盘右键一键切换「桌面壁纸模式 / 置顶交互模式」，支持开机自启
- **单实例运行**：互斥体保护，避免多个进程抢占 WebView2 缓存目录
- **持久化登录态**：独立 WebView2 数据目录（`%LOCALAPPDATA%\DesktopBoard\WebView2Data`），Cookie / LocalStorage 不丢失
- **自动同步**：在线改完课表后，教室电脑 30 秒内自动拉取更新，无需操作教室电脑
- **省电省内存**：桌面被全屏窗口遮挡时自动暂停刷新，并定期回收进程内存
- **绿色免安装**：PyInstaller 打包为单文件 exe，拷到教室电脑双击即用

---

## 目录结构

```
.
├── main.py                  # 主程序入口（窗口 / WebView / 单实例）
├── win32_wallpaper.py       # Win32 壁纸层窗口与桌面遮挡检测
├── tray.py                  # 系统托盘
├── autostart.py             # 开机自启（注册表）
├── config_manager.py        # config.json 读写、日志与缓存路径
├── config.example.json      # 配置模板
├── DesktopBoard.spec        # PyInstaller 打包配置
├── build.bat                # 一键打包脚本
├── icon.ico                 # 托盘图标
└── classboard-web/          # Next.js 前端 + Cloudflare Functions
    ├── src/app/             # 看板页 / 管理后台页
    ├── src/components/      # 看板渲染组件
    ├── src/lib/             # 接口、实时同步、校历、天气
    ├── functions/api/       # Cloudflare Pages Functions（board / weather）
    └── wrangler.toml
```

---

## 快速开始

### 1. 桌面客户端

```bat
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py
```

首次运行会在同级目录自动生成 `config.json`，可参考 `config.example.json` 修改：

```json
{
    "url": "https://你的看板域名",
    "auto_start": true,
    "start_as_wallpaper": true,
    "sync_system_wallpaper": true,
    "pause_when_occluded": true,
    "window_title": "DesktopBoard_Wallpaper_Host",
    "interactive_width": 1280,
    "interactive_height": 800
}
```

### 2. 打包单文件 exe

```bat
build.bat
```

产物：`dist\DesktopBoard.exe`。

### 3. 前端看板网站

```bat
cd classboard-web
npm install
npm run dev      # http://localhost:3000 ，管理后台 /admin
npm run build    # 静态导出到 out/
```

部署到 Cloudflare Pages（免费）的完整步骤见
[`classboard-web/README_CLOUDFLARE部署指南.md`](classboard-web/README_CLOUDFLARE部署指南.md)：

1. 创建 KV 命名空间，绑定变量名 `BOARD_KV`
2. 设置环境变量 `ADMIN_PASSWORD`（默认 `123456`，请务必修改）
3. 构建命令 `npm run build`，输出目录 `out`

---

## 日常使用

- 教室电脑：把 `DesktopBoard.exe` 拷到任意目录，同目录放好 `config.json`，双击运行即可
- 老师端：浏览器打开 `https://你的看板域名/admin`，输入管理密码，改完点「保存并推送」

---

## 环境要求

- Windows 10 / 11，需已安装 **Microsoft Edge WebView2 Runtime**（Win11 自带）
- Python 3.9+（客户端）
- Node.js 18+（前端）

---

## 说明

- `config.json`、`app.log`、`.venv`、`node_modules`、构建产物等均已在 `.gitignore` 中排除
- 打包产物请通过 GitHub Releases 发布，不要提交进仓库
