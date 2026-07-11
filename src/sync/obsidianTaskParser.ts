import {
	SP_ID_REGEX,
	TAGS_REGEX,
	DUE_REGEX,
	PROJECT_REGEX,
	AT_DUE_REGEX,
	AT_TAGS_REGEX,
	AT_PROJECT_REGEX,
	AT_SYNTAX_REGEX,
	CHECKBOX_DONE_REGEX,
	CHECKBOX_UNDONE_REGEX,
} from '../utils/constants';

export interface TaskLine {
	raw: string;
	title: string;
	indentLevel: number;
	isDone: boolean;
	spId: string | null;
	tags: string[];
	dueRaw: string | null;
	project: string | null;
	lineNumber: number;
	filePath: string;
}

function extractInlineField(line: string, regex: RegExp): string | null {
	const match = line.match(regex);
	return match ? (match[1]?.trim() ?? null) : null;
}

function extractAllAtFields(line: string, regex: RegExp): string[] {
	const matches = line.matchAll(regex);
	return Array.from(matches, (m) => m[1]!.trim());
}

function stripQuotes(s: string): string {
	return s.replace(/^"|"$/g, '');
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

	// Old syntax [key:: value]
	const tagsRaw = extractInlineField(trimmed, TAGS_REGEX);
	const dueRaw = extractInlineField(trimmed, DUE_REGEX);
	const project = extractInlineField(trimmed, PROJECT_REGEX);

	// New @ syntax @key:value
	const atDueRaw = extractInlineField(trimmed, AT_DUE_REGEX);
	const atProject = extractInlineField(trimmed, AT_PROJECT_REGEX);
	const atTagsRaw = extractAllAtFields(trimmed, AT_TAGS_REGEX);

	// @ syntax takes priority over old syntax
	const finalDueRaw = atDueRaw ?? dueRaw;
	const finalProject = atProject ?? project;

	// Merge tags from both syntaxes
	const oldTags = tagsRaw
		? tagsRaw
				.split(/[,|]/)
				.map((t) => t.trim())
				.filter((t) => t.length > 0)
		: [];
	const allTags = [...oldTags, ...atTagsRaw.map(stripQuotes)];

	const title = trimmed
		.replace(/^- \[.\] /, '')
		.replace(SP_ID_REGEX, '')
		.replace(TAGS_REGEX, '')
		.replace(DUE_REGEX, '')
		.replace(PROJECT_REGEX, '')
		.replace(AT_SYNTAX_REGEX, '')
		.trim();

	return {
		raw: trimmed,
		title,
		indentLevel,
		isDone,
		spId,
		tags: allTags,
		dueRaw: finalDueRaw,
		project: finalProject,
		lineNumber,
		filePath,
	};
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
