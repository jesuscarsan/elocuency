import { App, MarkdownPostProcessor, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { HeaderMetadataKeys } from '@elo/core';
import { normalizeDifficulty, difficultyToColor } from '@elo/core';

import { HeaderDataService } from '../../../../Application/Services/HeaderDataService';

export const createHeaderMetadataRenderer = (
	app: App,
	service: HeaderDataService,
): MarkdownPostProcessor => {
	return async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const sourcePath = ctx.sourcePath;
		if (!sourcePath) return;

		// 1. Read Metadata via Service
		const metadataMap = await service.getHeaderData(sourcePath);

		// 2. Identify Headers in this block
		const headers = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
		if (headers.length === 0) return;

		// 3. Process each header
		// We need to find the Block ID.
		// Option A: Check "data-id" attribute? No, Obsidian doesn't expose it easily on the element.
		// Option B: Read source line via ctx.getSectionInfo.

		const sectionInfo = ctx.getSectionInfo(el);

		headers.forEach((header, index) => {
			// If we have section info, try to find ID in raw text.
			let blockId = '';

			if (sectionInfo) {
				// Calculate line number. The 'headers' array matches the structure of the rendered block?
				// Usually `el` is the container for a section.
				// But sometimes multiple headers are in one block? Unlikely in standard mode.
				// Let's iterate lines.
				// ACTUALLY: `el` in post-processor is usually a `div` wrapping the paragraph/header.
				// If it's a header, sectionInfo usually points to that specific line range.

				const startLine = sectionInfo.lineStart;
				const endLine = sectionInfo.lineEnd;

				// We need to read the specific line.
				// ctx doesn't give text directly, need to read file or use cache?
				// sectionInfo text is not available directly.

				// Let's use the file cache to map line number to text?
				// Or just rely on the visible text and finding the corresponding cache entry?

				// Robust Fallback: Match by header text matching Cache
				const file = app.vault.getAbstractFileByPath(sourcePath);
				if (file instanceof TFile) {
					const cache = app.metadataCache.getFileCache(file);
					const headingCache = cache?.headings?.find((h) => {
						// Position check is best if available
						/* 
                           sectionInfo.lineStart match? 
                           Obsidian renders blocks. If it's a heading, lineStart == line of heading.
                        */
						return h.position.start.line === startLine;
					});

					if (headingCache) {
						// Extract ID from heading text in cache (which includes the ID)
						// Wait, cache.headings[].heading INCLUDES the id?
						// Usually Obsidian strips it in `.heading` property but keeps it in raw?
						// Actually, `.heading` property usually has the text.
						// Checking `id` property of heading block?
						// Let's check the raw line if we can match it.
						// Or rely on the specific format we injected: "Title ^id"
						// Obsidian specific: headingCache DOES NOT include the blockId in .heading text usually.
						// Wait, if it is a block ID, custom format `^id` at end of line.
						// We can't easily get the RAW text without reading file.
						// But we know the line number.
						// Optimization: We could read the file but that's expensive every render.
						// Better: Iterate keys in metadataMap and see if any map to this header?
						// But keys ARE block IDs.
					}
				}
			}

			// ALTERNATIVE: Look for child 'span.cm-blockid' if in editing mode?
			// In Reading mode, the ^id is stripped.

			// Let's use the regex on the rendered text? No, it's gone.

			// READ FILE for the specific line is the most robust way if we have line numbers.
			// But reading file 100 times for 100 headers is bad.
			// Although file is cached by Obsidian.

			// Better approach:
			// 1. Get Cache for file.
			// 2. Find heading at specific line `sectionInfo.lineStart`.
			// 3. That heading SHOULD have an id if we put it there?
			//    No, Obsidian does NOT auto-parse `^id` into `heading.id` unless it's a true block id link?
			//    Actually it does. `headingCache` has no `id` field. blockIds are stored separately in `cache.blocks`.

			const file = app.vault.getAbstractFileByPath(sourcePath);
			if (file instanceof TFile && sectionInfo) {
				const cache = app.metadataCache.getFileCache(file);
				const line = sectionInfo.lineStart;

				// Find block ID associated with this line
				if (cache?.blocks) {
					for (const [id, block] of Object.entries(cache.blocks)) {
						if (block.position.start.line === line) {
							blockId = id;
							break;
						}
					}
				}
			}

			if (blockId) {
				const data = metadataMap[blockId] || {};
				renderMetadataPill(header, data);
			}
		});
	};
};

