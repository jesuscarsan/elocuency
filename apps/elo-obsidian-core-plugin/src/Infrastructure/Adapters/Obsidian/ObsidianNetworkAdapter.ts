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

    async postJson<T = any>(url: string, body: any, headers: Record<string, string> = {}): Promise<T> {
        try {
            const response = await requestUrl({
                url,
                method: 'POST',
                body: JSON.stringify(body),
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            });
            // Obsidian requestUrl returns a json object directly if it parses it, or provides a .json property
            return response.json as T;
        } catch (error) {
            console.error(`Failed to post JSON to ${url}:`, error);
            throw error;
        }
    }
}
