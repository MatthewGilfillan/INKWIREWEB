import Foundation
import CoreGraphics

enum WorkspacePreset: String, CaseIterable {
    case focus, teaching, twoDisplays
    var title: String {
        switch self {
        case .focus: return "Focus"
        case .teaching: return "Teaching desk"
        case .twoDisplays: return "Two displays"
        }
    }
}

struct WorkspaceFrames {
    let teacher: CGRect
    let classroom: CGRect?

    static func make(preset: WorkspacePreset, teacherScreen: CGRect, classroomScreen: CGRect?) -> WorkspaceFrames {
        let desk = teacherScreen.insetBy(dx: 16, dy: 16)
        if preset == .focus { return WorkspaceFrames(teacher: desk, classroom: nil) }
        if preset == .twoDisplays, let other = classroomScreen {
            return WorkspaceFrames(teacher: desk, classroom: other.insetBy(dx: 16, dy: 16))
        }
        // Leave room for the native window frames. Small screens use overlapping
        // windows instead of shrinking the notebook or board below a usable size.
        let gap: CGFloat = 12
        if desk.width >= 1072 {
            let width = min(max(560, floor((desk.width - gap) * 0.56)), desk.width - gap - 480)
            return WorkspaceFrames(
                teacher: CGRect(x: desk.minX, y: desk.minY, width: width, height: desk.height),
                classroom: CGRect(x: desk.minX + width + gap, y: desk.minY, width: desk.width - width - gap, height: desk.height)
            )
        }
        let teacher = CGRect(x: desk.minX, y: desk.minY + 24, width: max(0, desk.width - 24), height: max(0, desk.height - 24))
        let classroom = CGRect(x: desk.minX + 24, y: desk.minY, width: max(0, desk.width - 24), height: max(0, desk.height - 24))
        return WorkspaceFrames(teacher: teacher, classroom: classroom)
    }
}

struct WorkspaceURLPolicy {
    let previewURL: URL?

    init(preview: String?) {
        if let raw = preview, let url = URL(string: raw), url.scheme == "http", url.host == "127.0.0.1", url.user == nil, url.password == nil {
            previewURL = url
        } else { previewURL = nil }
    }

    var home: URL { previewURL ?? URL(string: "https://inkwire-education.com/notebooks")! }
    var origin: URL { URL(string: "/", relativeTo: home)!.absoluteURL }

    func isWorkspace(_ url: URL) -> Bool {
        guard url.user == nil, url.password == nil else { return false }
        if url.scheme == "https", ["inkwire-education.com", "www.inkwire-education.com"].contains(url.host ?? ""), url.port == nil || url.port == 443 { return true }
        if let preview = previewURL, url.scheme == "http", url.host == "127.0.0.1", url.port == preview.port { return true }
        return false
    }

    // The display accepts a board, never the teacher's surrounding notebook or
    // dashboard. Copy only identifiers used by the existing board renderer.
    func classroomBoardURL(_ url: URL) -> URL? {
        guard isWorkspace(url), ["/board-embed", "/board-embed.html"].contains(url.path),
              var parts = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return nil }
        let items = parts.queryItems ?? []
        var safe: [URLQueryItem] = []
        for name in ["classId", "boardId", "snapshotId"] {
            let values = items.filter { $0.name == name }
            if values.isEmpty && name == "snapshotId" { continue }
            guard values.count == 1, let value = values[0].value,
                  value.range(of: "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", options: .regularExpression) != nil else { return nil }
            safe.append(URLQueryItem(name: name, value: value))
        }
        parts.queryItems = safe; parts.fragment = nil
        return parts.url
    }
}
