const test = require('node:test');
const assert = require('node:assert/strict');

test('demo documents match teacher and learner pages, with isolated lessons and sections', async () => {
  const { demoDocument } = await import('../src/liveblocks-config.mjs');
  const first = demoDocument('Alex Lee|1|Discussion');
  assert.deepEqual(first, demoDocument('Alex Lee|1|Discussion'));
  assert.notEqual(first.roomId, demoDocument('Alex Lee|2|Discussion').roomId);
  assert.equal(first.roomId, demoDocument('Alex Lee|1|Writing').roomId);
  assert.notEqual(first.field, demoDocument('Alex Lee|1|Writing').field);
  for (const key of ['Another Learner|1|Writing', 'Alex Lee|1|Private', 'Alex Lee|0|Writing', 'Alex Lee|25|Writing', 'Alex Lee|1|Writing|extra']) {
    assert.equal(demoDocument(key), null);
  }
});

test('loading, offline, pending and failed connections never claim saved changes', async () => {
  const { sharedStatus } = await import('../src/liveblocks-config.mjs');
  assert.match(sharedStatus('connected', 'synchronized', false), /All changes saved/);
  for (const args of [['connecting','synchronized',false], ['connected','loading',false], ['reconnecting','synchronized',false], ['connected','synchronizing',false], ['connected','synchronized',true]]) {
    assert.doesNotMatch(sharedStatus(...args), /All changes saved/);
  }
});
