import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import SuperProductivitySyncPlugin from './main';

export interface SuperProductivitySettings {
	spApiUrl: string;
	defaultProjectId: string;
	pollingIntervalSeconds: number;
	autoCreateDeepLink: boolean;
	enablePolling: boolean;
	enableSubtaskSync: boolean;
	taskStateCache: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: SuperProductivitySettings = {
	spApiUrl: 'http://127.0.0.1:3876',
	defaultProjectId: '',
	pollingIntervalSeconds: 30,
	autoCreateDeepLink: true,
	enablePolling: true,
	enableSubtaskSync: true,
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
			.setName('SP API URL')
			.setDesc('Super Productivity REST API 地址（默认端口 3876）')
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
			.setName('Default Project ID')
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
			.setName('Polling Interval')
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
			.setName('Enable Polling')
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
			.setName('Auto-create Deep Link')
			.setDesc('在 SP 任务备注中嵌入 Obsidian 链接，点击跳转到原笔记')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateDeepLink)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateDeepLink = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Subtask Sync')
			.setDesc('将缩进层级映射为 SP 子任务（缩进 2 空格为一级子任务，更深层级拍平）')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSubtaskSync)
					.onChange(async (value) => {
						this.plugin.settings.enableSubtaskSync = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('测试与 Super Productivity 的 API 连接')
			.addButton((btn) =>
				btn
					.setButtonText('Test Connection')
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('Testing...');
						const ok = await this.plugin.api?.healthCheck();
						btn.setDisabled(false);
						btn.setButtonText('Test Connection');
						if (ok) {
							new Notice('Connection successful!');
						} else {
							new Notice('Connection failed. Is SP running?');
						}
					}),
			);

		new Setting(containerEl)
			.setName('Force Sync')
			.setDesc('立即执行一次完整同步')
			.addButton((btn) =>
				btn
					.setButtonText('Sync Now')
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('Syncing...');
						await this.plugin.syncService?.pollOnce();
						btn.setDisabled(false);
						btn.setButtonText('Sync Now');
						new Notice('Sync completed');
					}),
			);
	}
}
