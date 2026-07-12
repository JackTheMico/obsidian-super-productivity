import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import SuperProductivitySyncPlugin from './main';

export interface SuperProductivitySettings {
	spApiUrl: string;
	defaultProjectId: string;
	pollingIntervalSeconds: number;
	autoCreateDeepLink: boolean;
	enablePolling: boolean;
	enableSubtaskSync: boolean;
	syncTags: boolean;
	syncExtraFields: boolean;
	autoSyncOnIdle: boolean;
	autoSyncDebounceSeconds: number;
	taskStateCache: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: SuperProductivitySettings = {
	spApiUrl: 'http://127.0.0.1:3876',
	defaultProjectId: '',
	pollingIntervalSeconds: 30,
	autoCreateDeepLink: true,
	enablePolling: true,
	enableSubtaskSync: true,
	syncTags: true,
	syncExtraFields: true,
	autoSyncOnIdle: true,
	autoSyncDebounceSeconds: 3,
	taskStateCache: {},
};

export class SyncSettingTab extends PluginSettingTab {
	plugin: SuperProductivitySyncPlugin;

	constructor(app: App, plugin: SuperProductivitySyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Sp API URL')
			.setDesc('Super productivity rest API 地址（默认端口 3876）')
			.addText((text) =>
				text
					.setPlaceholder('http://127.0.0.1:3876')
					.setValue(this.plugin.settings.spApiUrl)
					.onChange(async (value) => {
						this.plugin.settings.spApiUrl = value;
						await this.plugin.saveSettings();
						this.plugin.recreateApi();
					}),
			);

		new Setting(containerEl)
			.setName('Default project ID')
			.setDesc('发送任务时的默认项目 ID（留空为收件箱）')
			.addText((text) =>
				text
					.setPlaceholder('INBOX_PROJECT')
					.setValue(this.plugin.settings.defaultProjectId)
					.onChange(async (value) => {
						this.plugin.settings.defaultProjectId = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Polling interval')
			.setDesc('状态同步轮询间隔（秒）')
			.addText((text) =>
				text
					.setPlaceholder('30')
					.setValue(String(this.plugin.settings.pollingIntervalSeconds))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (num > 0) {
							this.plugin.settings.pollingIntervalSeconds = num;
							await this.plugin.saveSettings();
							this.plugin.restartPolling();
						}
					}),
			);

		new Setting(containerEl)
			.setName('Enable polling')
			.setDesc('启动定时轮询，检测状态变更')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enablePolling)
					.onChange(async (value) => {
						this.plugin.settings.enablePolling = value;
						await this.plugin.saveSettings();
						this.plugin.restartPolling();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-create deep link')
			.setDesc('在 sp 任务备注中嵌入 Obsidian 链接，点击跳转到原笔记')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateDeepLink)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateDeepLink = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Subtask sync')
			.setDesc('将缩进层级映射为 sp 子任务（缩进 2 空格为一级子任务，更深层级拍平）')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSubtaskSync)
					.onChange(async (value) => {
						this.plugin.settings.enableSubtaskSync = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Sync tags')
			.setDesc('将任务行中的 [tags:: a, b] 或 @tag:a 同步为 sp 标签（需 sp 中已存在同名标签；输入 @ 可获取智能提示）')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncTags)
					.onChange(async (value) => {
						this.plugin.settings.syncTags = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Sync extra fields')
			.setDesc('将 @estimate:HH:MM / @estimate HH:MM（预估时长）、@schedule:日期 / @schedule 日期（计划日期）、@project:项目 / @project 项目、@tag:标签 / @tag 标签 与 @priority:标签 / @priority 标签 同步到 sp（输入 @ 可获取智能提示）')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncExtraFields)
					.onChange(async (value) => {
						this.plugin.settings.syncExtraFields = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-sync on idle')
			.setDesc('停止编辑当前文件后，自动将未同步的任务推送到 sp')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncOnIdle)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncOnIdle = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-sync debounce')
			.setDesc('停止编辑后等待多少秒再自动同步（防抖）')
			.addText((text) =>
				text
					.setPlaceholder('3')
					.setValue(String(this.plugin.settings.autoSyncDebounceSeconds))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (num > 0) {
							this.plugin.settings.autoSyncDebounceSeconds = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('测试与 super productivity 的 API 连接')
			.addButton((btn) =>
				btn
					.setButtonText('Test connection')
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('Testing...');
						const ok = await this.plugin.api?.healthCheck();
						btn.setDisabled(false);
						btn.setButtonText('Test connection');
						if (ok) {
							new Notice('Connection successful!');
						} else {
							new Notice('Connection failed. Is sp running?');
						}
					}),
			);

		new Setting(containerEl)
			.setName('Force sync')
			.setDesc('立即执行一次完整同步')
			.addButton((btn) =>
				btn
					.setButtonText('Sync now')
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('Syncing...');
						await this.plugin.syncService?.pollOnce();
						btn.setDisabled(false);
						btn.setButtonText('Sync now');
						new Notice('Sync completed');
					}),
			);
	}
}
