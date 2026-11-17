import Foundation
import CoreGraphics

@main struct WorkspacePolicyTests {
    static func main() {
        let policy = WorkspaceURLPolicy(preview: "http://127.0.0.1:8080/notebooks")
        let ids = "classId=18c0a2cb-5ce8-4dbd-87bc-d23140efb84c&boardId=b6440c82-68a4-49a8-80da-764267337b52"
        let board = URL(string: "https://inkwire-education.com/board-embed?" + ids)!
        precondition(policy.classroomBoardURL(board) == board)
        precondition(policy.classroomBoardURL(URL(string: board.absoluteString + "&reviewRole=teacher&sourcePageId=private&returnTo=/teacher#assessment")!) == board)
        for forbidden in [
            "https://inkwire-education.com/teacher?" + ids,
            "https://inkwire-education.com/notebooks?" + ids,
            "https://inkwire-education.com/board-embed?" + ids + "&boardId=b6440c82-68a4-49a8-80da-764267337b52",
            "https://inkwire-education.com/board-embed?" + ids + "&snapshotId=not-a-snapshot",
            "https://inkwire-education.com.evil.test/board-embed?" + ids,
            "https://user:pass@inkwire-education.com/board-embed?" + ids,
            "http://inkwire-education.com/board-embed?" + ids,
            "https://inkwire-education.com:8443/board-embed?" + ids,
            "http://127.0.0.1:8081/board-embed.html?" + ids,
            "http://localhost:8080/board-embed.html?" + ids
        ] { precondition(policy.classroomBoardURL(URL(string: forbidden)!) == nil, forbidden) }
        precondition(policy.classroomBoardURL(URL(string: "http://127.0.0.1:8080/board-embed.html?" + ids)!) != nil)
        precondition(WorkspaceURLPolicy(preview: "https://evil.test").previewURL == nil)
        precondition(WorkspaceURLPolicy(preview: nil).isWorkspace(URL(string: "http://127.0.0.1:8080/notebooks")!) == false)

        let primary = CGRect(x: 0, y: 30, width: 1512, height: 916)
        let left = CGRect(x: -1920, y: -200, width: 1920, height: 1080)
        let dual = WorkspaceFrames.make(preset: .twoDisplays, teacherScreen: primary, classroomScreen: left)
        precondition(primary.contains(dual.teacher))
        precondition(left.contains(dual.classroom!))
        precondition(dual.classroom!.minX < 0)
        precondition(!dual.teacher.intersects(dual.classroom!))
        let single = WorkspaceFrames.make(preset: .twoDisplays, teacherScreen: primary, classroomScreen: nil)
        precondition(primary.contains(single.teacher) && primary.contains(single.classroom!))
        precondition(!single.teacher.intersects(single.classroom!))
        precondition(single.teacher.width >= 560 && single.classroom!.width >= 480)
        let small = CGRect(x: 90, y: 50, width: 1000, height: 700)
        let fallback = WorkspaceFrames.make(preset: .teaching, teacherScreen: small, classroomScreen: nil)
        precondition(small.contains(fallback.teacher) && small.contains(fallback.classroom!))
        precondition(WorkspaceFrames.make(preset: .focus, teacherScreen: primary, classroomScreen: left).classroom == nil)
        print("PASS: board URL isolation, preview origin restrictions, and single/dual-display geometry")
    }
}
