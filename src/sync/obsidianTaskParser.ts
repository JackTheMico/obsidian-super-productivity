import { SP_ID_REGEX, CHECKBOX_DONE_REGEX, CHECKBOX_UNDONE_REGEX } from '../utils/constants';

export interface TaskLine {
	raw: string;
	title: string;
	indentLevel: number;
	isDone: boolean;
	spId: string | null;
	lineNumber: number;
	filePath: string;
}

export function parseLine(line: string, lineNumber: number, filePath: string): TaskLine | null {
	const trimmed = line.trimEnd();
	if (!CHECKBOX_UNDONE_REGEX.test(trimmed) && !CHECKBOX_DONE_REGEX.test(trimmed)) {
		return null;
	}

	const leadingSpaces = line.length - line.trimStart().length;
	const indentLevel = Math.floor(leadingSpaces / 2);
	const isDone = CHECKBOX_DONE_REGEX.test(trimmed);
	const spIdMatch = trimmed.match(SP_ID_REGEX);
	const spId = spIdMatch ? spIdMatch[1]!.trim() : null;
	const title = trimmed
		.replace(/^- \[.\] /, '')
		.replace(SP_ID_REGEX, '')
		.trim();

	return { raw: trimmed, title, indentLevel, isDone, spId, lineNumber, filePath };
}

export function extractAllTasks(content: string, filePath: string): TaskLine[] {
	const lines = content.split('\n');
	const tasks: TaskLine[] = [];
	for (let i = 0; i < lines.length; i++) {
		const task = parseLine(lines[i]!, i, filePath);
		if (task) tasks.push(task);
	}
	return tasks;
}

export function addSpId(line: string, spId: string): string {
	const trimmed = line.trimEnd().replace(SP_ID_REGEX, '').trimEnd();
	return `${trimmed} [sp_id:: ${spId}]`;
}

export function removeSpId(line: string): string {
	return line.trimEnd().replace(SP_ID_REGEX, '').trimEnd();
}

export function markDone(line: string): string {
	return line.replace(/^- \[ \]/, '- [x]');
}

export function markUndone(line: string): string {
	return line.replace(/^- \[x\]/i, '- [ ]');
}
