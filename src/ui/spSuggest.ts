import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';
import type SuperProductivitySyncPlugin from '../main';
import type { SPTag, SPProject } from '../api/types';

interface SPSuggestion {
	text: string;
	displayText: string;
	description?: string;
}

type SuggestMode = 'type' | 'due' | 'tag' | 'project' | 'estimate' | 'schedule' | 'priority';

export class SPSuggest extends EditorSuggest<SPSuggestion> {
	private plugin: SuperProductivitySyncPlugin;
	private mode: SuggestMode = 'type';
	private query = '';
	private tagsCache: { data: SPTag[]; timestamp: number } | null = null;
	private projectsCache: { data: SPProject[]; timestamp: number } | null = null;
	private static readonly CACHE_TTL = 300000;

	constructor(plugin: SuperProductivitySyncPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		if (!/^- \[[x ]\] /i.test(line)) return null;

		const lineUpToCursor = line.substring(0, cursor.ch);
		const atIndex = lineUpToCursor.lastIndexOf('@');
		if (atIndex === -1) return null;

		const afterAt = lineUpToCursor.substring(atIndex + 1);
		this.mode = 'type';
		this.query = afterAt;

		const typeMatch = afterAt.match(
			/^(due|tag|project|estimate|schedule|priority):(.*)$/,
		);
		if (typeMatch) {
			this.mode = (typeMatch[1] ?? 'type') as SuggestMode;
			this.query = typeMatch[2] ?? '';
		}

		return {
			start: { line: cursor.line, ch: atIndex },
			end: cursor,
			query: afterAt,
		};
	}

	async getSuggestions(
		context: EditorSuggestContext,
	): Promise<SPSuggestion[]> {
		switch (this.mode) {
			case 'type':
				return this.getTypeSuggestions();
			case 'due':
				return this.getDueSuggestions();
			case 'tag':
				return await this.getTagSuggestions();
			case 'project':
				return await this.getProjectSuggestions();
			case 'estimate':
				return this.getEstimateSuggestions();
			case 'schedule':
				return this.getScheduleSuggestions();
			case 'priority':
				return await this.getTagSuggestions();
			default:
				return [];
		}
	}

	private getTypeSuggestions(): SPSuggestion[] {
		const items: SPSuggestion[] = [
			{ text: 'due:', displayText: 'due', description: '截止日期' },
			{ text: 'tag:', displayText: 'tag', description: 'SP 标签' },
			{ text: 'project:', displayText: 'project', description: 'SP 项目' },
			{ text: 'estimate:', displayText: 'estimate', description: '预估时长 HH:MM' },
			{ text: 'schedule:', displayText: 'schedule', description: '计划日期 YYYY-MM-DD' },
			{ text: 'priority:', displayText: 'priority', description: 'SP 标签（作为优先级）' },
		];
		const q = this.query.toLowerCase();
		return q ? items.filter((i) => i.text.toLowerCase().includes(q)) : items;
	}

	private getEstimateSuggestions(): SPSuggestion[] {
		const items: SPSuggestion[] = [
			{
				text: 'estimate:00:30',
				displayText: '00:30',
				description: '30 分钟',
			},
			{
				text: 'estimate:01:00',
				displayText: '01:00',
				description: '1 小时',
			},
			{
				text: 'estimate:02:30',
				displayText: '02:30',
				description: '2 小时 30 分钟',
			},
		];
		const q = this.query.toLowerCase();
		return q
			? items.filter(
					(i) =>
						i.displayText.toLowerCase().includes(q) ||
						i.text.toLowerCase().includes(q),
				)
			: items;
	}

