export interface SPTask {
	id: string;
	title: string;
	notes?: string;
	isDone: boolean;
	projectId?: string;
	tagIds?: string[];
	parentId?: string;
	subTaskIds?: string[];
	timeEstimate?: number;
	timeSpent?: number;
	created: string;
	modified: string;
}

export interface SPProject {
	id: string;
	title: string;
}

export interface CreateTaskParams {
	title: string;
	notes?: string;
	projectId?: string;
	tagIds?: string[];
	parentId?: string;
	timeEstimate?: number;
}

export interface UpdateTaskParams {
	title?: string;
	notes?: string;
	isDone?: boolean;
}

export interface ApiResponse<T> {
	ok: boolean;
	data?: T;
	error?: { code: string; message: string };
}
