import { HeaderDataPort, HeaderProgress, HeaderData } from "@elo/core";

export class HeaderDataService {
    constructor(private readonly repository: HeaderDataPort) { }

    async getHeaderData(filePath: string): Promise<HeaderData> {
        return this.repository.getHeaderData(filePath);
    }

    async getHeaderProgress(filePath: string): Promise<HeaderProgress> {
        return this.repository.getHeaderProgress(filePath);
    }

    findMissingHeaders(progress: HeaderProgress, currentHeaders: string[]): string[] {
        const normalizedHeaders = new Set(currentHeaders.map(h => h.trim()));
        const jsonKeys = Object.keys(progress);

        return jsonKeys.filter(key => !normalizedHeaders.has(key));
    }
}
