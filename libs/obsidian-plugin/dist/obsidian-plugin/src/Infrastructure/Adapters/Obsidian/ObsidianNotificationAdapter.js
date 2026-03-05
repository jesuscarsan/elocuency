"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidianNotificationAdapter = void 0;
const obsidian_1 = require("obsidian");
class ObsidianNotificationAdapter {
    constructor(translationService) {
        this.translationService = translationService;
    }
    showMessage(keyOrMessage, args) {
        const message = this.translationService
            ? this.translationService.t(keyOrMessage, args)
            : keyOrMessage;
        new obsidian_1.Notice(message);
    }
    showError(keyOrMessage, args) {
        const message = this.translationService
            ? this.translationService.t(keyOrMessage, args)
            : keyOrMessage;
        new obsidian_1.Notice(`Error: ${message}`);
    }
}
exports.ObsidianNotificationAdapter = ObsidianNotificationAdapter;
