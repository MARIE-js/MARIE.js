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

export interface Settings {
	theme: 'dark' | 'light' | 'system';
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
			theme: 'system',
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
		switch ($settings.theme) {
			case 'light':
				return false;
			case 'dark':
				return true;
			default:
				return $browserDarkMode;
		}
	},
);

export type InputOutputMode = 'hex' | 'dec' | 'oct' | 'bin' | 'unicode';
