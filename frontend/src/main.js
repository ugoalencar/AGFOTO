import { createApp } from 'vue';
import App from './App.vue';
import { createApiClient } from './services/api.js';

// Create app
const app = createApp(App);

// Register global API client
const apiClient = createApiClient('http://127.0.0.1:3000');
app.config.globalProperties.$api = apiClient;

// Mount
app.mount('#app');
