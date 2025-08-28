# Aice PS - AI 图片编辑器

Aice PS 是一款功能强大的网页版 AI 照片编辑器，利用 Google aistudio 的先进能力，让专业级的图像编辑和创作变得简单直观。用户可以通过简单的文本提示对图像进行修饰、应用创意滤镜、进行专业调整，甚至从零开始生成全新的图像。

![Aice PS 界面截图](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/gemini-2-5-flash-prompt-based-image-editing.original.png)

## 注意，调用 gemini api key 是需要收费的。但直接调用环境变量中的api是免费的。

### [【AiStudio DEMO】](https://ai.studio/apps/drive/1JSVTWc7Pe1GfLLrQcBWPZF_yH_80xUGg)  [【视频教程】](https://www.bilibili.com/video/BV1y6e2z3EDS/)  [【交流群】](https://cnb.cool/fuliai/comfyui/-/issues/11) 

> 登录了google aistudio 的可以直接打开上面 app 使用。

> 请大家谨慎使用自己的gemini api key

## 视频中提示词：[点这里查看](prompt.md)

## ✨ 主要功能

- **AI 图像生成**: 通过文本描述直接创作高质量图片，并支持多种宽高比。
- **智能修饰**: 在图片上指定任意位置，通过文字指令进行局部修改（如“移除这个物体”、“把衬衫变成红色”）。
- **创意滤镜**: 一键应用多种艺术风格滤镜，如动漫风、合成波、Lomo 效果等。
- **专业调整**: 对图片进行全局调整，如背景虚化、增强细节、调整光效等。
- **智能合成**: 上传 1-3 张图片，通过描述将它们无缝地融合在一起。
- **纹理叠加**: 为图片添加各种创意纹理，如裂纹漆、木纹、金属拉丝等。
- **一键抠图**: 自动移除图片背景，生成透明背景的 PNG 图像。
- **AI 灵感建议**: AI 会分析您的图片，并为您推荐合适的滤镜、调整和纹理效果。
- **Past Forward 时光穿越**: 将照片中的人物重新想象成不同年代的风格（1950s-2000s），包括服装、发型、照片质感等。支持单张图片放大查看和下载。
- **基础编辑**: 包括无限制的裁剪、撤销/重做、对比原图、保存和下载。

## 🛠️ 技术栈

- **前端**: React 19 (通过 esm.sh 加载，无构建步骤)
- **语言**: TypeScript
- **AI 模型**: Google Gemini API (`gemini-2.5-flash-image-preview`, `imagen-4.0-generate-001`, `gemini-2.5-flash`)
- **样式**: Tailwind CSS (通过 CDN)
- **组件库**: `react-image-crop`

## 🎨 核心 AI 模型介绍

Aice PS 的强大功能由 Google 最先进的一系列生成式 AI 模型驱动，每个模型都在特定任务中发挥着关键作用。

### 1. Gemini 2.5 Flash Image (`gemini-2.5-flash-image-preview`)

这款模型是 Aice PS 所有核心**图像编辑功能**的引擎，也被称为 "Nano Banana"。它不仅仅是一个图像生成器，更是一个上下文编辑器，能够深度理解图像内容并根据自然语言指令进行精确操作。

其主要优势包括：

-   **高级推理与上下文理解**: 模型能像人类一样“思考”用户的编辑意图。例如，当要求“将一个在烤箱里烤了4天的千层面”可视化时，它会生成一个烧焦的、冒着烟的千层面，而不是一个完美的成品，展现了其卓越的逻辑推理能力。
-   **卓越的角色与场景一致性**: 在进行多次编辑或生成系列图片时，能够保持主体角色和场景风格的高度一致性。这对于故事叙述、视频镜头生成或品牌资产设计至关重要。
-   **精确的局部编辑**: 用户可以在图像上指定一个点，然后用自然语言描述修改内容（例如，“移除这个人”或“给这件衬衫添加条纹”），模型会进行无缝、逼真的修改，同时保持图像其他部分不变。
-   **文本与细节处理**: 能够识别并修改图像中的文字，例如更改报纸标题或产品标签，同时保持原始字体和风格。它还能修复旧照片、消除运动模糊，并保留关键细节。
-   **多图像融合**: 模型可以理解并融合多张输入图片，例如将一个物体放入新场景，或将一个房间的风格替换为另一张图的纹理。

