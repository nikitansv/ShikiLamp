const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const UglifyJS = require('uglify-js');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'dist');
const entry = path.join(srcDir, 'index.js');
const outFile = path.join(outDir, 'plugin.js');

(async () => {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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
  code = minified.code || code;

  fs.writeFileSync(outFile, code, 'utf8');
  console.log(`Built ${outFile} (${Buffer.byteLength(code)} bytes)`);
})().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
