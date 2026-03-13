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

describe('play metadata validation', () => {
  it('accepts nullable or valid values', () => {
    const { validateHoleMetaValues } = loadModule('../src/features/play/utils/validation.ts');
    assert.equal(validateHoleMetaValues({ par: 4, length: 320, hcpIndex: 8 }), null);
    assert.equal(validateHoleMetaValues({ par: null, length: null, hcpIndex: null }), null);
  });

  it('rejects invalid hcp index', () => {
    const { validateHoleMetaValues } = loadModule('../src/features/play/utils/validation.ts');
    assert.equal(validateHoleMetaValues({ hcpIndex: 19 }), 'HCP-index måste vara mellan 1 och 18.');
  });
});
