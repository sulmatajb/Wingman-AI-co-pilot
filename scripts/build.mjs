import { mkdir, copyFile, rm } from 'node:fs/promises';

const files = ['index.html', 'styles.css', 'cards.js', 'app.js', 'example.js', 'example.json'];
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const file of files) {
  await copyFile(new URL(`../viewer/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
console.log(`Built ${files.length} public files. Server code and credentials are excluded.`);
