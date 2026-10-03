const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const UglifyJS = require('uglify-js');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'docs');
const entry = path.join(srcDir, 'index.js');
const outFile = path.join(outDir, 'plugin.js');
const docsFile = path.join(docsDir, 'ShikiLamp.js');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    write: false,
    globalName: 'ShikimoriLocalPlugin',
    platform: 'browser',
    target: 'es2018'
  });

  let code = result.outputFiles[0].text;
  const minified = UglifyJS.minify(code, {
    compress: false,
    mangle: false,
    output: { comments: /^!/ }
  });
  if (minified.error) throw minified.error;
  code = minified.code;

  fs.writeFileSync(outFile, code, 'utf8');
  fs.writeFileSync(docsFile, code, 'utf8');
  console.log(`Built ${outFile} (${Buffer.byteLength(code)} bytes)`);
})().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
