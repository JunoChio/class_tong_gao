# 班级桌面看板 · Cloudflare 免费版部署与使用指南

本项目包含两部分（都在桌面的 `aaa` 文件夹中）：
1. **教室桌面端程序**：`dist\DesktopBoard.exe`（单文件绿色版，拷到教室 Windows 电脑即可直接运行，透明叠加在教室原壁纸之上、桌面图标之下）。
2. **在线编辑与看板网站**：`classboard-web\`（Next.js 静态站点 + Cloudflare Pages Functions + Cloudflare KV，**完全免费部署**）。

---

## 一、3 分钟免费部署到 Cloudflare Pages

### 第 1 步：把 `classboard-web` 上传到 GitHub（或直接上传构建好的 `out` 目录）
推荐用 GitHub 仓库（以后改代码自动部署）：
1. 在 GitHub 新建一个私有或公开仓库，将 `classboard-web` 文件夹里的代码推送上去。

### 第 2 步：在 Cloudflare 创建免费 KV 数据库（用来保存课表、作业、待办、寄语）
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 左侧菜单点击 **Storage & Databases（存储和数据库）** → **KV**。
3. 点击 **Create a namespace（创建命名空间）**，名称填 `classboard-kv`，点击创建。

### 第 3 步：在 Cloudflare Pages 部署网站
1. 左侧菜单点击 **Workers & Pages** → **Create** → 选择 **Pages** → **Connect to Git**。
2. 选择你刚上传的仓库，构建设置按下面填：
   - **Framework preset（框架预设）**：`Next.js (Static HTML Export)`
   - **Build command（构建命令）**：`npm run build`
   - **Build output directory（输出目录）**：`out`
   - （如果 `classboard-web` 是仓库里的子目录，在 Root directory 填 `classboard-web`）
3. 点击 **Save and Deploy**，等待 1~2 分钟即可拿到你的免费网址（例如 `https://classboard-xxx.pages.dev`）。

### 第 4 步：绑定 KV 存储 & 设置编辑密码（关键一步！）
1. 进入刚才创建好的 Pages 项目 → 点击 **Settings（设置）** → **Bindings（绑定）**（或 Functions）：
   - 添加 **KV namespace binding**：
     - **Variable name（变量名）**：必须填 `BOARD_KV`
     - **KV namespace**：选择第 2 步创建的 `classboard-kv`
2. （推荐）在 **Settings → Environment variables（环境变量）** 中添加：
   - **Variable name**：`ADMIN_PASSWORD`
   - **Value**：设置你自己的老师管理密码（不填的话默认密码是 `123456`）
3. 回到 **Deployments** 点一次 **Retry deployment** 让绑定生效！

> **国内直连小贴士**：如果教室电脑不挂代理，建议在 Pages 的 **Custom domains（自定义域）** 里绑定一个你自己的普通域名，国内教室电脑访问会秒开且非常稳定。

---

## 二、日常怎么使用？

### 1. 教室电脑部署（只需配置一次）
1. 将 `aaa\dist\DesktopBoard.exe` 复制到教室电脑任意文件夹（比如 `D:\ClassBoard\DesktopBoard.exe`）。
2. 在同级目录放一个 `config.json`（或双击运行一次让它自动生成再修改），把 `url` 改为你的 Cloudflare 网站地址：
   ```json
   {
       "url": "https://你的看板域名",
       "auto_start": true,
       "start_as_wallpaper": true,
       "sync_system_wallpaper": true,
       "window_title": "DesktopBoard_Wallpaper_Host",
       "interactive_width": 1280,
       "interactive_height": 800
   }
   ```
3. 双击运行 `DesktopBoard.exe`：
   - 看板自动贴在**教室原壁纸上面、桌面图标下面**，左侧留空完全不挡桌面课件图标。
   - 右下角系统托盘右键可以一键勾选 **「开机自启」**，以后教室电脑每天开机自动显示今日课表和作业！

### 2. 老师手机 / 办公电脑随时更新内容
1. 浏览器打开 **`https://你的看板域名/admin`**。
2. 输入管理密码（默认 `123456`），修改：
   - 班级名称、左侧图标留白宽度
   - 周一至周五课表（教室电脑自动按当天星期切换！）
   - 今日作业（语文 / 数学 / 英语 / 自定义学科及卡片配色）
   - 班级待办提醒 & 班主任寄语
3. 点击 **「保存并推送」** —— 教室电脑桌面 **30 秒内自动同步更新**，全程无需去碰教室电脑！
