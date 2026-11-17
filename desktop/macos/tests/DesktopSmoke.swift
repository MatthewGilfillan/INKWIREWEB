import AppKit
import WebKit

private struct SmokeFailure: Error, CustomStringConvertible { let description: String }
@main struct DesktopSmoke {
    @MainActor static func main() {
        let application = NSApplication.shared
        let delegate = InkNoteApp()
        application.delegate = delegate
        Task { @MainActor in
            do {
                try await run(delegate)
                print("PASS: native windows, board selection, private-data isolation, polling, blanking and local material display")
                UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier!)
                exit(0)
            } catch { print("FAIL: \(error)"); exit(1) }
        }
        withExtendedLifetime(delegate) { application.run() }
    }
    @MainActor static func js(_ view: WKWebView, _ body: String) async throws -> Any {
        try await withCheckedThrowingContinuation { continuation in
            view.callAsyncJavaScript(body, arguments: [:], in: nil, in: .page) { continuation.resume(with: $0) }
        }
    }
    @MainActor static func wait(_ label: String, seconds: Int = 20, _ condition: @escaping () async throws -> Bool) async throws {
        for _ in 0..<(seconds * 5) {
            if (try? await condition()) == true { return }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        throw SmokeFailure(description: label)
    }
    static func check(_ value: Bool, _ message: String) throws { if !value { throw SmokeFailure(description: message) } }
    @MainActor static func run(_ app: InkNoteApp) async throws {
        try await wait("teacher fixture did not load") {
            guard let web = app.web else { return false }
            return try await js(web, "return !!document.querySelector('.notebook-live-board iframe');") as? Bool == true
        }
        try check(app.window.standardWindowButton(.zoomButton)?.isEnabled == true, "teacher fullscreen button is disabled")
        app.applyPreset(.teaching)
        try check(app.display.window.isVisible && app.window.isVisible, "teaching preset did not open both windows")
        try check(app.display.window.collectionBehavior.contains(.fullScreenPrimary), "display is not a native fullscreen window")
        try check(app.display.window.standardWindowButton(.zoomButton)?.isEnabled == true, "display fullscreen button is disabled")
        try check(app.display.web == nil && app.display.boardURL == nil, "preset automatically mirrored teacher content")
        let draftKey = "inkwire-board-draft:[\"fixture-teacher\",\"18c0a2cb-5ce8-4dbd-87bc-d23140efb84c\",\"b6440c82-68a4-49a8-80da-764267337b52\"]"
        let data = try JSONSerialization.data(withJSONObject: [draftKey])
        let literal = String(data: data, encoding: .utf8)!
        _ = try await js(app.web, "localStorage.setItem((\(literal))[0],JSON.stringify({text:'SECRET TEACHER DRAFT'})); return true;")
        app.presentBoard()
        try await wait("shared board did not appear on native display") {
            guard let web = app.display.web else { return false }
            return try await js(web, "return document.querySelector('[data-board-title]')?.textContent==='Classroom display test' && document.documentElement.dataset.inkwireProjection==='ready';") as? Bool == true
        }
        try check(app.display.boardURL?.absoluteString.contains("sourcePageId") == false, "private query reached display")
        let projection = app.display.web!
        let clean = try await js(projection, "return !document.body.innerText.includes('PRIVATE') && !document.body.innerText.includes('SECRET') && !document.querySelector('[data-board-cog]') && !document.querySelector('[data-story-panel=assess]');") as? Bool
        try check(clean == true, "private teacher content appeared on display")
        let blocked = try await js(projection, "try { await fetch('/api/class-boards/classes/18c0a2cb-5ce8-4dbd-87bc-d23140efb84c/b6440c82-68a4-49a8-80da-764267337b52',{method:'POST',body:'{}'}); return false; } catch { return true; }") as? Bool
        try check(blocked == true, "display allowed a write request")
        let sourceDraft = try await js(app.web, "return localStorage.getItem((\(literal))[0]);") as? String
        try check(sourceDraft?.contains("SECRET TEACHER DRAFT") == true, "display changed teacher draft storage")
        let origin = app.policy.origin
        _ = try await URLSession.shared.data(from: URL(string: "/test-control?change=add", relativeTo: origin)!.absoluteURL)
        try await wait("display did not poll new shared evidence") { try await js(projection, "return document.body.innerText.includes('A newly synced classroom idea');") as? Bool == true }
        _ = try await URLSession.shared.data(from: URL(string: "/test-control?change=private", relativeTo: origin)!.absoluteURL)
        try await wait("display did not hide a board changed to teacher-only") { app.display.window.subtitle == "Standby" }
        app.blankDisplay()
        try check(app.display.web == nil && app.display.boardURL == nil, "blanking did not discard displayed content")
        let materialURL = FileManager.default.temporaryDirectory.appendingPathComponent("inkwire-desktop-smoke.png")
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: materialURL)
        defer { try? FileManager.default.removeItem(at: materialURL) }
        try app.display.showMaterial(materialURL)
        try check(app.display.window.subtitle.contains("local file") && app.display.web == nil, "local image presentation failed")
        app.display.window.performClose(nil)
        try check(app.window.isVisible && !app.display.window.isVisible, "closing the classroom display closed the teacher workspace")
        app.applyPreset(.twoDisplays)
        try check(app.window.isVisible && app.display.window.isVisible, "two-display fallback failed")
        app.applyPreset(.focus)
        try check(!app.display.window.isVisible && app.window.isVisible, "focus preset failed")
        let (stats, _) = try await URLSession.shared.data(from: URL(string: "/test-control", relativeTo: origin)!.absoluteURL)
        try check((try JSONSerialization.jsonObject(with: stats) as? [String: Int])?["writes"] == 0, "native smoke test wrote to a board")
    }
}
