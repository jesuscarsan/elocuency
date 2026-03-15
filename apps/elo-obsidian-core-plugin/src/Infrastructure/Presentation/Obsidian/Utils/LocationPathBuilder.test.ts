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

    it('should build a standard path correctly with default "Mi mundo"', () => {
        const details: GeocodingResponse = {
            municipality: 'MunicipioTest',
            province: 'ProvinciaTest',
            region: 'RegionTest',
            country: 'España',
        };

        const path = builder.buildPath('NotaTest', details, mockMetadata);
        // Expect: Mi mundo/Europa/España/RegionTest/ProvinciaTest/MunicipioTest/NotaTest/NotaTest.md
        expect(path).toBe('Mi mundo/Europa/España/RegionTest/ProvinciaTest/MunicipioTest/NotaTest/NotaTest.md');
    });

    it('should build path with custom locations folder', () => {
        const details: GeocodingResponse = {
            municipality: 'MunicipioTest',
            province: 'ProvinciaTest',
            region: 'RegionTest',
            country: 'España',
        };

        const path = builder.buildPath('NotaTest', details, mockMetadata, 'CustomPlaces');
        expect(path.startsWith('CustomPlaces/')).toBe(true);
    });

    it('should handle the "Municipality equals Province" case correctly by adding (Ciudad) to both folder and file', () => {
        const details: GeocodingResponse = {
            municipality: 'Madrid',
            province: 'Madrid',
            region: 'Comunidad de Madrid',
            country: 'España',
        };

        const path = builder.buildPath('Madrid', details, mockMetadata);
        // Expect: Mi mundo/Europa/España/Comunidad de Madrid/Madrid/Madrid (Ciudad)/Madrid (Ciudad).md
        expect(path).toBe('Mi mundo/Europa/España/Comunidad de Madrid/Madrid/Madrid (Ciudad)/Madrid (Ciudad).md');
    });

    it('should handle case insensitivity for "Municipality equals Province" check', () => {
        const details: GeocodingResponse = {
            municipality: 'madrid',
            province: 'Madrid',
            region: 'Comunidad de Madrid',
            country: 'España',
        };

        const path = builder.buildPath('Madrid', details, mockMetadata);
        expect(path).toContain('Madrid (Ciudad)/Madrid (Ciudad).md');
    });


    it('should correct "badly written" file names matching municipality', () => {
        const details: GeocodingResponse = {
            municipality: 'San Sebastián',
            province: 'Guipúzcoa',
            region: 'País Vasco',
            country: 'España',
        };

        const path = builder.buildPath('san sebastian', details, mockMetadata);
        // Should rename file to San Sebastián.md
        expect(path.endsWith('San Sebastián/San Sebastián.md')).toBe(true);
    });

    it('should NOT correct completely different file names', () => {
        const details: GeocodingResponse = {
            municipality: 'San Sebastián',
            province: 'Guipúzcoa',
            region: 'País Vasco',
            country: 'España',
        };

        const path = builder.buildPath('La playa de la concha', details, mockMetadata);
        // Should keep original name: San Sebastián/La playa de la concha.md
        expect(path.endsWith('San Sebastián/La playa de la concha/La playa de la concha.md')).toBe(true);
    });

    it('should include region even if not Spain, not famous, and folder does not exist', () => {
        const details: GeocodingResponse = {
            municipality: 'Mun',
            province: 'Prov',
            region: 'Reg',
            country: 'Francia',
        };

        mockVault.getAbstractFileByPath.mockReturnValue(null); // Folder does not exist

        const path = builder.buildPath('Nota', details, mockMetadata);
        // Expect: Mi mundo/Europa/Francia/Reg/Prov/Mun/Nota.md
        expect(path).toBe('Mi mundo/Europa/Francia/Reg/Prov/Mun/Nota/Nota.md');
    });

    it('should handle Belgian structure with Region correctly', () => {
        const details: GeocodingResponse = {
            municipality: 'Waterloo',
            province: 'Brabante Valón',
            region: 'Región Valona',
            country: 'Bélgica',
        };

        const path = builder.buildPath('Waterloo', details, mockMetadata);
        // Expect: Mi mundo/Europa/Bélgica/Región Valona/Brabante Valón/Waterloo/Waterloo.md
        expect(path).toBe('Mi mundo/Europa/Bélgica/Región Valona/Brabante Valón/Waterloo/Waterloo.md');
    });

    it('should include region if folder exists even if not Spain/Famous', () => {
        const details: GeocodingResponse = {
            municipality: 'Mun',
            province: 'Prov',
            region: 'Reg',
            country: 'Francia',
        };

        // Mock that region folder exists
        // The builder checks parts + region. 
        // Mi mundo/Europa/Francia/Reg
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Mi mundo/Europa/Francia/Reg') return {} as TFolder;
            return null;
        });

        const path = builder.buildPath('Nota', details, mockMetadata);
        expect(path).toBe('Mi mundo/Europa/Francia/Reg/Prov/Mun/Nota/Nota.md');
    });
});
