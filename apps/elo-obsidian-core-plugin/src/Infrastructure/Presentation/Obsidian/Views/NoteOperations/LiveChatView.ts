import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
} from 'obsidian';
import ObsidianExtension from '@/Infrastructure/Presentation/Obsidian/main';
import { VoiceRecordingService } from '../../Services/VoiceRecordingService';

export const VIEW_TYPE_LIVE_CHAT = 'live-chat-view';

export class LiveChatView extends ItemView {
	private plugin: ObsidianExtension;
	private voiceService: VoiceRecordingService;
	private startButton: ButtonComponent | null = null;
	private statusEl: HTMLElement | null = null;
	private isChatting: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianExtension) {
		super(leaf);
		this.plugin = plugin;
		const serverUrl = this.plugin.settings.eloServerUrl || 'http://localhost:8001';
		const wsUrl = serverUrl.replace('http', 'ws') + '/ws/voice';
		this.voiceService = new VoiceRecordingService(wsUrl);
	}

	getViewType() {
		return VIEW_TYPE_LIVE_CHAT;
	}

	getDisplayText() {
		return this.plugin.translationService.t('liveChat.title');
	}

	getIcon() {
		return 'microphone';
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.style.padding = '20px';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.alignItems = 'center';
		container.style.justifyContent = 'center';
		container.style.gap = '20px';

		container.createEl('h2', { text: this.plugin.translationService.t('liveChat.title') });

		this.statusEl = container.createDiv({ text: this.plugin.translationService.t('liveChat.statusDisconnected') });
		this.statusEl.style.fontSize = '1.2em';
		this.statusEl.style.fontWeight = 'bold';
		this.statusEl.style.color = 'var(--text-muted)';

		const buttonContainer = container.createDiv();
		this.startButton = new ButtonComponent(buttonContainer);
		this.startButton
			.setButtonText(this.plugin.translationService.t('liveChat.start'))
			.setCta()
			.onClick(() => this.toggleChat());

		this.startButton.buttonEl.style.width = '200px';
		this.startButton.buttonEl.style.height = '50px';
		this.startButton.buttonEl.style.fontSize = '1.1em';
	}

	private async toggleChat() {
		if (this.isChatting) {
			this.voiceService.stop();
			this.isChatting = false;
			this.updateUI();
		} else {
			try {
				await this.voiceService.start();
				this.isChatting = true;
				this.updateUI();
			} catch (err) {
				console.error('Failed to start Gemini Live:', err);
			}
		}
	}

	private updateUI() {
		if (!this.startButton || !this.statusEl) return;

		if (this.isChatting) {
			this.startButton.setButtonText(this.plugin.translationService.t('liveChat.stop'));
			this.startButton.buttonEl.style.backgroundColor = 'var(--text-error)';
			this.statusEl.setText(this.plugin.translationService.t('liveChat.statusConnected'));
			this.statusEl.style.color = 'var(--text-success)';
			this.startButton.buttonEl.classList.add('is-chatting');
		} else {
			this.startButton.setButtonText(this.plugin.translationService.t('liveChat.start'));
			this.startButton.buttonEl.style.backgroundColor = '';
			this.statusEl.setText(this.plugin.translationService.t('liveChat.statusDisconnected'));
			this.statusEl.style.color = 'var(--text-muted)';
			this.startButton.buttonEl.classList.remove('is-chatting');
		}
	}

	async onClose() {
		this.voiceService.stop();
	}
}
