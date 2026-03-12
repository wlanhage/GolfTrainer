import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadNavigateFromMenu() {
  const source = fs.readFileSync(new URL('../src/app/navigation/menuNavigation.ts', import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: () => ({}) });
  vm.runInContext(transpiled, context);
  return module.exports.navigateFromMenu;
}

describe('navigateFromMenu', () => {
  it('uses parent navigator to navigate before closing the menu', () => {
    const navigateFromMenu = loadNavigateFromMenu();
    const callOrder = [];

    const rootNavigation = {
      navigate(route) {
        callOrder.push(`navigate:${route}`);
      }
    };

    const menuNavigation = {
      getParent() {
        return rootNavigation;
      },
      navigate(route) {
        callOrder.push(`local:${route}`);
      },
      goBack() {
        callOrder.push('goBack');
      }
    };

    navigateFromMenu(menuNavigation, 'Profile');

    assert.deepEqual(callOrder, ['navigate:Profile', 'goBack']);
  });

  it('falls back to local navigation if parent navigator is unavailable', () => {
    const navigateFromMenu = loadNavigateFromMenu();
    const callOrder = [];

    const menuNavigation = {
      getParent() {
        return undefined;
      },
      navigate(route) {
        callOrder.push(`local:${route}`);
      },
      goBack() {
        callOrder.push('goBack');
      }
    };

    navigateFromMenu(menuNavigation, 'TrainingList', (callback) => {
      callOrder.push('scheduled');
      callback();
    });

    assert.deepEqual(callOrder, ['goBack', 'scheduled', 'local:TrainingList']);
  });
});