	private getScheduleSuggestions(): SPSuggestion[] {
		const now = new Date();
		const toIso = (d: Date) => d.toISOString().slice(0, 10);
		const items: SPSuggestion[] = [
			{
				text: `schedule:${toIso(now)}`,
				displayText: 'today',
				description: toIso(now),
			},
			{
				text: `schedule:${toIso(
					new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
				)}`,
				displayText: 'tomorrow',
				description: toIso(
					new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
				),
			},
		];
		const q = this.query.toLowerCase();
		return q
			? items.filter(
					(i) =>
						i.displayText.toLowerCase().includes(q) ||
						(i.description &&
							i.description.toLowerCase().includes(q)),
				)
			: items;
	}

	private getDueSuggestions(): SPSuggestion[] {
		const now = new Date();
		const dayNames = [
			'sunday',
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
		];
		const toIso = (d: Date) => d.toISOString().slice(0, 10);

		const items: SPSuggestion[] = [
			{
				text: 'due:today',
				displayText: 'today',
				description: toIso(now),
			},
			{
				text: 'due:tomorrow',
				displayText: 'tomorrow',
				description: toIso(
					new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
				),
			},
		];

		for (let i = 1; i <= 7; i++) {
			const d = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() + i,
			);
			const dayName = dayNames[d.getDay()] ?? '';
			const label =
				i === 1 ? 'next ' + dayName : dayName;
			items.push({
				text: `due:${toIso(d)}`,
				displayText: label,
				description: toIso(d),
			});
		}

		const q = this.query.toLowerCase();
		return q
			? items.filter(
					(i) =>
						i.displayText.toLowerCase().includes(q) ||
						(i.description && i.description.toLowerCase().includes(q)),
				)
			: items;
	}

	private async getTagSuggestions(): Promise<SPSuggestion[]> {
		const tags = await this.getCachedTags();
		const items: SPSuggestion[] = tags.map((t) => {
			const safe = t.title.includes(' ') ? `"${t.title}"` : t.title;
			return {
				text: `tag:${safe}`,
				displayText: t.title,
				description: 'SP 标签',
			};
		});
		const q = this.query.toLowerCase();
		return q
			? items.filter((i) => i.displayText.toLowerCase().includes(q))
			: items;
	}

	private async getProjectSuggestions(): Promise<SPSuggestion[]> {
		const projects = await this.getCachedProjects();
		const items: SPSuggestion[] = projects.map((p) => {
			const safe = p.title.includes(' ') ? `"${p.title}"` : p.title;
			return {
				text: `project:${safe}`,
				displayText: p.title,
				description: 'SP 项目',
			};
		});
		const q = this.query.toLowerCase();
		return q
			? items.filter((i) => i.displayText.toLowerCase().includes(q))
			: items;
	}

	private async getCachedTags(): Promise<SPTag[]> {
		const now = Date.now();
		if (
			this.tagsCache &&
			now - this.tagsCache.timestamp < SPSuggest.CACHE_TTL
		) {
			return this.tagsCache.data;
		}
		const data = await this.plugin.api.getTags();
		this.tagsCache = { data, timestamp: now };
		return data;
	}

	private async getCachedProjects(): Promise<SPProject[]> {
		const now = Date.now();
		if (
			this.projectsCache &&
			now - this.projectsCache.timestamp < SPSuggest.CACHE_TTL
		) {
			return this.projectsCache.data;
		}
		const data = await this.plugin.api.getProjects();
		this.projectsCache = { data, timestamp: now };
		return data;
	}

	renderSuggestion(suggestion: SPSuggestion, el: HTMLElement): void {
		el.createDiv({ text: suggestion.displayText });
		if (suggestion.description) {
			el.createDiv({
				text: suggestion.description,
				cls: 'sp-suggest-desc',
			});
		}
	}

	selectSuggestion(
		suggestion: SPSuggestion,
		evt: MouseEvent | KeyboardEvent,
	): void {
		if (!this.context) return;
		const { editor, start, end } = this.context;
		editor.replaceRange(`@${suggestion.text}`, start, end);
		editor.setCursor({
			line: start.line,
			ch: start.ch + suggestion.text.length + 1,
		});
	}
}
