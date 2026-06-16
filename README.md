# NidayedeSMS

Android 短信监听转发到飞书群机器人的小工具。基于 uni-app (Vue 3) + HBuilder X 5+App 运行时。

## 功能

- 后台轮询 Android 系统短信，发现新短信即推送到飞书群机器人
- 两种过滤模式：
  - **所有短信**：来一条转一条
  - **仅验证码**（默认）：通过关键词、发件号段（106 开头）、常见格式正则识别验证码短信，过滤掉无关内容
- 失败自动重试 3 次，间隔 2 秒
- 本地保存最近 100 条转发日志和已处理短信指纹（防重复推送）
- 转发成功/失败时弹 Toast，并尝试发原生通知

## 工作方式

1. `utils/smsMonitor.js` 启动后每 5 秒查询一次 `content://sms/`，只取最近 5 分钟内 `type == 1`（已接收）的短信
2. 用「日期 + 发件人 + 正文前 20 字」生成指纹去重
3. 通过 `uni.request` 直接 POST 到飞书 Webhook：

   ```json
   {
     "msg_type": "text",
     "content": { "text": "【短信转发】\n发件人: ...\n时间: ...\n类型: ...\n内容: ..." }
   }
   ```

## 使用

### 1. 配置 webhook

打开 `utils/smsMonitor.js`，把第 6 行的占位符换成你自己的飞书机器人 webhook：

```js
const API_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/你的key'
```

获取方式：飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人 → 复制 Webhook 地址。

### 2. 配置机器人安全策略

飞书自定义机器人必须开启至少一项安全设置：

- **关键词**：推荐填 `短信转发`（代码里的消息文案默认带这四个字）
- **签名校验**：⚠️ 纯前端调不通，需要后端代签或不要选这个

### 3. 编译运行

用 HBuilder X 打开本项目目录 → 运行 → 运行到手机或模拟器 → Android App 基座。或者云打包 / 本地打包 APK 后安装。

### 4. 授予权限

首次启动时手动同意：

- 读取短信 (`READ_SMS`)
- 接收短信 (`RECEIVE_SMS`)
- 后台运行 / 忽略电池优化（保证应用被杀后还能轮询）

### 5. 进入应用

首页 → 进入「短信监听」页 → 选择模式 → 点「启动监听」。

## Android 权限

`manifest.json` 已声明：`READ_SMS`、`RECEIVE_SMS`、`INTERNET`、`FOREGROUND_SERVICE`、`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 等。

## 目录结构

```
.
├── App.vue
├── main.js
├── manifest.json          # uni-app 应用配置（含 Android 权限）
├── pages.json
├── pages/index/
│   ├── index.vue          # 首页
│   └── sms.vue            # 短信监听控制页
├── utils/
│   └── smsMonitor.js      # 核心：轮询短信 + 推送飞书
├── components/
└── static/
```

## 注意事项

- 仅在 Android App 端可用（依赖 `plus.android` 读取系统短信库），H5 / iOS / 微信小程序跑不起来
- 5 秒轮询模式，并不是真正的广播监听；如果你要更实时，可以把 `plus.android.implements` 注册 `BroadcastReceiver` 监听 `SMS_RECEIVED`
- 飞书自定义机器人有频控（约 100 条/分钟），别拿这玩意儿做大规模分发

## License

仅供个人学习交流使用，不要拿去做违法或骚扰用途。
