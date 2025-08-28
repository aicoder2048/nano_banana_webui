# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Aice PS 是一款功能强大的网页版 AI 图片编辑器，基于 Google aistudio 的 Gemini API 构建。这是一个现代化的 React 应用程序，使用 TypeScript 开发，支持各种 AI 图像处理功能。

## 核心架构

### 技术栈
- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite (无复杂构建步骤)  
- **AI 服务**: Google Gemini API (`gemini-2.5-flash-image-preview`, `imagen-4.0-generate-001`, `gemini-2.5-flash`)
- **样式**: Tailwind CSS (通过 CDN)
- **图像处理**: `react-image-crop` 组件

### 项目结构
- `App.tsx` - 主应用组件，包含所有状态管理和核心图像处理逻辑
- `components/` - UI 组件目录
  - 功能面板组件：`FilterPanel`, `AdjustmentPanel`, `TexturePanel`, `FusionPanel`, `ErasePanel`
  - 界面组件：`Header`, `Toolbar`, `StartScreen`, `PastForwardPage`
  - 工具组件：`ImageUploader`, `CropPanel`, `SettingsModal`
- `services/geminiService.ts` - Gemini API 集成服务
- `types.ts` - TypeScript 类型定义  
- `lib/albumUtils.ts` - 图像处理工具函数

### API 配置
- 生产环境：通过 `GEMINI_API_KEY` 环境变量配置 API 密钥
- 本地开发：支持通过浏览器 localStorage 设置 API 密钥
- Vite 配置中将环境变量注入为 `process.env.API_KEY`

## 开发命令

### 本地开发
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
```

### 本地服务器启动 (无需构建)
```bash
npm install -g serve
serve .              # 使用 serve 启动静态服务器
# 或
python -m http.server # 使用 Python 启动服务器
```

## AI 模型集成

### 核心模型
1. **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image-preview`) - 图像编辑核心引擎
   - 局部编辑：点击图像指定位置进行修改
   - 上下文理解：深度理解图像内容并根据自然语言指令操作
   - 多图融合：理解并融合多张输入图片

2. **Imagen 4** (`imagen-4.0-generate-001`) - 文本到图像生成
   - 负责"用 AI 创造图像"功能

3. **Gemini 2.5 Flash** (`gemini-2.5-flash`) - 文本分析和灵感建议
   - "获取灵感"功能，分析图片并生成编辑建议

### API 服务函数
- `generateEditedImage()` - 图像编辑
- `generateFilteredImage()` - 滤镜应用  
- `generateAdjustedImage()` - 图像调整
- `generateFusedImage()` - 多图融合
- `generateTexturedImage()` - 纹理叠加
- `removeBackgroundImage()` - 背景移除

## 关键功能特性

### 图像编辑功能
- **智能修饰**: 点击图像任意位置通过文字指令进行局部修改
- **创意滤镜**: 多种艺术风格滤镜（动漫风、合成波、Lomo 等）
- **专业调整**: 背景虚化、细节增强、光效调整
- **智能合成**: 多张图片（1-3张）无缝融合
- **纹理叠加**: 各种创意纹理效果
- **一键抠图**: 自动背景移除，生成透明 PNG

### 用户界面特性
- **历史记录**: "Past Forward"页面展示编辑历史
- **撤销/重做**: 完整的操作历史管理
- **对比视图**: 原图与编辑后对比
- **裁剪工具**: 基于 react-image-crop 的裁剪功能

## 开发注意事项

### 状态管理
- 应用状态主要在 `App.tsx` 中集中管理
- 使用 React hooks (useState, useCallback, useRef, useEffect) 管理状态
- 图像历史记录通过数组状态维护

### 图像处理
- 使用 Canvas API 进行图像操作和裁剪
- 支持多种图像格式的 DataURL 转换
- 图像加载使用 `crossOrigin='anonymous'` 确保 Canvas 兼容性

### 错误处理
- Gemini API 错误统一在 `geminiService.ts` 中处理
- 支持中英文错误消息
- API 密钥验证和错误提示

### 部署配置
- **Vercel 部署**: 静态站点，Framework Preset 选择 "Other"
- **环境变量**: 必须设置 `API_KEY` 环境变量为 Gemini API 密钥
- **无构建步骤**: 项目可直接通过静态服务器运行