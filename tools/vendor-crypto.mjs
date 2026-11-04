// Copy the pinned dependency graph, retaining MIT notices and rewriting only imports.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), seen = new Set();
const packageRoot = name => path.join(root, 'node_modules/@noble', name);
const vendorPath = (name, file) => path.join(root, 'dist/vendor', name, file);
async function visit(name, file) {
  const key = name + '/' + file; if (seen.has(key)) return; seen.add(key);
  let source = await readFile(path.join(packageRoot(name), file), 'utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const specifier = match[1]; let dependencyName = name, dependencyFile;
    if (specifier.startsWith('@noble/')) {
      const [, named, ...rest] = specifier.split('/');
      dependencyName = named; dependencyFile = rest.join('/');
    } else if (specifier.startsWith('.')) dependencyFile = path.normalize(path.join(path.dirname(file), specifier));
    else throw new Error('Unexpected dependency: ' + specifier);
    if (dependencyFile.startsWith('..')) throw new Error('Dependency escaped its package.');
    await visit(dependencyName, dependencyFile);
    let relative = path.relative(path.dirname(vendorPath(name, file)), vendorPath(dependencyName, dependencyFile));
    if (!relative.startsWith('.')) relative = './' + relative;
    source = source.replaceAll("'" + specifier + "'", "'" + relative + "'").replaceAll('"' + specifier + '"', '"' + relative + '"');
  }
  source = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  await mkdir(path.dirname(vendorPath(name, file)), {recursive:true});
  await writeFile(vendorPath(name, file), source);
}
await visit('curves','ed25519.js');
await visit('hashes','sha2.js');
for (const name of ['curves','hashes']) {
  await writeFile(vendorPath(name,'LICENSE'), await readFile(path.join(packageRoot(name),'LICENSE')));
}
await writeFile(path.join(root,'dist/vendor/NOTICE.txt'),
  'Vendored @noble/curves 2.4.0 and @noble/hashes 2.4.0.\nMIT licenses are retained in their respective directories.\nOnly module import paths and source-map comments are changed.\n');
console.log('Vendored ' + seen.size + ' pinned modules.');
