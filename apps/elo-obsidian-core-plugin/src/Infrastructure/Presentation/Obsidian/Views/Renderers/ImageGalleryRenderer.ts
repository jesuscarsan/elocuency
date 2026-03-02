import { Plugin, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { FrontmatterKeys } from '@elo/core';

export function registerImageGalleryRenderer(plugin: Plugin) {
    console.log("[ImageGalleryRenderer] Registering markdown post processor")
    plugin.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
        const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);

        if (!(file instanceof TFile)) {
            return;
        }

        const cache = plugin.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter) {
            return;
        }

        const imagesRaw = frontmatter[FrontmatterKeys.EloImages] || [];

        // Parse Photos (elo-bridge format) -> URLs
        // Format: elo-bridge://id=...&name=... or straight http/https
        const allImages: string[] = [];
        if (Array.isArray(imagesRaw)) {
            // console.log('[ImageGalleryRenderer] Found Photos field:', imagesRaw);
            const regex = /elo-bridge:\/\/id=([^&]+)/;
            imagesRaw.forEach((entry: string) => {
                if (entry.startsWith('elo-bridge://')) {
                    const match = entry.match(regex);
                    if (match && match[1]) {
                        const id = match[1];
                        const url = `http://localhost:27345/image?id=${id}`;
                        // console.log('[ImageGalleryRenderer] Generated URL from bridge link:', url);
                        allImages.push(url);
                    } else {
                        console.log('[ImageGalleryRenderer] Failed to parse bridge link:', entry);
                    }
                } else if (entry.startsWith('http')) {
                    allImages.push(entry);
                }
            });
        }

        if (allImages.length === 0) {
            return;
        }

        // Avoid rendering multiple times
        if (element.querySelector('.elo-image-gallery-container')) {
            console.log('[ImageGalleryRenderer] Gallery already exists, skipping.');
            return;
        }

        // Logic to render only near the top (similar to GoogleMapsRenderer)
        const frontmatterEndLine = frontmatter.position?.end.line ?? -1;
        const sectionInfo = context.getSectionInfo(element);
        if (!sectionInfo) return;

        const currentLine = sectionInfo.lineStart;

        // Render if within 5 lines of frontmatter end or if it's the first element
        if (currentLine > frontmatterEndLine + 5) {
            return;
        }

        // console.log('[ImageGalleryRenderer] Rendering gallery for:', file.basename);
        console.log('[ImageGalleryRenderer] Rendering gallery for:', file.basename, 'with images:', allImages);

        const container = element.createDiv({ cls: 'elo-image-gallery-container' });
        container.style.marginTop = '10px';
        container.style.marginBottom = '20px';
        container.style.display = 'grid';
        container.style.gap = '10px';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        container.style.width = '100%';

        allImages.forEach((url: string) => {
            // Basic URL validation
            if (typeof url !== 'string' || !url.startsWith('http')) return;

            const imgContainer = container.createDiv({ cls: 'elo-gallery-item' });
            imgContainer.style.overflow = 'hidden';
            imgContainer.style.borderRadius = '8px';
            imgContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            imgContainer.style.aspectRatio = '9/16';

            const img = imgContainer.createEl('img');
            img.src = url;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.cursor = 'pointer';
            img.style.transition = 'transform 0.2s';

            // Simple click to open in new tab (or fancy lightbox if we had one)
            img.addEventListener('click', () => {
                window.open(url, '_blank');
            });

            // Simple hover effect
            img.onmouseenter = () => img.style.transform = 'scale(1.05)';
            img.onmouseleave = () => img.style.transform = 'scale(1)';
        });
    });
}
