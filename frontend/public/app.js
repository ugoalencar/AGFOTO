import { createApiClient } from './api.js';

async function loadComponent() {
  const source = await fetch('./App.vue').then(response => {
    if (!response.ok) throw new Error(`Unable to load application: ${response.status}`);
    return response.text();
  });
  // Guloso de proposito: o template do componente pode conter <template v-if> aninhado.
  // Com match nao-guloso o primeiro </template> interno cortava metade da interface fora.
  const template = source.match(/<template>([\s\S]*)<\/template>/)?.[1];
  const script = source.match(/<script>([\s\S]*)<\/script>/)?.[1];

  if (!template || !script) throw new Error('Application component is invalid');

  const componentScript = script
    .replace(/import \{ ref, computed, onMounted, onUnmounted \} from 'vue';/, 'const { ref, computed, onMounted, onUnmounted } = Vue;')
    .replace('export default', 'return')
    .replaceAll('this.$api', 'api');
  const component = new Function('Vue', 'api', componentScript)(Vue, createApiClient(window.location.origin));
  component.template = template;
  return component;
}

loadComponent()
  .then(component => Vue.createApp(component).mount('#app'))
  .catch(error => {
    console.error(error);
    document.querySelector('#app').textContent = 'Nao foi possivel carregar a aplicacao.';
  });
