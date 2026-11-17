/* Only shared classroom content is passed to the existing board renderer.
   This is a display surface, not a replacement for server authorization. */
(function (root) {
  const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]));
  const postKeys = ['id', 'title', 'text', 'url', 'imageId', 'authorName', 'appearance', 'teacher', 'pinned', 'teacherEdited', 'createdAt', 'updatedAt', 'stage', 'position', 'evidence', 'reference', 'reasoning', 'character', 'teamId', 'contributors', 'reactionCounts', 'likes', 'version'];
  const boardKeys = ['id', 'title', 'prompt', 'template', 'layout', 'published', 'open', 'archived', 'audience', 'background', 'backgroundImageId', 'settingsVersion', 'revision', 'createdAt', 'className', 'bookTitle', 'pypTheme', 'lessonId', 'standards', 'sectionLabels', 'closedSnapshotId', 'teamMode'];
  function posts(rows = []) {
    return rows.filter(post => !post.deleted && !post.moderated).map(post => ({
      ...pick(post, postKeys), editable: false, own: false, liked: false, reaction: null,
      comments: (post.comments || []).filter(comment => !comment.deleted && !comment.moderated).map(comment => ({
        ...pick(comment, ['id', 'text', 'authorName', 'appearance', 'teacher', 'createdAt', 'version']), own: false
      }))
    }));
  }
  function board(value) {
    const item = value?.board;
    if (!item?.published || item.archived || item.audience && item.audience !== 'class') return null;
    // Unrevealed ranking activities contain teacher-only comparison evidence.
    if ((item.rankingItems?.length || item.rankings?.length) && !item.revealRankings) return null;
    return {
      userId: value.userId, teacher: false,
      board: {
        ...pick(item, boardKeys), canWrite: false, replies: false, reactions: false,
        ownLearnerId: '', ownName: '', ownAppearance: {}, exitQuestion: '',
        roster: [], reviews: [], reflections: [], snapshots: [],
        teams: (item.teams || []).map(team => pick(team, ['id', 'name', 'color', 'count'])),
        rankingItems: item.revealRankings ? item.rankingItems || [] : [],
        rankings: item.revealRankings ? (item.rankings || []).map(row => pick(row, ['id', 'order', 'reasoning', 'reflection', 'createdAt', 'updatedAt', 'authorName', 'appearance'])) : [],
        revealRankings: !!item.revealRankings, posts: posts(item.posts)
      }
    };
  }
  function snapshot(value) {
    if (!value?.snapshot) return null;
    return { userId: value.userId, snapshot: {
      ...pick(value.snapshot, [...boardKeys, 'count', 'createdAt']), posts: posts(value.snapshot.posts),
      reviews: [], reflections: [], teams: [], rankings: []
    }};
  }
  root.InkWireProjectionPolicy = Object.freeze({ board, snapshot });
})(globalThis);
