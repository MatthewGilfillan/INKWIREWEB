#!/bin/zsh
set -eu
cd "${0:A:h}"
target_dir="build/Ink Wire LMS.app"
mkdir -p "$target_dir/Contents/MacOS" "$target_dir/Contents/Resources" build/swift-cache
xcrun swiftc -parse-as-library -swift-version 5 -O -target arm64-apple-macos14.0 -module-cache-path build/swift-cache -framework AppKit -framework WebKit InkNoteApp.swift -o "$target_dir/Contents/MacOS/InkWireLMS"
cp Info.plist "$target_dir/Contents/Info.plist"
cp desktop.css "$target_dir/Contents/Resources/"
cp assets/InkWireLMS.icns "$target_dir/Contents/Resources/"
mkdir -p "$target_dir/Contents/Resources/Fonts"
cp assets/fonts/* "$target_dir/Contents/Resources/Fonts/"
codesign --force --deep --sign - "$target_dir"
printf '%s\n' "Built $target_dir"
