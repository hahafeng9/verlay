# verlay

在 [Vercel](https://vercel.com) 上部署 VLESS over WebSocket 代理服务。

## 部署

1. Fork 本仓库到你的 GitHub 账号。
2. 登录 [Vercel](https://vercel.com)，点击 **Add New Project**，导入 Fork 后的仓库。
3. 在部署配置页展开 **Environment Variables**，添加以下变量：

| 变量 | 是否必填 | 含义 |
|------|----------|------|
| UUID | 是 | 客户端 UUID，自行生成一个即可 |
| DOMAIN | 是 | 实际使用的访问域名，不含协议；建议使用自定义域名（见下方说明） |
| REMARKS | 否 | 订阅备注名，默认 `vercel-ws` |

4. 点击 **Deploy** 完成首次部署。
5. 到项目 **Settings** → **Domains** 添加自定义域名，并将 `DOMAIN` 环境变量设为该域名后重新部署。

> **重要：** Vercel 默认分配的 `*.vercel.app` 域名在国内可能无法访问，请务必绑定自定义域名后再使用。`DOMAIN` 需与最终访问域名保持一致。

## 获取订阅链接

部署成功后，访问以下地址获取订阅信息（返回内容为 Base64 编码）：

`https://<DOMAIN>/<UUID>`

- `<DOMAIN>`：环境变量 `DOMAIN` 的值
- `<UUID>`：环境变量 `UUID` 的值

该路径同时作为订阅密钥，请勿公开分享。

## 说明

- WebSocket 需要 [Fluid Compute](https://vercel.com/docs/fluid-compute)，2025 年 4 月 23 日后创建的项目默认已开启。
- 连接最长维持 300 秒，超时后客户端需自行重连；更多限制见 [Vercel Functions 文档](https://vercel.com/docs/functions/limitations)。
