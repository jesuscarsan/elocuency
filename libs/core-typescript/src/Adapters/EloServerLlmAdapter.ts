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
            return JSON.parse(data.response);
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
            return JSON.parse(data.response);
        } catch (e) {
            console.error("Failed to parse JSON response from Elo Server", e);
            return null;
        }
    }
}
