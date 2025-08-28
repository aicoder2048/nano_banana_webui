---
title: 在 macOS 上使用 npm 安装并运行 serve 的两种方式
author: Your Name
date: 2025-08-28
---

# 在 macOS 上使用 npm 安装并运行 `serve` 的两种方式

> 本文档适用于 macOS 用户，演示如何以「全局」或「项目本地」方式安装并运行静态文件服务器 `serve`。

---

## 1. 全局安装（-g）

| 项目 | 路径/说明 |
|------|-----------|
| **安装目录** | `/usr/local/lib/node_modules/serve` |
| **可执行文件软链** | `/usr/local/bin/serve → /usr/local/lib/node_modules/serve/bin/serve.js` |
| **安装命令** | `sudo npm install -g serve` |
| **使用命令** | 任意目录下直接运行 `serve .` |
| **优点** | 一次安装，全系统可用 |
| **缺点** | 版本冲突风险；需要管理员权限或 `nvm` |

---

## 2. 本地安装（项目级）

| 项目 | 路径/说明 |
|------|-----------|
| **安装目录** | 项目根目录下的 `node_modules/serve` |
| **可执行文件路径** | `./node_modules/.bin/serve` |
| **安装命令** | `npm install serve`（在项目根目录执行） |
| **运行命令** | `npx serve .` 或 `./node_modules/.bin/serve .` |
| **优点** | 版本锁定在项目内，避免冲突；无需 sudo；CI/协作友好 |
| **缺点** | 需用 `npx` 或脚本调用 |

---

## 快速对照表

| 场景 | 全局安装 | 本地安装 |
|------|----------|----------|
| 安装命令 | `sudo npm i -g serve` | `npm i serve` |
| 运行命令 | `serve .` | `npx serve .` |
| 版本隔离 | ❌ | ✅ |
| 管理员权限 | 需要 | 不需要 |
| CI/CD 适用 | 需额外安装 | 直接可用 |

---

## 附：把本地运行写成 npm script

在 `package.json` 中增加：

```json
{
  "scripts": {
    "serve": "serve ."
  }
}
```

以后只需：
```bash
npm run serve
```
