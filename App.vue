<script>
	import smsMonitor from './utils/smsMonitor.js'
	
	export default {
		onLaunch: function() {
			console.log('App Launch')
			// 注意：默认不自动启动，由用户手动控制
			// 如果需要自动启动，可以取消下面的注释
			// if (plus && plus.android) {
			// 	setTimeout(() => {
			// 		smsMonitor.start()
			// 	}, 2000)
			// }
		},
		onShow: function() {
			console.log('App Show')
			// 应用显示时确保服务运行
			if (plus && plus.android && !smsMonitor.isRunning) {
				smsMonitor.start()
			}
		},
		onHide: function() {
			console.log('App Hide')
			// 应用隐藏时不停止服务，保持后台运行
			// smsMonitor.stop()
		}
	}
</script>

<style>
	/*每个页面公共css */
	@import url('./static/iconfont/iconfont.css');
</style>
