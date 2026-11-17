#!/bin/zsh
set -eu
cd "${0:A:h}"
qa_dir="$(mktemp -d /private/tmp/inkwire-desktop-qa.XXXXXX)"
qa_server_pid=""
trap '[[ -n "$qa_server_pid" ]] && kill "$qa_server_pid" 2>/dev/null || true; rm -rf "$qa_dir"' EXIT
node tests/fixture-server.cjs "$qa_dir/port" &
qa_server_pid=$!
for attempt in {1..50}; do [[ -s "$qa_dir/port" ]] && break; sleep 0.1; done
[[ -s "$qa_dir/port" ]]
qa_app="$qa_dir/Ink Wire Desktop QA.app"
mkdir -p "$qa_app/Contents/MacOS" "$qa_app/Contents/Resources" build/swift-cache
xcrun swiftc -parse-as-library -swift-version 5 -D DESKTOP_SMOKE_TEST -module-cache-path build/swift-cache -framework AppKit -framework WebKit -framework PDFKit InkNoteApp.swift WorkspacePolicy.swift ClassroomDisplay.swift tests/DesktopSmoke.swift -o "$qa_app/Contents/MacOS/InkWireDesktopQA"
cp desktop.css projection-policy.js projection.js "$qa_app/Contents/Resources/"
cat > "$qa_app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>InkWireDesktopQA</string><key>CFBundleIdentifier</key><string>online.inkwire.desktop-qa</string><key>CFBundleName</key><string>Ink Wire Desktop QA</string><key>CFBundlePackageType</key><string>APPL</string><key>NSPrincipalClass</key><string>NSApplication</string></dict></plist>
PLIST
INK_NOTE_PREVIEW_URL="http://127.0.0.1:$(cat "$qa_dir/port")/notebooks" "$qa_app/Contents/MacOS/InkWireDesktopQA"
