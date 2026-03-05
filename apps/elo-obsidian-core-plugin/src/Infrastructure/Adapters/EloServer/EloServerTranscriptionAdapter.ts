import { requestUrl } from 'obsidian';
import { TranscriptionPort } from '@elo/core';
import { TranslationService } from '@elo/obsidian-plugin';

export class EloServerTranscriptionAdapter implements TranscriptionPort {
    constructor(
        private baseUrl: string,
        private authToken: string,
        private readonly translationService: TranslationService,
    ) {
        this.updateConfig(baseUrl, authToken);
    }

    public updateConfig(baseUrl: string, authToken: string) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.authToken = authToken;
    }

    async transcribe(audioBlob: Blob): Promise<string> {
        const base64Data = await this.blobToBase64(audioBlob);
        const url = `${this.baseUrl.replace(/\/$/, '')}/api/ai/transcribe`;

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify({
                    audio_base64: base64Data,
                    mime_type: 'audio/webm',
                    prompt: this.translationService.t('transcription.prompt'),
                }),
                throw: false,
            });

            if (response.status === 200) {
                const data = response.json;
                return data.transcription;
            } else {
                throw new Error(`Elo Server Transcription Error: ${response.status} - ${response.text}`);
            }
        } catch (error) {
            console.error('EloServerTranscriptionAdapter Error:', error);
            throw error;
        }
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result as string;
                if (result) {
                    resolve(result.split(',')[1]);
                } else {
                    reject(new Error('Failed to convert Blob to Base64'));
                }
            };
            reader.onerror = (error) => reject(error);
        });
    }
}
