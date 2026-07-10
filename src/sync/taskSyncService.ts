import { App, Editor, Notice, TFile, Vault } from 'obsidian';
import { SuperProductivityApi } from '../api/superProductivityApi';
import type { SuperProductivitySettings } from '../settings';
import {
	parseLine,
	extractAllTasks,
	addSpId,
	markDone,
} from './obsidianTaskParser';
import type { TaskLine } from './obsidianTaskParser';
import { createDeepLink } from '../utils/deepLink';

export class TaskSyncService {
	private api: SuperProductivityApi;
	private vault: Vault;
	private app: App;
	private settings: SuperProductivitySettings;
	private polling = false;
	private cacheInitialized = false;

	constructor(
		app: App,
		api: SuperProductivityApi,
		settings: SuperProductivitySettings,
	) {
		this.app = app;
		this.vault = app.vault;
		this.api = api;
		this.settings = settings;
	}

	private async readFileSafe(file: TFile): Promise<string> {
		try {
			return await this.vault.read(file);
		} catch {
			return '';
		}
	}

	private async modifyFileSafe(
		file: TFile,
		content: string,
	): Promise<boolean> {
		try {
			await this.vault.modify(file, content);
			return true;
		} catch {
			return false;
		}
	}

	async pushCurrentLineTask(editor: Editor, file: TFile): Promise<void> {
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line);
		const task = parseLine(lineText, cursor.line, file.path);
		if (!task) {
			new Notice('Current line is not a task');
			return;
		}
		if (task.isDone) {
			new Notice('Task is already completed');
			return;
		}
		if (task.spId) {
			new Notice('Task already has a sync ID');
			return;
		}

		try {
			const content = await this.readFileSafe(file);
			const allTasks = extractAllTasks(content, file.path);
			const parentSpId = this.findParentSpId(task, allTasks);

			const notes = this.settings.autoCreateDeepLink
				? createDeepLink(this.app, file, task.lineNumber)
				: undefined;

			const spTask = await this.api.createTask({
				title: task.title,
				notes,
				projectId: this.settings.defaultProjectId || undefined,
				parentId: parentSpId,
			});

			const newLine = addSpId(editor.getLine(cursor.line), spTask.id);
			editor.setLine(cursor.line, newLine);

			this.settings.taskStateCache[spTask.id] = false;
			new Notice('Task sent to Super Productivity');
		} catch (e) {
			new Notice(`Failed to send task: ${(e as Error).message}`);
		}
	}

	async pushAllTasks(file: TFile): Promise<void> {
		const content = await this.readFileSafe(file);
		const allTasks = extractAllTasks(content, file.path);
		const activeTasks = allTasks.filter((t) => !t.isDone && !t.spId);

		if (activeTasks.length === 0) {
			new Notice('No unsynced unchecked tasks found');
			return;
		}

		try {
			const spIds: { lineNumber: number; spId: string }[] = [];

			for (const task of activeTasks) {
				const parentSpId = this.findParentSpId(task, allTasks);

				const notes = this.settings.autoCreateDeepLink
					? createDeepLink(this.app, file, task.lineNumber)
					: undefined;

				const spTask = await this.api.createTask({
					title: task.title,
					notes,
					projectId: this.settings.defaultProjectId || undefined,
					parentId: parentSpId,
				});

				spIds.push({ lineNumber: task.lineNumber, spId: spTask.id });
				this.settings.taskStateCache[spTask.id] = false;
			}

			const updatedLines = content.split('\n');
			for (const { lineNumber, spId } of spIds) {
				updatedLines[lineNumber] = addSpId(
					updatedLines[lineNumber]!,
					spId,
				);
			}
			await this.modifyFileSafe(file, updatedLines.join('\n'));

			new Notice(`Sent ${spIds.length} tasks to Super Productivity`);
		} catch (e) {
			new Notice(`Failed to send tasks: ${(e as Error).message}`);
		}
	}

	private findParentSpId(
		task: TaskLine,
		allTasks: TaskLine[],
	): string | undefined {
		if (
			task.indentLevel === 0 ||
			!this.settings.enableSubtaskSync
		) {
			return undefined;
		}
		let parentSpId: string | undefined;
		for (let i = allTasks.length - 1; i >= 0; i--) {
			const t = allTasks[i]!;
			if (
				t.lineNumber < task.lineNumber &&
				t.indentLevel === task.indentLevel - 1 &&
				t.spId
			) {
				parentSpId = t.spId;
				break;
			}
		}
		return parentSpId;
	}

	async pollOnce(): Promise<void> {
		if (this.polling) return;
		this.polling = true;
		try {
			const healthy = await this.api.healthCheck();
			if (!healthy) return;

			if (!this.cacheInitialized) {
				await this.initializeCache();
				this.cacheInitialized = true;
			}

			await this.syncSpToObsidian();
			await this.syncObsidianToSp();
		} catch (e) {
			console.error('Sync error:', e);
		} finally {
			this.polling = false;
		}
	}

	private async initializeCache(): Promise<void> {
		const files = this.vault.getMarkdownFiles();
		for (const file of files) {
			const content = await this.readFileSafe(file);
			for (const task of extractAllTasks(content, file.path)) {
				if (task.spId) {
					this.settings.taskStateCache[task.spId] = task.isDone;
				}
			}
		}
	}

	private async syncSpToObsidian(): Promise<void> {
		const spTasks = await this.api.getTasks({
			includeDone: true,
			source: 'all',
		});

		for (const spTask of spTasks) {
			if (!spTask.isDone) continue;

			const cached = this.settings.taskStateCache[spTask.id];
			if (cached === true) continue;

			const found = await this.findLineBySpId(spTask.id);
			if (!found) {
				this.settings.taskStateCache[spTask.id] = false;
				continue;
			}

			const { file, taskLine } = found;
			if (taskLine.isDone) {
				this.settings.taskStateCache[spTask.id] = true;
				continue;
			}

			const content = await this.readFileSafe(file);
			const lines = content.split('\n');
			lines[taskLine.lineNumber] = markDone(lines[taskLine.lineNumber]!);
			const ok = await this.modifyFileSafe(
				file,
				lines.join('\n'),
			);
			if (ok) {
				this.settings.taskStateCache[spTask.id] = true;
			}
		}
	}

	private async syncObsidianToSp(): Promise<void> {
		const files = this.vault.getMarkdownFiles();
		for (const file of files) {
			const content = await this.readFileSafe(file);
			for (const task of extractAllTasks(content, file.path)) {
				if (!task.spId) continue;

				const cached = this.settings.taskStateCache[task.spId];

				if (cached === undefined) {
					this.settings.taskStateCache[task.spId] = task.isDone;
					continue;
				}

				if (cached === task.isDone) continue;

				try {
					await this.api.updateTask(task.spId, {
						isDone: task.isDone,
					});
					this.settings.taskStateCache[task.spId] = task.isDone;
				} catch (e) {
					console.error(
						`Failed to update SP task ${task.spId}:`,
						e,
					);
				}
			}
		}
	}

	private async findLineBySpId(
		spId: string,
	): Promise<{ file: TFile; taskLine: TaskLine } | null> {
		const files = this.vault.getMarkdownFiles();
		for (const file of files) {
			const content = await this.readFileSafe(file);
			for (const task of extractAllTasks(content, file.path)) {
				if (task.spId === spId) {
					return { file, taskLine: task };
				}
			}
		}
		return null;
	}
}
