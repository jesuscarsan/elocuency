export interface ImageContent {
    data: string; // Base64 string
    mimeType: string;
}

export interface ImageAnalysisResult {
    literal_transcription: string;
    analysis: string;
}

export class EloServerImagesAdapter {
    private baseUrl: string;
    private authToken: string;

    constructor(baseUrl: string, authToken: string) {
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
            throw new Error(`Elo Server AI Vision Error (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    async generateContentFromImages(
        images: ImageContent[],
        additionalPrompt: string = ""
    ): Promise<ImageAnalysisResult | null> {
        const prompt = `
      Analiza las siguientes imágenes que corresponden a lecciones de libros de texto.
      ${additionalPrompt}
      
      Instrucciones:
      1. Primero transcribe el texto literalmente de todas las imágenes en orden.
      2. Luego analiza el contenido en profundidad.
    `;

        const expectedSchema = {
            type: "object",
            properties: {
                literal_transcription: {
                    type: "string",
                    description: "Transcripción literal completa en markdown.",
                },
                analysis: {
                    type: "string",
                    description: "Análisis detallado y resumen.",
                },
            },
            required: ["literal_transcription", "analysis"],
        };

        const data = await this.fetchAi<{ response: string }>("/api/ai/vision", {
            prompt: prompt,
            images: images,
            json_mode: true,
            expected_schema: expectedSchema,
        });

        try {
            return JSON.parse(data.response);
        } catch (e) {
            console.error("Failed to parse vision response from Elo Server", e);
            return null;
        }
    }

    async generateEnrichmentFromImages(
        images: ImageContent[],
        promptTemplate: string
    ): Promise<{ body?: string; frontmatter?: Record<string, unknown> } | null> {
        const prompt = `
      ${promptTemplate}
      
      Analiza las imágenes proporcionadas y utiliza su contenido para cumplir con la solicitud.
      Responde SOLAMENTE con el JSON válido que contenga "body" y opcionalmente "frontmatter".
    `;

        const data = await this.fetchAi<{ response: string }>("/api/ai/vision", {
            prompt: prompt,
            images: images,
            json_mode: true,
        });

        try {
            return JSON.parse(data.response);
        } catch (e) {
            console.error("Failed to parse vision enrichment response from Elo Server", e);
            return null;
        }
    }
}
