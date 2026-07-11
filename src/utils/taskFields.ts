import type { SuperProductivityApi } from '../api/superProductivityApi';

export interface ParsedDue {
	dueDay?: string;
	dueWithTime?: number;
}

export interface ParsedExtraFields {
	timeEstimate?: number;
	plannedAt?: number | null;
}

const WEEKDAY_MAP: Record<string, number> = {
	周日: 0,
	星期日: 0,
	sunday: 0,
	sun: 0,
	周一: 1,
	星期一: 1,
	monday: 1,
	mon: 1,
	周二: 2,
	星期二: 2,
	tuesday: 2,
	tue: 2,
	周三: 3,
	星期三: 3,
	wednesday: 3,
	wed: 3,
	周四: 4,
	星期四: 4,
	thursday: 4,
	thu: 4,
	周五: 5,
	星期五: 5,
	friday: 5,
	fri: 5,
	周六: 6,
	星期六: 6,
	saturday: 6,
	sat: 6,
};

function toIsoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function resolveRelativeDate(keyword: string, now: Date): Date | null {
	const lower = keyword.toLowerCase();
	if (lower === 'today' || lower === '今天') {
		return new Date(now.getFullYear(), now.getMonth(), now.getDate());
	}
	if (lower === 'tomorrow' || lower === '明天') {
		return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	}
	if (lower in WEEKDAY_MAP) {
		const target = WEEKDAY_MAP[lower]!;
		const diff = (target - now.getDay() + 7) % 7;
		const days = diff === 0 ? 7 : diff;
		return new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + days,
		);
	}
	return null;
}

export function parseDue(raw: string | null): ParsedDue | null {
	if (!raw) return null;
	const now = new Date();
	const trimmed = raw.trim();

	const relative = resolveRelativeDate(trimmed, now);
	if (relative) {
		return { dueDay: toIsoDate(relative) };
	}

	const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
	if (isoDateMatch) {
		return { dueDay: isoDateMatch[1]! };
	}

	const dateTimeMatch = trimmed.match(
		/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/,
	);
	if (dateTimeMatch) {
		const datePart = dateTimeMatch[1]!;
		const hour = dateTimeMatch[2]!.padStart(2, '0');
		const minute = dateTimeMatch[3]!;
		const ms = Date.parse(`${datePart}T${hour}:${minute}:00`);
		if (!isNaN(ms)) {
			return { dueWithTime: ms };
		}
	}

	return null;
}

export function parseEstimate(raw: string | null): number | null {
	if (!raw) return null;
	const match = raw.trim().match(/^(\d{1,3}):(\d{2})$/);
	if (!match) return null;
	const hours = parseInt(match[1]!, 10);
	const minutes = parseInt(match[2]!, 10);
	if (minutes >= 60) return null;
	return (hours * 60 + minutes) * 60 * 1000;
}

export function formatEstimate(ms: number | null | undefined): string | null {
	if (!ms || ms <= 0) return null;
	const totalMinutes = Math.round(ms / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseSchedule(raw: string | null): number | null {
	if (!raw) return null;
	const m = raw.trim().match(
		/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?$/,
	);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const h = m[4] ? Number(m[4]) : 0;
	const mi = m[5] ? Number(m[5]) : 0;
	if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
		return null;
	}
	const ms = new Date(y, mo - 1, d, h, mi).getTime();
	return isNaN(ms) ? null : ms;
}

export function formatSchedule(ms: number | null | undefined): string | null {
	if (!ms) return null;
	const dt = new Date(ms);
	if (isNaN(dt.getTime())) return null;
	const y = dt.getFullYear();
	const mo = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	const hh = String(dt.getHours()).padStart(2, '0');
	const mi = String(dt.getMinutes()).padStart(2, '0');
	return hh === '00' && mi === '00'
		? `${y}-${mo}-${d}`
		: `${y}-${mo}-${d}T${hh}:${mi}`;
}

export interface ResolveResult {
	ids: string[];
	missing: string[];
}

export async function resolveTagIds(
	api: SuperProductivityApi,
	tagNames: string[],
): Promise<ResolveResult> {
	if (tagNames.length === 0) return { ids: [], missing: [] };
	const tags = await api.getTags();
	const byTitle = new Map<string, string>();
	for (const t of tags) {
		byTitle.set(t.title.trim().toLowerCase(), t.id);
	}
	const ids: string[] = [];
	const missing: string[] = [];
	for (const name of tagNames) {
		const id = byTitle.get(name.trim().toLowerCase());
		if (id) {
			ids.push(id);
		} else {
			missing.push(name);
		}
	}
	return { ids, missing };
}

export async function resolveProjectId(
	api: SuperProductivityApi,
	projectName: string | null,
	defaultProjectId: string,
): Promise<{ id: string; resolved: boolean }> {
	if (!projectName) {
		return { id: defaultProjectId, resolved: false };
	}
	const projects = await api.getProjects();
	const target = projectName.trim().toLowerCase();
	for (const p of projects) {
		if (p.title.trim().toLowerCase() === target) {
			return { id: p.id, resolved: true };
		}
	}
	return { id: defaultProjectId, resolved: false };
}
