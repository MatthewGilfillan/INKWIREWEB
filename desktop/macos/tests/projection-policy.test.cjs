const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../projection-policy.js');
const policy = globalThis.InkWireProjectionPolicy;

const fixture = () => ({ userId: 'teacher', teacher: true, board: {
  id: 'board', title: 'Venn Diagram', template: 'venn-diagram', published: true, open: true,
  audience: 'class', canWrite: true, roster: [{ name: 'Private roster' }],
  reviews: [{ feedback: 'Private assessment' }], reflections: [{ answer: 'Private reflection' }],
  exitQuestion: 'Private question', ownName: 'Teacher', unknownPrivateField: 'Future private value',
  teams: [{ id: 'team', name: 'Blue', color: 'blue', count: 2, members: ['private-id'] }],
  posts: [{ id: 'post', text: 'Shared idea', editable: true, own: true, learnerId: 'private-id', contributorIds: ['private-id'],
    comments: [{ id: 'comment', text: 'Shared reply' }, { id: 'removed', text: 'Removed reply', deleted: true }] },
    { id: 'removed', text: 'Removed post', deleted: true }]
}});

test('classroom projection retains shared evidence and removes private assessment and editing data', () => {
  const source = fixture();
  const result = policy.board(source);
  assert.equal(result.teacher, false);
  assert.equal(result.board.canWrite, false);
  assert.deepEqual(result.board.reviews, []);
  assert.deepEqual(result.board.reflections, []);
  assert.deepEqual(result.board.roster, []);
  assert.equal(result.board.unknownPrivateField, undefined);
  assert.equal(result.board.teams[0].members, undefined);
  assert.equal(result.board.posts[0].learnerId, undefined);
  assert.equal(result.board.posts[0].contributorIds, undefined);
  assert.equal(result.board.posts[0].editable, false);
  assert.deepEqual(result.board.posts.map(p => p.text), ['Shared idea']);
  assert.deepEqual(result.board.posts[0].comments.map(p => p.text), ['Shared reply']);
  assert.equal(source.board.canWrite, true, 'the teacher response must not be mutated');
});

test('drafts, teacher-only boards, archived boards and unrevealed rankings stay off the projector', () => {
  for (const change of [{ published: false }, { audience: 'teachers' }, { archived: true }, { rankingItems: [{}], revealRankings: false }]) {
    const value = fixture(); Object.assign(value.board, change);
    assert.equal(policy.board(value), null);
  }
});

test('ending a board still permits read-only final evidence and snapshot sanitization', () => {
  const value = fixture(); value.board.open = false; value.board.closedSnapshotId = 'saved';
  assert.equal(policy.board(value).board.closedSnapshotId, 'saved');
  const final = policy.snapshot({ userId: 'teacher', snapshot: { ...value.board, reviews: [{ private: true }] } });
  assert.deepEqual(final.snapshot.reviews, []);
  assert.deepEqual(final.snapshot.posts.map(p => p.text), ['Shared idea']);
  assert.equal(final.snapshot.posts[0].editable, false);
});
