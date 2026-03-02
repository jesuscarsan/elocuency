import { App, Vault, TFile, TFolder, TAbstractFile } from 'obsidian';
import { LocationPathBuilder } from './LocationPathBuilder';
import { PlaceMetadata } from "@elo/core";
import { GeocodingResponse } from "@elo/core";

// Mocking Obsidian classes
const mockVault = {
    getAbstractFileByPath: jest.fn(),
};

const mockApp = {
    vault: mockVault,
} as unknown as App;

describe('LocationPathBuilder', () => {
    let builder: LocationPathBuilder;

    beforeEach(() => {
        builder = new LocationPathBuilder(mockApp);
        jest.clearAllMocks();
    });

    const mockMetadata: PlaceMetadata = {
        continent: 'Europa',
        isRegionFamous: false,
    };

    it('should build a standard path correctly', () => {
        const details: GeocodingResponse = {
            municipio: 'MunicipioTest',
            provincia: 'ProvinciaTest',
            region: 'RegionTest',
            pais: 'España',
        };

        const path = builder.buildPath('NotaTest', details, mockMetadata);
        // Expect: Lugares/Europa/España/RegionTest/ProvinciaTest/MunicipioTest/NotaTest.md
        expect(path).toBe('Lugares/Europa/España/RegionTest/ProvinciaTest/MunicipioTest/NotaTest/NotaTest.md');
    });

    it('should handle the "Municipality equals Province" case correctly by adding (Ciudad) to both folder and file', () => {
        const details: GeocodingResponse = {
            municipio: 'Madrid',
            provincia: 'Madrid',
            region: 'Comunidad de Madrid',
            pais: 'España',
        };

        const path = builder.buildPath('Madrid', details, mockMetadata);
        // Expect: Lugares/Europa/España/Comunidad de Madrid/Madrid/Madrid (Ciudad)/Madrid (Ciudad).md
        expect(path).toBe('Lugares/Europa/España/Comunidad de Madrid/Madrid/Madrid (Ciudad)/Madrid (Ciudad).md');
    });

    it('should handle case insensitivity for "Municipality equals Province" check', () => {
        const details: GeocodingResponse = {
            municipio: 'madrid',
            provincia: 'Madrid',
            region: 'Comunidad de Madrid',
            pais: 'España',
        };

        const path = builder.buildPath('Madrid', details, mockMetadata);
        // Expect: Lugares/Europa/España/Comunidad de Madrid/Madrid/Madrid (Ciudad)/Madrid (Ciudad).md
        // Note: The builder uses the details values for folders usually, let's see how it behaves. 
        // Ideally it should normalize casing or use the provided details. 
        // Based on current implementation logic, it uses details.municipio for folder.
        // But for the check it should be case insensitive.

        // If the implementation keeps lowercase 'madrid' in folder, that's one thing, 
        // but the file and last folder should match the (Ciudad) rule.
        // Let's assume the user wants clean output, but for now we test the structural logic.
        expect(path).toContain('Madrid (Ciudad)/Madrid (Ciudad).md');
    });


    it('should correct "badly written" file names matching municipality', () => {
        const details: GeocodingResponse = {
            municipio: 'San Sebastián',
            provincia: 'Guipúzcoa',
            region: 'País Vasco',
            pais: 'España',
        };

        const path = builder.buildPath('san sebastian', details, mockMetadata);
        // Should rename file to San Sebastián.md
        expect(path.endsWith('San Sebastián/San Sebastián.md')).toBe(true);
    });

    it('should NOT correct completely different file names', () => {
        const details: GeocodingResponse = {
            municipio: 'San Sebastián',
            provincia: 'Guipúzcoa',
            region: 'País Vasco',
            pais: 'España',
        };

        const path = builder.buildPath('La playa de la concha', details, mockMetadata);
        // Should keep original name: San Sebastián/La playa de la concha.md
        expect(path.endsWith('San Sebastián/La playa de la concha/La playa de la concha.md')).toBe(true);
    });

    it('should include region even if not Spain, not famous, and folder does not exist', () => {
        const details: GeocodingResponse = {
            municipio: 'Mun',
            provincia: 'Prov',
            region: 'Reg',
            pais: 'Francia',
        };

        mockVault.getAbstractFileByPath.mockReturnValue(null); // Folder does not exist

        const path = builder.buildPath('Nota', details, mockMetadata);
        // Expect: Lugares/Europa/Francia/Reg/Prov/Mun/Nota.md
        expect(path).toBe('Lugares/Europa/Francia/Reg/Prov/Mun/Nota/Nota.md');
    });

    it('should handle Belgian structure with Region correctly', () => {
        const details: GeocodingResponse = {
            municipio: 'Waterloo',
            provincia: 'Brabante Valón',
            region: 'Región Valona',
            pais: 'Bélgica',
        };

        const path = builder.buildPath('Waterloo', details, mockMetadata);
        // Expect: Lugares/Europa/Bélgica/Región Valona/Brabante Valón/Waterloo/Waterloo.md
        expect(path).toBe('Lugares/Europa/Bélgica/Región Valona/Brabante Valón/Waterloo/Waterloo.md');
    });

    it('should include region if folder exists even if not Spain/Famous', () => {
        const details: GeocodingResponse = {
            municipio: 'Mun',
            provincia: 'Prov',
            region: 'Reg',
            pais: 'Francia',
        };

        // Mock that region folder exists
        // The builder checks parts + region. 
        // Lugares/Europa/Francia/Reg
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Lugares/Europa/Francia/Reg') return {} as TFolder;
            return null;
        });

        const path = builder.buildPath('Nota', details, mockMetadata);
        expect(path).toBe('Lugares/Europa/Francia/Reg/Prov/Mun/Nota/Nota.md');
    });
});
