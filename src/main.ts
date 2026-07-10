import { Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	SuperProductivitySettings,
	SyncSettingTab,
} from './settings';
import { SuperProductivityApi } from './api/superProductivityApi';
import { TaskSyncService } from './sync/taskSyncService';

export default class SuperProductivitySyncPlugin extends Plugin {
	settings!: SuperProductivitySettings;
	api!: SuperProductivityApi;
	syncService!: TaskSyncService;
	private pollingId: number | null = null;

	async onload() {
		await this.loadSettings();
		this.initModules();
		this.registerCommands();
		this.addSettingTab(new SyncSettingTab(this.app, this));

		const ribbonIcon = this.addRibbonIcon(
			'list-checks',
			'Sync to Super Productivity',
			async () => {
				await this.syncService.pollOnce();
				new Notice('Sync completed');
			},
		);
		ribbonIcon.addClass('sp-sync-ribbon');

		const statusBarEl = this.addStatusBarItem();
		statusBarEl.setText('SP Sync: idle');
		statusBarEl.addClass('sp-sync-status');

		this.restartPolling();
	}

	onunload() {
		this.clearPolling();
	}

	initModules() {
		this.api = new SuperProductivityApi(this.settings.spApiUrl);
		this.syncService = new TaskSyncService(
			this.app,
			this.api,
			this.settings,
		);
	}

	recreateApi() {
		this.api = new SuperProductivityApi(this.settings.spApiUrl);
		this.syncService = new TaskSyncService(
			this.app,
			this.api,
			this.settings,
		);
	}

	restartPolling() {
		this.clearPolling();
		if (this.settings.enablePolling) {
			this.pollingId = window.setInterval(() => {
				void this.syncService.pollOnce();
			}, this.settings.pollingIntervalSeconds * 1000);
		}
	}

	private clearPolling() {
		if (this.pollingId !== null) {
			window.clearInterval(this.pollingId);
			this.pollingId = null;
		}
	}

	private registerCommands() {
		this.addCommand({
			id: 'send-current-task',
			name: 'Send current task to Super Productivity',
			editorCallback: (
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			) => {
				const file = ctx.file;
				if (!file) {
					new Notice('No file is active');
					return;
				}
				void this.syncService.pushCurrentLineTask(editor, file);
			},
		});

		this.addCommand({
			id: 'send-all-tasks',
			name: 'Send all tasks to Super Productivity',
			checkCallback: (checking: boolean) => {
				const file =
					this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					void this.syncService.pushAllTasks(file);
				}
				return true;
			},
		});

		this.addCommand({
			id: 'force-sync',
			name: 'Force sync now',
			callback: async () => {
				await this.syncService.pollOnce();
				new Notice('Force sync completed');
			},
		});

		this.addCommand({
			id: 'test-sp-connection',
			name: 'Test Super Productivity connection',
			callback: async () => {
				const ok = await this.api.healthCheck();
				if (ok) {
					new Notice(
						'SP connection successful!',
					);
				} else {
					new Notice(
						'SP connection failed. Is SP running with API enabled?',
					);
				}
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SuperProductivitySettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
