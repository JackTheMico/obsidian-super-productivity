export const DEFAULT_API_URL = 'http://127.0.0.1:3876';
export const DEFAULT_POLLING_INTERVAL = 30;
export const SP_ID_REGEX = /\[sp_id::\s*([^\]]+)\]\s*$/;
export const CHECKBOX_DONE_REGEX = /^- \[x\]/i;
export const CHECKBOX_UNDONE_REGEX = /^- \[ \]/;
export const CHECKBOX_REGEX = /^- \[[x ]\] /i;
export const TAGS_REGEX = /\[tags::\s*([^\]]+)\]/i;
export const DUE_REGEX = /\[due::\s*([^\]]+)\]/i;
export const PROJECT_REGEX = /\[project::\s*([^\]]+)\]/i;

export const AT_DUE_REGEX = /@due:([^\s]+)/i;
export const AT_TAGS_REGEX = /@tag:([^\s]+)/gi;
export const AT_PROJECT_REGEX = /@project:([^\s]+)/i;
export const AT_SYNTAX_REGEX = /@(?:due|tag|project):[^\s]+/gi;
