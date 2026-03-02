import { requestUrl } from 'obsidian';
import { ImageSearchPort } from '@elo/core';

export class EloServerImageSearchAdapter implements ImageSearchPort {
    constructor(
        private readonly baseUrl: string,
        private readonly authToken: string,
    ) { }

    async searchImages(query: string, count: number = 10): Promise<string[]> {
        const url = `${this.baseUrl.replace(/\/$/, '')}/api/ai/image-search`;

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify({
                    query: query,
                    count: count,
                }),
                throw: false,
            });

            if (response.status === 200) {
                const data = response.json;
                return data.images || [];
            } else {
                console.error(`Elo Server Image Search Error: ${response.status} - ${response.text}`);
                return [];
            }
        } catch (error) {
            console.error('EloServerImageSearchAdapter Error:', error);
            return [];
        }
    }
}
