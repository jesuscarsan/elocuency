import { App, MarkdownPostProcessor, MarkdownPostProcessorContext, TFile, Notice } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { HeaderDataService } from '../../../../Application/Services/HeaderDataService';

const lastWarningTime: Record<string, number> = {};

export const createHeaderProgressRenderer = (
	app: App,
	service: HeaderDataService,
): MarkdownPostProcessor => {
	return async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		// We only want to run this in reading mode (or initial render of live preview)
		// ctx.sourcePath gives us the file path of the markdown file

		const sourcePath = ctx.sourcePath;
		if (!sourcePath) return;

		// Get Progress via Service
		const progressMap = await service.getHeaderProgress(sourcePath);
		if (Object.keys(progressMap).length === 0) return;

		// CHECK FOR MISSING HEADERS
		const file = app.vault.getAbstractFileByPath(sourcePath);
		if (file instanceof TFile) {
			const cache = app.metadataCache.getFileCache(file);
			const headings = cache?.headings?.map((h) => h.heading) || [];

			const missingKeys = service.findMissingHeaders(progressMap, headings);

			if (missingKeys.length > 0) {
				// Rate limit warnings to avoid spamming the user (once every 10 seconds per file)
				const now = Date.now();
				if (!lastWarningTime[sourcePath] || now - lastWarningTime[sourcePath] > 10000) {
					lastWarningTime[sourcePath] = now;
					showMessage(
						`⚠️ Header Progress: The following headers in .json are missing in the note:\n${missingKeys.join('\n')}`,
					);
					console.warn(`[HeaderProgress] Missing headers in ${sourcePath}:`, missingKeys);
				}
			}
		}

		// Find all headers in this specific rendered block
		const headers = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
		// Consolidate logic: sometimes 'el' itself might be the header or close to it?
		// In standard PostProcessor logic, 'el' is usually a container div.

		// console.log(`[HeaderProgress] Found ${headers.length} headers in current block.`);

		headers.forEach((header) => {
			const headerText = header.innerText?.trim(); // Use innerText and trim
			// console.log(`[HeaderProgress] Checking header: "${headerText}"`);

			if (!headerText) return;

			// Check if there is progress for this header
			if (progressMap.hasOwnProperty(headerText)) {
				const progressValue = progressMap[headerText];
				// console.log(`[HeaderProgress] Match found! Value: ${progressValue}`);

				// Avoid double rendering
				if (header.querySelector('.header-progress-container')) return;

				const progressContainer = document.createElement('span');
				progressContainer.addClass('header-progress-container');

				const progressBar = document.createElement('progress');
				progressBar.addClass('header-progress-bar');
				progressBar.value = progressValue;
				progressBar.max = 100;

				const progressLabel = document.createElement('span');
				progressLabel.addClass('header-progress-label');
				progressLabel.innerText = ` ${progressValue}%`;

				progressContainer.appendChild(progressBar);
				progressContainer.appendChild(progressLabel);

				header.appendChild(progressContainer);
			}
		});
	};
};
