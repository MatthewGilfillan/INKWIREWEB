import AppKit
import WebKit

private let homeURL = URL(string: "https://inkwire-education.com/notebooks")!

final class InkNoteApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, NSToolbarDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var backButton: NSButton!
    var focusButton: NSButton!
    var pinButton: NSButton!
    var compactButton: NSButton!
    var progress: NSProgressIndicator!
    var observation: NSKeyValueObservation?
    var popupWindows: [NSWindow] = []
    var downloadURLs: [WKDownload: URL] = [:]
    var compact = false
    var isFocused = false
    var fullFrame: NSRect?
    var allowQuit = false
    let notice = NSTextField(wrappingLabelWithString: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.appearance = NSAppearance(named:.aqua)
        makeMenu()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        if let url = Bundle.main.url(forResource: "desktop", withExtension: "css"), let css = try? String(contentsOf: url), let data = try? JSONSerialization.data(withJSONObject: [css]), let array = String(data: data, encoding: .utf8) {
            let script = "if(location.hostname==='inkwire-education.com'||location.hostname==='127.0.0.1'){const s=document.createElement('style');s.textContent=(\(array))[0];document.head.append(s);document.documentElement.classList.add('ink-note-desktop');}"
            config.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let data = try? JSONSerialization.data(withJSONObject: NSFontManager.shared.availableFontFamilies.sorted()), let families = String(data: data, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: "if(location.hostname==='inkwire-education.com'||location.hostname==='127.0.0.1')window.inkNoteFontFamilies=\(families);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        if let directory = Bundle.main.resourceURL?.appendingPathComponent("Fonts"), let facesData = try? Data(contentsOf: directory.appendingPathComponent("faces.json")), let faces = try? JSONSerialization.jsonObject(with: facesData) as? [[String:String]] {
            var files: [String:String] = [:]
            for face in faces { if let file = face["file"], files[file] == nil, let data = try? Data(contentsOf: directory.appendingPathComponent(file)) { files[file] = data.base64EncodedString() } }
            if let data = try? JSONSerialization.data(withJSONObject: ["files":files,"faces":faces]), let payload = String(data:data,encoding:.utf8) {
                let script = "if(location.hostname==='inkwire-education.com'||location.hostname==='127.0.0.1'){const bundle=\(payload);const bytes={};for(const [file,data] of Object.entries(bundle.files))bytes[file]=Uint8Array.from(atob(data),c=>c.charCodeAt(0));for(const item of bundle.faces){const font=new FontFace(item.family,bytes[item.file],{style:item.style,weight:item.weight,unicodeRange:item.unicodeRange,display:'swap'});document.fonts.add(font);font.load().catch(()=>{});}}"
                config.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentStart,forMainFrameOnly:true))
            }
        }
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 780), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.appearance = NSAppearance(named:.aqua)
        window.titlebarAppearsTransparent = false
        window.titleVisibility = .visible
        for type in [NSWindow.ButtonType.closeButton,.miniaturizeButton,.zoomButton] { window.standardWindowButton(type)?.isHidden = false; window.standardWindowButton(type)?.alphaValue = 1 }
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.title = "Ink Wire LMS"; window.subtitle = "Ink Wire Learning Studio"
        window.minSize = NSSize(width: 560, height: 440); window.delegate = self
        window.isReleasedWhenClosed = false; window.setFrameAutosaveName("InkNoteWorkspace")
        window.toolbarStyle = .unifiedCompact
        window.backgroundColor = .windowBackgroundColor
        let toolbar = NSToolbar(identifier: "InkNoteToolbar"); toolbar.delegate = self; toolbar.displayMode = .iconOnly; toolbar.allowsUserCustomization = false; window.toolbar = toolbar
        let root = NSView(); root.wantsLayer = true; root.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor; window.contentView = root
        web.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(web)
        let footer = NSView(); footer.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(footer)
        let label = NSTextField(labelWithString: "Ink Wire LMS · classroom beta"); label.font = .systemFont(ofSize: 10); label.textColor = .secondaryLabelColor; label.translatesAutoresizingMaskIntoConstraints = false; footer.addSubview(label)
        progress = NSProgressIndicator(); progress.style = .spinning; progress.controlSize = .small; progress.isDisplayedWhenStopped = false; progress.translatesAutoresizingMaskIntoConstraints = false; footer.addSubview(progress)
        notice.font = .systemFont(ofSize: 11); notice.textColor = .secondaryLabelColor; notice.translatesAutoresizingMaskIntoConstraints = false; notice.isHidden = true; root.addSubview(notice)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor), web.leadingAnchor.constraint(equalTo: root.leadingAnchor), web.trailingAnchor.constraint(equalTo: root.trailingAnchor), web.bottomAnchor.constraint(equalTo: footer.topAnchor),
            footer.leadingAnchor.constraint(equalTo: root.leadingAnchor), footer.trailingAnchor.constraint(equalTo: root.trailingAnchor), footer.bottomAnchor.constraint(equalTo: root.bottomAnchor), footer.heightAnchor.constraint(equalToConstant: 26),
            label.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 14), label.centerYAnchor.constraint(equalTo: footer.centerYAnchor), progress.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -14), progress.centerYAnchor.constraint(equalTo: footer.centerYAnchor),
            notice.centerXAnchor.constraint(equalTo: root.centerXAnchor), notice.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor, constant: 16), notice.widthAnchor.constraint(lessThanOrEqualToConstant: 440)
        ])
        observation = web.observe(\.isLoading, options: [.new]) { [weak self] _, _ in DispatchQueue.main.async { self?.updateControls() } }
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        // Development preview is opt-in and restricted to localhost; production is the default.
        if let raw = (ProcessInfo.processInfo.environment["INK_NOTE_PREVIEW_URL"] ?? Bundle.main.object(forInfoDictionaryKey:"InkNoteDevelopmentPreviewURL") as? String), let url = URL(string: raw), url.host == "127.0.0.1", url.scheme == "http" { web.load(URLRequest(url: url)) }
        else { web.load(URLRequest(url: homeURL)) }
    }
    func makeMenu() {
        let bar = NSMenu(); let appItem = NSMenuItem(); bar.addItem(appItem); let app = NSMenu(); appItem.submenu = app
        app.addItem(withTitle: "About Ink Wire LMS", action: #selector(about), keyEquivalent: "").target = self
        app.addItem(.separator()); app.addItem(withTitle: "Quit Ink Wire LMS", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let fileItem = NSMenuItem(); bar.addItem(fileItem); let file = NSMenu(title: "File"); fileItem.submenu = file
        file.addItem(withTitle: "My notebooks", action: #selector(home), keyEquivalent: "1").target = self
        file.addItem(withTitle: "Teacher dashboard", action: #selector(dashboard), keyEquivalent: "0").target = self
        file.addItem(withTitle: "Open in Browser", action: #selector(openBrowser), keyEquivalent: "b").target = self
        file.addItem(withTitle: "Print…", action: #selector(printPage), keyEquivalent: "p").target = self
        let editItem = NSMenuItem(); bar.addItem(editItem); let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        for (title, action, key) in [("Undo", Selector(("undo:")), "z"), ("Redo", Selector(("redo:")), "Z"), ("Cut", #selector(NSText.cut(_:)), "x"), ("Copy", #selector(NSText.copy(_:)), "c"), ("Paste", #selector(NSText.paste(_:)), "v"), ("Select All", #selector(NSText.selectAll(_:)), "a")] { edit.addItem(withTitle: title, action: action, keyEquivalent: key) }
        let viewItem = NSMenuItem(); bar.addItem(viewItem); let view = NSMenu(title: "View"); viewItem.submenu = view
        for (title, action, key) in [("Show or Hide Notebook Navigation", #selector(toggleFocus), "\\"), ("Compact Window", #selector(toggleCompact), "2"), ("Keep on Top", #selector(togglePin), "t"), ("Reload", #selector(reload), "r")] { view.addItem(withTitle: title, action: action, keyEquivalent: key).target = self }
        NSApp.mainMenu = bar
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { toolbarDefaultItemIdentifiers(toolbar) }
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { [.init("back"), .init("home"), .flexibleSpace, .init("focus"), .init("compact"), .init("pin"), .init("browser")] }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar: Bool) -> NSToolbarItem? {
        let specs: [String:(String,String,Selector)] = ["back":("chevron.left","Back",#selector(back)), "home":("books.vertical","My notebooks",#selector(home)), "focus":("sidebar.left","Show or hide notebook navigation",#selector(toggleFocus)), "compact":("rectangle.compress.vertical","Compact window",#selector(toggleCompact)), "pin":("pin","Keep on top",#selector(togglePin)), "browser":("arrow.up.right.square","Open in browser",#selector(openBrowser))]
        guard let spec = specs[id.rawValue] else { return nil }
        let item = NSToolbarItem(itemIdentifier: id); item.label = spec.1
        let button = NSButton(image: (NSImage(systemSymbolName: spec.0, accessibilityDescription: spec.1) ?? NSImage(size:NSSize(width:18,height:18))), target: self, action: spec.2)
        button.bezelStyle = .toolbar; button.toolTip = spec.1; button.setAccessibilityLabel(spec.1); item.view = button
        if id.rawValue == "back" { backButton = button }; if id.rawValue == "focus" { focusButton = button }; if id.rawValue == "pin" { pinButton = button }; if id.rawValue == "compact" { compactButton = button }
        return item
    }
    func updateControls() { backButton?.isEnabled = web.canGoBack; if web.isLoading { progress.startAnimation(nil) } else { progress.stopAnimation(nil) } }
    @objc func back() { web.goBack() }
    func navigate(_ url: URL) { web.load(URLRequest(url: url)) }
    @objc func home() { navigate(homeURL) }
    @objc func dashboard() { navigate(URL(string:"https://inkwire-education.com/teacher")!) }
    @objc func reload() { web.reload() }
    @objc func openBrowser() { if let url = web.url, url.scheme == "https" || url.host == "127.0.0.1" { NSWorkspace.shared.open(url) } }
    @objc func toggleFocus() {
        web.evaluateJavaScript("(()=>{const button=document.querySelector('#toggle-navigation');if(button)button.click();return document.querySelector('#folio-grid')?.classList.contains('focus-page')||false;})()") { [weak self] result, _ in
            guard let self = self else { return }; self.isFocused = result as? Bool ?? false; self.focusButton?.state = self.isFocused ? .on : .off
        }
    }
    @objc func toggleCompact() {
        compact.toggle(); compactButton?.state = compact ? .on : .off
        if compact { fullFrame = window.frame; let old = window.frame; window.setFrame(NSRect(x: old.minX, y: old.maxY-680, width: 640, height: 680), display: true, animate: true) }
        else if let frame = fullFrame { window.setFrame(frame, display: true, animate: true) }
    }
    @objc func togglePin() { window.level = window.level == .floating ? .normal : .floating; pinButton?.state = window.level == .floating ? .on : .off }
    @objc func printPage() { web.printOperation(with: NSPrintInfo.shared).runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil) }
    @objc func about() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName:"Ink Wire LMS", .applicationVersion:"0.2 · classroom beta", .credits:NSAttributedString(string:"Part of Ink Wire Learning Studio.\nOnline notebooks for teaching, writing and feedback.")]) }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { notice.isHidden = true; updateControls() }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { updateControls(); isFocused = false; focusButton?.state = .off }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
    func fail(_ error: Error) { guard (error as NSError).code != NSURLErrorCancelled else { return }; notice.stringValue = "Could not connect. Check your connection, then use View → Reload. Your notebook remains open."; notice.isHidden = false; updateControls() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { notice.stringValue = "The notebook view stopped. Use View → Reload to reconnect. Any unsaved browser draft may be recovered by the notebook."; notice.isHidden = false }
    func isWorkspaceURL(_ url: URL) -> Bool {
        if url.scheme == "https", ["inkwire-education.com","www.inkwire-education.com"].contains(url.host ?? "") { return true }
        let preview = ProcessInfo.processInfo.environment["INK_NOTE_PREVIEW_URL"] ?? Bundle.main.object(forInfoDictionaryKey:"InkNoteDevelopmentPreviewURL") as? String
        if let raw = preview, let allowed = URL(string:raw), url.scheme == "http", url.host == "127.0.0.1", url.port == allowed.port { return true }
        return false
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.targetFrame == nil, let url = action.request.url, url.absoluteString == "about:blank" || isWorkspaceURL(url) else { return nil }
        let child = WKWebView(frame:.zero, configuration:configuration)
        child.navigationDelegate = self; child.uiDelegate = self; child.allowsBackForwardNavigationGestures = true
        let popup = NSWindow(contentRect:NSRect(x:0,y:0,width:1280,height:850),styleMask:[.titled,.closable,.resizable,.miniaturizable],backing:.buffered,defer:false)
        popup.title = "Ink Wire LMS · Live Board"; popup.minSize = NSSize(width:480,height:400)
        popup.collectionBehavior.insert(.fullScreenPrimary); popup.isReleasedWhenClosed = false; popup.delegate = self
        popup.contentView = child; popupWindows.append(popup); popup.center(); popup.makeKeyAndOrderFront(nil)
        return child
    }
    func webViewDidClose(_ webView: WKWebView) { if let popup = webView.window, popup !== window { popup.close() } }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.targetFrame == nil && action.navigationType == .linkActivated && url.scheme == "https" && !isWorkspaceURL(url) { NSWorkspace.shared.open(url); decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if url.scheme == "blob" || url.absoluteString == "about:blank" && webView !== web { decisionHandler(.allow); return }
        if isWorkspaceURL(url) { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated && ["https","http","mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) { decisionHandler(response.canShowMIMEType ? .allow : .download) }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = URL(fileURLWithPath:suggestedFilename).lastPathComponent
        panel.beginSheetModal(for: window) { result in if result == .OK, let url = panel.url { self.downloadURLs[download] = url; completionHandler(url) } else { completionHandler(nil) } }
    }
    func downloadDidFinish(_ download: WKDownload) { if let url = downloadURLs.removeValue(forKey:download) { NSWorkspace.shared.activateFileViewerSelecting([url]) } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { downloadURLs.removeValue(forKey:download); let alert = NSAlert(); alert.messageText = "Download could not finish"; alert.informativeText = error.localizedDescription; alert.beginSheetModal(for: window) }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection; panel.canChooseDirectories = parameters.allowsDirectories
        panel.beginSheetModal(for: webView.window ?? window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { let alert = NSAlert(); alert.messageText = message; alert.beginSheetModal(for: webView.window ?? window) { _ in completionHandler() } }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle:"Continue"); alert.addButton(withTitle:"Cancel"); alert.beginSheetModal(for: webView.window ?? window) { completionHandler($0 == .alertFirstButtonReturn) } }
    func webView(_ webView: WKWebView, runBeforeUnloadConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { let alert = NSAlert(); alert.messageText = "Leave this notebook?"; alert.informativeText = "The notebook has unsaved changes. Stay here until saving finishes, or download a recovery copy."; alert.addButton(withTitle:"Stay"); alert.addButton(withTitle:"Leave"); alert.beginSheetModal(for:webView.window ?? window) { completionHandler($0 == .alertSecondButtonReturn) } }
    func pendingChanges(_ views: [WKWebView], completion: @escaping (Bool) -> Void) {
        let group = DispatchGroup(); var pending = false
        for view in views { group.enter(); view.evaluateJavaScript("window.dispatchEvent(new Event('ink-note-check-close')); (()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()") { result, error in
            if result as? Bool == true { pending = true }; group.leave()
        }}
        group.notify(queue:.main) { completion(pending) }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if allowQuit { return .terminateNow }
        let views = [web!] + popupWindows.compactMap { $0.contentView as? WKWebView }
        pendingChanges(views) { pending in
            if pending { let alert = NSAlert(); alert.messageText = "Classroom changes are still saving"; alert.informativeText = "A notebook or Live Board has unsaved changes. Stay open to finish saving or download a recovery copy."; alert.addButton(withTitle:"Stay"); alert.addButton(withTitle:"Quit anyway"); alert.beginSheetModal(for:NSApp.keyWindow ?? self.window) { response in self.allowQuit = response == .alertSecondButtonReturn; sender.reply(toApplicationShouldTerminate:self.allowQuit) } }
            else { self.allowQuit = true; sender.reply(toApplicationShouldTerminate:true) }
        }; return .terminateLater
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if sender === window { NSApp.terminate(nil); return false }
        guard let child = sender.contentView as? WKWebView else { return true }
        pendingChanges([child]) { pending in
            let close = { sender.orderOut(nil); self.popupWindows.removeAll { $0 === sender }; sender.delegate = nil; sender.close() }
            if pending { let alert = NSAlert(); alert.messageText = "This board is still saving"; alert.informativeText = "Stay open to finish saving. Closing the window does not end the lesson."; alert.addButton(withTitle:"Stay"); alert.addButton(withTitle:"Close anyway"); alert.beginSheetModal(for:sender) { if $0 == .alertSecondButtonReturn { close() } } }
            else { close() }
        }; return false
    }
}
@main struct InkNoteMain { static func main() { let app = NSApplication.shared; let delegate = InkNoteApp(); app.delegate = delegate; withExtendedLifetime(delegate) { app.run() } } }
