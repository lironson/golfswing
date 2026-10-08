import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// index.html loads css/js with a ?v= version so browsers don't mix cached old files with
// new HTML after a release. Every module must be versioned, all with the same version.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('every JS module and the stylesheet share one asset version', () => {
  const versions = [...html.matchAll(/\?v=([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(versions.length > 0, 'no versioned asset URLs found');
  assert.equal(new Set(versions).size, 1, `mixed versions: ${[...new Set(versions)].join(', ')}`);
  assert.match(html, /href="css\/styles\.css\?v=/);
  assert.match(html, /src="js\/app\.js\?v=/);
});

test('import map covers every module in js/', () => {
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const f of readdirSync(new URL('../js/', import.meta.url)).filter((n) => n.endsWith('.js') && n !== 'app.js')) {
    assert.ok(map[`./js/${f}`], `js/${f} is missing from the import map in index.html`);
    assert.match(map[`./js/${f}`], new RegExp(`^\\./js/${f.replace('.', '\\.')}\\?v=`));
  }
});
