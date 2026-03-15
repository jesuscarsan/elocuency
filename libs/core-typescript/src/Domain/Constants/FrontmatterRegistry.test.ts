import { describe, it, expect } from 'vitest';
import { FrontmatterKeys, FrontmatterRegistry, setFrontmatterRegistry } from './FrontmatterRegistry';

describe('FrontmatterRegistry', () => {
    it('should be initially empty', () => {
        expect(Object.keys(FrontmatterRegistry)).toHaveLength(0);
        expect(FrontmatterKeys.municipality).toBeUndefined();
    });

    it('should allow setting the registry', () => {
        setFrontmatterRegistry({
            "municipality": {
                "key": "municipality",
                "description": "Nombre del municipio",
                "type": "string"
            }
        });

        expect(FrontmatterRegistry['municipality']).toBeDefined();
        expect(FrontmatterRegistry['municipality'].key).toBe('municipality');
        expect(FrontmatterKeys.municipality).toBe('municipality');
    });
});
