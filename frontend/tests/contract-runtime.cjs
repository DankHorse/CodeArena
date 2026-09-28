// Contract regressions without a running backend or changes to browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function runtime(demo, fetch, overrides = {}, storage = new Map()) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.VITE_DEMO', JSON.stringify(String(demo)));
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
      exports, require: name => overrides[name] ?? load(path.resolve(path.dirname(file), name)), fetch, URL, URLSearchParams, Error,
      crypto: require('node:crypto').webcrypto, FormData: overrides.FormData ?? FormData,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    }, { filename: file });
    return exports;
  }
  return file => load(path.join(root, file));
}

module.exports = { runtime };
