import * as esbuild from 'esbuild';
const options = {
  entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', format: 'cjs',
  target: 'node22', external: ['vscode'], outfile: 'dist/extension.js',
  sourcemap: true, minify: false,
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log('Watching extension sources...');
} else {
  await esbuild.build(options);
}
