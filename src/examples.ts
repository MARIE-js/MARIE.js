import {
	faFont,
	faPlus,
	faRefresh,
	faSort,
	faTimes,
} from '@fortawesome/free-solid-svg-icons';

function getUrl(example: string) {
	return new URL(
		import.meta.env.BASE_URL + 'examples/' + example + '.mas',
		window.location.href,
	).href;
}

export default [
	{ name: 'Addition', icon: faPlus, url: getUrl('addition') },
	{ name: 'Multiply', icon: faTimes, url: getUrl('multiply') },
	{ name: 'Quicksort', icon: faSort, url: getUrl('quicksort') },
	{ name: 'Unicode', icon: faFont, url: getUrl('unicode') },
	{ name: 'Quine', icon: faRefresh, url: getUrl('quine') },
];
