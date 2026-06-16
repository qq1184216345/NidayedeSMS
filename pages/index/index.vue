<template>
	<view class="container">
		<view class="header">
			<button class="get-btn" @click="getSms">获取短信</button>
			
			<view class="monitor-section">
				<view class="monitor-header">
					<text class="monitor-title">短信监听服务</text>
					<switch :checked="monitorStatus.isRunning" @change="toggleMonitor" color="#667eea" />
				</view>
				
				<view class="monitor-settings">
					<text class="settings-label">转发模式：</text>
					<radio-group @change="onSettingChange" class="radio-group">
						<label class="radio-item">
							<radio value="code" :checked="monitorSettings.mode === 'code'" color="#667eea" />
							<text class="radio-text">仅验证码</text>
						</label>
						<label class="radio-item">
							<radio value="all" :checked="monitorSettings.mode === 'all'" color="#667eea" />
							<text class="radio-text">所有短信</text>
						</label>
					</radio-group>
				</view>
				
				<view v-if="monitorStatus.isRunning" class="monitor-stats">
					<view class="stat-item">
						<text class="stat-label">运行状态：</text>
						<text class="stat-value running">运行中</text>
					</view>
					<view class="stat-item">
						<text class="stat-label">已处理：</text>
						<text class="stat-value">{{monitorStatus.stats.totalProcessed}}</text>
					</view>
					<view class="stat-item">
						<text class="stat-label">成功：</text>
						<text class="stat-value success">{{monitorStatus.stats.successCount}}</text>
					</view>
					<view class="stat-item">
						<text class="stat-label">失败：</text>
						<text class="stat-value error">{{monitorStatus.stats.failCount}}</text>
					</view>
				</view>
				<view v-else class="monitor-stats">
					<text class="stat-value stopped">已停止</text>
				</view>
			</view>
		</view>
		
		<view v-if="initialized && smsList.length === 0" class="empty-state">
			<text class="empty-text">暂无短信记录</text>
		</view>
		
		<view v-else class="sms-list">
			<view v-for="(item, index) in smsList" :key="index" class="sms-item" :class="{'sms-received': item.type === '接收', 'sms-sent': item.type === '发送'}">
				<view class="sms-header">
					<view class="sms-type" :class="{'type-received': item.type === '接收', 'type-sent': item.type === '发送'}">
						{{item.type}}
					</view>
					<text class="sms-date">{{item.date}}</text>
				</view>
				<view class="sms-address">
					<text class="label">发件人：</text>
					<text class="value">{{item.address}}</text>
				</view>
				<view class="sms-body">
					<text class="sms-content">{{item.body}}</text>
				</view>
			</view>
			
			<view v-if="loadingMore" class="load-more">
				<text class="load-text">加载中...</text>
			</view>
			<view v-else-if="!hasMore && smsList.length > 0" class="load-more">
				<text class="load-text">没有更多数据了</text>
			</view>
		</view>
	</view>
</template>

