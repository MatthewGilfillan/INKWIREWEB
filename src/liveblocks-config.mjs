// Public development project key. Never put a Liveblocks secret key here.
export const publicApiKey = 'pk_dev_aLkhvmcCawGNMlcSSfVwXU_vpb5hby_bNl3BIce8erNv8tYw2a2AVo3pQzv8BieJ';

// Deliberately limited to the fictional demonstration enrollment.
// This maps documents; it does NOT authorize access to them.
export function demoDocument(key) {
  const match = /^Alex Lee\|(\d+)\|(Discussion|Writing|Reflection|Homework)$/.exec(key);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 24) return null;
  return {
    roomId: `inkwire-demo-v1-alex-lesson-${Number(match[1])}`,
    field: match[2].toLowerCase(),
  };
}

export function sharedStatus(connection, provider, error) {
  if (error) return 'Connection unavailable — check the Liveblocks project settings.';
  if (connection === 'reconnecting' || connection === 'disconnected') return 'Reconnecting — keep this page open.';
  if (connection !== 'connected' || provider === 'loading') return 'Connecting to the shared page…';
  if (provider === 'synchronizing') return 'Saving shared changes…';
  return 'All changes saved to the shared demo';
}
