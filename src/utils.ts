import type { Action } from './marie';

/**
 * Converts an unsigned integer into an array of
 * binary numbers.
 * @memberof Utility
 *
 * @param num The unsigned integer to be converted.
 * @param padding How many zeros to pad integer.
 * @returns The binary array representation of unsigned integer.
 */
export function uintToBinArray(num: number, padding: number) {
	const binArray: number[] = [];
	while (num > 0) {
		binArray.push(num & 1);
		num >>= 1;
	}

	if (typeof padding !== 'undefined') {
		padding -= binArray.length;

		while (padding > 0) {
			binArray.push(0);
			padding -= 1;
		}
	}

	binArray.reverse();

	return binArray;
}

/**
 * Converts a signed integer in *size*-bit two's-complement format
 * into an array of binary numbers.
 *
 * @param num The signed integer to be converted.
 * @param size Size of the signed integer.
 * @returns The binary array representation of signed integer.
 */
export function intToBinArray(num: number, size: number) {
	const binArray: number[] = [];
	for (let i = 0; i < size; i++) {
		binArray.push(num & 1);
		num >>= 1;
	}

	binArray.reverse();

	return binArray;
}

/**
 * Converts an unsigned integer into an array of
 * binary numbers, and then converts into a bit string with even spacing
 * between each group of binary digits.
 *
 * @param num The unsigned integer to be converted.
 * @param padding How many zeros to pad integer.
 * @param bitSize The length of each bit group.
 * @returns The binary array representation of unsigned integer.
 */
export function uintToBinGroup(num: number, padding: number, bitSize: number) {
	const binArray = uintToBinArray(num, padding);
	let binString = '';

	for (let i = 0; i < padding; i++) {
		binString += binArray[i];

		if (i % bitSize == bitSize - 1) {
			binString += ' ';
		}
	}

	return binString;
}

/**
 * Converts a signed integer in *size*-bit two's complement format
 * into an array of binary numbers, and then converts into a bit string
 * with even spacing between each group of binary digits.
 *
 * @param num - The unsigned integer to be converted.
 * @param size - Size of the signed integer.
 * @param bitSize - The length of each bit group.
 * @returns The binary array representation of signed integer.
 */
export function intToBinGroup(num: number, size: number, bitSize: number) {
	const binArray = intToBinArray(num, size);
	let binString = '';

	for (let i = 0; i < size; i++) {
		binString += binArray[i];

		if (i % bitSize == bitSize - 1) {
			binString += ' ';
		}
	}

	return binString;
}

/**
 * Converts decimal value into hexadecimal string.
 *
 * @param num The value to be converted.
 * @param digits The number of hexadecimal digits (for padding and truncating)
 * @returns The hexadecimal representation.
 */
export function hex(num: number, digits = 4) {
	const padding = Array(digits).fill('0').join('');
	const hex = num.toString(16).toUpperCase();
	const result = `${padding}${hex}`;
	return result.substring(result.length - digits);
}

/** Show as a signed decimal number.
 *
 * @param num The number
 * @returns The decimal representation
 */
export function dec(num: number) {
	return String((num << 16) >> 16);
}

/** Show as an octal number.
 */
export function oct(num: number) {
	const octal = num.toString(8).toUpperCase();
	const matches = octal.match(/^(\d{0,2})((?:\d{3})*)$/);
	const first = matches![1];
	const parts = matches![2].match(/\d{3}/g) ?? [];
	return [first, ...parts].join(' ');
}

/** Show as a binary string.
 *
 * @param num The number
 * @returns The binary representation
 */
export function bin(num: number) {
	if (num === 0) {
		return '0';
	}
	const groups = [];
	let bits = [];
	for (let i = num; i != 0; i >>= 1) {
		bits.push(i & 1);
		if (bits.length === 4) {
			bits.reverse();
			groups.push(bits.join(''));
			bits = [];
		}
	}
	bits.reverse();
	groups.push(bits.join(''));
	groups.reverse();
	return groups.join(' ');
}

/**
 * Converts mask to bracket notation seen in MARIE.
 *
 * @param mask The value to be converted.
 * @param digits The number of many hexadecimal digits
 * @return The bracket notation of mask.
 */
export function maskToBracketNotation(mask: number, digits = 4) {
	let start = 0;
	let end = 0;
	let counter = 0;
	const list: string[] = [];
	let range = false;

	while (4 * digits !== counter) {
		if (mask & 1) {
			if (!range) {
				range = true;
				start = counter;
			}
		} else {
			if (range) {
				range = false;
				end = counter - 1;

				if (start !== end) {
					list.push(`${end}-${start}`);
				} else {
					list.push(`${start}`);
				}
			}
		}

		mask >>= 1;
		counter++;
	}

	if (range) {
		range = false;
		end = counter - 1;

		if (start !== end) {
			list.push(`${end}-${start}`);
		} else {
			list.push(`${start}`);
		}
	}

	list.reverse();

	return `[${list.join(', ')}]`;
}

/**
 * Converts a 15-bit RGB color to a CSS value.
 *
 * @param x The 15-bit color
 * @returns The equivalent CSS color
 */
export function rgb(x: number) {
	const b = Math.round(((x & 0x1f) / 31.0) * 255.0);
	const g = Math.round((((x >> 5) & 0x1f) / 31.0) * 255.0);
	const r = Math.round((((x >> 10) & 0x1f) / 31.0) * 255.0);
	return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get log deltas instead of processing entire lists.
 *
 * @param onNewLogs Callback when additional logs are appended
 * @param onClear Callback when the logs are cleared
 * @returns
 */
export function logWatcher(
	onNewLogs: (actions: Action[]) => void,
	onClear: () => void,
) {
	let logLength = 0;
	return (allLogs: Action[]) => {
		if (allLogs.length > logLength) {
			const newLogs = allLogs.slice(logLength);
			logLength = allLogs.length;
			onNewLogs(newLogs);
		} else if (allLogs.length < logLength) {
			logLength = allLogs.length;
			onClear();
			onNewLogs(allLogs);
		}
	};
}
