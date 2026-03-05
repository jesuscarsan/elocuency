"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EloServerLlmAdapter = void 0;
class EloServerLlmAdapter {
    constructor(baseUrl, authToken) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        this.authToken = authToken;
    }
    async fetchAi(endpoint, body) {
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
    async requestEnrichment(params) {
        const data = await this.fetchAi("/api/ai/generate", {
            prompt: params.prompt,
            json_mode: true,
        });
        try {
            return JSON.parse(data.response);
        }
        catch (e) {
            return { body: data.response };
        }
    }
    async requestStreamBrief(params) {
        // Current server implementation doesn't support streaming back via REST easily for simple clients,
        // so we just return the full response for now.
        const data = await this.fetchAi("/api/ai/generate", {
            prompt: params.prompt,
        });
        return data.response;
    }
    async request(params) {
        const data = await this.fetchAi("/api/ai/generate", {
            prompt: params.prompt,
        });
        return data.response;
    }
    async requestJson(params) {
        const data = await this.fetchAi("/api/ai/generate", {
            prompt: params.prompt,
            json_mode: true,
        });
        try {
            return JSON.parse(data.response);
        }
        catch (e) {
            console.error("Failed to parse JSON response from Elo Server", e);
            return null;
        }
    }
}
exports.EloServerLlmAdapter = EloServerLlmAdapter;
