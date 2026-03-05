"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeInEditMode = exports.getActiveMarkdownView = void 0;
const obsidian_1 = require("obsidian");
/**
 * Helper to get the active MarkdownView, supporting specific file targeting and fallback
 * for when focus is in a side panel.
 */
function getActiveMarkdownView(app, targetFile) {
    if (targetFile) {
        const leaves = app.workspace.getLeavesOfType('markdown');
        const matchingLeaf = leaves.find(leaf => leaf.view.file === targetFile);
        return matchingLeaf ? matchingLeaf.view : null;
    }
    let view = app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
    if (!view) {
        const activeFile = app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
            const leaves = app.workspace.getLeavesOfType('markdown');
            const matchingLeaf = leaves.find(leaf => leaf.view.file === activeFile);
            if (matchingLeaf) {
                view = matchingLeaf.view;
            }
        }
    }
    return view;
}
exports.getActiveMarkdownView = getActiveMarkdownView;
/**
 * Executes an action in edit (source) mode and ensures the view returns to preview mode afterwards.
 *
 * @param view The MarkdownView to operate on.
 * @param action The async action to execute while in edit mode.
 */
async function executeInEditMode(view, action) {
    const originalMode = view.getMode ? view.getMode() : (view.getState().mode);
    // Switch to source mode if not already there
    if (originalMode !== 'source') {
        await view.setState({ ...view.getState(), mode: 'source' }, { history: false });
    }
    try {
        await action();
    }
    finally {
        // Always switch to preview mode at the end, as requested.
        if (originalMode !== 'source' && (view.getMode ? view.getMode() : view.getState().mode) !== 'preview') {
            await view.setState({ ...view.getState(), mode: 'preview' }, { history: false });
        }
    }
}
exports.executeInEditMode = executeInEditMode;
