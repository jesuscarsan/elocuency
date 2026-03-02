import { App } from "obsidian";
import { HeaderData, HeaderDataPort, HeaderProgress } from "@elo/core";

export class ObsidianHeaderDataRepository implements HeaderDataPort {
    constructor(private app: App) { }

    async getHeaderData(filePath: string): Promise<HeaderData> {
        const jsonPath = this.getJsonPath(filePath);
        if (await this.exists(jsonPath)) {
            try {
                const content = await this.app.vault.adapter.read(jsonPath);
                return JSON.parse(content);
            } catch (e) {
                console.warn(`[HeaderDataRepository] Failed to parse JSON at ${jsonPath}`, e);
            }
        }
        return {};
    }

    async getHeaderProgress(filePath: string): Promise<HeaderProgress> {
        const jsonPath = this.getJsonPath(filePath);
        if (await this.exists(jsonPath)) {
            try {
                const content = await this.app.vault.adapter.read(jsonPath);
                const data = JSON.parse(content);
                if (data && data.progress && typeof data.progress === 'object') {
                    return data.progress;
                }
            } catch (e) {
                console.warn(`[HeaderDataRepository] Failed to read progress from ${jsonPath}`, e);
            }
        }
        return {};
    }

    async exists(filePath: string): Promise<boolean> {
        return this.app.vault.adapter.exists(filePath);
    }

    private getJsonPath(sourcePath: string): string {
        return sourcePath.replace(/\.md$/, '.json');
    }
}
