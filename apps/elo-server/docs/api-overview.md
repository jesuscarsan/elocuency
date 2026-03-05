# Elo Server API Documentation

The Elo Server provides a centralized interface for AI operations, including text generation, vision analysis, audio transcription, and image search.

## Authentication

All endpoints (except for the LangServe Playground UI) require a Bearer Token in the `Authorization` header.

```http
Authorization: Bearer <YOUR_SERVER_AUTH_TOKEN>
```

## AI Tools Endpoints (`/api/ai`)

These endpoints provide direct access to specific AI capabilities.

### 1. Text Generation (`POST /api/ai/generate`)

Generates text or structured JSON using Google Gemini.

**Request Body:**

```json
{
	"prompt": "Summarize this text...",
	"model_name": "gemini-2.0-flash", // Optional
	"json_mode": false, // Set to true for JSON output
	"temperature": 0.4 // Optional
}
```

### 2. Vision Analysis (`POST /api/ai/vision`)

Analyzes images and extracts information.

**Request Body:**

```json
{
	"prompt": "What is in these images?",
	"images": [{ "data": "<base64_string>", "mimeType": "image/png" }],
	"json_mode": true
}
```

### 3. Audio Transcription (`POST /api/ai/transcribe`)

Transcribes audio files using Gemini's multimodal capabilities.

**Request Body:**

```json
{
	"audio_base64": "<base64_string>",
	"mime_type": "audio/webm",
	"prompt": "Transcribe literally" // Optional context
}
```

### 4. Image Search (`POST /api/ai/image-search`)

Performs a Google Custom Search for images.

**Request Body:**

```json
{
	"query": "Golden Retriever",
	"count": 5
}
```

## Agentic Endpoints

These endpoints expose LangChain/LangGraph agents with tool-calling capabilities.

### 1. Specialized Agent (`/agent`)

The main entry point for the Elocuency Agent. It has access to tools (Obsidian, MCP, n8n, etc.).

- **Playground**: [http://localhost:8001/agent/playground](http://localhost:8001/agent/playground)
- **Streaming**: Supports LangServe streaming protocols.

### 2. Simple Model (`/simple-agent`)

A direct pass-through to the LLM without tools.

- **Playground**: [http://localhost:8001/simple-agent/playground](http://localhost:8001/simple-agent/playground)

## Interactive Documentation

- **Swagger UI**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **ReDoc**: [http://localhost:8001/redoc](http://localhost:8001/redoc)
