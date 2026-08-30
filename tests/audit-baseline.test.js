import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildInventory } from '../scripts/audit-baseline.mjs';

test('buildInventory classifies pages, components, functions and risks', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zuccaro-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, 'src', 'pages'), { recursive: true });
  await mkdir(path.join(root, 'src', 'components'), { recursive: true });
  await mkdir(path.join(root, 'base44', 'functions', 'guard'), { recursive: true });
  await mkdir(path.join(root, 'base44', 'entities'), { recursive: true });

  await writeFile(path.join(root, 'src', 'pages', 'Dashboard.jsx'), '<button data-action="open" data-permission="Dashboard.visualizar">Open</button>');
  await writeFile(path.join(root, 'src', 'components', 'Legacy.old.jsx'), `export default '${'\u00c3'}';\n${'x\n'.repeat(601)}`);
  await writeFile(path.join(root, 'base44', 'functions', 'guard', 'entry.ts'), 'export {};');
  await writeFile(path.join(root, 'base44', 'entities', 'config.jsonc'), '{}');

  const inventory = await buildInventory(root);

  assert.equal(inventory.summary.pages, 1);
  assert.equal(inventory.summary.components, 1);
  assert.equal(inventory.summary.functions, 1);
  assert.equal(inventory.summary.entitiesWithLocalSchema, 1);
  assert.equal(inventory.summary.filesOver600Lines, 1);
  assert.equal(inventory.summary.filesWithEncodingMarkers, 1);
  assert.equal(inventory.summary.legacyCandidates, 1);
  assert.equal(inventory.summary.interactiveControls, 1);
  assert.equal(inventory.summary.controlsWithActionMarker, 1);
  assert.equal(inventory.summary.controlsWithPermissionMarker, 1);
});
