import {
	buildMergedFrontmatter,
	formatFrontmatterBlock,
	splitFrontmatter,
	stripLeadingFrontmatter,
} from '../Utils/FrontmatterUtils';

export function mergeNotes(noteB: string, noteA: string, useTemplateBody: boolean = true): string {
	const templateSplit = splitFrontmatter(noteB);
	const currentSplit = splitFrontmatter(noteA);
	const mergedFrontmatter = buildMergedFrontmatter(
		templateSplit.frontmatterText,
		currentSplit.frontmatterText,
	);
	const mergedFrontmatterBlock = mergedFrontmatter ? formatFrontmatterBlock(mergedFrontmatter) : '';

	const mergedBody = useTemplateBody
		? mergeBodyContent(templateSplit.body, currentSplit.body)
		: currentSplit.body;
	const normalizedBody = mergedBody.replace(/^[\n\r]+/, '');

	const segments: string[] = [];
	if (mergedFrontmatterBlock) {
		segments.push(mergedFrontmatterBlock);
	}
	if (normalizedBody) {
		segments.push(normalizedBody);
	}

	return segments.join('\n\n');
}

function mergeBodyContent(templateBody: string, currentBody: string): string {
	const cleanTemplate = stripLeadingFrontmatter(templateBody);
	const cleanCurrent = stripLeadingFrontmatter(currentBody);

	const normalizedTemplate = cleanTemplate.replace(/\s+$/, '');
	const normalizedCurrent = cleanCurrent.replace(/^\s+/, '');

	if (!normalizedTemplate) {
		return normalizedCurrent;
	}

	if (!normalizedCurrent) {
		return normalizedTemplate;
	}

	return `${normalizedTemplate}\n\n${normalizedCurrent}`;
}
