import { requestUrl } from 'obsidian';
import type { SPTask, SPProject, SPTag, CreateTaskParams, UpdateTaskParams } from './types';

interface ApiResponse<T> {
	ok: boolean;
	data?: T;
	error?: { code: string; message: string };
}

export class SuperProductivityApi {
	constructor(private baseUrl: string) {}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const resp = await requestUrl({
			url: `${this.baseUrl}${path}`,
			method,
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		});
		const json = resp.json as ApiResponse<T>;
		if (!json.ok) {
			throw new Error(json.error?.message ?? 'Unknown API error');
		}
		return json.data as T;
	}

	async healthCheck(): Promise<boolean> {
		try {
			await this.request<unknown>('GET', '/health');
			return true;
		} catch {
			return false;
		}
	}

	async createTask(params: CreateTaskParams): Promise<SPTask> {
		return this.request<SPTask>('POST', '/tasks', params);
	}

	async updateTask(id: string, params: UpdateTaskParams): Promise<SPTask> {
		return this.request<SPTask>('PATCH', `/tasks/${id}`, params);
	}

	async getTask(id: string): Promise<SPTask> {
		return this.request<SPTask>('GET', `/tasks/${id}`);
	}

	async getTasks(params?: { includeDone?: boolean; projectId?: string; source?: string }): Promise<SPTask[]> {
		const query = new URLSearchParams();
		if (params?.includeDone) query.set('includeDone', 'true');
		if (params?.projectId) query.set('projectId', params.projectId);
		if (params?.source) query.set('source', params.source);
		const qs = query.toString();
		return this.request<SPTask[]>('GET', `/tasks${qs ? '?' + qs : ''}`);
	}

	async getProjects(): Promise<SPProject[]> {
		return this.request<SPProject[]>('GET', '/projects');
	}

	async getTags(): Promise<SPTag[]> {
		return this.request<SPTag[]>('GET', '/tags');
	}
}
