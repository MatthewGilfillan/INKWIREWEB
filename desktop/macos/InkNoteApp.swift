import AppKit
import WebKit
import UniformTypeIdentifiers

final class InkNoteApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, NSToolbarDelegate, NSMenuItemValidation {
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
    var downloadWindows: [WKDownload: NSWindow] = [:]
    var layoutButton: NSPopUpButton?
    var display: ClassroomDisplay!
    weak var lastTeachingWindow: NSWindow?
    var screenObserver: NSObjectProtocol?
    var pendingPreset: WorkspacePreset?
    var preset = WorkspacePreset(rawValue: UserDefaults.standard.string(forKey: "InkWireWorkspacePreset") ?? "") ?? .focus
    lazy var policy = WorkspaceURLPolicy(preview: ProcessInfo.processInfo.environment["INK_NOTE_PREVIEW_URL"] ?? Bundle.main.object(forInfoDictionaryKey: "InkNoteDevelopmentPreviewURL") as? String)
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
        config.websiteDataStore = policy.previewURL == nil ? .default() : .nonPersistent()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        if let url = Bundle.main.url(forResource: "desktop", withExtension: "css"), let css = try? String(contentsOf: url, encoding: .utf8), let data = try? JSONSerialization.data(withJSONObject: [css]), let array = String(data: data, encoding: .utf8) {
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
        window.title = "Ink Wire LMS"; window.subtitle = "Teacher workspace"
        window.minSize = NSSize(width: 560, height: 440); window.delegate = self
        window.isReleasedWhenClosed = false; window.setFrameAutosaveName("InkNoteWorkspace")
        window.toolbarStyle = .unifiedCompact
        window.backgroundColor = .windowBackgroundColor
        let toolbar = NSToolbar(identifier: "InkNoteToolbar"); toolbar.delegate = self; toolbar.displayMode = .iconOnly; toolbar.allowsUserCustomization = false; window.toolbar = toolbar
        let root = NSView(); root.wantsLayer = true; root.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor; window.contentView = root
        web.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(web)
        let footer = NSView(); footer.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(footer)
        let label = NSTextField(labelWithString: "Ink Wire LMS · teacher workspace"); label.font = .systemFont(ofSize: 10); label.textColor = .secondaryLabelColor; label.translatesAutoresizingMaskIntoConstraints = false; footer.addSubview(label)
        progress = NSProgressIndicator(); progress.style = .spinning; progress.controlSize = .small; progress.isDisplayedWhenStopped = false; progress.translatesAutoresizingMaskIntoConstraints = false; footer.addSubview(progress)
        notice.font = .systemFont(ofSize: 11); notice.textColor = .secondaryLabelColor; notice.translatesAutoresizingMaskIntoConstraints = false; notice.isHidden = true; root.addSubview(notice)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor), web.leadingAnchor.constraint(equalTo: root.leadingAnchor), web.trailingAnchor.constraint(equalTo: root.trailingAnchor), web.bottomAnchor.constraint(equalTo: footer.topAnchor),
            footer.leadingAnchor.constraint(equalTo: root.leadingAnchor), footer.trailingAnchor.constraint(equalTo: root.trailingAnchor), footer.bottomAnchor.constraint(equalTo: root.bottomAnchor), footer.heightAnchor.constraint(equalToConstant: 26),
            label.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 14), label.centerYAnchor.constraint(equalTo: footer.centerYAnchor), progress.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -14), progress.centerYAnchor.constraint(equalTo: footer.centerYAnchor),
            notice.centerXAnchor.constraint(equalTo: root.centerXAnchor), notice.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor, constant: 16), notice.widthAnchor.constraint(lessThanOrEqualToConstant: 440)
        ])
        observation = web.observe(\.isLoading, options: [.new]) { [weak self] _, _ in DispatchQueue.main.async { self?.updateControls() } }
        if !window.setFrameUsingName("InkNoteWorkspace") { window.center() }
        display = ClassroomDisplay(policy: policy)
        display.onMove = { [weak self] in self?.rememberClassroomScreen() }
        display.onExitFullscreen = { [weak self] in self?.finishPendingLayout() }
        screenObserver = NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in self?.screensChanged() }
        window.makeKeyAndOrderFront(nil); lastTeachingWindow = window; NSApp.activate(ignoringOtherApps: true)
        // Restore arrangement only. Projected content always starts blank.
        if UserDefaults.standard.string(forKey: "InkWireWorkspacePreset") != nil { applyPreset(preset) }
        web.load(URLRequest(url: policy.home))
    }
    func makeMenu() {
        let bar = NSMenu(); let appItem = NSMenuItem(); bar.addItem(appItem); let app = NSMenu(); appItem.submenu = app
        app.addItem(withTitle: "About Ink Wire LMS", action: #selector(about), keyEquivalent: "").target = self
        app.addItem(.separator()); app.addItem(withTitle: "Quit Ink Wire LMS", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let fileItem = NSMenuItem(); bar.addItem(fileItem); let file = NSMenu(title: "File"); fileItem.submenu = file
        file.addItem(withTitle: "My notebooks", action: #selector(home), keyEquivalent: "1").target = self
        file.addItem(withTitle: "Teacher dashboard", action: #selector(dashboard), keyEquivalent: "0").target = self
        file.addItem(withTitle: "Open in Browser", action: #selector(openBrowser), keyEquivalent: "b").target = self
        file.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.addItem(withTitle: "Print…", action: #selector(printPage), keyEquivalent: "p").target = self
        let editItem = NSMenuItem(); bar.addItem(editItem); let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        for (title, action, key) in [("Undo", Selector(("undo:")), "z"), ("Redo", Selector(("redo:")), "Z"), ("Cut", #selector(NSText.cut(_:)), "x"), ("Copy", #selector(NSText.copy(_:)), "c"), ("Paste", #selector(NSText.paste(_:)), "v"), ("Select All", #selector(NSText.selectAll(_:)), "a")] { edit.addItem(withTitle: title, action: action, keyEquivalent: key) }
        let viewItem = NSMenuItem(); bar.addItem(viewItem); let view = NSMenu(title: "View"); viewItem.submenu = view
        for (title, action, key) in [("Show or Hide Notebook Navigation", #selector(toggleFocus), "\\"), ("Compact Window", #selector(toggleCompact), "2"), ("Keep on Top", #selector(togglePin), "t"), ("Reload", #selector(reload), "r")] { view.addItem(withTitle: title, action: action, keyEquivalent: key).target = self }
        let workspaceItem = NSMenuItem(); bar.addItem(workspaceItem)
        let workspace = NSMenu(title: "Workspace"); workspaceItem.submenu = workspace
        for (index, choice) in WorkspacePreset.allCases.enumerated() {
            let item = workspace.addItem(withTitle: choice.title, action: #selector(choosePreset(_:)), keyEquivalent: String(index + 1))
            item.target = self; item.representedObject = choice.rawValue; item.keyEquivalentModifierMask = [.command, .option]
        }
        workspace.addItem(.separator())
        workspace.addItem(withTitle: "Show Live Board on Classroom Display…", action: #selector(presentBoard), keyEquivalent: "d").target = self
        workspace.items.last?.keyEquivalentModifierMask = [.command, .shift]
        workspace.addItem(withTitle: "Show PDF or Image on Classroom Display…", action: #selector(presentMaterial), keyEquivalent: "").target = self
        workspace.addItem(withTitle: "Blank Classroom Display", action: #selector(blankDisplay), keyEquivalent: "b").target = self
        workspace.items.last?.keyEquivalentModifierMask = [.command, .shift]
        workspace.addItem(withTitle: "Move Classroom Display to Next Screen", action: #selector(moveDisplay), keyEquivalent: "").target = self
        let windowItem = NSMenuItem(); bar.addItem(windowItem)
        let windows = NSMenu(title: "Window"); windowItem.submenu = windows; NSApp.windowsMenu = windows
        windows.addItem(withTitle: "Teacher Workspace", action: #selector(showTeacher), keyEquivalent: "").target = self
        windows.addItem(withTitle: "Classroom Display", action: #selector(showDisplay), keyEquivalent: "").target = self
        windows.addItem(.separator())
        windows.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windows.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        let fullscreen = windows.addItem(withTitle: "Enter Full Screen", action: #selector(toggleFullscreen), keyEquivalent: "f")
        fullscreen.target = self; fullscreen.keyEquivalentModifierMask = [.command, .control]
        windows.addItem(.separator())
        windows.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        NSApp.mainMenu = bar
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { toolbarDefaultItemIdentifiers(toolbar) }
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        if toolbar.identifier == "InkWireBoardToolbar" { return [.flexibleSpace, .init("present"), .init("blank"), .init("browser")] }
        return [.init("back"), .init("home"), .flexibleSpace, .init("layout"), .init("present"), .init("blank"), .init("focus"), .init("browser")]
    }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar: Bool) -> NSToolbarItem? {
        if id.rawValue == "layout" {
            let item = NSToolbarItem(itemIdentifier: id); item.label = "Workspace layout"
            let choices = NSPopUpButton(frame: .zero, pullsDown: false)
            for choice in WorkspacePreset.allCases { choices.addItem(withTitle: choice.title); choices.lastItem?.representedObject = choice.rawValue }
            choices.selectItem(withTitle: preset.title); choices.target = self; choices.action = #selector(choosePreset(_:))
            choices.toolTip = "Arrange the teacher workspace and classroom display"; choices.setAccessibilityLabel("Workspace layout")
            layoutButton = choices; item.view = choices; return item
        }
        let specs: [String:(String,String,Selector)] = ["back":("chevron.left","Back",#selector(back)), "home":("books.vertical","My notebooks",#selector(home)), "focus":("sidebar.left","Show or hide notebook navigation",#selector(toggleFocus)), "compact":("rectangle.compress.vertical","Compact window",#selector(toggleCompact)), "pin":("pin","Keep on top",#selector(togglePin)), "browser":("arrow.up.right.square","Open in browser",#selector(openBrowser)), "present":("airplay.video","Show a Live Board on the classroom display",#selector(presentBoard)), "blank":("rectangle.slash","Blank classroom display",#selector(blankDisplay))]
        guard let spec = specs[id.rawValue] else { return nil }
        let item = NSToolbarItem(itemIdentifier: id); item.label = spec.1
        let button = NSButton(image: (NSImage(systemSymbolName: spec.0, accessibilityDescription: spec.1) ?? NSImage(size:NSSize(width:18,height:18))), target: self, action: spec.2)
        button.bezelStyle = .toolbar; button.toolTip = spec.1; button.setAccessibilityLabel(spec.1); item.view = button
        if id.rawValue == "back" { backButton = button }; if id.rawValue == "focus" { focusButton = button }; if id.rawValue == "pin" { pinButton = button }; if id.rawValue == "compact" { compactButton = button }
        return item
    }
    func updateControls() { backButton?.isEnabled = web.canGoBack; if web.isLoading { progress.startAnimation(nil) } else { progress.stopAnimation(nil) } }
    var activeTeachingWeb: WKWebView { if let current = NSApp.keyWindow, let view = current.contentView as? WKWebView { return view }; if let view = lastTeachingWindow?.contentView as? WKWebView { return view }; return web }
    @objc func back() { activeTeachingWeb.goBack() }
    func navigate(_ url: URL) { window.makeKeyAndOrderFront(nil); web.load(URLRequest(url: url)) }
    @objc func home() { navigate(URL(string: "/notebooks", relativeTo: policy.origin)!.absoluteURL) }
    @objc func dashboard() { navigate(URL(string: "/teacher", relativeTo: policy.origin)!.absoluteURL) }
    @objc func reload() { activeTeachingWeb.reload() }
    @objc func openBrowser() { if let url = activeTeachingWeb.url, policy.isWorkspace(url) { NSWorkspace.shared.open(url) } }
    @objc func toggleFocus() {
        window.makeKeyAndOrderFront(nil); setNotebookFocus(!isFocused)
    }
    func setNotebookFocus(_ value: Bool) {
        isFocused = value; focusButton?.state = value ? .on : .off
        web.evaluateJavaScript("document.documentElement.classList.toggle('ink-note-focus', \(value ? "true" : "false"));", completionHandler: nil)
    }

    @objc func choosePreset(_ sender: Any) {
        let raw = (sender as? NSMenuItem)?.representedObject as? String ?? (sender as? NSPopUpButton)?.selectedItem?.representedObject as? String
        guard let raw, let selected = WorkspacePreset(rawValue: raw) else { return }
        applyPreset(selected)
    }
    func applyPreset(_ selected: WorkspacePreset) {
        guard display != nil else { return }
        let fullscreenWindows = [window!, display.window].filter { $0.styleMask.contains(.fullScreen) }
        if !fullscreenWindows.isEmpty {
            pendingPreset = selected
            fullscreenWindows.forEach { $0.toggleFullScreen(nil) }
            return
        }
        guard let teacherScreen = window.screen ?? NSScreen.screens.first else { return }
        pendingPreset = nil; preset = selected
        let savedScreen = UserDefaults.standard.string(forKey: "InkWireClassroomScreen")
        let available = NSScreen.screens.filter { $0 !== teacherScreen }
        let other = available.first { screenID($0) == savedScreen } ?? available.first
        let frames = WorkspaceFrames.make(preset: selected, teacherScreen: teacherScreen.visibleFrame, classroomScreen: other?.visibleFrame)
        window.setFrame(frames.teacher, display: true)
        if let frame = frames.classroom {
            display.window.setFrame(frame, display: true); display.window.orderFront(nil)
        } else { display.window.orderOut(nil) }
        compact = false; compactButton?.state = .off
        layoutButton?.selectItem(withTitle: selected.title)
        UserDefaults.standard.set(selected.rawValue, forKey: "InkWireWorkspacePreset")
        setNotebookFocus(selected == .focus)
        window.makeKeyAndOrderFront(nil)
        if selected == .twoDisplays && other == nil {
            notice.stringValue = "One display is connected. The classroom display is beside your workspace; choose Two displays again after connecting a projector."
            notice.isHidden = false
        }
    }
    func finishPendingLayout() {
        guard let next = pendingPreset, !window.styleMask.contains(.fullScreen), !display.window.styleMask.contains(.fullScreen) else { return }
        applyPreset(next)
    }
    func windowDidExitFullScreen(_ notification: Notification) { finishPendingLayout() }
    func windowDidBecomeKey(_ notification: Notification) {
        if let active = notification.object as? NSWindow { lastTeachingWindow = active }
    }
    func screenID(_ screen: NSScreen) -> String { (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.stringValue ?? screen.localizedName }
    func rememberClassroomScreen() {
        guard display != nil, NSScreen.screens.count > 1, let screen = display.window.screen, screen !== window.screen else { return }
        UserDefaults.standard.set(screenID(screen), forKey: "InkWireClassroomScreen")
    }
    func screensChanged() {
        let visible = NSScreen.screens.map(\.visibleFrame)
        guard let primary = NSScreen.screens.first else { return }
        if !visible.contains(where: { $0.intersects(window.frame) }) { window.setFrame(primary.visibleFrame.insetBy(dx: 16, dy: 16), display: true) }
        if display.window.isVisible && !visible.contains(where: { $0.intersects(display.window.frame) }) {
            display.blank()
            display.window.setFrame(primary.visibleFrame.insetBy(dx: 40, dy: 40), display: true)
            window.makeKeyAndOrderFront(nil)
        }
    }
    @objc func showTeacher() { window.makeKeyAndOrderFront(nil) }
    @objc func showDisplay() { display.window.makeKeyAndOrderFront(nil) }
    @objc func blankDisplay() { display.blank() }
    @objc func toggleFullscreen() { (NSApp.keyWindow ?? window).toggleFullScreen(nil) }
    @objc func moveDisplay() {
        guard NSScreen.screens.count > 1 else { return }
        if display.window.styleMask.contains(.fullScreen) { display.window.toggleFullScreen(nil); return }
        let screens = NSScreen.screens, index = screens.firstIndex { $0 === display.window.screen } ?? 0
        display.window.setFrame(screens[(index + 1) % screens.count].visibleFrame.insetBy(dx: 16, dy: 16), display: true)
        display.window.orderFront(nil); rememberClassroomScreen()
    }
    func prepareClassroomDisplay() {
        if !display.window.isVisible && preset == .focus { applyPreset(NSScreen.screens.count > 1 ? .twoDisplays : .teaching) }
        display.window.orderFront(nil)
    }
    @objc func presentBoard() {
        let source = activeTeachingWeb
        if let url = source.url, let board = policy.classroomBoardURL(url) { present(board, source: source); return }
        guard let current = source.url, policy.isWorkspace(current) else { boardHelp(); return }
        source.evaluateJavaScript("Array.from(document.querySelectorAll('.notebook-live-board iframe[src]')).map(frame=>({url:frame.src,title:frame.title||'Live Board'}))") { [weak self, weak source] result, _ in
            guard let self, let source else { return }
            var seen = Set<URL>()
            let boards: [(URL, String)] = (result as? [[String: String]] ?? []).compactMap { item in
                guard let raw = item["url"], let url = URL(string: raw), let safe = self.policy.classroomBoardURL(url), seen.insert(safe).inserted else { return nil }
                return (safe, String((item["title"] ?? "Live Board").prefix(100)))
            }
            if boards.count == 1 { self.present(boards[0].0, source: source); return }
            guard !boards.isEmpty else { self.boardHelp(); return }
            let alert = NSAlert(); alert.messageText = "Choose the Live Board to display"
            alert.informativeText = "Only this shared board will appear on the classroom display. Your notebook and assessment controls stay here."
            let picker = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 380, height: 28))
            boards.forEach { picker.addItem(withTitle: $0.1) }; alert.accessoryView = picker
            alert.addButton(withTitle: "Show board"); alert.addButton(withTitle: "Cancel")
            alert.beginSheetModal(for: source.window ?? self.window) { response in
                if response == .alertFirstButtonReturn { self.present(boards[picker.indexOfSelectedItem].0, source: source) }
            }
        }
    }
    func present(_ url: URL, source: WKWebView) {
        guard display.showBoard(url, sourceConfiguration: source.configuration) else { boardHelp(); return }
        prepareClassroomDisplay()
    }
    func boardHelp() {
        let alert = NSAlert(); alert.messageText = "Choose a Live Board first"
        alert.informativeText = "Open a notebook page containing a Live Board, or open the board in its own window, then choose Show Live Board on Classroom Display. The board must be open to the class."
        alert.beginSheetModal(for: lastTeachingWindow ?? window)
    }
    @objc func presentMaterial() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.pdf, .image]; panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false; panel.prompt = "Show on classroom display"; panel.message = "Choose a PDF or image. The selected file stays on this Mac."
        panel.beginSheetModal(for: lastTeachingWindow ?? window) { [weak self] response in
            guard let self, response == .OK, let url = panel.url else { return }
            do { try self.display.showMaterial(url); self.prepareClassroomDisplay() }
            catch { let alert = NSAlert(); alert.messageText = "This material could not open"; alert.informativeText = "Choose a readable PDF or image file."; alert.beginSheetModal(for: self.lastTeachingWindow ?? self.window) }
        }
    }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(choosePreset(_:)) { menuItem.state = (menuItem.representedObject as? String) == preset.rawValue ? .on : .off }
        if menuItem.action == #selector(moveDisplay) { return NSScreen.screens.count > 1 }
        if menuItem.action == #selector(toggleFullscreen) { menuItem.title = (NSApp.keyWindow ?? window)?.styleMask.contains(.fullScreen) == true ? "Exit Full Screen" : "Enter Full Screen" }
        return true
    }
    @objc func toggleCompact() {
        compact.toggle(); compactButton?.state = compact ? .on : .off
        if compact { fullFrame = window.frame; let old = window.frame; window.setFrame(NSRect(x: old.minX, y: old.maxY-680, width: 640, height: 680), display: true, animate: true) }
        else if let frame = fullFrame { window.setFrame(frame, display: true, animate: true) }
    }
    @objc func togglePin() { window.level = window.level == .floating ? .normal : .floating; pinButton?.state = window.level == .floating ? .on : .off }
    @objc func printPage() { let active = activeTeachingWeb; active.printOperation(with: NSPrintInfo.shared).runModal(for: active.window ?? window, delegate: nil, didRun: nil, contextInfo: nil) }
    @objc func about() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName:"Ink Wire LMS", .applicationVersion:"0.3 · classroom beta", .credits:NSAttributedString(string:"Part of Ink Wire Learning Studio.\nOnline notebooks and a separate classroom display.\nZoom meetings open in Zoom or your browser.")]) }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { if webView === web { notice.isHidden = true; updateControls() } }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { if webView === web { updateControls(); setNotebookFocus(preset == .focus && UserDefaults.standard.string(forKey: "InkWireWorkspacePreset") != nil) } }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
    func fail(_ error: Error) { guard (error as NSError).code != NSURLErrorCancelled else { return }; notice.stringValue = "Could not connect. Check your connection, then use View → Reload. Your notebook remains open."; notice.isHidden = false; updateControls() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { notice.stringValue = "The notebook view stopped. Use View → Reload to reconnect. Any unsaved browser draft may be recovered by the notebook."; notice.isHidden = false }
    func isWorkspaceURL(_ url: URL) -> Bool { policy.isWorkspace(url) }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.targetFrame == nil, let url = action.request.url, url.absoluteString == "about:blank" || isWorkspaceURL(url) else { return nil }
        let child = WKWebView(frame:.zero, configuration:configuration)
        child.navigationDelegate = self; child.uiDelegate = self; child.allowsBackForwardNavigationGestures = true
        let popup = NSWindow(contentRect:NSRect(x:0,y:0,width:1280,height:850),styleMask:[.titled,.closable,.resizable,.miniaturizable],backing:.buffered,defer:false)
        popup.title = "Ink Wire LMS · Live Board"; popup.minSize = NSSize(width:480,height:400)
        popup.collectionBehavior.insert(.fullScreenPrimary); popup.isReleasedWhenClosed = false; popup.delegate = self
        let toolbar = NSToolbar(identifier: "InkWireBoardToolbar"); toolbar.delegate = self; toolbar.displayMode = .iconOnly
        popup.toolbarStyle = .unifiedCompact; popup.toolbar = toolbar
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
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { downloadWindows[download] = webView.window ?? window; download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { downloadWindows[download] = webView.window ?? window; download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = URL(fileURLWithPath:suggestedFilename).lastPathComponent
        panel.beginSheetModal(for: downloadWindows[download] ?? window) { result in if result == .OK, let url = panel.url { self.downloadURLs[download] = url; completionHandler(url) } else { self.downloadWindows.removeValue(forKey: download); completionHandler(nil) } }
    }
    func downloadDidFinish(_ download: WKDownload) { downloadWindows.removeValue(forKey: download); if let url = downloadURLs.removeValue(forKey:download) { NSWorkspace.shared.activateFileViewerSelecting([url]) } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { downloadURLs.removeValue(forKey:download); let owner = downloadWindows.removeValue(forKey: download) ?? window!; let alert = NSAlert(); alert.messageText = "Download could not finish"; alert.informativeText = error.localizedDescription; alert.beginSheetModal(for: owner) }
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
#if !DESKTOP_SMOKE_TEST
@main struct InkNoteMain { static func main() { let app = NSApplication.shared; let delegate = InkNoteApp(); app.delegate = delegate; withExtendedLifetime(delegate) { app.run() } } }
#endif
