import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: () => ({}) });
  vm.runInContext(transpiled, context);
  return module.exports;
}

describe('play round logic', () => {
  it('calculates relative score against par', () => {
    const { getRelativeToPar } = loadModule('../src/features/play/utils/roundLogic.ts');

    const value = getRelativeToPar([
      { parSnapshot: 4, strokes: 5 },
      { parSnapshot: 3, strokes: 3 },
      { parSnapshot: 5, strokes: 4 }
    ]);

    assert.equal(value, 0);
  });

  it('returns null if no par snapshots exist', () => {
    const { getRelativeToPar } = loadModule('../src/features/play/utils/roundLogic.ts');
    assert.equal(getRelativeToPar([{ parSnapshot: null, strokes: 4 }]), null);
  });
});