<script>
	import smsMonitor from '@/utils/smsMonitor.js'
	
	export default {
		data() {
			return {
				smsList: [],
				allSmsList: [],
				page: 1,
				pageSize: 20,
				hasMore: false,
				loadingMore: false,
				initialized: false,
				monitorStatus: {
					isRunning: false,
					stats: {
						totalProcessed: 0,
						successCount: 0,
						failCount: 0
					}
				},
				monitorSettings: {
					mode: 'code' // 'code' - 仅验证码, 'all' - 所有短信
				}
			}
		},
		onLoad() {
			// 初始化监听服务状态
			this.updateMonitorStatus()
			this.updateMonitorSettings()
			
			// 注册状态变化回调
			smsMonitor.setCallback('onStatusChange', (status) => {
				this.monitorStatus = status
			})
		},
		onUnload() {
			// 页面卸载时清理回调
			smsMonitor.setCallback('onStatusChange', null)
		},
		onReachBottom() {
			if (this.hasMore && !this.loadingMore && this.initialized) {
				this.loadMoreSms()
			}
		},
		methods: {
			async getSms() {
				const hasPermission = await this.checkPermission('android.permission.READ_SMS')
				if (!hasPermission) {
					uni.showToast({
						title: '请授予短信读取权限',
						icon: 'none'
					})
					return
				}

				this.smsList = []
				this.allSmsList = []
				this.page = 1
				this.hasMore = false
				this.initialized = false
				
				const main = plus.android.runtimeMainActivity()
				const Uri = plus.android.importClass('android.net.Uri')
				const uri = Uri.parse('content://sms/')
				const cr = main.getContentResolver()
				plus.android.importClass(cr)

				uni.showLoading({
					title: '加载短信中...'
				})

				const currentTime = new Date().getTime()
				const threeMonthsAgo = new Date(currentTime - 3 * 30 * 24 * 60 * 60 * 1000).getTime()
				const selection = 'date > ' + threeMonthsAgo
				const orderBy = 'date DESC'
				const cur = cr.query(uri, null, selection, null, orderBy)
				plus.android.importClass(cur)

				const msgList = []
				while (cur.moveToNext()) {
					const indexAddress = cur.getColumnIndex('address')
					const indexBody = cur.getColumnIndex('body')
					const indexType = cur.getColumnIndex('type')
					const indexDate = cur.getColumnIndex('date')
					
					const type = cur.getString(indexType)
					const smsDate = cur.getString(indexDate)
					
					const newObj = {
						address: cur.getString(indexAddress),
						body: cur.getString(indexBody),
						type: type == 1 ? '接收' : '发送',
						date: this.formatDate(smsDate)
					}
					
					msgList.push(newObj)
				}
				
				cur.close()
				this.allSmsList = msgList
				this.initialized = true
				this.loadPageData()
				uni.hideLoading()
			},
			
			loadPageData() {
				const startIndex = (this.page - 1) * this.pageSize
				const endIndex = startIndex + this.pageSize
				const pageData = this.allSmsList.slice(startIndex, endIndex)
				
				if (this.page === 1) {
					this.smsList = pageData
				} else {
					this.smsList = this.smsList.concat(pageData)
				}
				
				this.hasMore = endIndex < this.allSmsList.length
			},
			
			loadMoreSms() {
				if (this.loadingMore || !this.hasMore) {
					return
				}
				
				this.loadingMore = true
				this.page++
				
				setTimeout(() => {
					this.loadPageData()
					this.loadingMore = false
				}, 300)
			},
			
			async checkPermission(permission) {
				return new Promise((resolve) => {
					plus.android.requestPermissions([permission], (result) => {
						resolve(result.granted && result.granted.length > 0)
					}, (error) => {
						console.error('权限请求错误:', error)
						resolve(false)
					})
				})
			},

			formatDate(timestamp) {
				const date = new Date(parseInt(timestamp))
				const year = date.getFullYear()
				const month = String(date.getMonth() + 1).padStart(2, '0')
				const day = String(date.getDate()).padStart(2, '0')
				const hours = String(date.getHours()).padStart(2, '0')
				const minutes = String(date.getMinutes()).padStart(2, '0')
				return `${year}-${month}-${day} ${hours}:${minutes}`
			},
			
			// 更新监听服务状态
			updateMonitorStatus() {
				const status = smsMonitor.getStatus()
				this.monitorStatus = status
			},
			
			// 切换监听服务
			async toggleMonitor(e) {
				const isRunning = e.detail.value
				
				if (isRunning) {
					// 检查权限
					if (plus && plus.android) {
						const hasPermission = await this.checkPermission('android.permission.READ_SMS')
						if (!hasPermission) {
							uni.showToast({
								title: '请授予短信读取权限',
								icon: 'none'
							})
							this.updateMonitorStatus()
							return
						}
					}
					
					// 启动监听服务
					await smsMonitor.start()
					uni.showToast({
						title: '监听服务已启动',
						icon: 'success'
					})
				} else {
					// 停止监听服务
					smsMonitor.stop()
					uni.showToast({
						title: '监听服务已停止',
						icon: 'none'
					})
				}
				
				this.updateMonitorStatus()
			},
			
			// 更新监听服务设置
			updateMonitorSettings() {
				const settings = smsMonitor.getSettings()
				this.monitorSettings = settings
			},
			
			// 设置变化
			onSettingChange(e) {
				const mode = e.detail.value
				smsMonitor.updateSettings({ mode })
				this.updateMonitorSettings()
				
				uni.showToast({
					title: mode === 'code' ? '已切换为仅验证码模式' : '已切换为所有短信模式',
					icon: 'none',
					duration: 1500
				})
			}
		}
	}
