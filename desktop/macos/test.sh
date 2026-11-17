#!/bin/zsh
set -eu
cd "${0:A:h}"
mkdir -p build/swift-cache
xcrun swiftc -parse-as-library -swift-version 5 -module-cache-path build/swift-cache WorkspacePolicy.swift tests/WorkspacePolicyTests.swift -o build/WorkspacePolicyTests
build/WorkspacePolicyTests
node --test tests/projection-policy.test.cjs
