import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = path.resolve('dist/assets');
const reportPath = path.resolve('dist/bundle-size-report.md');

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

const main = async () => {
  let files;
  try {
    files = await fs.readdir(distDir);
  } catch {
    console.error(`Missing build output directory: ${distDir}`);
    process.exit(1);
  }

  const assetFiles = files.filter((file) => /\.(js|css)$/.test(file));

  const rows = await Promise.all(
    assetFiles.map(async (file) => {
      const filePath = path.join(distDir, file);
      const content = await fs.readFile(filePath);
      return {
        file,
        rawSize: content.byteLength,
        gzipSize: gzipSync(content).byteLength,
      };
    }),
  );

  rows.sort((a, b) => b.rawSize - a.rawSize);

  const totalRaw = rows.reduce((sum, row) => sum + row.rawSize, 0);
  const totalGzip = rows.reduce((sum, row) => sum + row.gzipSize, 0);

  const topRows = rows.slice(0, 10);

  const markdown = [
    '# Bundle Size Report',
    '',
    `- Total JS/CSS assets: ${rows.length}`,
    `- Total raw size: ${formatSize(totalRaw)}`,
    `- Total gzip size: ${formatSize(totalGzip)}`,
    '',
    '## Top 10 largest assets',
    '',
    '| Asset | Raw size | Gzip size |',
    '| --- | ---: | ---: |',
    ...topRows.map((row) => `| ${row.file} | ${formatSize(row.rawSize)} | ${formatSize(row.gzipSize)} |`),
    '',
  ].join('\n');

  await fs.writeFile(reportPath, markdown, 'utf8');
  console.log(markdown);
};

await main();
