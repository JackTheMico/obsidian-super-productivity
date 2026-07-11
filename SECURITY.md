# Security Policy / 安全策略

## Reporting a Vulnerability / 报告漏洞

If you discover a security vulnerability in this plugin, please report it privately
by opening a **GitHub Issue** with the label `security` or contacting the maintainer
directly through the issue tracker.

如发现本插件存在安全漏洞，请通过 **GitHub Issue** 添加 `security` 标签，或在 issue 中直接联系维护者。

Please include the following details:

- Plugin version / 插件版本
- Obsidian version / Obsidian 版本
- A description of the vulnerability / 漏洞描述
- Steps to reproduce (if applicable) / 复现步骤（如适用）

## Scope / 范围

This plugin operates entirely locally and communicates only with the Super Productivity
local REST API (`http://127.0.0.1:3876` by default). It does **not** make external
network requests, collect telemetry, or transmit vault data to third parties.

本插件完全本地运行，仅与 Super Productivity 本地 REST API（默认 `http://127.0.0.1:3876`）通信。
插件**不会**发起外部网络请求、收集遥测数据或将 vault 数据发送给第三方。

## Response / 响应时间

I will acknowledge receipt of a vulnerability report within **7 days** and will
work to address verified issues promptly.

我将在 **7 天内**确认收到漏洞报告，并尽快修复已验证的问题。
