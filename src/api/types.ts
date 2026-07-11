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
	plannedAt?: number | null;
	created: string;
	modified: string;
}

export interface SPProject {
	id: string;
	title: string;
}

export interface SPTag {
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
	plannedAt?: number | null;
	dueDay?: string;
	dueWithTime?: number;
}

export interface UpdateTaskParams {
	title?: string;
	notes?: string;
	isDone?: boolean;
	projectId?: string;
	tagIds?: string[];
	timeEstimate?: number;
	plannedAt?: number | null;
	dueDay?: string;
	dueWithTime?: number;
}
