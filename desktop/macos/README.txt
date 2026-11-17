Ink Wire LMS — macOS classroom beta 0.2.0

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
