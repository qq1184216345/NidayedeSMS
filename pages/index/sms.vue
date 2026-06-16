<template>
	<view class="content">
		<image class="logo" src="/static/logo.png"></image>
		<view class="text-area">
			<text class="title">{{title}}</text>
		</view>
		
		<!-- iconfont 组件使用示例 -->
		<view class="icon-demo">
			<view class="demo-title">Iconfont 图标组件示例</view>
			<view class="icon-list">
				<view class="icon-item" v-for="icon in iconList" :key="icon.name">
					<icon-haha 
						:name="icon.name" 
						:size="icon.size"
						:color="icon.color"
						@click="handleIconClick(icon)"
					></icon-haha>
					<text class="icon-label">{{icon.label}}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				title: 'Hello',
				iconList: [
					{ name: 'jubao', label: '举报', size: '48', color: '#ff4757' },
					{ name: 'anquanbaozhang', label: '安全保障', size: '48', color: '#2ed573' },
					{ name: 'xiaoxi-zhihui', label: '消息', size: '48', color: '#5352ed' },
					{ name: 'xihuan', label: '喜欢', size: '48', color: '#ff6348' },
					{ name: 'gengduo', label: '更多', size: '48', color: '#747d8c' }
				]
			}
		},
		onLoad() {

		},
		methods: {
			handleIconClick(icon) {
				uni.showToast({
					title: `点击了${icon.label}`,
					icon: 'none'
				});
				uni.navigateTo({
					url:"/pages/index/sms"
				})
			}
		}
	}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.logo {
		height: 200rpx;
		width: 200rpx;
		margin-top: 200rpx;
		margin-left: auto;
		margin-right: auto;
		margin-bottom: 50rpx;
	}

	.text-area {
		display: flex;
		justify-content: center;
	}

	.title {
		font-size: 36rpx;
		color: #8f8f94;
	}
	
	.icon-demo {
		margin-top: 80rpx;
		width: 100%;
		padding: 0 40rpx;
	}
	
	.demo-title {
		font-size: 32rpx;
		color: #333;
		font-weight: bold;
		margin-bottom: 40rpx;
		text-align: center;
	}
	
	.icon-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-around;
	}
	
	.icon-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 20rpx;
		padding: 20rpx;
	}
	
	.icon-label {
		font-size: 24rpx;
		color: #666;
		margin-top: 16rpx;
	}
</style>
