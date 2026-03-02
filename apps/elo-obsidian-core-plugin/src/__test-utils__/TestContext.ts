import { App, TFile, TFolder } from '../__mocks__/obsidian';

export class TestContext {
    app: App;

    constructor() {
        this.app = new App();
    }

    async createFile(path: string, content: string): Promise<TFile> {
        return (await this.app.vault.create(path, content)) as TFile;
    }

    async createFolder(path: string): Promise<TFolder> {
        return (await this.app.vault.createFolder(path)) as TFolder;
    }

    async getFile(path: string): Promise<TFile | null> {
        return this.app.vault.getAbstractFileByPath(path) as TFile | null;
    }
}
