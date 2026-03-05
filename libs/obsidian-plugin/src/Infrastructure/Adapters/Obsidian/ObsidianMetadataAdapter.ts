import { App, TFile, HeadingCache } from "obsidian";
import { HeaderMetadataRegistry, HeaderMetadataKey, HeaderMetadata } from "../../../../../core-typescript/dist";
import { MetadataPort } from '../../../../../core-typescript/dist';

export class ObsidianMetadataAdapter implements MetadataPort {
    constructor(private app: App) { }

    public async updateBlockMetadata(fileOrPath: TFile | string, blockId: string, metadata: HeaderMetadata): Promise<void> {
        let file: TFile | null = null;
        if (typeof fileOrPath === 'string') {
            const abstractFile = this.app.vault.getAbstractFileByPath(fileOrPath);
            if (abstractFile instanceof TFile) file = abstractFile;
        } else {
            file = fileOrPath;
        }

        if (!file) return;

        const jsonPath = file.path.replace(/\.md$/, '.json');
        let currentData: Record<string, Record<string, any>> = {};

        if (await this.app.vault.adapter.exists(jsonPath)) {
            try {
                const content = await this.app.vault.adapter.read(jsonPath);
                currentData = JSON.parse(content);
            } catch (e) {
                console.warn(`[ObsidianMetadataAdapter] Failed to parse existing JSON at ${jsonPath}`, e);
            }
        }

        if (!currentData[blockId]) {
            currentData[blockId] = {};
        }

        currentData[blockId] = {
            ...currentData[blockId],
            ...metadata
        };

        await this.app.vault.adapter.write(jsonPath, JSON.stringify(currentData, null, 2));
    }

    public async getFileMetadata(fileOrPath: TFile | string): Promise<Record<string, Record<string, any>>> {
        const path = (typeof fileOrPath === 'string') ? fileOrPath : fileOrPath.path;
        const jsonPath = path.replace(/\.md$/, '.json');

        if (await this.app.vault.adapter.exists(jsonPath)) {
            try {
                const content = await this.app.vault.adapter.read(jsonPath);
                const parsed = JSON.parse(content);
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed;
                }
            } catch (e) {
                console.warn(`[ObsidianMetadataAdapter] Failed to parse JSON at ${jsonPath}`, e);
            }
        }
        return {};
    }

    /**
     * Ensures a block ID exists for the given header.
     * Returns the block ID (existing or newly generated).
     */
    public ensureBlockId(header: HeadingCache): string {
        const blockIdMatch = header.heading.match(/\^([a-zA-Z0-9-]+)$/);
        if (blockIdMatch) {
            return blockIdMatch[1];
        }
        return this.generateShortId();
    }

    private generateShortId(): string {
        return Math.random().toString(36).substring(2, 8);
    }

    /**
     * Syncs metadata for all block IDs in the file to the sidecar JSON.
     */
    public async syncMetadata(file: TFile, blockIds: string[]): Promise<void> {
        const jsonPath = file.path.replace(/\.md$/, '.json');
        let currentData: Record<string, Record<string, any>> = {};

        // 1. Read existing JSON if valid
        if (await this.app.vault.adapter.exists(jsonPath)) {
            try {
                const content = await this.app.vault.adapter.read(jsonPath);
                const parsed = JSON.parse(content);
                if (typeof parsed === 'object' && parsed !== null) {
                    currentData = parsed;
                }
            } catch (e) {
                console.warn(`[ObsidianMetadataAdapter] Failed to parse existing JSON at ${jsonPath}`, e);
                currentData = {};
            }
        }

        // 2. Update data
        let hasChanges = false;
        const defaultMetadata: Record<string, any> = {};
        Object.values(HeaderMetadataRegistry).forEach(field => {
            defaultMetadata[field.key] = field.defaultValue;
        });

        for (const id of blockIds) {
            if (!currentData[id]) {
                currentData[id] = { ...defaultMetadata };
                hasChanges = true;
            } else {
                let entryChanged = false;
                Object.keys(defaultMetadata).forEach(key => {
                    if (currentData[id][key] === undefined) {
                        currentData[id][key] = defaultMetadata[key];
                        entryChanged = true;
                    }
                });
                if (entryChanged) hasChanges = true;
            }
        }

        // 3. Write if changed
        if (hasChanges) {
            await this.app.vault.adapter.write(jsonPath, JSON.stringify(currentData, null, 2));
        }
    }

    public async handleRename(file: TFile, oldPath: string): Promise<void> {
        if (file.extension !== 'md') return;

        const oldJsonPath = oldPath.replace(/\.md$/, '.json');
        const newJsonPath = file.path.replace(/\.md$/, '.json');

        if (await this.app.vault.adapter.exists(oldJsonPath)) {
            try {
                await this.app.vault.adapter.rename(oldJsonPath, newJsonPath);
            } catch (e) {
                console.warn(`[ObsidianMetadataAdapter] Failed to rename sidecar JSON from ${oldJsonPath} to ${newJsonPath}`, e);
            }
        }
    }
}
