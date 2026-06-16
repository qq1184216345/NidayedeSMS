/**
 * 短信监听服务
 * 用于后台监听新短信并自动调用API
 */

// 飞书自定义机器人 webhook 地址，请替换为你自己的：
// 飞书群 -> 设置 -> 群机器人 -> 添加机器人 -> 自定义机器人 -> 复制 Webhook 地址
const API_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_KEY_HERE'
const CHECK_INTERVAL = 5000 // 检查间隔：5秒
const STORAGE_KEY = 'sms_processed_ids'
const LOG_STORAGE_KEY = 'sms_monitor_logs'
const SETTINGS_STORAGE_KEY = 'sms_monitor_settings'
const MAX_RETRY_COUNT = 3 // 最大重试次数
const RETRY_DELAY = 2000 // 重试延迟：2秒
const MAX_LOG_COUNT = 100 // 最大日志条数

// 设置选项：'all' - 所有短信, 'code' - 仅验证码
const SETTING_ALL = 'all'
const SETTING_CODE_ONLY = 'code'

class SmsMonitor {
	constructor() {
		this.isRunning = false
		this.timer = null
		this.processedIds = new Set()
		this.lastCheckTime = Date.now()
		this.stats = {
			totalProcessed: 0,
			successCount: 0,
			failCount: 0
		}
		this.callbacks = {
			onStatusChange: null,
			onLog: null
		}
		this.settings = {
			mode: SETTING_CODE_ONLY // 默认只处理验证码
		}
		this.loadProcessedIds()
		this.loadStats()
		this.loadSettings()
	}

	// 设置状态变化回调
	setCallback(type, callback) {
		if (type in this.callbacks) {
			this.callbacks[type] = callback
		}
	}

	// 触发状态变化
	emitStatusChange() {
		if (this.callbacks.onStatusChange) {
			this.callbacks.onStatusChange({
				isRunning: this.isRunning,
				stats: { ...this.stats }
			})
		}
	}

	// 添加日志
	addLog(level, message, data = null) {
		const log = {
			time: new Date().toLocaleString('zh-CN'),
			level, // 'info', 'success', 'error'
			message,
			data
		}
		
		try {
			let logs = uni.getStorageSync(LOG_STORAGE_KEY) || []
			logs.unshift(log)
			
			// 只保留最近100条日志
			if (logs.length > MAX_LOG_COUNT) {
				logs = logs.slice(0, MAX_LOG_COUNT)
			}
			
			uni.setStorageSync(LOG_STORAGE_KEY, logs)
			
			// 触发日志回调
			if (this.callbacks.onLog) {
				this.callbacks.onLog(log)
			}
			
			console.log(`[${level}]`, message, data || '')
		} catch (e) {
			console.error('保存日志失败:', e)
		}
	}

	// 获取日志
	getLogs(limit = 50) {
		try {
			const logs = uni.getStorageSync(LOG_STORAGE_KEY) || []
			return logs.slice(0, limit)
		} catch (e) {
			return []
		}
	}

	// 清空日志
	clearLogs() {
		try {
			uni.removeStorageSync(LOG_STORAGE_KEY)
			this.addLog('info', '日志已清空')
		} catch (e) {
			console.error('清空日志失败:', e)
		}
	}

	// 加载统计数据
	loadStats() {
		try {
			const stored = uni.getStorageSync('sms_monitor_stats')
			if (stored) {
				this.stats = { ...this.stats, ...stored }
			}
		} catch (e) {
			console.error('加载统计数据失败:', e)
		}
	}

	// 保存统计数据
	saveStats() {
		try {
			uni.setStorageSync('sms_monitor_stats', this.stats)
		} catch (e) {
			console.error('保存统计数据失败:', e)
		}
	}

	// 加载设置
	loadSettings() {
		try {
			const stored = uni.getStorageSync(SETTINGS_STORAGE_KEY)
			if (stored) {
				this.settings = { ...this.settings, ...stored }
			}
		} catch (e) {
			console.error('加载设置失败:', e)
		}
	}

	// 保存设置
	saveSettings() {
		try {
			uni.setStorageSync(SETTINGS_STORAGE_KEY, this.settings)
		} catch (e) {
			console.error('保存设置失败:', e)
		}
	}

	// 获取设置
	getSettings() {
		return { ...this.settings }
	}

