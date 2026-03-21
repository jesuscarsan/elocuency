import { LlmPort, LlmParams, LlmResponse } from "../Domain/Ports/LlmPort";

export class EloServerLlmAdapter implements LlmPort {
    private baseUrl: string;
    private authToken: string;

    constructor(baseUrl: string, authToken: string) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        this.authToken = authToken;
    }

    public updateConfig(baseUrl: string, authToken: string) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        this.authToken = authToken;
    }

    private cleanJsonString(input: string): string {
        let cleaned = input.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        return cleaned.trim();
    }

    private async fetchAi<T>(endpoint: string, body: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Elo Server AI Error (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    async requestEnrichment(params: LlmParams): Promise<LlmResponse | null> {
        const data = await this.fetchAi<{ response: string }>("/api/ai/generate", {
            prompt: params.prompt,
            json_mode: true,
        });

        try {
            const cleaned = this.cleanJsonString(data.response);
            return JSON.parse(cleaned);
        } catch (e) {
            return { body: data.response };
        }
    }

    async requestStreamBrief(params: LlmParams): Promise<string | null> {
        // Current server implementation doesn't support streaming back via REST easily for simple clients,
        // so we just return the full response for now.
        const data = await this.fetchAi<{ response: string }>("/api/ai/generate", {
            prompt: params.prompt,
        });
        return data.response;
    }

    async request(params: LlmParams): Promise<string | null> {
        const data = await this.fetchAi<{ response: string }>("/api/ai/generate", {
            prompt: params.prompt,
        });
        return data.response;
    }

    async requestJson(params: LlmParams): Promise<any | null> {
        const data = await this.fetchAi<{ response: string }>("/api/ai/generate", {
            prompt: params.prompt,
            json_mode: true,
        });
        try {
            const cleaned = this.cleanJsonString(data.response);
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse JSON response from Elo Server", e);
            return null;
        }
    }
}
