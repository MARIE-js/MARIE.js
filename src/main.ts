import 'bulma/css/bulma.css';
import './app.css';
import App from './App.svelte';
import { darkMode } from './settings';
import { mount } from 'svelte';

const app = mount(App, {
	target: document.getElementById('app')!,
});

darkMode.subscribe(($darkMode) => {
	const dark = 'theme-dark';
	const light = 'theme-light';
	document.documentElement.classList.add($darkMode ? dark : light);
	document.documentElement.classList.remove($darkMode ? light : dark);
});

export default app;