</script>

<style scoped>
	.container {
		min-height: 100vh;
		background-color: #f5f5f5;
		padding-bottom: 40rpx;
	}

	.header {
		padding: 30rpx;
		background-color: #fff;
		border-bottom: 1rpx solid #eee;
	}

	.get-btn {
		width: 100%;
		height: 88rpx;
		line-height: 88rpx;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
		border: none;
		border-radius: 12rpx;
		font-size: 32rpx;
		font-weight: 500;
		box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
	}

	.get-btn:active {
		opacity: 0.9;
		transform: scale(0.98);
	}

	.empty-state {
		padding: 200rpx 30rpx;
		text-align: center;
	}

	.empty-text {
		font-size: 28rpx;
		color: #999;
	}

	.sms-list {
		padding: 20rpx 30rpx;
	}

	.sms-item {
		background-color: #fff;
		border-radius: 16rpx;
		padding: 30rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
		border-left: 6rpx solid #ddd;
	}

	.sms-received {
		border-left-color: #52c41a;
	}

	.sms-sent {
		border-left-color: #1890ff;
	}

	.sms-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;
		padding-bottom: 20rpx;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.sms-type {
		display: inline-block;
		padding: 4rpx 16rpx;
		border-radius: 8rpx;
		font-size: 24rpx;
		font-weight: 500;
	}

	.type-received {
		background-color: #f6ffed;
		color: #52c41a;
		border: 1rpx solid #b7eb8f;
	}

	.type-sent {
		background-color: #e6f7ff;
		color: #1890ff;
		border: 1rpx solid #91d5ff;
	}

	.sms-date {
		font-size: 24rpx;
		color: #999;
	}

	.sms-address {
		margin-bottom: 20rpx;
		font-size: 28rpx;
	}

	.sms-address .label {
		color: #666;
		font-weight: 500;
	}

	.sms-address .value {
		color: #333;
	}

	.sms-body {
		margin-top: 20rpx;
	}

	.sms-content {
		font-size: 28rpx;
		color: #333;
		line-height: 1.6;
		word-break: break-all;
	}

	.load-more {
		padding: 40rpx 0;
		text-align: center;
	}

	.load-text {
		font-size: 26rpx;
		color: #999;
	}

	.monitor-section {
		margin-top: 30rpx;
		padding: 30rpx;
		background-color: #fff;
		border-radius: 12rpx;
		box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
	}

	.monitor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;
	}

	.monitor-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #333;
	}

	.monitor-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 20rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid #f0f0f0;
	}

	.stat-item {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 45%;
	}

	.stat-label {
		font-size: 26rpx;
		color: #666;
		margin-right: 10rpx;
	}

	.stat-value {
		font-size: 28rpx;
		font-weight: 600;
	}

	.stat-value.running {
		color: #52c41a;
	}

	.stat-value.stopped {
		color: #999;
	}

	.stat-value.success {
		color: #1890ff;
	}

	.stat-value.error {
		color: #ff4d4f;
	}

	.monitor-settings {
		margin-top: 20rpx;
		padding: 20rpx 0;
		border-top: 1rpx solid #f0f0f0;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.settings-label {
		font-size: 28rpx;
		color: #666;
		margin-bottom: 15rpx;
		display: block;
	}

	.radio-group {
		display: flex;
		gap: 40rpx;
	}

	.radio-item {
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.radio-text {
		font-size: 28rpx;
		color: #333;
	}
</style>