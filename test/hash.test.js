import { describe, it, expect } from 'vitest';
import { hash8 } from '../lib/hash.js';

describe('hash8', () => {
    it('is deterministic', () => {
        expect(hash8('hello/world.png')).toBe(hash8('hello/world.png'));
    });

    it('returns exactly 8 lowercase hex digits', () => {
        for (const s of ['', 'a', 'a/b/c.jpg', 'x'.repeat(500)]) {
            expect(hash8(s)).toMatch(/^[0-9a-f]{8}$/);
        }
    });

    it('distinguishes distinct inputs (spot check)', () => {
        const seen = new Set(['a', 'b', 'ab', 'ba', 'trip/rome', 'trip/paris'].map(hash8));
        expect(seen.size).toBe(6);
    });

    it('matches a hand-computed FNV-1a vector', () => {
        // FNV-1a 32-bit of "a": ((2166136261 ^ 97) * 16777619) >>> 0 = 0xE40C292C
        expect(hash8('a')).toBe('e40c292c');
        // "" -> the unmodified offset basis 2166136261 = 0x811C9DC5
        expect(hash8('')).toBe('811c9dc5');
    });
});
