// Local-only static server used by diploma review generation and browser tests.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const defaultRoot = path.resolve(__dirname, '..');
async function createHarness({ rootDir = defaultRoot } = {}) {
  const root = path.resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const content = await fs.readFile(file), extension = path.extname(file);
      const types = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
      res.setHeader('Content-Type', types[extension] || 'text/html'); res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  return { browser, base, async close() { await browser.close(); await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { createHarness };
