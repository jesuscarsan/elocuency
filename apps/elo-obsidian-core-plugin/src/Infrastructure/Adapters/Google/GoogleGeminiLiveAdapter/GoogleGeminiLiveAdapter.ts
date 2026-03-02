import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { AudioRecorder } from './AudioRecorder';
import { AudioPlayer } from './AudioPlayer';

const GEMINI_LIVE_URL =
	'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

import { IGeminiSessionAdapter } from '@elo/core';
import { TranslationService } from '@elo/obsidian-plugin';

export class GoogleGeminiLiveAdapter implements IGeminiSessionAdapter {
	private ws: WebSocket | null = null;
	private audioRecorder: AudioRecorder;
	private audioPlayer: AudioPlayer;
	private apiKey: string;
	private isConnected: boolean = false;
	private systemInstruction: string = '';
	private isAiSpeaking: boolean = false;

	private onTextReceived: (text: string) => void;
	private onUserTextReceived: (text: string) => void;
	private onScoreReceived: (score: number) => void;

	constructor(
		apiKey: string,
		private readonly translationService: TranslationService,
		onTextReceived?: (text: string) => void,
		onScoreReceived?: (score: number) => void,
		onUserTextReceived?: (text: string) => void,
	) {
		this.apiKey = apiKey;
		this.onTextReceived = onTextReceived || (() => {});
		this.onScoreReceived = onScoreReceived || (() => {});
		this.onUserTextReceived = onUserTextReceived || (() => {});

		this.audioPlayer = new AudioPlayer((isPlaying) => {
			this.isAiSpeaking = isPlaying;
		});
		this.audioRecorder = new AudioRecorder(this.translationService, (base64Audio) => {
			this.sendAudioChunk(base64Audio);
		});
	}

	async resumeAudio(): Promise<void> {
		await this.audioPlayer.resume();
	}

	async connect(
		systemInstruction: string = '',
		enableScoreTracking: boolean = false,
		voice: string = 'Aoede',
		temperature: number = 0.5,
		topP: number = 0.95,
	): Promise<boolean> {
		this.systemInstruction = systemInstruction;
		if (!this.apiKey) {
			showMessage('geminiLive.apiKeyMissing', undefined, this.translationService);
			return false;
		}

		const url = `${GEMINI_LIVE_URL}?key=${this.apiKey}`;

		try {
			this.ws = new WebSocket(url);
		} catch (e) {
			console.error('Error creating WebSocket', e);
			showMessage('geminiLive.connectionError', undefined, this.translationService);
			return false;
		}

		return new Promise((resolve) => {
			if (!this.ws) return resolve(false);

			this.ws.onopen = async () => {
				console.log('Gemini Live WS Connected');
				this.isConnected = true;
				this.sendSetupMessage(enableScoreTracking, voice, temperature, topP);

				// Start recording immediately upon connection (or can be manual)
				const micStarted = await this.audioRecorder.start();
				if (!micStarted) {
					this.disconnect();
					resolve(false);
					return;
				}
				resolve(true);
			};

			this.ws.onmessage = async (event) => {
				await this.handleMessage(event);
			};

			this.ws.onerror = (error) => {
				console.error('Gemini Live WS Error:', error);
				showMessage('geminiLive.websocketError', undefined, this.translationService);
				this.disconnect();
			};

			this.ws.onclose = () => {
				console.log('Gemini Live WS Closed');
				this.disconnect();
			};
		});
	}

