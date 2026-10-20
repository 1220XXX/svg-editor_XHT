import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';
import { MemoryStorage } from './MemoryStorage.js';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';

describe('saved SVG always contains legal XML text', () => {
  it.each(['\u0000','\u0001','\uD800','\uFFFE'])('rejects illegal XML code points atomically (%j)', async illegal => {
    const e = new TestEditor(); await e.setup('init','create text t 1 2 "valid"');
    const before = await e.run('tree');
    expect(await e.run(`set t text "bad${illegal}text"`)).toMatch(/^error: invalid XML character in text/);
    expect(await e.run('tree')).toBe(before);
    expect(await e.run(`set t fill "red${illegal}"`)).toMatch(/^error: invalid XML character/);
  });
  it('retains valid supplementary Unicode through save and read', async () => {
    const storage = new MemoryStorage(); const codec = new SvgCodec(new ShapeFactory());
    const e = new TestEditor(storage, codec); await e.setup('init','create text t 1 2 "中文 😀 & < >"','save unicode.svg','read unicode.svg');
    expect(await e.run('show t')).toContain('中文 😀 & < >');
  });
});
