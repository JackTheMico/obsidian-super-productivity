import { App, Editor, Notice, TFile, Vault } from 'obsidian';
import { SuperProductivityApi } from '../api/superProductivityApi';
import type { SPTask } from '../api/types';
import type { SuperProductivitySettings } from '../settings';
import {
	parseLine,
	extractAllTasks,
	addSpId,
	markDone,
	applyExtraFieldsToLine,
} from './obsidianTaskParser';
import type { TaskLine } from './obsidianTaskParser';
import { createDeepLink } from '../utils/deepLink';
import {
	parseSchedule,
	parseEstimate,
	formatEstimate,
	formatSchedule,
	resolveTagIds,
	resolveProjectId,
} from '../utils/taskFields';

export class TaskSyncService {
	private api: SuperProductivityApi;
	private vault: Vault;
	private app: App;
	private settings: SuperProductivitySettings;
	private polling = false;
	private cacheInitialized = false;
	suppressAutoSync = false;

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
			this.suppressAutoSync = true;
			await this.vault.modify(file, content);
			return true;
		} catch {
			return false;
		} finally {
			this.suppressAutoSync = false;
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

		try {
			this.suppressAutoSync = true;
			const content = await this.readFileSafe(file);
			const allTasks = extractAllTasks(content, file.path);
			const parentSpId = this.findParentSpId(task, allTasks);

			const notes = this.settings.autoCreateDeepLink
				? createDeepLink(this.app, file, task.lineNumber)
				: undefined;

			const { tagIds, projectId, schedule, timeEstimate } =
				await this.resolveTaskFields(task);

			let spTask;
			if (task.spId) {
				spTask = await this.api.updateTask(task.spId, {
					title: task.title,
					notes,
					projectId: projectId || undefined,
					tagIds: tagIds.length ? tagIds : undefined,
					dueWithTime: schedule.dueWithTime,
					timeEstimate,
				});
				new Notice(`[sp-sync] 更新任务 ${spTask.id} | dueWithTime=${spTask.dueWithTime}`);
			} else {
				spTask = await this.api.createTask({
					title: task.title,
					notes,
					projectId: projectId || undefined,
					parentId: parentSpId,
					tagIds: tagIds.length ? tagIds : undefined,
					dueWithTime: schedule.dueWithTime,
					timeEstimate,
				});
				new Notice(`[sp-sync] 创建任务 ${spTask.id} | dueWithTime=${spTask.dueWithTime}`);

				const newLine = addSpId(editor.getLine(cursor.line), spTask.id);
				editor.setLine(cursor.line, newLine);
			}

			this.settings.taskStateCache[spTask.id] = false;
			new Notice(task.spId ? 'Task updated in super productivity' : 'Task sent to super productivity');
		} catch (e) {
			new Notice(`Failed to send task: ${(e as Error).message}`);
		} finally {
			this.suppressAutoSync = false;
		}
	}

	async pushAllTasks(file: TFile): Promise<void> {
		const content = await this.readFileSafe(file);
		const allTasks = extractAllTasks(content, file.path);
		const newTasks = allTasks.filter((t) => !t.isDone && !t.spId);
		const existingTasks = allTasks.filter((t) => !t.isDone && t.spId);

		if (newTasks.length === 0 && existingTasks.length === 0) {
			new Notice('No unchecked tasks found');
			return;
		}

		try {
			this.suppressAutoSync = true;
			let createdCount = 0;
			let updatedCount = 0;
			const spIds: { lineNumber: number; spId: string }[] = [];

			if (newTasks.length > 0) {
				const { tagIds, projectIds, schedules, timeEstimates } =
					await this.resolveTaskFieldsBulk(newTasks);

				for (const task of newTasks) {
					const parentSpId = this.findParentSpId(task, allTasks);

					const notes = this.settings.autoCreateDeepLink
						? createDeepLink(this.app, file, task.lineNumber)
						: undefined;

					const spTask = await this.api.createTask({
						title: task.title,
						notes,
						projectId:
							projectIds[task.lineNumber] ||
							this.settings.defaultProjectId ||
							undefined,
						parentId: parentSpId,
						tagIds: task.tags.length ? tagIds[task.lineNumber] : undefined,
						dueWithTime: schedules[task.lineNumber]?.dueWithTime,
						timeEstimate: timeEstimates[task.lineNumber],
					});

					new Notice(
						`[sp-sync] 创建任务 ${spTask.id} | dueWithTime=${spTask.dueWithTime}`,
					);

					spIds.push({ lineNumber: task.lineNumber, spId: spTask.id });
					this.settings.taskStateCache[spTask.id] = false;
					createdCount++;
				}
			}

			if (existingTasks.length > 0) {
				const { tagIds, projectIds, schedules, timeEstimates } =
					await this.resolveTaskFieldsBulk(existingTasks);

				for (const task of existingTasks) {
					const notes = this.settings.autoCreateDeepLink
						? createDeepLink(this.app, file, task.lineNumber)
						: undefined;

					const spTask = await this.api.updateTask(task.spId!, {
						title: task.title,
						notes,
						projectId:
							projectIds[task.lineNumber] ||
							this.settings.defaultProjectId ||
							undefined,
						tagIds: task.tags.length ? tagIds[task.lineNumber] : undefined,
						dueWithTime: schedules[task.lineNumber]?.dueWithTime,
						timeEstimate: timeEstimates[task.lineNumber],
					});

					new Notice(
						`[sp-sync] 更新任务 ${spTask.id} | dueWithTime=${spTask.dueWithTime}`,
					);

					this.settings.taskStateCache[spTask.id] = false;
					updatedCount++;
				}
			}

			const updatedLines = content.split('\n');
			for (const { lineNumber, spId } of spIds) {
				updatedLines[lineNumber] = addSpId(
					updatedLines[lineNumber]!,
					spId,
				);
			}
			await this.modifyFileSafe(file, updatedLines.join('\n'));

			const parts: string[] = [];
			if (createdCount > 0) parts.push(`创建 ${createdCount} 个`);
			if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个`);
			new Notice(`${parts.join('、')}任务同步到 Super Productivity`);
		} catch (e) {
			new Notice(`Failed to send tasks: ${(e as Error).message}`);
		} finally {
			this.suppressAutoSync = false;
		}
	}

	private async resolveTaskFields(task: TaskLine): Promise<{
		tagIds: string[];
		projectId: string;
		schedule: { dueWithTime?: number };
		timeEstimate?: number;
	}> {
		const allTagNames = [...task.tags];
		if (this.settings.syncExtraFields) {
			allTagNames.push(...task.priorityRaw);
		}

		const tagIds: string[] = [];
		if (this.settings.syncTags && allTagNames.length) {
			const result = await resolveTagIds(this.api, allTagNames);
			tagIds.push(...result.ids);
			if (result.missing.length) {
				new Notice(
					`Tags not found in SP (skipped): ${result.missing.join(', ')}`,
				);
			}
		}

		let projectId = this.settings.defaultProjectId;
		if (task.project) {
			const resolved = await resolveProjectId(
				this.api,
				task.project,
				this.settings.defaultProjectId,
			);
			projectId = resolved.id;
			if (!resolved.resolved) {
				new Notice(
					`Project "${task.project}" not found in SP, using default`,
				);
			}
		}

		let schedule: { dueWithTime?: number } = {};
		if (this.settings.syncExtraFields) {
			const sched = parseSchedule(task.scheduleRaw);
			if (sched === null && task.scheduleRaw) {
				new Notice(`Invalid schedule: ${task.scheduleRaw}`);
			} else {
				schedule = sched ?? {};
			}
		}

		let timeEstimate: number | undefined;
		if (this.settings.syncExtraFields) {
			const est = parseEstimate(task.estimateRaw);
			if (est === null && task.estimateRaw) {
				new Notice(`Invalid estimate: ${task.estimateRaw}`);
			} else {
				timeEstimate = est ?? undefined;
			}
		}

		return { tagIds, projectId, schedule, timeEstimate };
	}

	private async resolveTaskFieldsBulk(tasks: TaskLine[]): Promise<{
		tagIds: Record<number, string[]>;
		projectIds: Record<number, string | undefined>;
		schedules: Record<number, { dueWithTime?: number }>;
		timeEstimates: Record<number, number | undefined>;
	}> {
		const tagIds: Record<number, string[]> = {};
		const projectIds: Record<number, string | undefined> = {};
		const schedules: Record<number, { dueWithTime?: number }> = {};
		const timeEstimates: Record<number, number | undefined> = {};

		const allTagNames = new Set<string>();
		const projectNames = new Set<string>();
		for (const task of tasks) {
			if (this.settings.syncTags) {
				task.tags.forEach((t) => allTagNames.add(t));
				if (this.settings.syncExtraFields) {
					task.priorityRaw.forEach((p) => allTagNames.add(p));
				}
			}
			if (task.project) projectNames.add(task.project);
			if (this.settings.syncExtraFields) {
				const est = parseEstimate(task.estimateRaw);
				if (est === null && task.estimateRaw) {
					new Notice(`Invalid estimate: ${task.estimateRaw}`);
				} else {
					timeEstimates[task.lineNumber] = est ?? undefined;
				}
				const sched = parseSchedule(task.scheduleRaw);
				if (sched === null && task.scheduleRaw) {
					new Notice(`Invalid schedule: ${task.scheduleRaw}`);
				} else {
					schedules[task.lineNumber] = sched ?? {};
				}
			} else {
				timeEstimates[task.lineNumber] = undefined;
				schedules[task.lineNumber] = {};
			}
		}

		const tagNameToId = new Map<string, string>();
		if (this.settings.syncTags && allTagNames.size) {
			const result = await resolveTagIds(this.api, [...allTagNames]);
			const names = [...allTagNames];
			result.ids.forEach((id, i) => {
				const name = names[i]!;
				tagNameToId.set(name.toLowerCase(), id);
			});
			if (result.missing.length) {
				new Notice(
					`Tags not found in SP (skipped): ${result.missing.join(', ')}`,
				);
			}
		}

		const projectNameToId = new Map<string, string>();
		if (projectNames.size) {
			for (const name of projectNames) {
				const resolved = await resolveProjectId(
					this.api,
					name,
					this.settings.defaultProjectId,
				);
				if (resolved.resolved) {
					projectNameToId.set(name.toLowerCase(), resolved.id);
				} else {
					new Notice(`Project "${name}" not found in SP, using default`);
				}
			}
		}

		for (const task of tasks) {
			if (this.settings.syncTags && task.tags.length) {
				tagIds[task.lineNumber] = task.tags
					.map((t) => tagNameToId.get(t.toLowerCase()))
					.filter((id): id is string => !!id);
			} else {
				tagIds[task.lineNumber] = [];
			}
			projectIds[task.lineNumber] = task.project
				? projectNameToId.get(task.project.toLowerCase())
				: undefined;
		}

		return { tagIds, projectIds, schedules, timeEstimates };
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

			const spTasks = await this.api.getTasks({
				includeDone: true,
				source: 'all',
			});

			await this.syncSpToObsidian(spTasks);
			await this.syncObsidianToSp(spTasks);
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

	private async syncSpToObsidian(spTasks: SPTask[]): Promise<void> {
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
			let updatedLine = lines[taskLine.lineNumber]!;
			updatedLine = markDone(updatedLine);

			if (this.settings.syncExtraFields) {
				const hasEstimateToken = taskLine.estimateRaw != null;
				const hasScheduleToken = taskLine.scheduleRaw != null;
				if (hasEstimateToken || hasScheduleToken) {
					const noteEstimate = parseEstimate(taskLine.estimateRaw);
					const noteSchedule = parseSchedule(taskLine.scheduleRaw);
					const spEstimate = spTask.timeEstimate ?? undefined;
					const spScheduleMs = spTask.dueWithTime ?? null;
					const noteScheduleMs = noteSchedule?.dueWithTime ?? null;

					const fields: {
						timeEstimate?: number | null;
						schedule?: number | null;
					} = {};
					if (hasEstimateToken && noteEstimate !== spEstimate) {
						fields.timeEstimate = spEstimate;
					}
					if (hasScheduleToken && noteScheduleMs !== spScheduleMs) {
						fields.schedule = spScheduleMs;
					}

					if (
						fields.timeEstimate !== undefined ||
						fields.schedule !== undefined
					) {
						updatedLine = applyExtraFieldsToLine(
							updatedLine,
							fields,
							formatEstimate,
							formatSchedule,
						);
					}
				}
			}

			lines[taskLine.lineNumber] = updatedLine;
			const ok = await this.modifyFileSafe(file, lines.join('\n'));
			if (ok) {
				this.settings.taskStateCache[spTask.id] = true;
			}
		}
	}

	private async syncObsidianToSp(spTasks: SPTask[]): Promise<void> {
		const spTaskById = new Map(spTasks.map((t) => [t.id, t]));
		const files = this.vault.getMarkdownFiles();
		for (const file of files) {
			const content = await this.readFileSafe(file);
			for (const task of extractAllTasks(content, file.path)) {
				if (!task.spId) continue;

				const spTask = spTaskById.get(task.spId);

				const cached = this.settings.taskStateCache[task.spId];
				if (cached === undefined) {
					this.settings.taskStateCache[task.spId] = task.isDone;
				} else if (cached !== task.isDone && spTask) {
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
					continue;
				}

			if (
				(!this.settings.syncExtraFields) ||
				!spTask
			)
				continue;

			const noteEstimate = parseEstimate(task.estimateRaw) ?? undefined;
			const noteSchedule = parseSchedule(task.scheduleRaw);
			const noteScheduleMs = noteSchedule?.dueWithTime ?? null;
			const spEstimate = spTask.timeEstimate ?? undefined;
			const spScheduleMs = spTask.dueWithTime ?? null;

			if (
				noteEstimate !== spEstimate ||
				noteScheduleMs !== spScheduleMs
			) {
				try {
					const patch: {
						timeEstimate?: number;
						dueWithTime?: number;
					} = { timeEstimate: noteEstimate };
					if (noteSchedule) {
						patch.dueWithTime = noteSchedule.dueWithTime;
					}
					new Notice(
						`[sp-sync] 更新 ${task.spId} | noteSched=${noteScheduleMs} spSched=${spScheduleMs}`,
					);
					await this.api.updateTask(task.spId, patch);
				} catch (e) {
					console.error(
						`Failed to update SP task ${task.spId}:`,
						e,
					);
				}
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
