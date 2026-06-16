import App from './App'
import iconHaha from './components/icon-haha.vue'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
// 全局注册组件
Vue.component('icon-haha', iconHaha)
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  // 全局注册组件
  app.component('icon-haha', iconHaha)
  return {
    app
  }
}
// #endif