import { LlmPort, LlmParams, LlmResponse } from "../Domain/Ports/LlmPort";
export declare class EloServerLlmAdapter implements LlmPort {
    private baseUrl;
    private authToken;
    constructor(baseUrl: string, authToken: string);
    private fetchAi;
    requestEnrichment(params: LlmParams): Promise<LlmResponse | null>;
    requestStreamBrief(params: LlmParams): Promise<string | null>;
    request(params: LlmParams): Promise<string | null>;
    requestJson(params: LlmParams): Promise<any | null>;
}
