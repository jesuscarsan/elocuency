import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveMarkdownView, executeInEditMode } from './ViewMode';
import { MarkdownView, TFile } from 'obsidian';

describe('ViewMode', () => {
	let mockApp: any;
	let mockView: any;
	let mockFile: any;

	beforeEach(() => {
		mockFile = new (TFile as any)('test.md');
		mockView = {
			file: mockFile,
			getMode: vi.fn(),
			getState: vi.fn().mockReturnValue({}),
			setState: vi.fn().mockResolvedValue(undefined),
		};
		mockApp = {
			workspace: {
				getActiveViewOfType: vi.fn(),
				getActiveFile: vi.fn(),
				getLeavesOfType: vi.fn().mockReturnValue([]),
			},
		};
	});

	describe('getActiveMarkdownView', () => {
		it('should return view for target file', () => {
			const leaves = [{ view: mockView }];
			mockApp.workspace.getLeavesOfType.mockReturnValue(leaves);

			const result = getActiveMarkdownView(mockApp, mockFile);
			expect(result).toBe(mockView);
		});

		it('should return null if target file not found in leaves', () => {
			mockApp.workspace.getLeavesOfType.mockReturnValue([]);
			const result = getActiveMarkdownView(mockApp, mockFile);
			expect(result).toBeNull();
		});

		it('should return active view if no target file', () => {
			mockApp.workspace.getActiveViewOfType.mockReturnValue(mockView);
			const result = getActiveMarkdownView(mockApp);
			expect(result).toBe(mockView);
		});

		it('should find view for active file if no active view', () => {
			mockApp.workspace.getActiveViewOfType.mockReturnValue(null);
			mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
			mockApp.workspace.getLeavesOfType.mockReturnValue([{ view: mockView }]);

			const result = getActiveMarkdownView(mockApp);
			expect(result).toBe(mockView);
		});

		it('should return null if no active view and no active file', () => {
			mockApp.workspace.getActiveViewOfType.mockReturnValue(null);
			mockApp.workspace.getActiveFile.mockReturnValue(null);
			const result = getActiveMarkdownView(mockApp);
			expect(result).toBeNull();
		});
	});

	describe('executeInEditMode', () => {
		it('should switch to source mode and back if in preview', async () => {
			mockView.getMode.mockReturnValueOnce('preview').mockReturnValue('source');
			const action = vi.fn().mockResolvedValue(undefined);

			await executeInEditMode(mockView, action);

			expect(mockView.setState).toHaveBeenCalledWith(
				expect.objectContaining({ mode: 'source' }),
				expect.any(Object),
			);
			expect(action).toHaveBeenCalled();
			expect(mockView.setState).toHaveBeenCalledWith(
				expect.objectContaining({ mode: 'preview' }),
				expect.any(Object),
			);
		});

		it('should not switch mode if already in source', async () => {
			mockView.getMode.mockReturnValue('source');
			const action = vi.fn().mockResolvedValue(undefined);

			await executeInEditMode(mockView, action);

			expect(mockView.setState).not.toHaveBeenCalled();
			expect(action).toHaveBeenCalled();
		});

		it('should restore preview mode even if action throws', async () => {
			mockView.getMode.mockReturnValueOnce('preview').mockReturnValue('source'); // Starts in preview, switches source
			const action = vi.fn().mockRejectedValue(new Error('Fail'));

			await expect(executeInEditMode(mockView, action)).rejects.toThrow('Fail');

			expect(mockView.setState).toHaveBeenCalledWith(
				expect.objectContaining({ mode: 'preview' }),
				expect.any(Object),
			);
		});
	});
});
