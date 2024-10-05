<script lang="ts">
	import type { Action, State, Register } from '../marie';
	import { hex, logWatcher } from '../utils';

	export let state: State;
	export let log: Action[];

	let action: Action | null = null;
	let step = 0;

	type Source = Register | 'M' | 'ADD' | 'SUB' | null;
	type Target = Register | 'M' | 'INC_PC' | null;
	let read: Source = null;
	let write: Target = null;

	const helpText: { [key: string]: string | undefined } = {
		cu: 'The control unit activates read and write signals to transfer data between selected devices.',
		read: 'The control unit sends a signal on one of these lines to instruct the selected device to put its contents on the data bus.',
		write:
			'The control unit sends a signal on one of these lines to instruct a device read in a value from the data bus and store it.',
		acSign:
			'These signals are used to perform the skipcond instruction by letting the control unit know the sign of the AC register.',
		readIR:
			'When this signal is activated, the IR register puts its contents on the data bus.',
		readIN:
			'When this signal is activated, the IN register puts its contents on the data bus.',
		readAC:
			'When this signal is activated, the AC register puts its contents on the data bus.',
		readMBR:
			'When this signal is activated, the MBR register puts its contents on the data bus.',
		readPC:
			'When this signal is activated, the program counter puts its contents on the data bus.',
		readMAR:
			'When this signal is activated, the MAR register puts its contents on the data bus.',
		readM:
			'When this signal is activated, the memory chip puts the contents of memory at the address given by the MAR on the data bus.',
		writeM:
			'When this signal is activated, the memory chip reads from the data bus and places the value in memory at the address given by the MAR.',
		writeIR:
			'When this signal is activated, the IR register reads from the data bus and stores the value.',
		writeOUT:
			'When this signal is activated, the OUT register reads from the data bus and stores the value.',
		writeAC:
			'When this signal is activated, the AC register reads from the data bus and stores the value.',
		writeMBR:
			'When this signal is activated, the MBR register reads from the data bus and stores the value.',
		writePC:
			'When this signal is activated, the PC register reads from the data bus and stores the value.',
		incPC:
			'When this signal is activated, the program counter increments by one.',
		writeMAR:
			'When this signal is activated, the MAR register reads from the data bus and stores the value.',
		step: 'The control unit has has a counter to keep track of which part of the fetch-decode-execute cycle it is up to. This is incremented after each micro-instruction, and is reset at the end of the execute phase of the cycle.',
		aluOpcode:
			'When the appropriate signal is activated, the ALU places the sum or difference of the AC and MBR registers on the bus.',
		aluA: 'The AC is directly connected to the ALU so that the ALU does not need to read its operands from the data bus',
		aluB: 'The MBR is directly connected to the ALU so that the ALU does not need to read its operands from the data bus',
		marM: 'The MAR is connected to the memory and dictates which address is written to or read from.',
		irCu: 'The control unit reads the instruction register to decode the current instruction.',
		bus: 'The bus is a shared signal path between devices. Only one device is allowed to place a value on the bus at any given time. Any other devices can read the value on the bus, or ignore it.',
		alu: 'The arithmetic logic unit in MARIE performs addition or subtraction, and can compare the AC with zero.',
		ir: 'The instruction register is decoded by the control unit to determine what signals it needs to activate on the given step.',
		out: 'The output register.',
		in: 'The input register',
		ac: 'The general purpose accumulator register.',
		mbr: 'The memory buffer register which is used to store values going in and out of main memory.',
		pc: 'The program counter stores the location in memory the next instruction to fetch.',
		mar: 'The memory address register stores the address used for memory reads and writes.',
		m: 'The main memory.',
	};

	const actionTypes = [
		'incpc',
		'arithmetic',
		'comparison',
		'memread',
		'memwrite',
		'regtransfer',
		'regset',
	];

	const updateLogs = logWatcher(
		(logs) => {
			const startIdx = logs.findLastIndex((action) => action.type === 'step');
			let newStep = step;
			if (startIdx !== -1) {
				newStep = -1;
				logs = logs.slice(startIdx + 1);
			}
			logs = logs.filter((action) => actionTypes.includes(action.type));
			if (logs.length > 0) {
				action = logs[logs.length - 1];
			}
			newStep += logs.length;
			step = newStep;
		},
		() => {
			action = null;
			step = 0;
		},
	);
	$: updateLogs(log);

	function updateSignals(action: Action | null) {
		if (action === null) {
			read = null;
			write = null;
			return;
		}
		switch (action.type) {
			case 'arithmetic':
				switch (action.operation) {
					case 'ADD':
						read = 'ADD';
						break;
					case 'SUB':
						read = 'SUB';
						break;
					case 'CLEAR':
						read = null;
						break;
				}
				write = 'AC';
				break;
			case 'regtransfer':
				read = action.source;
				write = action.target;
				break;
			case 'regset':
				read = null;
				write = action.register;
				break;
			case 'memread':
				read = 'M';
				write = 'MBR';
				break;
			case 'memwrite':
				read = 'MBR';
				write = 'M';
				break;
			case 'incpc':
				read = null;
				write = 'INC_PC';
				break;
			default:
				read = null;
				write = null;
		}
	}
	$: updateSignals(action);
	$: busActive = read !== null && write !== null;

	function isBusTransferActive(
		target: Target,
		source: Source,
		read: Source,
		write: Target,
	) {
		return (
			(read === source && write === target) ||
			(read === target && write == source)
		);
	}

	function isBusTransferReversed(
		target: Target,
		source: Source,
		read: Source,
		write: Target,
	) {
		return read === target && write == source;
	}

	let hover: string | null = null;