	disconnect(): void {
		this.isConnected = false;
		this.audioRecorder.stop();
		this.audioPlayer.close(); // Ensure AudioContext is closed

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private sendSetupMessage(
		enableScoreTracking: boolean,
		voice: string,
		temperature: number,
		topP: number,
	): void {
		if (!this.ws) return;

		const setupMsg: any = {
			setup: {
				model: 'models/gemini-2.0-flash-exp',
				generation_config: {
					response_modalities: ['AUDIO'],
					speech_config: {
						voice_config: {
							prebuilt_voice_config: {
								voice_name: voice,
							},
						},
					},
					temperature: temperature,
					top_p: topP,
				},
			},
		};

		// NOTE: Server-side VAD disablement via 'voice_activity_detection' config
		// seems to cause connection issues (socket close) on some models/environments.
		// We will rely on Client-Side muting (sending silence or no chunks) for PTT.
		// if (usePTT) {
		//    // Attempting to disable server VAD is removed to restore stability.
		// }

		// Add output_audio_transcription to BidiGenerateContentSetup directly
		(setupMsg.setup as any).output_audio_transcription = {};
		// (setupMsg.setup as any).input_audio_transcription = { model: 'google-provided-model' }; // Enable input transcription

		if (enableScoreTracking) {
			console.log('Enabling Score Tracking Tool in Setup');
			setupMsg.setup.tools = [
				{
					function_declarations: [
						{
							name: 'report_score',
							description: "Report the score of the user's answer effectiveness.",
							parameters: {
								type: 'OBJECT',
								properties: {
									score: {
										type: 'INTEGER',
										description: 'The score of the answer from 0 to 10.',
									},
								},
								required: ['score'],
							},
						},
					],
				},
			];
		}

		if (this.systemInstruction) {
			let finalInstruction = this.systemInstruction;
			if (enableScoreTracking) {
				finalInstruction +=
					'\n\nIMPORTANT: You are configured to track the user\'s answer quality. When the user answers, you MUST evaluate it and call the "report_score" function with a score from 0 to 10.';
			}

			setupMsg.setup.system_instruction = {
				parts: [{ text: finalInstruction }],
			};
		}

		console.log(
			`Gemini Live: Sending Setup with Temperature: ${temperature}, TopP: ${topP}, Voice: ${voice}`,
		);
		console.log('Sending Setup Msg:', JSON.stringify(setupMsg, null, 2));

		this.ws.send(JSON.stringify(setupMsg));
	}

	sendContextUpdate(fileName: string, content: string): void {
		if (!this.ws || !this.isConnected) return;

		const msg = {
			client_content: {
				turns: [
					{
						role: 'user',
						parts: [{ text: `SYSTEM UPDATE: \n${content}` }],
					},
				],
				turn_complete: true,
			},
		};
		console.log('Sending Context Update Msg:', JSON.stringify(msg, null, 2));
		this.ws.send(JSON.stringify(msg));
	}

	sendText(text: string): void {
		if (!this.ws || !this.isConnected) return;

		const msg = {
			client_content: {
				turns: [
					{
						role: 'user',
						parts: [{ text: text }],
					},
				],
				turn_complete: true,
			},
		};
		console.log('Sending Text Message:', text);
		this.ws.send(JSON.stringify(msg));
	}

	private chunkCount = 0;

	private sendAudioChunk(base64Audio: string): void {
		if (!this.ws || !this.isConnected || this.isAiSpeaking) return;
		if (this.ws.readyState !== WebSocket.OPEN) return; // Prevent sending to closed socket

		const msg = {
			realtime_input: {
				media_chunks: [
					{
						mime_type: 'audio/pcm',
						data: base64Audio,
					},
				],
			},
		};

		this.chunkCount++;
		if (this.chunkCount % 50 === 0) {
			// console.log(`Sending Audio Chunk #${this.chunkCount} (size: ${base64Audio.length})`);
		}

		this.ws.send(JSON.stringify(msg));
	}

	private async handleMessage(event: MessageEvent): Promise<void> {
		let data;
		try {
			if (event.data instanceof Blob) {
				data = JSON.parse(await event.data.text());
			} else {
				data = JSON.parse(event.data);
			}
		} catch (e) {
			console.error('Error parsing WS message', e);
			return;
		}

		// Log for debug (careful with huge logs)
		// console.log("WS Msg:", JSON.stringify(data, null, 2));

		// Handle tool calls / function calls
		// In some API versions this might be deeper or slightly different named,
		// but typically it is in modelTurn parts or toolCall.
		// Let's check modelTurn parts first.

		// Handle Setup Complete
		if ((data as any).setupComplete) {
			console.log('Gemini Live: Setup Complete');
			return;
		}

		// Handle Errors (e.g. Quota, Invalid Argument)
		if ((data as any).error) {
			console.error('Gemini Live API Error:', (data as any).error);
			showMessage(
				'geminiLive.apiError',
				{
					message: (data as any).error.message || 'Unknown error',
				},
				this.translationService,
			);
			return;
		}

		const serverContent = data?.serverContent;
		if (!serverContent) {
			console.log('No serverContent in message (and not setup/error)', data);
			return;
		}

		// Handle TurnComplete (might contain final transcription?)
		// But usually transcript events come as 'serverContent' -> 'modelTurn' (output) or special field.

		// Handle Output Transcription (AI Speech)
		// Check BidiGenerateContentResponse definition.
		// It has 'serverContent' -> 'modelTurn' -> 'parts' -> 'text' usually?
		// Or 'serverContent' -> 'outputTranscription'? Docs say 'outputTranscription' is not top-level in serverContent usually?
		// Wait, looking at proto: 'serverContent' string field `modelTurn`.
		// There is NO `outputTranscription` field in `ServerContent`.
		// However, `toolCall` etc are there.
		// Wait, existing code had: `if (serverContent.outputTranscription ...)`
		// If that was working for AI text, fine. But usually AI text comes in `modelTurn`.

		// Input Transcription comes in `interrupted` or just `turnComplete`?
		// Actually, it might be `serverContent` -> `speechRecognitionResults`? No?
		// Let's assume the unofficial/beta API structure.
		// Based on search: `inputAudioTranscription` config enables it.
		// It often arrives as a separate message or part of `toolUse`? No.

		// Let's trust logic: checks for any text field.

		// Handle User Input Transcription
		// It might appear as `serverContent` -> `recognitionResult` ??
		// Or in the logged message structure.
		// Let's add logging to discover it if not known.
		// But I need to implement it.
		// Common field name: `speechRecognitionResult` or `inputTranscription`.

		// Let's check for `serverContent.interrupted` as well?

		// I'll add a check for a likely field based on experience/docs.
		// "turnComplete" often has it?

		// Wait, let's implement the callback architecture first.

		if (serverContent.outputTranscription && serverContent.outputTranscription.text) {
			// console.log("Received Transcription (Output):", serverContent.outputTranscription.text);
			// This is AI text?
			this.onTextReceived(serverContent.outputTranscription.text);
		}

		// New: Check for Input Transcription
		// Note: The field might be named differently.
		const recognitionResult =
			(serverContent as any).speechRecognitionResults || (serverContent as any).recognitionResult;
		if (recognitionResult) {
			// Handling parts or text
			const transcript =
				recognitionResult.transcript ||
				(recognitionResult.parts ? recognitionResult.parts[0]?.text : '');
			if (transcript) {
				console.log('Received User Transcription:', transcript);
				this.onUserTextReceived(transcript);
			}
		}

		const modelTurn = serverContent.modelTurn;

		// console.log("Model Turn:", modelTurn);
		if (!modelTurn || !modelTurn.parts) {
			// console.log("No modelTurn or parts in message", serverContent);
			// It might be turnComplete or interrupted
			if (serverContent.turnComplete) {
				console.log('Turn Complete');
			}
			return;
		}

		const parts = modelTurn.parts;
		if (parts && Array.isArray(parts)) {
			for (const part of parts) {
				if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
					// console.log(`Received Audio Chunk (${part.inlineData.data.length} chars)`);
					this.audioPlayer.addPcmData(part.inlineData.data);
				} else if (part.text) {
					console.log('Received Text Part:', part.text);
					this.onTextReceived(part.text);
				} else if (part.functionCall) {
					console.log('Gemini Live: Function Call detected', part.functionCall);
					// Handle function call
					if (part.functionCall.name === 'report_score') {
						const args = part.functionCall.args;
						console.log('Gemini Live: report_score args:', args);

						let score = args?.score;
						// Handle string or number
						if (typeof score === 'string') {
							score = parseInt(score, 10);
						}

						if (typeof score === 'number' && !isNaN(score)) {
							console.log('Gemini Live: Emitting score event:', score);
							this.onScoreReceived(score);
						} else {
							console.warn('Gemini Live: Invalid score received:', args);
						}
					}

					const responseId = part.functionCall.id || 'no-id'; // standard fallback
					this.sendFunctionResponse(part.functionCall.name, responseId, { status: 'ok' });
				} else if (part.executableCode) {
					console.log('Gemini Live: Executable Code detected', part.executableCode);
					const code = part.executableCode.code;
					if (code) {
						// Look for report_score(score=X) or report_score(X)
						// The user saw: "default_api.report_score(score=10)\n"
						const match = code.match(/report_score\s*\(\s*(?:score\s*=\s*)?(\d+)\s*\)/);
						if (match && match[1]) {
							const score = parseInt(match[1], 10);
							console.log('Gemini Live: Parsed score from code:', score);
							if (!isNaN(score)) {
								this.onScoreReceived(score);
							}
						}
					}
				}
			}
		}
	}

	private sendFunctionResponse(name: string, id: string, result: any): void {
		if (!this.ws || !this.isConnected) return;

		const msg = {
			tool_response: {
				function_responses: [
					{
						name: name,
						id: id,
						response: { result: result },
					},
				],
			},
		};
		this.ws.send(JSON.stringify(msg));
	}
}
