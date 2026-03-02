import { requestUrl } from 'obsidian';
import { TranscriptionPort } from '@elo/core';
import { TranslationService } from '@elo/obsidian-plugin';

export class GeminiTranscriptionAdapter implements TranscriptionPort {
	private apiKey: string;
	private modelName = 'gemini-2.0-flash-exp';

	constructor(
		apiKey: string,
		private readonly translationService: TranslationService,
	) {
		this.apiKey = apiKey;
	}

	async transcribe(audioBlob: Blob): Promise<string> {
		if (!this.apiKey) {
			throw new Error('API Key is missing for GeminiTranscriptionAdapter');
		}

		const base64Data = await this.blobToBase64(audioBlob);
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

		try {
			const response = await requestUrl({
				url: url,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: this.translationService.t('transcription.prompt'),
								},
								{ inline_data: { mime_type: 'audio/webm', data: base64Data } },
							],
						},
					],
				}),
				throw: false,
			});

			if (response.status === 200) {
				const data = response.json;
				const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
				if (transcription) {
					return transcription;
				} else {
					throw new Error('No transcription found in Gemini response.');
				}
			} else {
				throw new Error(`Gemini API Error: ${response.status} - ${response.text}`);
			}
		} catch (error) {
			console.error('GeminiTranscriptionAdapter Error:', error);
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
					// Remove "data:audio/webm;base64," prefix
					resolve(result.split(',')[1]);
				} else {
					reject(new Error('Failed to convert Blob to Base64'));
				}
			};
			reader.onerror = (error) => reject(error);
		});
	}
}
