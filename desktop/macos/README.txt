Ink Wire LMS — macOS classroom beta 0.3.0

Authoritative app source now lives beside the website in this release repository.
Build: zsh desktop/macos/build.sh
Open: desktop/macos/build/Ink Wire LMS.app
Target: Apple silicon, macOS 14 or later.

The app loads https://inkwire-education.com/notebooks and the same authenticated
website, data and access rules. It does not carry a separate classroom database.
The existing online.inkwire.inknote bundle identifier is intentionally retained
to preserve the existing WebKit sign-in/profile when changing the product name.
Browser and native-app sign-in sessions are independent. No passwords are bundled.

Same-site board popups open in resizable native windows, with the green fullscreen
control. They share the WebKit website data store. External links open in the
default browser. Uploads and downloads use native panels. Audio starts through a
user action. Closing a child window leaves the main workspace open. Closing a
window is not an End lesson command. Unsaved-change checks cover child windows
as well as the main notebook when quitting.

This build is locally ad-hoc signed. Developer ID distribution signing,
notarization and an automatic-update service are not configured in this beta.
The app displays the deployed website: local web changes are not made live merely
by rebuilding the app. Use the isolated review build to test an undeployed web
candidate. Live sign-in with Matthew's account remains an acceptance check; local
checks used fictional accounts and did not enter or change production credentials.

Windows is deferred at Matthew's request, 16 November 2026.

Workspace layouts
-----------------
Choose a preset from the native toolbar or Workspace menu:

• Focus — gives the notebook the available screen area and hides notebook
  navigation. The sidebar toolbar button can bring navigation back.
• Teaching desk — places the teacher workspace and classroom display beside
  each other. On small screens the windows overlap instead of becoming unusable.
• Two displays — keeps the teacher workspace on its current screen and places
  the classroom display on another connected screen. The previously selected
  classroom screen is preferred when available. With only one display connected,
  the app uses the Teaching desk arrangement and explains the fallback.

The chosen preset and window positions are remembered. Classroom content is NOT
restored automatically when reopening the app. A display always starts at Standby.
The Window menu lists both windows and provides native fullscreen (Control-Cmd-F),
Minimize and Zoom. Both windows have normal resizable macOS frames and green
fullscreen controls. Moving a display window never ends the lesson or Live Board.
Changing layouts while fullscreen first returns the windows to their normal frames.

Classroom display
-----------------
1. Open a notebook page containing a Live Board, or open a board in its own window.
2. Open the board to the class using the website's teacher controls.
3. Use the toolbar display icon or Workspace > Show Live Board on Classroom
   Display. If the page contains several boards, choose which one to show.
4. Move the display to the projector, or use Two displays, then use its green
   fullscreen control. The teacher workspace remains separate.
5. Workspace > Blank Classroom Display (Shift-Cmd-B) immediately returns it to
   Standby and unloads its content. Closing it does the same; the teacher workspace
   remains open and students can keep working.

Only an explicitly selected, shared Live Board is eligible. Notebook, assessment,
dashboard and sign-in pages cannot navigate into this display. Teacher-only,
unpublished and archived boards stay hidden. The native display uses the existing
board renderer and its polling, but strips private reviews, reflections, roster
identifiers, removed posts and editing permissions from its rendering input. It
does not restore or modify teacher drafts. Editing, upload, navigation and write
requests are disabled in the display. Scrolling remains available. If the teacher
ends the board, the existing board renderer follows its saved final snapshot.
If it becomes teacher-only or the session expires, the display returns to Standby.

This projection surface shares the signed-in teacher's WebKit cookie store; it is
not a separate student account or server authorization role. Continue to use the
actual student notebook workflow for distributing student activities. Ordinary
board popup windows remain editable teacher windows; use Classroom Display for
projection when assessment and settings controls should stay private.

Workspace > Show PDF or Image on Classroom Display opens a native file picker.
The selected file is shown locally and is not uploaded or distributed to students.
PDFs scroll; images fit proportionally without stretching. Export PowerPoint or
Keynote slides to PDF for this first version. Live slide editing, camera grids and
embedded Zoom video are not included. Zoom links continue to open externally.

Verification
------------
Run zsh desktop/macos/test.sh for URL isolation, display geometry and private-data
filtering tests. Run zsh desktop/macos/test-native.sh for an actual AppKit/WebKit
smoke test. It starts a loopback server with fictional classroom data, opens
temporary native windows, checks board selection, blocked writes, teacher draft
isolation, live polling, blanking, image presentation and independent window
closure, then exits. It uses a separate QA bundle identifier and an in-memory
WebKit store; production accounts/data are not touched. Loopback listening and
native windows may require the environment's local-execution permission.

Verified in this release: compilation, local ad-hoc signature, the policy tests,
and the native smoke test on one connected screen. A genuine second monitor,
projector fullscreen/Spaces behavior, production sign-in and reconnect behavior,
real-file uploads/downloads, quiz audio, and real classroom final snapshots still
need acceptance testing. Two-screen geometry is covered with synthetic displays,
including a display positioned at negative desktop coordinates.
