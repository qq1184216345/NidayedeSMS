<template>
	<text 
		:class="['iconfont', iconClass]" 
		:style="iconStyle"
		@click="handleClick"
	></text>
</template>

<script>
	export default {
		name: "icon-haha",
		props: {
			// 图标名称，如 'jubao', 'anquanbaozhang' 等
			name: {
				type: String,
				required: true,
				default: ''
			},
			// 图标大小，支持 rpx、px、em 等单位，默认 32rpx
			size: {
				type: [String, Number],
				default: '32'
			},
			// 图标颜色，默认 #333333
			color: {
				type: String,
				default: '#333333'
			},
			// 自定义样式类名
			customClass: {
				type: String,
				default: ''
			}
		},
		computed: {
			// 图标类名
			iconClass() {
				return `icon-${this.name} ${this.customClass}`;
			},
			// 图标样式
			iconStyle() {
				const style = {};
				
				// 处理大小
				if (this.size) {
					const sizeValue = typeof this.size === 'number' 
						? `${this.size}rpx` 
						: this.size;
					style.fontSize = sizeValue;
				}
				
				// 处理颜色
				if (this.color) {
					style.color = this.color;
				}
				
				return style;
			}
		},
		methods: {
			handleClick(e) {
				this.$emit('click', e);
			}
		}
	}
</script>

<style scoped>
	.iconfont {
		font-family: "iconfont" !important;
		font-style: normal;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		display: inline-block;
		line-height: 1;
	}
</style>