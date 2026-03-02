export class App {
	vault: Vault;
	workspace: Workspace;
	metadataCache: MetadataCache;
	fileManager: FileManager;
	lastEvent: any = null;
	keymap: any = null;
	scope: any = null;
	commands: any;

	constructor() {
		this.vault = new Vault();
		this.workspace = new Workspace();
		this.metadataCache = new MetadataCache();
		this.fileManager = new FileManager();
		this.commands = {
			findCommand: jest.fn(),
			executeCommandById: jest.fn(),
			listCommands: jest.fn().mockReturnValue([]),
		};
	}
}

export class Vault {
	files: Map<string, TFile | TFolder> = new Map();

	create(path: string, data: string): Promise<TFile> {
		const file = new TFile(path, data);
		this.files.set(path, file);

		// Assign parent
		const parentPath = path.split('/').slice(0, -1).join('/');
		if (parentPath) {
			const parent = this.files.get(parentPath);
			if (parent instanceof TFolder) {
				file.parent = parent;
				parent.children.push(file);
			}
		}

		return Promise.resolve(file);
	}

	createFolder(path: string): Promise<TFolder> {
		const folder = new TFolder(path);
		this.files.set(path, folder);

		// Assign parent
		const parentPath = path.split('/').slice(0, -1).join('/');
		if (parentPath) {
			const parent = this.files.get(parentPath);
			if (parent instanceof TFolder) {
				folder.parent = parent;
				parent.children.push(folder);
			}
		}

		return Promise.resolve(folder);
	}

	read(file: TFile): Promise<string> {
		return Promise.resolve(file.content);
	}

	modify(file: TFile, data: string): Promise<void> {
		file.content = data;
		return Promise.resolve();
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.files.get(path) || null;
	}

	getMarkdownFiles(): TFile[] {
		return Array.from(this.files.values()).filter(
			(f) => f instanceof TFile && f.extension === 'md',
		) as TFile[];
	}

	delete(file: TAbstractFile): Promise<void> {
		this.files.delete(file.path);
		return Promise.resolve();
	}

	rename(file: TAbstractFile, newPath: string): Promise<void> {
		this.files.delete(file.path);
		file.path = newPath;
		file.name = newPath.split('/').pop() || '';
		this.files.set(newPath, file as TFile | TFolder);
		return Promise.resolve();
	}
}

export class Workspace {
	activeLeaf: WorkspaceLeaf | null = null;

	getActiveFile(): TFile | null {
		return this.activeLeaf?.view?.file || null;
	}

	getActiveViewOfType<T extends View>(type: new (...args: any[]) => T): T | null {
		if (this.activeLeaf?.view && this.activeLeaf.view instanceof type) {
			return this.activeLeaf.view as T;
		}
		return null;
	}

	getLeaf(createIfNeeded?: boolean): WorkspaceLeaf {
		if (!this.activeLeaf && createIfNeeded) {
			this.activeLeaf = new WorkspaceLeaf();
		}
		return this.activeLeaf!;
	}
}

export class WorkspaceLeaf {
	view: View | null = null;

	openFile(file: TFile): Promise<void> {
		if (!this.view) {
			this.view = new MarkdownView(file);
		} else {
			(this.view as MarkdownView).file = file;
		}
		return Promise.resolve();
	}
}

export class View {
	file: TFile | null = null;
}

export class MarkdownView extends View {
	editor: Editor;
	currentMode: string = 'preview'; // default to preview

	constructor(file: TFile) {
		super();
		this.file = file;
		this.editor = new Editor(file);
	}

	getViewType(): string {
		return 'markdown';
	}

	getMode(): string {
		return this.currentMode;
	}

	getState(): any {
		return { mode: this.currentMode };
	}

	setState(state: any, result: any): Promise<void> {
		if (state.mode) {
			this.currentMode = state.mode;
		}
		return Promise.resolve();
	}
}

export class Editor {
	file: TFile;
	constructor(file: TFile) {
		this.file = file;
	}

	getSelection(): string {
		return '';
	}

	replaceSelection(text: string): void {
		// mock implementation
	}

	getValue(): string {
		return this.file.content;
	}

	setValue(content: string): void {
		this.file.content = content;
	}
}

export abstract class TAbstractFile {
	path: string;
	name: string;
	parent: TFolder | null = null;
	vault: Vault;

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
		this.vault = new Vault(); // Setup a dummy vault reference or mock needs to inject it?
		// ideally it should reference the main vault but for type check any Vault is fine.
	}
}

export class TFile extends TAbstractFile {
	stat: FileStats;
	basename: string;
	extension: string;
	content: string;

	constructor(path: string, content: string = '') {
		super(path);
		this.content = content;
		this.basename = this.name.split('.').slice(0, -1).join('.');
		this.extension = this.name.split('.').pop() || '';
		this.stat = { ctime: Date.now(), mtime: Date.now(), size: content.length };
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	constructor(path: string) {
		super(path);
	}
}

export interface FileStats {
	ctime: number;
	mtime: number;
	size: number;
}

export class MetadataCache {
	getFileCache(file: TFile): any {
		return {};
	}
}

export class FileManager {
	processFrontMatter(file: TFile, fn: (frontmatter: any) => void): Promise<void> {
		// Very basic frontmatter parser mock for now.
		// Real implementation usually parses YAML.
		// We will assume content starts with --- and ends with ---

		let content = file.content;
		let frontmatter = {};
		const match = content.match(/^---\n([\s\S]*?)\n---/);

		if (match) {
			const yaml = match[1];
			// parsing yaml very simply
			yaml.split('\n').forEach((line) => {
				const [key, ...values] = line.split(':');
				if (key && values) {
					let val = values.join(':').trim();
					if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
					if (val.startsWith('[') && val.endsWith(']')) {
						// array
						(frontmatter as any)[key.trim()] = val
							.slice(1, -1)
							.split(',')
							.map((s) => s.trim().replace(/^"|"$/g, ''));
					} else {
						(frontmatter as any)[key.trim()] = val;
					}
				}
			});
		}

		fn(frontmatter);

		// Reconstruct content
		let newYaml = '---\n';
		for (const [key, value] of Object.entries(frontmatter)) {
			if (Array.isArray(value)) {
				const arrStr = (value as any[]).map((v) => `"${v}"`).join(', ');
				newYaml += `${key}: [${arrStr}]\n`;
			} else {
				newYaml += `${key}: ${value}\n`;
			}
		}
		newYaml += '---';

		if (match) {
			file.content = content.replace(/^---\n[\s\S]*?\n---/, newYaml);
		} else {
			file.content = newYaml + '\n' + content;
		}

		return Promise.resolve();
	}
}

export class Notice {
	constructor(message: string, timeout?: number) {
		// console.log('Notice:', message);
	}
}

export class Modal {
	app: App;
	constructor(app: App) {
		this.app = app;
	}
	open(): void {}
	close(): void {}
}

export class FuzzySuggestModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	setPlaceholder(placeholder: string): void {}
	selectSuggestion(value: any, evt: MouseEvent | KeyboardEvent): void {}
	onChooseItem(item: any, evt: MouseEvent | KeyboardEvent): void {}
}

import * as yaml from 'js-yaml';

export const requestUrl = jest.fn();

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function parseYaml(text: string): any {
	return yaml.load(text);
}

export function stringifyYaml(obj: any): string {
	return yaml.dump(obj);
}