	// 更新设置
	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings }
		this.saveSettings()
		this.addLog('info', `设置已更新: ${newSettings.mode === SETTING_ALL ? '所有短信' : '仅验证码'}`)
	}

	// 判断是否为验证码短信
	isVerificationCodeSms(sms) {
		const body = sms.body || ''
		const address = sms.address || ''
		const bodyLower = body.toLowerCase()
		
		// 1. 检查常见验证码关键词（必须包含）
		const codeKeywords = [
			'验证码', '校验码', '确认码', '动态码', '安全码',
			'verification code', 'verification', 'verify code',
			'您的验证码', '验证码为', '验证码是'
		]
		
		const hasKeyword = codeKeywords.some(keyword => 
			bodyLower.includes(keyword.toLowerCase())
		)
		
		// 如果包含关键词，直接认为是验证码
		if (hasKeyword) {
			return true
		}
		
		// 2. 检查发件人号码（106开头通常是验证码发送平台）
		const isCodeSender = /^106\d+$/.test(address)
		if (isCodeSender) {
			// 106开头的号码 + 包含4-8位数字，认为是验证码
			const hasDigitCode = /\d{4,8}/.test(body)
			if (hasDigitCode) {
				return true
			}
		}
		
		// 3. 检查是否包含常见的验证码格式模式（更严格的模式）
		const codePatterns = [
			/验证码[：:]\s*\d{4,8}/,
			/验证码为[：:]\s*\d{4,8}/,
			/验证码是[：:]\s*\d{4,8}/,
			/您的验证码[：:]\s*\d{4,8}/,
			/[\d]{4,8}\s*[为是]\s*验证码/,
			/code[：:]\s*\d{4,8}/i,
			/verification code[：:]\s*\d{4,8}/i,
			/验证码\s*[：:]\s*[\d]{4,8}/,
			/[\d]{4,8}\s*是\s*.*验证码/,
			/验证码\s*[\d]{4,8}/
		]
		
		const matchesPattern = codePatterns.some(pattern => pattern.test(body))
		if (matchesPattern) {
			return true
		}
		
		// 4. 检查是否同时包含数字和"码"字（较宽松的条件）
		const hasCodeChar = /码/.test(body)
		const hasDigitCode = /\d{4,8}/.test(body)
		if (hasCodeChar && hasDigitCode && body.length < 50) {
			// 短信较短且包含"码"和数字，可能是验证码
			return true
		}
		
		return false
	}

	// 加载已处理的短信ID
	loadProcessedIds() {
		try {
			const stored = uni.getStorageSync(STORAGE_KEY)
			if (stored && Array.isArray(stored)) {
				this.processedIds = new Set(stored)
				// 只保留最近1000条记录，避免存储过大
				if (this.processedIds.size > 1000) {
					const arr = Array.from(this.processedIds).slice(-1000)
					this.processedIds = new Set(arr)
					uni.setStorageSync(STORAGE_KEY, arr)
				}
			}
		} catch (e) {
			console.error('加载已处理短信ID失败:', e)
		}
	}

	// 保存已处理的短信ID
	saveProcessedIds() {
		try {
			uni.setStorageSync(STORAGE_KEY, Array.from(this.processedIds))
		} catch (e) {
			console.error('保存已处理短信ID失败:', e)
		}
	}

	// 获取短信的唯一ID（使用日期+发件人+内容生成）
	getSmsId(sms) {
		return `${sms.date}_${sms.address}_${sms.body.substring(0, 20)}`
	}

	// 格式化日期
	formatDate(timestamp) {
		const date = new Date(parseInt(timestamp))
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		const hours = String(date.getHours()).padStart(2, '0')
		const minutes = String(date.getMinutes()).padStart(2, '0')
		const seconds = String(date.getSeconds()).padStart(2, '0')
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
	}

	// 获取最新短信（只获取最近5分钟内的）
	async getNewSms() {
		return new Promise((resolve) => {
			try {
				const main = plus.android.runtimeMainActivity()
				const Uri = plus.android.importClass('android.net.Uri')
				const uri = Uri.parse('content://sms/')
				const cr = main.getContentResolver()
				plus.android.importClass(cr)

				const currentTime = new Date().getTime()
				const fiveMinutesAgo = currentTime - 5 * 60 * 1000
				const selection = 'date > ' + fiveMinutesAgo
				const orderBy = 'date DESC'
				const cur = cr.query(uri, null, selection, null, orderBy)
				plus.android.importClass(cur)

				const msgList = []
				while (cur.moveToNext()) {
					const indexId = cur.getColumnIndex('_id')
					const indexAddress = cur.getColumnIndex('address')
					const indexBody = cur.getColumnIndex('body')
					const indexType = cur.getColumnIndex('type')
					const indexDate = cur.getColumnIndex('date')

					const type = cur.getString(indexType)
					const smsDate = cur.getString(indexDate)

					// 只处理接收的短信
					if (type == 1) {
						const newObj = {
							id: cur.getString(indexId),
							address: cur.getString(indexAddress),
							body: cur.getString(indexBody),
							type: '接收',
							date: this.formatDate(smsDate),
							timestamp: parseInt(smsDate)
						}
						msgList.push(newObj)
					}
				}

				cur.close()
				resolve(msgList)
			} catch (e) {
				console.error('获取短信失败:', e)
				resolve([])
			}
		})
	}

	// 调用飞书webhook（带重试机制）
	async sendToApi(sms, retryCount = 0) {
		try {
			const text = `【短信转发】\n发件人: ${sms.address}\n时间: ${sms.date}\n类型: ${sms.type}\n内容: ${sms.body}`

			const response = await uni.request({
				url: API_URL,
				method: 'POST',
				header: {
					'Content-Type': 'application/json'
				},
				data: {
					msg_type: 'text',
					content: {
						text: text
					}
				},
				timeout: 10000
			})

			// 飞书返回 { code: 0, ... } 表示成功
			const feishuCode = response.data && response.data.code
			const success = response.statusCode === 200 && feishuCode === 0
			
			if (success) {
				this.stats.successCount++
				this.addLog('success', `短信已发送: ${sms.address}`, sms)
				this.saveStats()
				this.emitStatusChange()
				
				// 显示成功通知
				this.showNotification('短信转发成功', `来自: ${sms.address}`)
				
				return true
			} else {
				const msg = response.data && response.data.msg
				throw new Error(`HTTP ${response.statusCode}${feishuCode != null ? ` code=${feishuCode}` : ''}${msg ? ` ${msg}` : ''}`)
			}
		} catch (e) {
			// 重试机制
			if (retryCount < MAX_RETRY_COUNT) {
				this.addLog('info', `API调用失败，${RETRY_DELAY/1000}秒后重试 (${retryCount + 1}/${MAX_RETRY_COUNT})`, e.message)
				
				await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
				return this.sendToApi(sms, retryCount + 1)
			} else {
				this.stats.failCount++
				this.addLog('error', `API调用最终失败: ${sms.address}`, e.message)
				this.saveStats()
				this.emitStatusChange()
				
				// 显示失败通知
				this.showNotification('短信转发失败', `来自: ${sms.address}`, 'error')
				
				return false
			}
		}
	}

	// 显示通知
	showNotification(title, content, type = 'success') {
		try {
			// 使用uni.showToast显示通知
			uni.showToast({
				title: title,
				icon: type === 'success' ? 'success' : 'none',
				duration: 2000
			})
			
			// 如果支持原生通知，也可以使用
			if (plus && plus.android) {
				try {
					const main = plus.android.runtimeMainActivity()
					const NotificationManager = plus.android.importClass('android.app.NotificationManager')
					const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
					const Context = plus.android.importClass('android.content.Context')
					
					const notificationManager = main.getSystemService(Context.NOTIFICATION_SERVICE)
					const builder = new NotificationCompat.Builder(main, 'sms_monitor')
						.setSmallIcon(android.R.drawable.ic_dialog_info)
						.setContentTitle(title)
						.setContentText(content)
						.setPriority(NotificationCompat.PRIORITY_LOW)
						.setAutoCancel(true)
					
					notificationManager.notify(1001, builder.build())
				} catch (e) {
					// 原生通知失败，忽略
				}
			}
		} catch (e) {
			console.error('显示通知失败:', e)
		}
	}

	// 检查并处理新短信
	async checkAndProcess() {
		if (!this.isRunning) {
			return
		}

		try {
			const smsList = await this.getNewSms()
			const now = Date.now()

			// 按时间排序，处理最新的短信
			smsList.sort((a, b) => b.timestamp - a.timestamp)

			for (const sms of smsList) {
				// 只处理最近5分钟内的短信
				if (now - sms.timestamp > 5 * 60 * 1000) {
					continue
				}

				const smsId = this.getSmsId(sms)

				// 检查是否已处理过
				if (!this.processedIds.has(smsId)) {
					// 根据设置判断是否需要处理此短信
					const shouldProcess = this.settings.mode === SETTING_ALL || this.isVerificationCodeSms(sms)
					
					if (!shouldProcess) {
						// 跳过非验证码短信
						continue
					}
					
					this.addLog('info', `检测到${this.settings.mode === SETTING_CODE_ONLY ? '验证码' : '新'}短信: ${sms.address}`, {
						body: sms.body.substring(0, 30) + '...',
						date: sms.date
					})
					
					// 发送到API
					const success = await this.sendToApi(sms)
					
					if (success) {
						// 标记为已处理
						this.processedIds.add(smsId)
						this.saveProcessedIds()
						this.stats.totalProcessed++
						this.saveStats()
						this.emitStatusChange()
					}
				}
			}

			this.lastCheckTime = now
		} catch (e) {
			console.error('检查短信时出错:', e)
		}
	}

	// 启动监听
	async start() {
		if (this.isRunning) {
			this.addLog('info', '短信监听服务已在运行')
			return
		}

		this.addLog('info', '启动短信监听服务')
		this.isRunning = true
		this.emitStatusChange()

		// 立即执行一次检查
		await this.checkAndProcess()

		// 定时检查
		this.timer = setInterval(() => {
			this.checkAndProcess()
		}, CHECK_INTERVAL)
	}

	// 停止监听
	stop() {
		if (!this.isRunning) {
			return
		}

		this.addLog('info', '停止短信监听服务')
		this.isRunning = false
		this.emitStatusChange()

		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	// 获取运行状态
	getStatus() {
		return {
			isRunning: this.isRunning,
			stats: { ...this.stats },
			lastCheckTime: this.lastCheckTime
		}
	}

	// 重置统计数据
	resetStats() {
		this.stats = {
			totalProcessed: 0,
			successCount: 0,
			failCount: 0
		}
		this.saveStats()
		this.emitStatusChange()
		this.addLog('info', '统计数据已重置')
	}
}

// 创建单例
const smsMonitor = new SmsMonitor()

export default smsMonitor

