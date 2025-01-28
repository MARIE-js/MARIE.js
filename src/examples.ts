import {
	faFont,
	faPlus,
	faRefresh,
	faSort,
	faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { constructURL } from './settings';

export function getExampleURL(example: string) {
	return constructURL(`examples/${example}.mas`);
}

export default [
	{ name: 'Addition', icon: faPlus, url: getExampleURL('addition') },
	{ name: 'Multiply', icon: faTimes, url: getExampleURL('multiply') },
	{ name: 'Quicksort', icon: faSort, url: getExampleURL('quicksort') },
	{ name: 'Unicode', icon: faFont, url: getExampleURL('unicode') },
	{ name: 'Quine', icon: faRefresh, url: getExampleURL('quine') },
];
