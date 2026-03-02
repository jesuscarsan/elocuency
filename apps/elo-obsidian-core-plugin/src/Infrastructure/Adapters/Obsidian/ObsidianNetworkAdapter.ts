import { requestUrl } from 'obsidian';
import { NetworkPort } from '../../../Domain/Ports/NetworkPort';

export class ObsidianNetworkAdapter implements NetworkPort {
    async getText(url: string): Promise<string> {
        try {
            const response = await requestUrl(url);
            return response.text;
        } catch (error) {
            console.error(`Failed to fetch URL ${url}:`, error);
            return '';
        }
    }
}