function renderMetadataPill(container: HTMLElement, data: any) {
	if (container.querySelector('.header-metadata-container')) return;

	// Ensure container (header) is positioned relatively so absolute child works
	container.style.position = 'relative';

	// Normalization Logic (0-10 input)
	const score =
		typeof data[HeaderMetadataKeys.Score] === 'number' ? data[HeaderMetadataKeys.Score] : 0; // 0-10
	const importance =
		typeof data[HeaderMetadataKeys.Importance] === 'number'
			? data[HeaderMetadataKeys.Importance]
			: 1; // 1-5
	const difficulty =
		typeof data[HeaderMetadataKeys.Difficulty] === 'number'
			? data[HeaderMetadataKeys.Difficulty]
			: 0; // 0-10

	const pill = document.createElement('span');
	pill.addClass('header-metadata-container');

	// 2. Importance (Stars)
	// Value is 1-5 direct
	let stars = Math.max(1, Math.min(5, Math.round(importance)));

	const impEl = document.createElement('span');
	impEl.addClass('hm-item', 'hm-importance');
	impEl.setText('★'.repeat(stars));
	impEl.style.color = '#ffd700';
	impEl.style.fontSize = '18px'; // Match SVG size
	impEl.style.lineHeight = '1';
	impEl.style.textShadow = '0 0 1px #b8860b';
	impEl.title = `Importancia: ${importance}/5`;
	pill.appendChild(impEl);

	// 3. Difficulty (Dot - SVG) with tooltips: 1: Baja, 2: Media, 3: Alta
	const normDiff = normalizeDifficulty(difficulty);
	const diffColor = difficultyToColor(normDiff);
	let diffText = 'Baja'; // 1
	if (normDiff === 2) diffText = 'Media';
	if (normDiff === 3) diffText = 'Alta';

	const diffEl = document.createElement('span');
	diffEl.addClass('hm-item');
	// Size 18x18 to match stars
	diffEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="6" fill="${diffColor}" stroke="none" />
    </svg>`;
	diffEl.title = `Dificultad: ${diffText} (${normDiff}/3)`;
	// pill.appendChild(diffEl);

	// 1. Score (Circular Progress - SVG Donut)
	// Size 18x18
	const size = 18;
	const center = size / 2;
	const strokeWidth = 2.5;
	const radius = (size - strokeWidth) / 2; // (18-2.5)/2 = 7.75
	const circumference = 2 * Math.PI * radius;
	const scorePct = Math.min(10, Math.max(0, score)); // 0-10
	const offset = circumference - (scorePct / 10) * circumference;

	let scoreColor = '#50fa7b'; // Green
	if (score < 5)
		scoreColor = '#ff5555'; // Red
	else if (score < 8) scoreColor = '#ffb86c'; // Orange

	const scoreEl = document.createElement('span');
	scoreEl.addClass('hm-item', 'hm-score-svg');
	scoreEl.title = `Nota: ${score}/10`;

	// SVG Donut
	scoreEl.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
        <!-- Background Circle -->
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${strokeWidth}" />
        <!-- Progress Circle -->
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${scoreColor}" stroke-width="${strokeWidth}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            stroke-linecap="round" />
        <!-- Text in center (un-rotated) -->
        <text x="50%" y="54%" text-anchor="middle" dy="0.3em" fill="var(--text-normal)"
            font-size="9" font-weight="bold" transform="rotate(90 ${center} ${center})">${Math.round(score)}</text>
    </svg>`;

	// 4. Attempts (Count)
	const attempts =
		typeof data[HeaderMetadataKeys.Attempts] === 'number' ? data[HeaderMetadataKeys.Attempts] : 0;

	const attemptsEl = document.createElement('span');
	attemptsEl.addClass('hm-item');
	attemptsEl.style.textAlign = 'right';
	attemptsEl.style.fontSize = '0.8em';
	attemptsEl.style.color = 'var(--text-muted)';
	attemptsEl.setText(`${attempts}x`);
	attemptsEl.title = `Intentos: ${attempts}`;
	pill.appendChild(attemptsEl);

	pill.appendChild(scoreEl);

	// Append to end (Right)
	container.style.position = '';
	container.appendChild(pill);
}
