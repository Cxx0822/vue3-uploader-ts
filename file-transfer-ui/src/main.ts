// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'

// 引入Vue App
import App from './App.vue'

// 引入element-ui组件
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'dayjs/locale/zh-cn' // 中文
import locale from 'element-plus/lib/locale/lang/zh-cn' // 中文

// 引入Font-Awesome
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 创建Vue3实例
const app = createApp(App)

// 使用Element UI Plus
app.use(ElementPlus, { locale })
// 使用pinia
app.use(createPinia())
// 使用Font-Awesome
app.component('font-awesome-icon', FontAwesomeIcon)
// 挂载到根组件上
app.mount('#app')