### 2. Imagen 4 (`imagen-4.0-generate-001`)

这款模型是业界领先的**文本到图像生成**模型，负责应用初始屏幕上的“用 AI 创造图像”功能。当用户输入一段描述性文字时，Imagen 4 会将其转化为一幅高质量、富有创意且与描述高度相关的图像。

### 3. Gemini 2.5 Flash (`gemini-2.5-flash`)

这是一款速度极快且高效的多模态模型，在 Aice PS 中主要负责**文本和逻辑分析**任务。当用户点击“获取灵感”时，Gemini 2.5 Flash 会分析当前图片，并根据其内容、风格和构图，智能地生成一系列富有创意的编辑建议（滤镜、调整、纹理等），为用户提供创作灵感。

## 🚀 快速开始 (本地开发)

该项目无需复杂的构建工具，可以直接在浏览器中运行。

### 1. 安装依赖

首先克隆仓库并安装依赖：

```bash
git clone <repository-url>
cd NanoBananaWebUI
npm install
```

### 2. 准备环境

- 一个现代的网页浏览器 (如 Chrome, Firefox, Edge)。
- Node.js (推荐版本 16+)

**推荐方式 - 使用 Vite 开发服务器：**
```bash
npm run dev
```

**替代方式 - 使用静态服务器：**
如果您想使用静态服务器，可以使用 `serve`：
```bash
npm install -g serve
serve .
```
或者，如果您安装了 Python 3，可以使用：
```bash
python -m http.server
```

### 3. 配置 API 密钥

要使用 AI 功能，您需要一个 Google Gemini API 密钥。

- **获取密钥**: 访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 创建您的免费 API 密钥。
- **配置密钥**:
  1. 在项目根目录下创建 `.env` 文件：
     ```bash
     echo "GEMINI_API_KEY=你的API密钥" > .env
     ```
  2. 或者在终端中设置环境变量：
     ```bash
     export GEMINI_API_KEY=你的API密钥
     ```

**重要**: 确保不要将 `.env` 文件提交到 git 仓库中。

### 4. 运行应用

- 使用 `npm run dev` 时，应用会在 `http://localhost:5173` 启动（Vite 默认端口）
- 使用 `serve .` 时，通常在 `http://localhost:3000` 
- 使用 Python 服务器时，通常在 `http://localhost:8000`

在浏览器中访问对应地址即可开始使用。

## 部署到 Vercel (推荐)

将此项目部署到 Vercel 非常简单，只需几分钟。

### 步骤 1: Fork & 导入仓库

1.  **Fork** 此 GitHub 仓库到您自己的账户。
2.  登录您的 [Vercel](https://vercel.com/) 账户。
3.  点击 "Add New... -> Project"，然后选择您刚刚 Fork 的仓库并点击 "Import"。

### 步骤 2: 配置项目

1.  Vercel 会自动识别这是一个静态项目。在 **Framework Preset** 部分，选择 **Other**。
2.  **构建和输出设置**部分保持默认即可，**无需任何构建命令**。

### 步骤 3: 设置环境变量 (关键！)

这是最重要的一步，它让您的线上应用能够安全地使用 API。

1.  展开 **Environment Variables** (环境变量) 部分。
2.  添加一个新的环境变量：
    - **Name**: `GEMINI_API_KEY`
    - **Value**: 粘贴您从 Google AI Studio 获取的 Gemini API 密钥。
3.  点击 "Add" 保存变量。

### 步骤 4: 部署

点击 **Deploy** 按钮。Vercel 会在几十秒内完成部署，之后您就可以通过 Vercel 提供的 URL 访问您的线上 AI 图片编辑器了！

###  [【视频教程】](https://www.bilibili.com/video/BV1y6e2z3EDS/)  [【交流群】](https://cnb.cool/fuliai/comfyui/-/issues/11) 

## 📄 许可证

本项目采用 [Apache-2.0](./LICENSE) 许可证。
