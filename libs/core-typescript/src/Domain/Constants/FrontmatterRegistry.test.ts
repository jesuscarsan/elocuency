import { describe, it, expect } from 'vitest';
import { FrontmatterKeys, FrontmatterRegistry, setFrontmatterRegistry } from './FrontmatterRegistry';

describe('FrontmatterRegistry', () => {
    it('should be initially empty', () => {
        expect(Object.keys(FrontmatterRegistry)).toHaveLength(0);
        expect(FrontmatterKeys.Municipio).toBeUndefined();
    });

    it('should allow setting the registry', () => {
        setFrontmatterRegistry({
            "Municipio": {
                "key": "Municipio",
                "description": "Nombre del municipio",
                "type": "string"
            }
        });

        expect(FrontmatterRegistry['Municipio']).toBeDefined();
        expect(FrontmatterRegistry['Municipio'].key).toBe('Municipio');
        expect(FrontmatterKeys.Municipio).toBe('Municipio');
    });
});
