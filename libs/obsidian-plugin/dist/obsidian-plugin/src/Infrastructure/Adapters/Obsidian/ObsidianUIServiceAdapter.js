"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidianUIServiceAdapter = void 0;
const obsidian_1 = require("obsidian");
const GenericFuzzySuggestModal_1 = require("../../Presentation/Obsidian/Views/Modals/GenericFuzzySuggestModal");
class ObsidianUIServiceAdapter {
    constructor(app, translationService) {
        this.app = app;
        this.translationService = translationService;
    }
    showMessage(keyOrMessage, args) {
        const message = this.translationService.t(keyOrMessage, args);
        new obsidian_1.Notice(message);
    }
    async showSelectionModal(placeholder, items, labelFn) {
        return new Promise((resolve) => {
            new GenericFuzzySuggestModal_1.GenericFuzzySuggestModal(this.app, items, labelFn, () => { }, (selected) => resolve(selected), placeholder).open();
        });
    }
}
exports.ObsidianUIServiceAdapter = ObsidianUIServiceAdapter;
