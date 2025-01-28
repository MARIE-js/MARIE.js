import { derived, writable } from 'svelte/store';

const mediaQueryStore = (query: string) => {
	const match = window.matchMedia(query);
	return writable(match.matches, (set) => {
		const setValue = () => set(window.matchMedia(query).matches);
		match.addEventListener('change', setValue);
		return () => match.removeEventListener('change', setValue);
	});
};

const browserDarkMode = mediaQueryStore('(prefers-color-scheme: dark)');

export const isMobile = mediaQueryStore('(max-width: 768px)');

export interface Settings {
	invertTheme: boolean;
	leftPanel: number;
	topPanel: number;
	editorPanel: number;
	outputLogOpen: boolean;
	rtlLogOpen: boolean;
	watchListOpen: boolean;
	inputsOpen: boolean;
	displayOpen: boolean;
	speed: number;
	outputMode: InputOutputMode;
}

export const settings = writable<Settings>(
	(() => {
		const s: Settings = {
			invertTheme: false,
			leftPanel: 70,
			topPanel: 70,
			editorPanel: 50,
			outputLogOpen: true,
			rtlLogOpen: false,
			watchListOpen: false,
			inputsOpen: false,
			displayOpen: false,
			speed: 9,
			outputMode: 'hex',
		};
		try {
			const v = JSON.parse(localStorage.getItem('marie.settings') ?? '{}');
			if (typeof v === 'object') {
				Object.assign(s, v);
			}
		} catch (e) {}
		return s;
	})(),
);
settings.subscribe((v) => {
	localStorage.setItem('marie.settings', JSON.stringify(v));
});

export const darkMode = derived(
	[browserDarkMode, settings],
	([$browserDarkMode, $settings]) => {
		if ($settings.invertTheme) {
			return !$browserDarkMode;
		}
		return $browserDarkMode;
	},
);

export type InputOutputMode = 'hex' | 'dec' | 'oct' | 'bin' | 'unicode';

export function constructURL(path: string) {
	let baseUrl = import.meta.env.BASE_URL;
	if (baseUrl.length > 0 && !baseUrl.startsWith('/')) {
		baseUrl = '/' + baseUrl;
	}
	if (!baseUrl.endsWith('/')) {
		baseUrl += '/';
	}
	return new URL(`${baseUrl}${path}`, window.location.href).href;
}
