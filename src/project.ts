import type { InputOutputMode } from './settings';

export type InputItem = {
	format: InputOutputMode;
	consumed: string;
	queued: string;
};

/** Mapping from line number to whether there is a breakpoint set there */
export type Breakpoints = { [line: number]: boolean | undefined };

/** Mapping from labels to whether that label should be watched as a pointer */
export type Pointers = { [label: string]: boolean | undefined };

export interface Project {
	code: string;
	breakpoints: Breakpoints;
	pointers: Pointers;
	inputs: InputItem[];
	outputMode: InputOutputMode;
}

const defaultProject: Project = {
	code: '',
	breakpoints: {},
	pointers: {},
	inputs: [],
	outputMode: 'hex',
};

function readProject(x: any) {
	const project: Project = { ...defaultProject, ...x };
	for (const input of project.inputs) {
		if (input.consumed !== '') {
			// Reset inputs to be unconsumed
			input.queued = [input.consumed, input.queued].join(
				input.format === 'unicode' ? '' : '\n',
			);
			input.consumed = '';
		}
	}
	return project;
}

export function getProjects(): { [id: string]: Project } {
	try {
		const parsed = JSON.parse(localStorage.getItem('marie.projects') ?? '[]');
		if (Array.isArray(parsed)) {
			return parsed
				.filter((x) => x._id)
				.reduce((acc, x) => ({ ...acc, [x._id]: readProject(x) }), {});
		}
	} catch (e) {
		console.error(e);
	}
	return {};
}

export function newProject() {
	const projectId = crypto.randomUUID();
	sessionStorage.setItem('marie.projectId', projectId);
	return { projectId, project: { ...defaultProject } };
}

export function restoreProject() {
	const projectId = sessionStorage.getItem('marie.projectId');
	if (!projectId) {
		return newProject();
	}
	const projects = getProjects();
	const project: Project = projects[projectId] ?? { ...defaultProject };
	return { projectId, project };
}

export function saveProject(projectId: string, project: Project) {
	const projects: { [key: string]: any } = getProjects();
	projects[projectId] = { ...project, _timestamp: Date.now(), _id: projectId };
	const result = Object.values(projects)
		.sort((a, b) => b._timestamp - a._timestamp)
		.slice(0, 10);
	localStorage.setItem('marie.projects', JSON.stringify(result));
}
