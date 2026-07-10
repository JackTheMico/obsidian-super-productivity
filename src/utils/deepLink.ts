import { App, TFile } from 'obsidian';

export function createDeepLink(app: App, file: TFile, line: number): string {
	const vaultName = app.vault.getName();
	const filePath = file.path;
	return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}&line=${line + 1}`;
}
