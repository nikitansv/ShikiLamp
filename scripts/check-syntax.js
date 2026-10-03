const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = [path.join(root, 'build.js')];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.name.endsWith('.js')) files.push(file);
  }
}

for (const directory of ['src', 'scripts', 'tests']) collect(path.join(root, directory));
for (const file of files) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
console.log('Syntax OK: ' + files.length + ' JavaScript files');
