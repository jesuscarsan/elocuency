import { App, normalizePath } from 'obsidian';
import { GeocodingResponse } from '@elo/core';
import { PlaceMetadata } from '@elo/core';

export { PlaceMetadata }; // Re-export if needed elsewhere, but better to import from Domain directly. 
// Actually, checking if it is used elsewhere.


export class LocationPathBuilder {
    constructor(private readonly app: App) { }

    buildPath(
        placeName: string,
        details: GeocodingResponse,
        metadata: PlaceMetadata
    ): string {
        const municipio = details.municipio?.trim();
        const provincia = details.provincia?.trim();
        const region = details.region?.trim();
        const pais = details.pais?.trim();

        const placeNameTrimmed = placeName.trim();

        const { continent, isRegionFamous } = metadata;

        // Base path: Lugares/Continente/País
        const parts = ['Lugares', continent, pais];

        // Region logic
        if (region) parts.push(region);

        // Province logic
        if (provincia) parts.push(provincia);

        // Municipality logic (Folder)
        if (municipio) {
            let municipioFolder = municipio;
            const isCitySameAsProvince = provincia && municipio.localeCompare(provincia, undefined, { sensitivity: 'base' }) === 0;

            if (isCitySameAsProvince && provincia) {
                municipioFolder = `${provincia} (Ciudad)`;
            }
            parts.push(municipioFolder);
        }

        // File name logic (Disambiguation & Correction)
        let fileName = `${placeNameTrimmed}.md`;

        if (municipio) {
            // Only rename if the current name is "badly written" version of the municipality
            // (e.g. "san sebastian" -> "San Sebastián")
            // If it's a completely different name (e.g. "La playa de la concha"), keep it.
            const isSameName = placeNameTrimmed.localeCompare(municipio, undefined, { sensitivity: 'base' }) === 0;

            if (isSameName) {
                // If it's the same name, use the proper municipality casing
                let cleanName = municipio;
                if (provincia && municipio.localeCompare(provincia, undefined, { sensitivity: 'base' }) === 0) {
                    cleanName = `${provincia} (Ciudad)`;
                }
                fileName = `${cleanName}.md`;
            }
        }


        // Ensure the note is always inside a folder with the same name
        const cleanParts = parts.filter(p => !!p && p.length > 0);
        const lastFolder = cleanParts.length > 0 ? cleanParts[cleanParts.length - 1] : '';
        const targetFolderName = fileName.replace(/\.md$/, '');

        // Comparison should probably be exact or case-insensitive depending on OS, 
        // but typically "Same Name" implies exact match or at least visually identical.
        // We'll use exact match for simple string equality to decide if we need a new folder.
        // However, if we just renamed the file to 'San Sebastián.md' (lines 50-62), 
        // and the folder is 'San Sebastián' (line 37), they match.

        if (lastFolder !== targetFolderName) {
            cleanParts.push(targetFolderName);
        }

        return normalizePath([...cleanParts, fileName].join('/'));
    }

    private folderExists(path: string): boolean {
        const normalized = normalizePath(path);
        const file = this.app.vault.getAbstractFileByPath(normalized);
        return !!file;
    }
}
