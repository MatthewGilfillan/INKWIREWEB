import AppKit
import WebKit
import PDFKit

private final class WeakDisplayHandler: NSObject, WKScriptMessageHandler {
    weak var owner: ClassroomDisplay?
    init(_ owner: ClassroomDisplay) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { owner?.receive(message) }
}

final class ClassroomDisplay: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    let window: NSWindow
    let policy: WorkspaceURLPolicy
    private let root = NSView()
    private let standby = NSView()
    private let subtitle = NSTextField(wrappingLabelWithString: "Choose a Live Board or a PDF/image from the teacher workspace.")
    private(set) var web: WKWebView?
    private(set) var boardURL: URL?
    private var content: NSView?
    var onMove: (() -> Void)?
    var onClose: (() -> Void)?
    var onExitFullscreen: (() -> Void)?

    init(policy: WorkspaceURLPolicy) {
        self.policy = policy
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 720), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        super.init()
        window.title = "Ink Wire LMS · Classroom Display"
        window.subtitle = "Standby"
        window.minSize = NSSize(width: 480, height: 400)
        window.collectionBehavior = [.fullScreenPrimary]
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.setFrameAutosaveName("InkWireClassroomDisplay")
        window.contentView = root
        standby.wantsLayer = true
        standby.layer?.backgroundColor = NSColor(calibratedRed: 0.95, green: 0.97, blue: 0.97, alpha: 1).cgColor
        fill(standby)
        let icon = NSImageView(image: NSImage(systemSymbolName: "display", accessibilityDescription: nil) ?? NSImage())
        icon.contentTintColor = NSColor(calibratedRed: 0.18, green: 0.47, blue: 0.46, alpha: 1)
        icon.setContentHuggingPriority(.required, for: .vertical)
        icon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([icon.widthAnchor.constraint(equalToConstant: 54), icon.heightAnchor.constraint(equalToConstant: 44)])
        let heading = NSTextField(labelWithString: "Ready for class")
        heading.font = .systemFont(ofSize: 28, weight: .bold)
        heading.textColor = NSColor(calibratedRed: 0.09, green: 0.17, blue: 0.29, alpha: 1)
        subtitle.font = .systemFont(ofSize: 16)
        subtitle.alignment = .center
        subtitle.textColor = .secondaryLabelColor
        let stack = NSStackView(views: [icon, heading, subtitle])
        stack.orientation = .vertical; stack.spacing = 18; stack.alignment = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false
        standby.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: standby.centerXAnchor), stack.centerYAnchor.constraint(equalTo: standby.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 440), stack.leadingAnchor.constraint(greaterThanOrEqualTo: standby.leadingAnchor, constant: 30),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: standby.trailingAnchor, constant: -30)
        ])
    }

    private func fill(_ view: NSView) {
        view.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(view)
        NSLayoutConstraint.activate([view.topAnchor.constraint(equalTo: root.topAnchor), view.bottomAnchor.constraint(equalTo: root.bottomAnchor), view.leadingAnchor.constraint(equalTo: root.leadingAnchor), view.trailingAnchor.constraint(equalTo: root.trailingAnchor)])
    }

    private func replaceContent(_ view: NSView?) {
        web?.stopLoading()
        web?.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDisplay")
        content?.removeFromSuperview(); web = nil; content = view
        if let view { fill(view) }
        root.addSubview(standby, positioned: .above, relativeTo: view)
    }

    func blank() {
        replaceContent(nil); boardURL = nil
        showStandby("Choose a Live Board or a PDF/image from the teacher workspace.")
        window.title = "Ink Wire LMS · Classroom Display"
    }

    private func showStandby(_ message: String) {
        subtitle.stringValue = message
        standby.isHidden = false
        window.subtitle = "Standby"
    }

    @discardableResult
    func showBoard(_ url: URL, sourceConfiguration: WKWebViewConfiguration) -> Bool {
        guard let safeURL = policy.classroomBoardURL(url),
              let policySource = Bundle.main.url(forResource: "projection-policy", withExtension: "js").flatMap({ try? String(contentsOf: $0, encoding: .utf8) }),
              let projectionSource = Bundle.main.url(forResource: "projection", withExtension: "js").flatMap({ try? String(contentsOf: $0, encoding: .utf8) }) else { return false }
        blank()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = sourceConfiguration.websiteDataStore
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        for script in sourceConfiguration.userContentController.userScripts { configuration.userContentController.addUserScript(script) }
        configuration.userContentController.addUserScript(WKUserScript(source: policySource + "\n" + projectionSource, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.add(WeakDisplayHandler(self), name: "classroomDisplay")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self; view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = false
        replaceContent(view); web = view; boardURL = safeURL
        showStandby("Opening the shared Live Board…")
        view.load(URLRequest(url: safeURL))
        return true
    }

    func showMaterial(_ url: URL) throws {
        let view: NSView
        if url.pathExtension.lowercased() == "pdf" {
            guard let document = PDFDocument(url: url) else { throw CocoaError(.fileReadCorruptFile) }
            let pdf = PDFView(); pdf.document = document; pdf.autoScales = true
            pdf.displayMode = .singlePageContinuous; pdf.backgroundColor = .white
            view = pdf
        } else {
            guard let image = NSImage(contentsOf: url) else { throw CocoaError(.fileReadCorruptFile) }
            let imageView = NSImageView(image: image); imageView.imageScaling = .scaleProportionallyUpOrDown
            imageView.wantsLayer = true; imageView.layer?.backgroundColor = NSColor.white.cgColor
            view = imageView
        }
        replaceContent(view); boardURL = nil; standby.isHidden = true
        window.title = "Ink Wire LMS · " + url.lastPathComponent
        window.subtitle = "Classroom display · local file"
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === web, let url = message.frameInfo.request.url,
              policy.classroomBoardURL(url) == boardURL, let value = message.body as? [String: Any] else { return }
        if value["ready"] as? Bool == true {
            standby.isHidden = true
            let title = String((value["title"] as? String ?? "Live Board").prefix(120))
            window.title = "Ink Wire LMS · " + title
            window.subtitle = "Classroom display · read only"
        } else { showStandby((value["message"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Opening the shared Live Board…") }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard !action.shouldPerformDownload, let url = action.request.url,
              action.targetFrame?.isMainFrame == true, policy.classroomBoardURL(url) == boardURL else {
            if action.targetFrame?.isMainFrame == true { showStandby("Open the teacher workspace to reconnect or choose another board.") }
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) { decisionHandler(response.canShowMIMEType ? .allow : .cancel) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { showStandby("The board could not connect. Reopen it from the teacher workspace.") } }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showStandby("The board could not connect. Reopen it from the teacher workspace.") }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showStandby("Reopen the board from the teacher workspace to reconnect.") }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { completionHandler() }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { completionHandler(false) }
    func windowShouldClose(_ sender: NSWindow) -> Bool { blank(); sender.orderOut(nil); onClose?(); return false }
    func windowDidMove(_ notification: Notification) { onMove?() }
    func windowDidExitFullScreen(_ notification: Notification) { onExitFullscreen?() }
}
