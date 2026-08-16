import { createApp } from 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.esm-browser.prod.js';
import App from './App.js';
import { createApiClient } from './services/api.js';

const app = createApp(App);
const apiClient = createApiClient('http://127.0.0.1:3000');
app.config.globalProperties.$api = apiClient;
app.mount('#app');
