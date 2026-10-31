import './worksheet.css';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { openWorksheetCache } from './worksheet-cache.js';
import { applyOperation, validateFile, validateAnnotation, compareRecords, translate, lassoContains, MAX_PDF_BYTES, MAX_PAGES, UUID, MAX_ANNOTATION_BYTES } from './worksheet-model.js';
import { drawAnnotation, drawSelection, hitAnnotation, annotationBounds } from './worksheet-render.js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { formattingExtensions, mountTextFormatting } from './text-formatting.js';
import { FONT_FAMILIES, jsonFromRich, richFromJSON, plainRichText } from './rich-text.js';

const toolNames = { hand: 'Scroll', select: 'Select / move', text: 'Type', pen: 'Pen', marker: 'Highlight', eraser: 'Erase stroke', lasso: 'Lasso', arrow: 'Arrow', rectangle: 'Rectangle', ellipse: 'Ellipse' };
const clone = value => structuredClone(value);
const download = (bytes, name, type) => {
  const url = URL.createObjectURL(new Blob([bytes], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export class Worksheet {
  constructor({ root, room, key, toast, send }) {
    Object.assign(this, { root, room, key, toast, send });
    this.file = null; this.records = {}; this.pending = []; this.role = room ? 'viewer' : 'teacher';
    this.online = false; this.selected = new Set(); this.history = []; this.redo = []; this.visible = new Set(['student', 'teacher']);
    this.tool = 'hand'; this.pages = []; this.activePage = 0; this.saveChain = Promise.resolve(); this.loadNumber = 0;
    this.measureContext = document.createElement('canvas').getContext('2d');
    root.innerHTML = `<div class="worksheet-controls" role="toolbar" aria-label="Worksheet tools">
      <div class="worksheet-tools"></div>
      <div class="worksheet-settings"><label>Colour <input data-ws="color" type="color" value="#315d4c"></label><label>Stroke <select data-ws="width"><option value="2">Fine</option><option value="4" selected>Medium</option><option value="8">Bold</option><option value="18">Broad</option></select></label>
      <label>Text font <select data-ws="family">${FONT_FAMILIES.map(font => `<option>${font}</option>`).join('')}</select></label><label>Text size <input data-ws="font" type="number" min="8" max="96" value="20" aria-label="Default text size"></label><label>Text width <select data-ws="text-width"><option value="180">Narrow</option><option value="320" selected>Medium</option><option value="600">Wide</option></select></label>
      <label><input data-ws="finger" type="checkbox"> Draw with finger</label></div>
      <div class="worksheet-actions"><button data-ws="undo">Undo</button><button data-ws="redo">Redo</button><button data-ws="edit">Edit / format text</button><button data-ws="delete">Delete selected</button><button data-ws="import" class="primary">Import PDF</button><input data-ws="file" type="file" accept="application/pdf,.pdf" hidden><button data-ws="export">Export marked PDF</button><button data-ws="backup">Save editable copy</button><button data-ws="restore">Open editable copy</button><input data-ws="backup-file" type="file" accept="application/json,.json" hidden><button data-ws="recovery" hidden>Recover previous annotations</button></div>
      <div class="worksheet-view"><span data-ws="role" class="worksheet-badge"></span><label><input data-ws="show-student" type="checkbox" checked> Student answers</label><label><input data-ws="show-teacher" type="checkbox" checked> Teacher feedback</label><label>Zoom <select data-ws="zoom"><option value=".75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><label>Page <select data-ws="page" aria-label="Go to PDF page"></select></label></div>
    </div><p data-ws="status" class="worksheet-status" role="status">Preparing worksheet…</p>
    <div data-ws="empty" class="worksheet-empty"><span class="worksheet-empty-icon">▤</span><h2>A worksheet you can work on together.</h2><p>Import a PDF, type anywhere, and draw your ideas over each page. The worksheet background stays locked.</p><p class="small">Up to 15 MB and 100 pages. Your original PDF stays separate from your answers.</p></div>
    <div data-ws="pages" class="worksheet-pages" aria-label="PDF worksheet pages"></div>
    <dialog data-ws="text-dialog" aria-labelledby="worksheet-text-heading"><form data-ws="text-form"><h2 id="worksheet-text-heading">Write on the worksheet</h2><p class="small">Select words to format them. Drag the corner handle on the page to resize the text box.</p><div data-ws="text-toolbar"></div><div data-ws="text-value"></div><label class="text-box-width">Box width <input data-ws="box-width" aria-label="Text box width" type="number" min="30" max="1000" step="10"></label><p data-ws="text-count" class="small" role="status"></p><div class="actions"><button type="button" data-ws="text-cancel">Cancel</button><button class="primary" type="submit">Save text</button></div></form></dialog>
    <dialog data-ws="replace-dialog"><h2>Replace this worksheet?</h2><p>The new PDF starts with blank annotation layers. Save an editable copy first if you want to keep working on this version.</p><div class="actions"><button data-ws="replace-cancel">Keep current</button><button data-ws="replace-confirm" class="primary">Replace PDF</button></div></dialog>`;
    this.$ = name => root.querySelector(`[data-ws="${name}"]`);
    for (const [tool, name] of Object.entries(toolNames)) {
      const button = document.createElement('button'); button.textContent = name; button.type = 'button'; button.dataset.tool = tool;
      button.onclick = () => { this.tool = tool; if (tool !== 'select') this.selected.clear(); this.gesture = null; this.update(); this.drawAll(); };
      root.querySelector('.worksheet-tools').append(button);
    }
    this.$('import').onclick = () => this.$('file').click();
    this.$('file').onchange = async () => { const file = this.$('file').files[0]; this.$('file').value = ''; if (file) await this.importPDF(file); };
    this.$('export').onclick = () => this.exportPDF();
    this.$('backup').onclick = () => this.backup();
    this.$('restore').onclick = () => this.$('backup-file').click();
    this.$('backup-file').onchange = async () => { const file = this.$('backup-file').files[0]; this.$('backup-file').value = ''; if (file) await this.restore(file); };
    this.$('recovery').onclick = () => download(JSON.stringify(this.recovery, null, 2), 'previous-worksheet-annotations.json', 'application/json');
    this.$('delete').onclick = () => this.change([...this.selected].map(id => ({ id, value: null })));
    this.$('edit').onclick = () => { const record = this.overlay()[[...this.selected][0]]; if (record?.value?.kind === 'text') this.editText(record.id, record.value); };
    this.$('undo').onclick = () => this.undo(false);
    this.$('redo').onclick = () => this.undo(true);
    this.$('zoom').onchange = () => this.resize();
    this.$('page').onchange = () => this.pages[Number(this.$('page').value)]?.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (const layer of ['student', 'teacher']) this.$(`show-${layer}`).onchange = event => {
      if (event.target.checked) this.visible.add(layer); else this.visible.delete(layer);
      this.selected.clear(); this.drawAll(); this.update();
    };
    root.addEventListener('keydown', event => this.keydown(event));
    this.update(); this.ready = this.initialize();
  }
  async initialize() {
    try {
      this.cache = await openWorksheetCache(`${this.room || 'local'}:${this.key || 'local'}`);
      const cached = await this.cache.read();
      Object.assign(this, { file: cached.file || null, records: cached.records || {}, pending: cached.pending || [], role: cached.role || this.role, recovery: cached.recovery });
      if (cached.cachedPdf && this.file && cached.cachedPdf.id === this.file.id) this.bytes = cached.cachedPdf.bytes;
      if (this.file && this.bytes) await this.openPDF(this.bytes);
    } catch (error) { this.storageError = true; this.toast(`Local recovery is unavailable: ${error.message}`); }
    this.initialized = true; this.update();
  }
  persist(pdf) {
    this.saving = (this.saving || 0) + 1;
    const value = clone({ file: this.file, records: this.records, pending: this.pending, role: this.role, recovery: this.recovery });
    this.saveChain = this.saveChain.then(() => this.cache.write(value, pdf)).catch(error => {
      this.storageError = true; this.toast(`Could not save on this device. Export your work: ${error.message}`); this.update();
    }).finally(() => { this.saving--; });
    return this.saveChain;
  }
  overlay() {
    const records = { ...this.records };
    let order = Math.max(0, ...Object.values(records).map(record => record.order || 0));
    for (const operation of this.pending) if (operation.pdfId === this.file?.id) records[operation.id] = {
      id: operation.id, layer: this.role, revision: (operation.baseRevision || 0) + 1,
      order: records[operation.id]?.order ?? ++order, value: operation.action === 'delete' ? null : operation.value,
    };
    return records;
  }
  editable() { return this.initialized && !this.storageError && ['teacher', 'student'].includes(this.role) && !!this.file && !this.busy; }
  own(record) { return record?.value && record.layer === this.role && this.visible.has(record.layer); }
  update() {
    const editable = this.editable();
    for (const button of this.root.querySelectorAll('[data-tool]')) {
      button.disabled = button.dataset.tool !== 'hand' && !editable;
      button.setAttribute('aria-pressed', String(button.dataset.tool === this.tool));
    }
    this.$('role').textContent = ({ teacher: 'Teacher · feedback layer', student: 'Student · answer layer', viewer: 'Read-only view' })[this.role];
    this.$('import').disabled = !this.initialized || this.role !== 'teacher' || this.busy || this.storageError || (!!this.room && !this.online);
    this.$('restore').disabled = !this.initialized || !!this.room || !!this.busy || !!this.storageError;
    this.$('restore').title = this.room ? 'Open editable copies in a local draft.' : 'Restore a PDF and its editable annotation layers.';
    this.$('export').disabled = !this.pdf || !!this.busy;
    this.$('backup').disabled = !this.bytes || !!this.busy;
    this.$('undo').disabled = !editable || !this.history.length;
    this.$('redo').disabled = !editable || !this.redo.length;
    const records = this.overlay();
    this.selected = new Set([...this.selected].filter(id => this.own(records[id])));
    this.$('delete').disabled = !editable || !this.selected.size;
    this.$('edit').disabled = !editable || this.selected.size !== 1 || records[[...this.selected][0]]?.value?.kind !== 'text';
    this.$('recovery').hidden = !this.recovery;
    this.$('empty').hidden = !!this.file;
    this.$('status').textContent = this.notice || (this.storageError ? 'Local saving failed. Save an editable copy before leaving.' : this.room
      ? `${this.online ? 'Connected' : 'Offline — working from this device'} · ${this.pending.length ? `${this.pending.length} annotation change${this.pending.length === 1 ? '' : 's'} ${this.online ? 'saving…' : 'waiting to sync'}` : 'Annotations saved'}${this.file ? ` · ${this.file.name}` : ''}`
      : `Local draft · saved on this device${this.file ? ` · ${this.file.name}` : ''}`);
    for (const page of this.pages) {
      page.overlay.style.touchAction = this.tool === 'hand' || !editable ? 'pan-x pan-y' : 'none';
      page.overlay.style.cursor = this.tool === 'hand' ? 'grab' : this.tool === 'text' ? 'text' : this.tool === 'select' ? 'default' : 'crosshair';
    }
  }
  async receive(message) {
    if (message.type === 'ready') {
      this.role = message.role || 'teacher'; this.online = true; this.inFlight = null;
      if (this.role === 'viewer' && this.pending.length) { this.recovery = { file: this.file, records: this.overlay() }; this.pending = []; }
      await this.persist(); this.flush(); this.update();
    } else if (message.type === 'worksheet-state') {
      if (message.file?.id !== this.file?.id) {
        if (this.pending.length) { this.recovery = { file: this.file, records: this.overlay() }; this.toast('The PDF changed. Your previous annotations are available under “Recover previous annotations”.'); }
        this.pending = []; this.inFlight = null; this.history = []; this.redo = []; this.selected.clear(); this.bytes = null;
        this.file = message.file; this.records = message.records;
        ++this.loadNumber;
        const previousPdf = this.pdf; this.pdf = null;
        this.clearPages();
        await previousPdf?.destroy();
      } else this.records = message.records;
      await this.persist();
      if (this.file && !this.pdf) await this.fetchPDF();
      this.drawAll(); this.update();
    } else if (message.type === 'worksheet-change' && message.pdfId === this.file?.id) {
      this.acceptRecord(message.record); await this.persist(); this.drawAll(); this.update();
    } else if (message.type === 'worksheet-result') {
      if (message.pdfId !== this.file?.id) { this.inFlight = null; return; }
      const operation = this.pending.find(op => op.opId === message.opId);
      if (!operation) return;
      if (message.record) this.acceptRecord(message.record);
      this.pending = this.pending.filter(op => op.opId !== message.opId && (!message.error || op.id !== operation.id));
      if (message.error) { this.history = []; this.redo = []; this.toast(message.error); }
      this.inFlight = null; await this.persist(); this.flush(); this.drawAll(); this.update();
    }
  }
  acceptRecord(record) {
    if (!this.records[record.id] || record.revision >= this.records[record.id].revision) this.records[record.id] = record;
  }
  disconnected() { this.online = false; this.inFlight = null; this.update(); }
  flush() {
    if (!this.online || this.inFlight || this.storageError || !this.pending.length || this.role === 'viewer') return;
    this.inFlight = this.pending[0].opId;
    this.send({ type: 'worksheet-op', ...this.pending[0] });
  }
  async change(entries, remember = true) {
    if (!this.editable() || !entries.length) return;
    const before = this.overlay(), history = [];
    try {
      // Validate the entire gesture before changing local state.
      let next = before;
      const operations = entries.map(({ id = crypto.randomUUID(), value }) => {
        const old = before[id];
        const operation = { opId: crypto.randomUUID(), id, pdfId: this.file.id, action: value ? 'put' : 'delete', baseRevision: old?.revision ?? null, ...(value ? { value } : {}) };
        const record = applyOperation({ file: this.file, records: next }, operation, this.role);
        next = { ...next, [id]: record };
        history.push({ id, before: clone(old?.value || null), after: clone(value) });
        return operation;
      });
      if (this.room) this.pending.push(...operations);
      else this.records = next;
      if (remember) { this.history.push(history); this.history = this.history.slice(-100); this.redo = []; }
      this.selected.clear(); this.drawAll(); this.update();
      await this.persist(); this.flush();
    } catch (error) { this.toast(error.message); }
  }
  async undo(redo) {
    const stack = redo ? this.redo : this.history, group = stack.pop();
    if (!group || !this.editable()) return;
    await this.change(group.map(item => ({ id: item.id, value: redo ? item.after : item.before })), false);
    (redo ? this.history : this.redo).push(group); this.update();
  }
  async loadPDF(bytes) {
    const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
    const base = new URL('/pdf-assets/', location.origin).href;
    return pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, isEvalSupported: false, enableXfa: false }).promise;
  }
  async openPDF(bytes) {
    const token = ++this.loadNumber;
    const pdf = await this.loadPDF(bytes);
    if (token !== this.loadNumber) { await pdf.destroy(); return; }
    if (pdf.numPages !== this.file.pages.length) { await pdf.destroy(); throw Error('PDF page information does not match this worksheet.'); }
    if (this.pdf) await this.pdf.destroy();
    if (token !== this.loadNumber) { await pdf.destroy(); return; }
    this.pdf = pdf; this.clearPages();
    this.$('page').replaceChildren();
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const page = this.pages[Number(entry.target.dataset.page)];
        page.nearby = entry.isIntersecting;
        if (page.nearby) { this.renderBackground(page); this.draw(page); }
        else { page.task?.cancel(); page.background.width = page.overlay.width = 1; page.background.height = page.overlay.height = 1; page.renderedWidth = 0; }
      }
    }, { rootMargin: '600px' });
    this.file.pages.forEach((size, index) => {
      const element = document.createElement('figure'); element.className = 'worksheet-page'; element.dataset.page = index;
      element.style.aspectRatio = `${size.width} / ${size.height}`;
      const caption = document.createElement('figcaption'); caption.textContent = `Page ${index + 1} · background locked`;
      const background = document.createElement('canvas'); background.setAttribute('aria-hidden', 'true'); background.width = background.height = 1;
      const overlay = document.createElement('canvas'); overlay.className = 'worksheet-overlay'; overlay.tabIndex = 0; overlay.setAttribute('role', 'img'); overlay.setAttribute('aria-label', `Worksheet page ${index + 1}. Choose a tool to annotate. Use Tab to reach the text annotation list.`);
      const list = document.createElement('ul'); list.className = 'worksheet-accessible'; list.setAttribute('aria-label', `Page ${index + 1} annotations`);
      element.append(caption, background, overlay, list); this.$('pages').append(element);
      const page = { element, background, overlay, index, size, list }; this.pages.push(page);
      overlay.onpointerdown = event => this.pointerDown(event, page);
      overlay.onpointermove = event => this.pointerMove(event, page);
      overlay.onpointerup = event => this.pointerUp(event, page);
      overlay.onpointercancel = () => { this.gesture = null; this.draw(page); };
      overlay.ondblclick = event => { if (!this.editable()) return; const record = this.hit(this.point(event, page), index); if (this.own(record) && record.value.kind === 'text') this.editText(record.id, record.value); };
      const option = document.createElement('option'); option.value = index; option.textContent = index + 1; this.$('page').append(option);
      this.observer.observe(element);
    });
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.$('pages'));
    this.resize(); this.update();
  }
  clearPages() {
    this.observer?.disconnect(); this.resizeObserver?.disconnect(); this.gesture = null;
    for (const page of this.pages) page.task?.cancel();
    this.pages = []; this.$('pages').replaceChildren();
  }
  resize() {
    const available = Math.max(240, Math.min(850, this.$('pages').clientWidth - 36));
    for (const page of this.pages) {
      page.element.style.width = `${available * Number(this.$('zoom').value)}px`;
      if (page.nearby) { this.renderBackground(page); this.draw(page); }
    }
  }
  canvasSize(page) {
    const width = page.element.clientWidth, height = width * page.size.height / page.size.width;
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4000000 / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
  }
  async renderBackground(page) {
    if (!this.pdf || !page.nearby) return;
    const { width, height } = this.canvasSize(page);
    if (page.renderedWidth === width) return;
    page.renderedWidth = width;
    const serial = page.serial = (page.serial || 0) + 1, pdf = this.pdf;
    const previous = page.task; previous?.cancel();
    try {
      if (previous) await previous.promise.catch(() => {});
      const pdfPage = await pdf.getPage(page.index + 1);
      if (page.serial !== serial || !page.nearby || pdf !== this.pdf) return;
      page.background.width = width; page.background.height = height;
      const viewport = pdfPage.getViewport({ scale: width / pdfPage.getViewport({ scale: 1 }).width });
      page.task = pdfPage.render({ canvasContext: page.background.getContext('2d'), viewport });
      await page.task.promise;
    } catch (error) { if (error.name !== 'RenderingCancelledException') { page.renderedWidth = 0; this.toast(`Page ${page.index + 1} could not render: ${error.message}`); } }
  }
  pageRecords(index) { return Object.values(this.overlay()).filter(record => record.value?.page === index && this.visible.has(record.layer)).sort(compareRecords); }
  draw(page) {
    if (!page.nearby) return;
    const { width, height } = this.canvasSize(page), canvas = page.overlay;
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.scale(width / 1000, width / 1000);
    const gesture = this.gesture?.page === page ? this.gesture : null;
    const records = this.pageRecords(page.index);
    for (const record of records) {
      if (gesture?.erased?.has(record.id)) continue;
      const value = gesture?.resizing?.id === record.id ? { ...record.value, boxWidth: gesture.newWidth || record.value.boxWidth }
        : gesture?.moving?.has(record.id) ? translate(record.value, gesture.dx || 0, gesture.dy || 0, page.size) : record.value;
      drawAnnotation(context, value);
      if (this.selected.has(record.id)) drawSelection(context, value);
    }
    if (gesture?.value) drawAnnotation(context, gesture.value);
    if (gesture?.polygon) {
      context.strokeStyle = '#166b91'; context.lineWidth = 2; context.setLineDash([6, 5]); context.beginPath();
      gesture.polygon.forEach((p, i) => i ? context.lineTo(p[0], p[1]) : context.moveTo(p[0], p[1])); context.closePath(); context.stroke();
    }
    // A semantic, keyboard-operable alternative to the canvas.
    page.list.replaceChildren();
    for (const record of records) {
      const item = document.createElement('li'), button = document.createElement('button');
      button.textContent = `${record.layer}: ${record.value.kind === 'text' ? record.value.text : record.value.kind}`;
      button.onclick = () => { this.selected = this.own(record) ? new Set([record.id]) : new Set(); this.tool = 'select'; this.drawAll(); this.update(); };
      item.append(button); page.list.append(item);
    }
  }
  drawAll() { for (const page of this.pages) this.draw(page); }
  point(event, page) {
    const rect = page.overlay.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)), Math.max(0, Math.min(page.size.height / page.size.width * 1000, (event.clientY - rect.top) / rect.width * 1000)), event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : .65];
  }
  hit(point, index) { return this.pageRecords(index).reverse().find(record => this.own(record) && hitAnnotation(point, record.value, this.measureContext)); }
  pointerDown(event, page) {
    if (!this.editable() || this.tool === 'hand' || event.button !== 0 || (event.pointerType === 'touch' && !this.$('finger').checked) || this.gesture) return;
    event.preventDefault(); page.overlay.focus({ preventScroll: true }); this.activePage = page.index; this.$('page').value = page.index;
    const point = this.point(event, page), hit = this.hit(point, page.index);
    if (this.tool === 'text') { point[0] = Math.min(970, point[0]); this.editText(null, { kind: 'text', page: page.index, color: this.$('color').value, width: 2, fontFamily: this.$('family').value, fontSize: Math.max(8, Math.min(96, Number(this.$('font').value) || 20)), boxWidth: Math.min(Number(this.$('text-width').value), 1000 - point[0]), points: [point], text: '' }); return; }
    const gesture = { page, start: point, pointerId: event.pointerId };
    if (this.tool === 'select') {
      const selected = this.selected.size === 1 ? this.overlay()[[...this.selected][0]] : null;
      const box = selected?.value?.kind === 'text' && selected.value.page === page.index ? annotationBounds(selected.value, this.measureContext) : null;
      if (box && Math.hypot(point[0] - box.x - box.width, point[1] - box.y - box.height) < 15) gesture.resizing = selected;
      else {
        if (hit && !this.selected.has(hit.id)) this.selected = new Set([hit.id]);
        if (!hit) this.selected.clear();
        gesture.moving = new Set([...this.selected].filter(id => this.overlay()[id]?.value?.page === page.index));
      }
    } else if (this.tool === 'lasso') { this.selected.clear(); gesture.polygon = [point]; }
    else if (this.tool === 'eraser') { gesture.erased = new Set(hit ? [hit.id] : []); }
    else {
      const width = Number(this.$('width').value);
      gesture.value = { kind: this.tool, page: page.index, color: this.$('color').value, width: this.tool === 'marker' ? Math.min(40, Math.max(12, width * 3)) : width,
        points: ['pen', 'marker'].includes(this.tool) ? [point] : [point, point] };
    }
    this.gesture = gesture; page.overlay.setPointerCapture(event.pointerId); this.draw(page); this.update();
  }
  pointerMove(event, page) {
    const gesture = this.gesture;
    if (!gesture || gesture.page !== page || gesture.pointerId !== event.pointerId) return;
    const point = this.point(event, page);
    if (gesture.resizing) gesture.newWidth = Math.max(30, Math.min(1000 - gesture.resizing.value.points[0][0], gesture.resizing.value.boxWidth + point[0] - gesture.start[0]));
    else if (gesture.value) {
      if (['pen', 'marker'].includes(gesture.value.kind)) {
        for (const sample of event.getCoalescedEvents?.() || [event]) gesture.value.points.push(this.point(sample, page));
        if (gesture.value.points.length > 2048) gesture.value.points = gesture.value.points.filter((_, index) => index % 2 === 0);
      } else gesture.value.points[1] = point;
    } else if (gesture.polygon) { gesture.polygon.push(point); if (gesture.polygon.length > 2048) gesture.polygon = gesture.polygon.filter((_, index) => index % 2 === 0); }
    else if (gesture.erased) { const hit = this.hit(point, page.index); if (hit) gesture.erased.add(hit.id); }
    else { gesture.dx = point[0] - gesture.start[0]; gesture.dy = point[1] - gesture.start[1]; }
    this.draw(page);
  }
  async pointerUp(event, page) {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.page !== page) return;
    this.pointerMove(event, page); this.gesture = null;
    if (page.overlay.hasPointerCapture(event.pointerId)) page.overlay.releasePointerCapture(event.pointerId);
    if (gesture.resizing) {
      const id = gesture.resizing.id;
      await this.change([{ id, value: { ...gesture.resizing.value, boxWidth: gesture.newWidth || gesture.resizing.value.boxWidth } }]); this.selected = new Set([id]);
    }
    else if (gesture.value) await this.change([{ value: gesture.value }]);
    else if (gesture.polygon) { this.selected = new Set(this.pageRecords(page.index).filter(record => this.own(record) && lassoContains(record.value, gesture.polygon)).map(record => record.id)); this.tool = 'select'; }
    else if (gesture.erased) await this.change([...gesture.erased].map(id => ({ id, value: null })));
    else if (gesture.moving?.size && (gesture.dx || gesture.dy)) await this.change([...gesture.moving].map(id => ({ id, value: translate(this.overlay()[id].value, gesture.dx || 0, gesture.dy || 0, page.size) })));
    this.drawAll(); this.update();
  }
  editText(id, value) {
    if (!this.editable()) return;
    const dialog = this.$('text-dialog'), pdfId = this.file.id;
    this.richEditor?.destroy(); this.$('text-value').replaceChildren();
    this.richEditor = new Editor({ element: this.$('text-value'), extensions: [StarterKit.configure({ link: false, code: false, codeBlock: false, horizontalRule: false, blockquote: false }), ...formattingExtensions()],
      content: jsonFromRich(value), editorProps: { attributes: { class: 'worksheet-rich-editor', role: 'textbox', 'aria-label': 'Worksheet text', 'aria-multiline': 'true' } },
      onUpdate: ({ editor }) => { this.$('text-count').textContent = `${editor.getText().length} / 2,000 characters`; } });
    const formatting = mountTextFormatting(this.$('text-toolbar'), this.richEditor, { full: true, defaultSize: value.fontSize, defaultFont: value.fontFamily || 'Arial', defaultColor: value.color });
    this.$('box-width').value = Math.round(value.boxWidth); this.$('box-width').max = Math.floor(1000 - value.points[0][0]);
    this.$('text-count').textContent = `${value.text.length} / 2,000 characters`;
    dialog.onclose = () => { formatting.destroy(); this.richEditor?.destroy(); this.richEditor = null; };
    this.$('text-form').onsubmit = async event => {
      event.preventDefault();
      try {
        if (this.file?.id !== pdfId) throw Error('The PDF changed. Copy your text before reopening the new worksheet.');
        const rich = richFromJSON(this.richEditor.getJSON(), value), text = plainRichText(rich);
        if (!text.trim()) throw Error('Write something in the text box.');
        const first = rich.flatMap(block => block.runs).find(run => run.text), boxWidth = Number(this.$('box-width').value);
        const next = validateAnnotation({ ...value, text, rich, fontSize: first?.fontSize || value.fontSize, fontFamily: first?.fontFamily || value.fontFamily || 'Arial', boxWidth }, this.file);
        await this.change([{ ...(id ? { id } : {}), value: next }]); dialog.close();
      } catch (error) { this.toast(error.message); }
    };
    this.$('text-cancel').onclick = () => dialog.close(); dialog.showModal(); this.richEditor.commands.focus('end');
    if (!value.text) this.richEditor.chain().setFontFamily(value.fontFamily || 'Arial').setFontSize(`${value.fontSize}px`).setColor(value.color).run();
  }
  keydown(event) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || this.root.querySelector('dialog[open]')) return;
    if (event.key === 'Enter' && event.target.tagName === 'CANVAS' && this.editable()) {
      event.preventDefault(); const value = this.overlay()[[...this.selected][0]]?.value;
      if (this.selected.size === 1 && value?.kind === 'text') this.editText([...this.selected][0], value);
      else if (this.tool === 'text') this.editText(null, { kind: 'text', page: Number(event.target.closest('[data-page]').dataset.page), points: [[100, 100, .5]], text: '', fontFamily: this.$('family').value, fontSize: Math.max(8, Math.min(96, Number(this.$('font').value) || 20)), boxWidth: Number(this.$('text-width').value), width: 2, color: this.$('color').value });
    }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); this.undo(event.shiftKey); }
    else if (event.key === 'Escape') { this.selected.clear(); this.gesture = null; this.drawAll(); this.update(); }
    else if (['Delete', 'Backspace'].includes(event.key) && this.selected.size) { event.preventDefault(); this.$('delete').click(); }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && this.selected.size) {
      event.preventDefault(); const step = event.shiftKey ? 20 : 4, selected = [...this.selected], records = this.overlay();
      this.change(selected.map(id => ({ id, value: translate(records[id].value, event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0, this.file.pages[records[id].value.page]) }))).then(() => { this.selected = new Set(selected); this.drawAll(); this.update(); });
    }
  }
  async confirmReplacement() {
    if (!this.file) return true;
    const dialog = this.$('replace-dialog'); dialog.showModal();
    return new Promise(resolve => {
      const finish = value => { dialog.close(); resolve(value); };
      this.$('replace-cancel').onclick = () => finish(false); this.$('replace-confirm').onclick = () => finish(true);
      dialog.oncancel = event => { event.preventDefault(); finish(false); };
    });
  }
  async importPDF(file) {
    if (this.role !== 'teacher' || this.busy || this.storageError || (this.room && !this.online)) return;
    if (file.size > MAX_PDF_BYTES) return this.toast('Choose a PDF smaller than 15 MB.');
    if (this.pending.length) return this.toast('Wait for annotation changes to finish saving before replacing the PDF.');
    let parsed;
    try {
      const bytes = await file.arrayBuffer();
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error('Choose a valid PDF file.');
      this.busy = true; this.notice = 'Reading PDF pages…'; this.update();
      parsed = await this.loadPDF(bytes);
      if (parsed.numPages > MAX_PAGES) throw Error('Choose a PDF with 100 pages or fewer.');
      const pages = [];
      for (let i = 1; i <= parsed.numPages; i++) { const page = await parsed.getPage(i), { width, height } = page.getViewport({ scale: 1 }); pages.push({ width, height }); }
      const metadata = validateFile({ id: crypto.randomUUID(), name: file.name.slice(0, 180), pages });
      if (!await this.confirmReplacement()) return;
      if (this.room) {
        const response = await fetch(`/api/documents/${this.room}/pdf`, { method: 'PUT', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/pdf', 'X-Worksheet-Metadata': encodeURIComponent(JSON.stringify(metadata)), 'If-Match': this.file?.id || 'none' }, body: bytes });
        if (!response.ok) { const result = await response.json(); throw Error(result.error); }
      }
      this.file = metadata; this.records = {}; this.pending = []; this.bytes = bytes; this.history = []; this.redo = []; this.selected.clear();
      await this.persist({ id: metadata.id, bytes }); await this.openPDF(bytes);
      this.tool = 'pen'; this.toast('PDF imported. Each page is locked behind your annotations.');
    } catch (error) { this.toast(error.name === 'PasswordException' ? 'This PDF is password protected. Import an unlocked copy.' : `Could not import PDF: ${error.message}`); }
    finally { await parsed?.destroy(); this.busy = false; this.notice = ''; this.update(); }
  }
  async fetchPDF() {
    const id = this.file?.id;
    if (!id || !this.room) return;
    try {
      const response = await fetch(`/api/documents/${this.room}/pdf?version=${id}`, { headers: { Authorization: `Bearer ${this.key}` } });
      if (!response.ok) throw Error('Could not load this PDF. Reconnect and try again.');
      const bytes = await response.arrayBuffer();
      if (this.file?.id !== id) return;
      this.bytes = bytes; this.notice = ''; await this.persist({ id, bytes }); await this.openPDF(bytes);
    } catch (error) { this.notice = error.message; this.update(); }
  }
  async exportPDF() {
    if (!this.pdf || this.busy) return;
    const records = clone(this.overlay()), visible = new Set(this.visible), pdf = this.pdf, filename = this.file.name;
    this.busy = true; this.update();
    try {
      const { PDFDocument } = await import('pdf-lib'), result = await PDFDocument.create();
      result.setTitle(filename.replace(/\.pdf$/i, '') + ' — annotated');
      for (let i = 0; i < pdf.numPages; i++) {
        this.notice = `Exporting page ${i + 1} of ${pdf.numPages}…`; this.update();
        const page = await pdf.getPage(i + 1), natural = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 2000 / natural.width, Math.sqrt(4000000 / (natural.width * natural.height)));
        const viewport = page.getViewport({ scale }), canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        context.save(); context.scale(viewport.width / 1000, viewport.width / 1000);
        const annotations = Object.values(records).filter(r => r.value?.page === i && visible.has(r.layer)).sort(compareRecords);
        for (const record of annotations) drawAnnotation(context, record.value);
        context.restore();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const image = await result.embedPng(await blob.arrayBuffer());
        result.addPage([natural.width, natural.height]).drawImage(image, { x: 0, y: 0, width: natural.width, height: natural.height });
        canvas.width = canvas.height = 0;
      }
      download(await result.save(), filename.replace(/\.pdf$/i, '') + '-annotated.pdf', 'application/pdf');
      this.toast('Marked PDF exported with the visible layers. Save an editable copy to keep editing outside this browser.');
    } catch (error) { this.toast(`PDF export failed: ${error.message}`); }
    finally { this.busy = false; this.notice = ''; this.update(); }
  }
  backup() {
    if (!this.bytes || !this.file) return;
    const bytes = new Uint8Array(this.bytes); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    download(JSON.stringify({ format: 'inkwire-worksheet-v1', file: this.file, records: this.overlay(), pdf: btoa(binary) }), this.file.name.replace(/\.pdf$/i, '') + '.inkwire.json', 'application/json');
  }
  async restore(file) {
    if (this.room || this.busy || this.storageError) return;
    try {
      if (file.size > 24 * 1024 * 1024) throw Error('This editable copy is too large.');
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'inkwire-worksheet-v1' || typeof backup.pdf !== 'string') throw Error('Choose an Ink Wire editable worksheet copy.');
      const metadata = validateFile(backup.file), records = {};
      if (!backup.records || Object.keys(backup.records).length > 4000) throw Error('Invalid annotation data.');
      for (const [id, record] of Object.entries(backup.records)) {
        if (!UUID.test(id) || !['teacher', 'student'].includes(record.layer) || !Number.isInteger(record.revision) || record.revision < 1) throw Error('Invalid annotation data.');
        records[id] = { id, layer: record.layer, revision: record.revision, order: Number.isSafeInteger(record.order) && record.order > 0 ? record.order : Object.keys(records).length + 1, value: record.value ? validateAnnotation(record.value, metadata) : null };
      }
      if (new TextEncoder().encode(JSON.stringify(records)).byteLength > MAX_ANNOTATION_BYTES) throw Error('Annotation data is too large.');
      const binary = atob(backup.pdf), bytes = Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
      if (bytes.byteLength > MAX_PDF_BYTES) throw Error('The PDF is too large.');
      const pdf = await this.loadPDF(bytes); const count = pdf.numPages; await pdf.destroy();
      if (count !== metadata.pages.length) throw Error('PDF page information does not match.');
      if (!await this.confirmReplacement()) return;
      this.file = metadata; this.records = records; this.pending = []; this.bytes = bytes; this.history = []; this.redo = []; this.selected.clear();
      await this.persist({ id: metadata.id, bytes }); await this.openPDF(bytes); this.toast('Editable worksheet restored as a local draft.'); this.update();
    } catch (error) { this.toast(`Could not restore worksheet: ${error.message}`); }
  }
  hasPendingChanges() { return this.pending.length > 0 || !!this.gesture || !!this.saving; }
}