</script>

<div class="data-path">
	<svg viewBox="0 0 273.84 112.2">
		<defs>
			<marker
				id="marker90"
				overflow="visible"
				markerHeight="0.5"
				markerWidth="0.5"
				orient="auto-start-reverse"
				preserveAspectRatio="xMidYMid"
				viewBox="0 0 1 1"
			>
				<path
					transform="scale(.5)"
					d="m5.77 0-8.65 5v-10z"
					fill="context-stroke"
					fill-rule="evenodd"
					stroke="context-stroke"
					stroke-width="1pt"
				/>
			</marker>
			<marker
				id="marker89"
				overflow="visible"
				markerHeight="0.5"
				markerWidth="0.5"
				orient="auto-start-reverse"
				preserveAspectRatio="xMidYMid"
				viewBox="0 0 1 1"
			>
				<path
					transform="scale(.5)"
					d="m5.77 0-8.65 5v-10z"
					fill="context-stroke"
					fill-rule="evenodd"
					stroke="context-stroke"
					stroke-width="1pt"
				/>
			</marker>
			<marker
				id="Triangle"
				overflow="visible"
				markerHeight="0.5"
				markerWidth="0.5"
				orient="auto-start-reverse"
				preserveAspectRatio="xMidYMid"
				viewBox="0 0 1 1"
			>
				<path
					transform="scale(.5)"
					d="m5.77 0-8.65 5v-10z"
					fill="context-stroke"
					fill-rule="evenodd"
					stroke="context-stroke"
					stroke-width="1pt"
				/>
			</marker>
		</defs>
		<path
			id="bus-path"
			class="bus-path"
			class:active={busActive}
			class:hover={hover === 'bus'}
			d="m64.559 43.26v35.056h172.64v-3.1734h-10.717v-31.883h-3.174v31.883h-23.283v-31.883h-3.176v31.883h-25.93v-31.883h-3.174v31.883h-12.7v-12.965h-3.175v12.965h-12.701v-31.883h-3.174v31.883h-15.345v-31.883h-3.176v31.883h-23.283v-31.883h-3.1734v31.883h-23.285v-31.883z"
			color="#000000"
			fill="#00389a"
			style="-inkscape-stroke:none"
		/>
		<g
			fill="none"
			stroke="#c5e0ff"
			stroke-dasharray="1.5875, 1.5875"
			stroke-width="1.5875"
		>
			<path
				id="ir-ac"
				class="bus-transfer"
				class:active={isBusTransferActive('AC', 'IR', read, write)}
				class:reverse={isBusTransferReversed('AC', 'IR', read, write)}
				d="m66.146 43.259v33.47h71.437v-33.47"
			/>
			<path
				id="ir-mbr"
				class="bus-transfer"
				class:active={isBusTransferActive('MBR', 'IR', read, write)}
				class:reverse={isBusTransferReversed('MBR', 'IR', read, write)}
				d="m66.146 43.259v33.47h103.19v-33.47"
			/>
			<path
				id="ir-pc"
				class="bus-transfer"
				class:active={isBusTransferActive('PC', 'IR', read, write)}
				class:reverse={isBusTransferReversed('PC', 'IR', read, write)}
				d="m66.146 43.259v33.47h132.29v-33.47"
			/>
			<path
				id="ir-mar"
				class="bus-transfer"
				class:active={isBusTransferActive('MAR', 'IR', read, write)}
				class:reverse={isBusTransferReversed('MAR', 'IR', read, write)}
				d="m66.146 43.259v33.47h158.75v-33.47"
			/>
			<path id="ir-m" class="bus-transfer" d="m66.146 43.259v33.47h171.05" />
			<path
				id="out-ac"
				class="bus-transfer"
				class:active={isBusTransferActive('OUT', 'AC', read, write)}
				d="m92.604 43.259v33.47h44.979v-33.47"
			/>
			<path
				id="in-ac"
				class="bus-transfer reverse"
				class:active={isBusTransferActive('IN', 'AC', read, write)}
				d="m119.06 43.259v33.47l18.521-1e-6v-33.47"
			/>
			<path
				id="ac-mbr"
				class="bus-transfer"
				class:active={isBusTransferActive('MBR', 'AC', read, write)}
				class:reverse={isBusTransferReversed('MBR', 'AC', read, write)}
				d="m137.58 43.259v33.47h31.75v-33.47"
			/>
			<path
				id="ac-pc"
				class="bus-transfer"
				class:active={isBusTransferActive('PC', 'AC', read, write)}
				class:reverse={isBusTransferReversed('PC', 'AC', read, write)}
				d="m137.58 43.259v33.47h60.854v-33.47"
			/>
			<path
				id="ac-mar"
				class="bus-transfer"
				class:active={isBusTransferActive('MAR', 'AC', read, write)}
				class:reverse={isBusTransferReversed('MAR', 'AC', read, write)}
				d="m137.58 43.259v33.47h87.312v-33.47"
			/>
			<path
				id="ac-m"
				class="bus-transfer"
				class:active={isBusTransferActive('M', 'AC', read, write)}
				class:reverse={isBusTransferReversed('M', 'AC', read, write)}
				d="m137.58 43.259v33.47l99.616-1e-6"
			/>
			<path
				id="mbr-pc"
				class="bus-transfer"
				class:active={isBusTransferActive('PC', 'MBR', read, write)}
				class:reverse={isBusTransferReversed('PC', 'MBR', read, write)}
				d="m169.33 43.259v33.47h29.104v-33.47"
			/>
			<path
				id="mbr-mar"
				class="bus-transfer"
				class:active={isBusTransferActive('MAR', 'MBR', read, write)}
				class:reverse={isBusTransferReversed('MAR', 'MBR', read, write)}
				d="m169.33 43.259v33.47h55.562v-33.47"
			/>
			<path
				id="mbr-m"
				class="bus-transfer"
				class:active={isBusTransferActive('M', 'MBR', read, write)}
				class:reverse={isBusTransferReversed('M', 'MBR', read, write)}
				d="m169.33 43.259v33.47l67.866-1e-6"
			/>
			<path
				id="pc-mar"
				class="bus-transfer"
				class:active={isBusTransferActive('MAR', 'PC', read, write)}
				class:reverse={isBusTransferReversed('MAR', 'PC', read, write)}
				d="m198.44 43.259v33.47l26.458-1e-6v-33.47"
			/>
			<path
				id="pc-m"
				class="bus-transfer"
				class:active={isBusTransferActive('M', 'PC', read, write)}
				class:reverse={isBusTransferReversed('M', 'PC', read, write)}
				d="m198.44 43.259v33.47l38.761-2e-6"
			/>
			<path
				id="alu-ac"
				class="bus-transfer"
				class:active={isBusTransferActive('AC', 'ADD', read, write) ||
					isBusTransferActive('AC', 'SUB', read, write)}
				d="m153.46 62.177v14.552h-15.875v-33.47"
			/>
		</g>
		<g transform="translate(3.9688 -1.3229)">
			<path
				id="read-signals-path"
				class="read-signals-path"
				class:hover={hover === 'read'}
				d="m230.81 12.404v0.82424h-198.13v0.79478h6.2193l-0.06873 47.336 102.22 0.04496-5.2e-4 0.82424 2.1136-1.2211-2.1115-1.2227-5.2e-4 0.82631-101.43-0.04496 0.0052-3.7326h97.993v0.82631l2.1136-1.2227-2.1136-1.2206v0.82424h-97.932v-42.018h11.51v18.346h-0.82424l1.2206 2.1136 1.2206-2.1136h-0.82424v-18.346h52.123v18.346h-0.82372l1.2206 2.1136 1.2227-2.1136h-0.82423v-18.346h25.664v18.346h-0.82424l1.2206 2.1136 1.2206-2.1136h-0.82424v-18.346h25.664v18.346h-0.82423l1.2227 2.1136 1.2206-2.1136h-0.82373v-18.346h25.664v18.346h-0.82372l1.2206 2.1136 1.2227-2.1136h-0.82423v-18.346h25.664v18.346h-0.82424l1.2206 2.1136 1.2206-2.1136h-0.82424v-18.346h20.066v0.82424l2.1136-1.2206z"
				color="#000000"
				style="-inkscape-stroke:none"
			/>
			<g fill="none" stroke="#000" stroke-width=".79375">
				<path
					id="m-read"
					class="read-signal"
					class:active={read === 'M'}
					d="m32.676 13.626h198.83"
					marker-end="url(#marker90)"
				/>
				<path
					id="ir-read"
					class="read-signal"
					class:active={read === 'IR'}
					class:hover={hover === 'readIR'}
					d="m51.594 33.073v-19.447h-18.918"
					marker-start="url(#marker90)"
				/>
				<path
					id="in-read"
					class="read-signal"
					class:active={read === 'IN'}
					class:hover={hover === 'readIN'}
					d="m104.51 33.073v-19.447h-71.834"
					marker-start="url(#marker90)"
				/>
				<path
					id="ac-read"
					class="read-signal"
					class:active={read === 'AC'}
					class:hover={hover === 'readAC'}
					d="m130.97 33.073v-19.447h-98.293"
					marker-start="url(#marker90)"
				/>
				<path
					id="mbr-read"
					class="read-signal"
					class:active={read === 'MBR'}
					class:hover={hover === 'readMBR'}
					d="m157.43 33.073-1e-5 -19.447h-124.75"
					marker-start="url(#marker90)"
				/>
				<path
					id="pc-read"
					class="read-signal"
					class:active={read === 'PC'}
					class:hover={hover === 'readPC'}
					d="m183.89 33.073v-19.447h-151.21"
					marker-start="url(#marker90)"
				/>
				<path
					id="mar-read"
					class="read-signal"
					class:active={read === 'MAR'}
					class:hover={hover === 'readMAR'}
					d="m210.34 33.073v-19.447h-177.67"
					marker-start="url(#marker90)"
				/>
				<path
					id="alu-add"
					class="read-signal"
					class:active={read === 'ADD'}
					class:hover={hover === 'aluOpcode'}
					d="m138.32 56.438h-99.032v-42.812h-6.6146"
					marker-start="url(#marker90)"
				/>
				<path
					id="alu-sub"
					class="read-signal"
					class:active={read === 'SUB'}
					class:hover={hover === 'aluOpcode'}
					d="m141.75 61.007-102.53-0.044083 0.066146-47.337h-6.6146"
					marker-start="url(#marker90)"
				/>
			</g>
			<path
				id="write-signals-path"
				class="write-signals-path"
				class:hover={hover === 'write'}
				d="m51.594 44.892-1.2206 2.1136h0.82424v48.244h-18.522v0.79272h198.13v0.82631l2.1136-1.2227-2.1136-1.2206v0.82424h-20.066v-48.244h0.82424l-1.2206-2.1136-1.2206 2.1136h0.82424v48.244h-23.02v-48.244h0.82424l-1.2206-2.1136-1.2206 2.1136h0.82424v48.244h-4.4979v-48.244h0.82373l-1.2206-2.1136-1.2227 2.1136h0.82423v48.244h-8.4646v-48.244h0.82423l-1.2227-2.1136-1.2206 2.1136h0.82372v48.244h-44.185v-48.244h0.82424l-1.2206-2.1136-1.2206 2.1136h0.82424v48.244h-48.154v-48.244h0.82372l-1.2206-2.1136-1.2227 2.1136h0.82424v48.244h-25.664v-48.244h0.82424z"
				color="#000000"
				style="-inkscape-stroke:none"
			/>
			<g fill="none" stroke="#000" stroke-width=".79375">
				<path
					id="m-write"
					class="write-signal"
					class:active={write === 'M'}
					class:hover={hover === 'writeM'}
					d="m32.676 95.647h198.83"
					marker-end="url(#marker90)"
				/>
				<path
					id="ir-write"
					class="write-signal"
					class:active={write === 'IR'}
					class:hover={hover === 'writeIR'}
					d="m51.594 46.302v49.345h-18.918"
					marker-start="url(#marker90)"
				/>
				<path
					id="out-write"
					class="write-signal"
					class:active={write === 'OUT'}
					class:hover={hover === 'writeOUT'}
					d="m78.052 46.302v49.345h-45.376"
					marker-start="url(#marker90)"
				/>
				<path
					id="ac-write"
					class="write-signal"
					class:active={write === 'AC'}
					class:hover={hover === 'writeAC'}
					d="m127 46.302v49.345h-94.324"
					marker-start="url(#marker90)"
				/>
				<path
					id="mbr-write"
					class="write-signal"
					class:active={write === 'MBR'}
					class:hover={hover === 'writeMBR'}
					d="m171.98 46.302v49.345h-139.3"
					marker-start="url(#marker90)"
				/>
				<path
					id="pc-inc"
					class="write-signal"
					class:active={write === 'INC_PC'}
					class:hover={hover === 'incPC'}
					d="m186.53 46.302v49.345h-153.86"
					marker-start="url(#marker90)"
				/>
				<path
					id="pc-write"
					class="write-signal"
					class:active={write === 'PC'}
					class:hover={hover === 'writePC'}
					d="m181.24 46.302v49.345h-148.56"
					marker-start="url(#marker90)"
				/>
				<path
					id="mar-write"
					class="write-signal"
					class:active={write === 'MAR'}
					class:hover={hover === 'writeMAR'}
					d="m210.34 46.302v49.345h-177.67"
					marker-start="url(#marker90)"
				/>
				<path
					id="ac-alu"
					class="non-data-bus"
					class:hover={hover === 'aluA'}
					d="m142.21 51.197v-6.6146"
					marker-start="url(#marker90)"
				/>
				<path
					id="mbr-alu"
					class="non-data-bus"
					class:hover={hover === 'aluB'}
					d="m156.77 51.197v-6.6146"
					marker-start="url(#marker90)"
				/>
				<path
					id="ir-cu"
					class="non-data-bus"
					class:hover={hover === 'irCu'}
					d="m45.376 39.688-10.9 1e-6"
					marker-end="url(#Triangle)"
				/>
				<path
					id="mar-m"
					class="non-data-bus"
					class:hover={hover === 'marM'}
					d="m227.14 39.688 4.3398 1e-6"
					marker-end="url(#marker89)"
				/>
				<path
					id="ac-zero"
					class="signal"
					class:hover={hover === 'acSign'}
					d="m159.49 55.458v15.715h-124.96"
					marker-end="url(#marker90)"
				/>
				<path
					id="ac-neg"
					class="signal"
					class:hover={hover === 'acSign'}
					d="m155.7 60.513v6.4271h-121.17"
					marker-end="url(#marker90)"
				/>
			</g>
			<g
				fill="#fff"
				stroke="#000"
				stroke-linejoin="round"
				stroke-width=".79375"
			>
				<g stroke-linecap="round">
					<rect
						id="cu-chip"
						class="chip"
						x="-3.5719"
						y="1.7198"
						width="36.248"
						height="105.04"
						role="presentation"
						on:mouseenter={() => (hover = 'cu')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="ir-chip"
						class="chip"
						class:write={write === 'IR'}
						class:read={read === 'IR'}
						x="45.376"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'ir')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="out-chip"
						class="chip"
						class:write={write === 'OUT'}
						x="71.834"
						y="34.793"
						width="23.019"
						role="presentation"
						on:mouseenter={() => (hover = 'out')}
						on:mouseleave={() => (hover = null)}
						height="9.7896"
					/>
					<rect
						id="in-chip"
						class="chip"
						class:read={read === 'IN'}
						x="98.293"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'in')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="ac-chip"
						class="chip"
						class:write={write === 'AC'}
						class:read={read === 'AC'}
						x="124.75"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'ac')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="mbr-chip"
						class="chip"
						class:write={write === 'MBR'}
						class:read={read === 'MBR'}
						x="151.21"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'mbr')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="pc-chip"
						class="chip"
						class:read={read === 'PC'}
						class:write={write === 'PC' || write === 'INC_PC'}
						x="177.67"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'pc')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="mar-chip"
						class="chip"
						class:read={read === 'MAR'}
						class:write={write === 'MAR'}
						x="204.13"
						y="34.793"
						width="23.019"
						height="9.7896"
						role="presentation"
						on:mouseenter={() => (hover = 'mar')}
						on:mouseleave={() => (hover = null)}
					/>
					<rect
						id="m-chip"
						class="chip"
						class:read={read === 'M'}
						class:write={write === 'M'}
						x="233.23"
						y="1.7198"
						width="36.248"
						height="105.04"
						role="presentation"
						on:mouseenter={() => (hover = 'm')}
						on:mouseleave={() => (hover = null)}
					/>
				</g>
				<path
					id="alu-chip"
					class="chip"
					class:read={read === 'ADD' || read === 'SUB'}
					role="presentation"
					on:mouseenter={() => (hover = 'alu')}
					on:mouseleave={() => (hover = null)}
					d="m137.58 52.917h9.2604l2.6458 3.3073 2.6458-3.3073h9.2604l-7.9375 10.583h-7.9375z"
				/>
			</g>
			<g fill="#000000" font-family="sans-serif" stroke-width=".26458">
				<text
					x="8.5844879"
					y="113.12169"
					font-size="4.2333px"
					style="line-height:1.25"
					xml:space="preserve"
					><tspan
						x="8.5844879"
						y="113.12169"
						font-size="4.2333px"
						stroke-width=".26458"
						style:text-align="center"
						text-anchor="middle">Control unit</tspan
					></text
				>
				<text
					x="247.95113"
					y="112.66901"
					font-size="4.2333px"
					style="line-height:1.25"
					xml:space="preserve"
					><tspan
						x="247.95113"
						y="112.66901"
						font-size="4.2333px"
						stroke-width=".26458"
						style:text-align="center"
						text-anchor="middle">Main memory</tspan
					></text
				>
				<text
					x="47.962612"
					y="47.082363"
					font-size="10.583px"
					style="line-height:1.25"
					xml:space="preserve"
					><tspan x="47.962612" y="47.082363" stroke-width=".26458" /></text
				>
				<g font-size="3.175px">
					<text
						x="177.25569"
						y="47.742161"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="177.25569"
							y="47.742161"
							font-size="3.175px"
							stroke-width=".26458">w</tspan
						></text
					>
					<text
						x="182.96385"
						y="47.887112"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="182.96385"
							y="47.887112"
							font-size="3.175px"
							stroke-width=".26458">+</tspan
						></text
					>
					<text
						x="141.16228"
						y="57.286503"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="141.16228"
							y="57.286503"
							font-size="3.175px"
							stroke-width=".26458">+</tspan
						></text
					>
					<text
						x="144.74011"
						y="61.662834"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="144.74011"
							y="61.662834"
							font-size="3.175px"
							stroke-width=".26458">-</tspan
						></text
					>
				</g>
				<g font-size="4.2333px">
					<text
						x="30.816475"
						y="14.805297"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="30.816475"
							y="14.805297"
							font-size="4.2333px"
							stroke-width=".26458"
							style:text-align="end"
							text-anchor="end">Read</tspan
						></text
					>
					<text
						x="30.695045"
						y="96.826126"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="30.695045"
							y="96.826126"
							font-size="4.2333px"
							stroke-width=".26458"
							style:text-align="end"
							text-anchor="end">Write</tspan
						></text
					>
					<text
						x="5.2647953"
						y="34.521732"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="5.2647953"
							y="34.521732"
							font-size="4.2333px"
							stroke-width=".26458"
							style:text-align="center"
							text-anchor="middle">Step</tspan
						></text
					>
					<text
						x="30.000763"
						y="72.907936"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="30.000763"
							y="72.907936"
							font-size="4.2333px"
							stroke-width=".26458"
							style:text-align="end"
							text-anchor="end">AC=0</tspan
						></text
					>
					<text
						x="30.000763"
						y="67.183914"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="30.000763"
							y="67.183914"
							font-size="4.2333px"
							stroke-width=".26458"
							style:text-align="end"
							text-anchor="end">AC&lt;0</tspan
						></text
					>
				</g>
			</g>
			<g font-family="sans-serif" stroke-width=".26458" text-anchor="middle">
				<g font-size="4.2333px">
					<text
						x="55.824932"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="55.824932"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">IR</tspan
						></text
					>
					<text
						x="83.224892"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="83.224892"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">OUT</tspan
						></text
					>
					<text
						x="109.86306"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="109.86306"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">IN</tspan
						></text
					>
					<text
						x="136.26039"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="136.26039"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">AC</tspan
						></text
					>
					<text
						x="164.30623"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="164.30623"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">MBR</tspan
						></text
					>
					<text
						x="149.48405"
						y="51.990623"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="149.48405"
							y="51.990623"
							font-size="4.2333px"
							stroke-width=".26458">ALU</tspan
						></text
					>
					<text
						x="189.17708"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="189.17708"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">PC</tspan
						></text
					>
					<text
						x="217.22289"
						y="33.734375"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="217.22289"
							y="33.734375"
							font-size="4.2333px"
							stroke-width=".26458">MAR</tspan
						></text
					>
					<text
						x="251.39449"
						y="50.272305"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="251.39449"
							y="50.272305"
							font-size="4.2333px"
							stroke-width=".26458">M[MAR]</tspan
						></text
					>
				</g>
				<g font-size="6.35px">
					<text
						id="ir-value"
						class="value"
						x="56.88335"
						y="42.283726"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="56.88335"
							y="42.283726"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.IR)}</tspan
						></text
					>
					<text
						id="out-value"
						class="value"
						x="83.340645"
						y="42.283726"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="83.340645"
							y="42.283726"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.OUT)}</tspan
						></text
					>
					<text
						id="in-value"
						class="value"
						x="109.79794"
						y="42.283726"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="109.79794"
							y="42.283726"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.IN)}</tspan
						></text
					>
					<text
						id="m-value"
						class="value"
						x="251.35107"
						y="57.764774"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="251.35107"
							y="57.764774"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25"
							>{hex(state.memory[state.registers.MAR])}</tspan
						></text
					>
					<text
						id="ac-value"
						class="value"
						x="136.25729"
						y="42.280621"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="136.25729"
							y="42.280621"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.AC)}</tspan
						></text
					>
					<text
						id="mbr-value"
						class="value"
						x="162.71664"
						y="42.280621"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="162.71664"
							y="42.280621"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.MBR)}</tspan
						></text
					>
					<text
						id="pc-value"
						class="value"
						x="189.17599"
						y="42.280621"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="189.17599"
							y="42.280621"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.PC, 3)}</tspan
						></text
					>
					<text
						id="mar-value"
						class="value"
						x="215.63535"
						y="42.280621"
						style:text-align="center"
						style="line-height:1.25"
						xml:space="preserve"
						><tspan
							x="215.63535"
							y="42.280621"
							font-size="6.35px"
							stroke-width=".26458"
							style="line-height:1.25">{hex(state.registers.MAR, 3)}</tspan
						></text
					>
				</g>
			</g>
		</g>
		<g
			stroke="#000"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width=".26458"
		>
			<circle
				id="step-0-circle"
				class="step"
				class:active={step <= 0}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="37.306"
				r="1.1906"
			/>
			<circle
				id="step-1-circle"
				class="step"
				class:active={step === 1}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="42.598"
				r="1.1906"
			/>
			<circle
				id="step-2-circle"
				class="step"
				class:active={step === 2}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="47.89"
				r="1.1906"
			/>
			<circle
				id="step-3-circle"
				class="step"
				class:active={step === 3}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="53.181"
				r="1.1906"
			/>
			<circle
				id="step-4-circle"
				class="step"
				class:active={step === 4}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="58.473"
				r="1.1906"
			/>
			<circle
				id="step-5-circle"
				class="step"
				class:active={step === 5}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="63.765"
				r="1.1906"
			/>
			<circle
				id="step-6-circle"
				class="step"
				class:active={step === 6}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="69.056"
				r="1.1906"
			/>
			<circle
				id="step-7-circle"
				class="step"
				class:active={step === 7}
				class:hover={hover == 'step'}
				cx="9.2604"
				cy="74.348"
				r="1.1906"
			/>
		</g>
		<g fill-opacity="0">
			<rect
				id="read-hover"
				x="22.018"
				y="7.1094"
				width="193.52"
				height="9.9157"
				role="presentation"
				on:mouseenter={() => (hover = 'read')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-hover"
				x="22.018"
				y="89.615"
				width="193.52"
				height="9.3544"
				role="presentation"
				on:mouseenter={() => (hover = 'write')}
				on:mouseleave={() => (hover = null)}
			/>
			<path
				id="ac-sign-hover"
				d="m38.229 63.789 119.31-0.39688 2.5136-7.4171 4.9551-3.4036 0.155 19.457-144.52 0.52917-0.1151-10.496 14.972-0.37418z"
				role="presentation"
				on:mouseenter={() => (hover = 'acSign')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-ir-hover"
				x="51.824"
				y="9.7286"
				width="5.7997"
				height="23.199"
				role="presentation"
				on:mouseenter={() => (hover = 'readIR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-in-hover"
				x="105.33"
				y="11.412"
				width="5.9868"
				height="22.076"
				role="presentation"
				on:mouseenter={() => (hover = 'readIN')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-ac-hover"
				x="131.34"
				y="11.225"
				width="6.361"
				height="22.638"
				role="presentation"
				on:mouseenter={() => (hover = 'readAC')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-mbr-hover"
				x="158.84"
				y="11.038"
				width="5.0514"
				height="22.451"
				role="presentation"
				on:mouseenter={() => (hover = 'readMBR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-pc-hover"
				x="184.84"
				y="11.038"
				width="5.9868"
				height="22.451"
				role="presentation"
				on:mouseenter={() => (hover = 'readPC')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-mar-hover"
				x="211.78"
				y="10.477"
				width="4.8643"
				height="22.825"
				role="presentation"
				on:mouseenter={() => (hover = 'readMAR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="read-m-hover"
				x="214.4"
				y="9.3544"
				width="24.322"
				height="5.7997"
				role="presentation"
				on:mouseenter={() => (hover = 'readM')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-m-hover"
				x="214.96"
				y="91.299"
				width="23.199"
				height="7.4835"
				role="presentation"
				on:mouseenter={() => (hover = 'writeM')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-ir-hover"
				x="53.32"
				y="43.217"
				width="5.2385"
				height="52.759"
				role="presentation"
				on:mouseenter={() => (hover = 'writeIR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-out-hover"
				x="78.577"
				y="43.592"
				width="6.361"
				height="52.198"
				role="presentation"
				on:mouseenter={() => (hover = 'writeOUT')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-ac-hover"
				x="126.47"
				y="43.03"
				width="7.4835"
				height="52.572"
				role="presentation"
				on:mouseenter={() => (hover = 'writeAC')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-mbr-hover"
				x="172.87"
				y="43.405"
				width="6.361"
				height="51.824"
				role="presentation"
				on:mouseenter={() => (hover = 'writeMBR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-pc-hover"
				x="181.1"
				y="43.405"
				width="6.1739"
				height="51.075"
				role="presentation"
				on:mouseenter={() => (hover = 'writePC')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="inc-pc-hover"
				x="188.4"
				y="43.405"
				width="6.1739"
				height="50.327"
				role="presentation"
				on:mouseenter={() => (hover = 'incPC')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="write-mar-hover"
				x="211.41"
				y="43.03"
				width="5.7997"
				height="52.385"
				role="presentation"
				on:mouseenter={() => (hover = 'writeMAR')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="step-hover"
				x="3.1805"
				y="28.625"
				width="13.283"
				height="48.83"
				role="presentation"
				on:mouseenter={() => (hover = 'step')}
				on:mouseleave={() => (hover = null)}
			/>
			<path
				id="alu-opcode-hover"
				d="m40.411 10.103 0.18709 52.572h109.07l-7.2964-10.103-95.976-0.74836-0.18709-41.534z"
				role="presentation"
				on:mouseenter={() => (hover = 'aluOpcode')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="alu-a-hover"
				x="143.87"
				y="43.03"
				width="5.2385"
				height="8.2319"
				role="presentation"
				on:mouseenter={() => (hover = 'aluA')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="alu-b-hover"
				x="158.46"
				y="42.469"
				width="4.6772"
				height="8.2319"
				role="presentation"
				on:mouseenter={() => (hover = 'aluB')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="mar-m-hover"
				x="231.24"
				y="36.108"
				width="6.361"
				height="4.8643"
				role="presentation"
				on:mouseenter={() => (hover = 'marM')}
				on:mouseleave={() => (hover = null)}
			/>
			<rect
				id="ir-cu-hover"
				x="36.295"
				y="35.734"
				width="12.909"
				height="4.6772"
				role="presentation"
				on:mouseenter={() => (hover = 'irCu')}
				on:mouseleave={() => (hover = null)}
			/><path
				id="bus-hover"
				d="m64.559 43.26v35.056h172.64v-3.1734h-10.717v-31.883h-3.174v31.883h-23.283v-31.883h-3.176v31.883h-25.93v-31.883h-3.174v31.883h-12.7v-12.965h-3.175v12.965h-12.701v-31.883h-3.174v31.883h-15.345v-31.883h-3.176v31.883h-23.283v-31.883h-3.1734v31.883h-23.285v-31.883z"
				color="#000000"
				style="-inkscape-stroke:none"
				role="presentation"
				on:mouseenter={() => (hover = 'bus')}
				on:mouseleave={() => (hover = null)}
			/>
		</g>
	</svg>
	{#if hover}
		<div class="help-text">
			{helpText[hover] ?? ''}
		</div>
	{/if}
</div>

<style>
	.data-path {
		height: 100%;
		overflow: auto;
		padding: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		padding-bottom: 3rem;
	}

	.help-text {
		max-width: 800px;
		position: absolute;
		bottom: 2rem;
		text-align: center;
		padding: 1rem;
		background-color: var(--bulma-background);
		border: solid 1px var(--bulma-border);
		border-radius: var(--bulma-radius);
        pointer-events: none;
	}

	svg {
		width: 100%;
		height: 100%;
		min-width: 640px;
		max-width: 1200px;
	}

	.chip {
		fill: var(--bulma-scheme-main-bis);
		stroke: currentColor;
		transition:
			stroke 0.1s ease,
			fill 0.1s ease;
	}
	.chip:hover {
		fill: var(--bulma-scheme-main-ter);
	}
	.chip.read {
		stroke: var(--bulma-info);
	}
	.chip.write {
		stroke: var(--bulma-danger);
	}

	text {
		fill: currentColor;
		font-family: var(--bulma-family-primary);
		pointer-events: none;
	}
	.value {
		font-family: var(--bulma-code-family);
	}

	.signal {
		stroke: currentColor;
		opacity: 0.7;
		transition: opacity 0.1s ease;
	}
	.signal.hover {
		opacity: 0.9;
	}

	.read-signal {
		stroke: var(--bulma-info);
	}
	.read-signals-path {
		fill: var(--bulma-info);
		opacity: 0.2;
	}
	.read-signals-path.hover {
		opacity: 0.5;
	}

	.write-signal {
		stroke: var(--bulma-danger);
	}
	.write-signals-path {
		fill: var(--bulma-danger);
		opacity: 0.2;
	}
	.write-signals-path.hover {
		opacity: 0.5;
	}

	.bus-path {
		fill: var(--bulma-success);
		opacity: 0.2;
		transition: opacity 0.1s ease;
	}
	.bus-path.hover {
		opacity: 0.6;
	}
	.bus-path.active {
		opacity: 0.8;
	}

	.non-data-bus {
		stroke: var(--bulma-success);
		opacity: 0.9;
		transition: opacity 0.1s ease;
	}

	.non-data-bus.hover {
		opacity: 1;
	}

	.read-signal,
	.write-signal,
	.bus-transfer {
		opacity: 0;
		transition: opacity 0.1s ease;
	}

	.step {
		fill: var(--bulma-info-20);
		stroke: var(--bulma-info-05);
		transition: fill 0.1s ease;
	}
	.step.hover {
		fill: var(--bulma-info-40);
	}
	.step.active {
		fill: var(--bulma-info);
	}

	.read-signal.hover,
	.write-signal.hover {
		opacity: 0.7;
	}
	.read-signal.active,
	.write-signal.active,
	.bus-transfer.active {
		opacity: 1;
	}

	.bus-transfer {
		stroke: #fff;
		animation: dash 0.5s linear;
		animation-iteration-count: infinite;
	}
	.bus-transfer.reverse {
		animation: dash-reverse 0.5s linear;
		animation-iteration-count: infinite;
	}
	@keyframes dash {
		to {
			stroke-dashoffset: -3.175;
		}
	}
	@keyframes dash-reverse {
		to {
			stroke-dashoffset: 3.175;
		}
	}
</style>
