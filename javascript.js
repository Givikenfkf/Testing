// public/app.js (client-only version)
// Note: This is a simplified example demonstrating in-browser read/edit/save flows.

const fileInput = document.getElementById('file-input');
const readBtn = document.getElementById('read-btn');
const metaSection = document.getElementById('meta-section');
const metadataList = document.getElementById('metadata-list');
const editPairs = document.getElementById('edit-pairs');
const addPairBtn = document.getElementById('add-pair');
const saveBtn = document.getElementById('save-btn');
const fileNameSpan = document.getElementById('file-name');
const message = document.getElementById('message');
const downloadLink = document.getElementById('download-link');
const exeHints = document.getElementById('exe-hints');
const applyExeBtn = document.getElementById('apply-exe');

let currentFile = null;      // File object
let currentMetadata = {};    // { key: value }
let currentBytes = null;     // ArrayBuffer of file

function showMessage(msg, err=false) {
  message.textContent = msg;
  message.style.color = err ? 'crimson' : 'green';
}

readBtn.addEventListener('click', async () => {
  const f = fileInput.files[0];
  if (!f) return showMessage('Select a file first', true);
  currentFile = f;
  fileNameSpan.textContent = f.name;
  currentBytes = await f.arrayBuffer();

  // determine type by extension
  const ext = (f.name.split('.').pop() || '').toLowerCase();

  try {
    if (['jpg','jpeg','tif','tiff','png'].includes(ext)) {
      // Images: exifr for reading
      showMessage('Reading image EXIF (exifr)...');
      const exif = await exifr.parse(currentBytes, true); // returns many tags
      currentMetadata = exif || {};
      renderMetadataList(currentMetadata);
      metaSection.classList.remove('hidden');
      exeHints.classList.add('hidden');
    } else if (['mp3','flac','m4a','wav','ogg'].includes(ext)) {
      showMessage('Reading audio tags (music-metadata-browser)...');
      const mm = await musicMetadata.parseBuffer(new Uint8Array(currentBytes), f.name);
      // mm.common and mm.format
      currentMetadata = Object.assign({}, mm.common);
      renderMetadataList(currentMetadata);
      metaSection.classList.remove('hidden');
      exeHints.classList.add('hidden');
    } else if (ext === 'pdf') {
      showMessage('Reading PDF (pdf-lib)...');
      const pdfDoc = await PDFLib.PDFDocument.load(currentBytes);
      // pdf-lib gives access to metadata we can read/write:
      const title = pdfDoc.getTitle();
      const author = pdfDoc.getAuthor();
      const subject = pdfDoc.getSubject();
      currentMetadata = { Title: title, Author: author, Subject: subject };
      // store pdfDoc for saves
      currentMetadata._pdfDoc = pdfDoc;
      renderMetadataList(currentMetadata);
      metaSection.classList.remove('hidden');
      exeHints.classList.add('hidden');
    } else if (ext === 'exe') {
      showMessage('EXE files require a server-side tool (ExifTool/pe tools) to edit. You can only inspect basic info locally.', true);
      exeHints.classList.remove('hidden');
      renderMetadataList({ Note: 'EXE editing not supported client-side. Use server option.' });
      metaSection.classList.remove('hidden');
    } else {
      showMessage('File type not recognized for client-side metadata operations.', true);
    }
  } catch (err) {
    showMessage('Error reading file: ' + err.message, true);
  }
});

function renderMetadataList(md) {
  metadataList.innerHTML = '';
  editPairs.innerHTML = '';
  const keys = Object.keys(md).filter(k => !k.startsWith('_')).sort();
  keys.forEach(k => {
    const v = md[k];
    const row = document.createElement('div');
    row.className = 'pair';
    row.innerHTML = `<strong>${escapeHtml(k)}</strong>: <span>${escapeHtml(String(v))}</span>`;
    metadataList.appendChild(row);

    const editRow = document.createElement('div');
    editRow.className = 'pair';
    editRow.innerHTML = `<input class="key" value="${escapeHtml(k)}"> <input class="val" value="${escapeHtml(String(v))}"> <button class="rem">Remove</button>`;
    editRow.querySelector('.rem').addEventListener('click', ()=> editRow.remove());
    editPairs.appendChild(editRow);
  });
}

addPairBtn.addEventListener('click', ()=> {
  const editRow = document.createElement('div');
  editRow.className = 'pair';
  editRow.innerHTML = `<input class="key" placeholder="key"> <input class="val" placeholder="value"> <button class="rem">Remove</button>`;
  editRow.querySelector('.rem').addEventListener('click', ()=> editRow.remove());
  editPairs.appendChild(editRow);
});

saveBtn.addEventListener('click', async () => {
  if (!currentFile) return showMessage('No file loaded', true);
  const ext = (currentFile.name.split('.').pop() || '').toLowerCase();
  const tags = {};
  Array.from(editPairs.querySelectorAll('.pair')).forEach(p => {
    const k = p.querySelector('.key')?.value?.trim();
    const v = p.querySelector('.val')?.value;
    if (k) tags[k] = v;
  });

  try {
    if (['jpg','jpeg','tif','tiff','png'].includes(ext)) {
      // exifr currently supports reading; writing EXIF fully in-browser is possible with other libs
      // Simple route: re-encode image without EXIF (or use piexifjs for JPEG)
      showMessage('For full EXIF writing in-browser, integrate piexifjs. This demo will create a basic download with metadata stored as JSON sidecar.');
      const blob = new Blob([currentBytes], { type: currentFile.type });
      triggerDownload(blob, currentFile.name);
      // also provide JSON sidecar
      triggerDownload(new Blob([JSON.stringify(tags, null, 2)], { type: 'application/json' }), currentFile.name + '.metadata.json');
      showMessage('Download: file + metadata JSON sidecar.');
    } else if (ext === 'pdf') {
      showMessage('Writing PDF metadata (pdf-lib)...');
      const pdfDoc = currentMetadata._pdfDoc;
      if (!pdfDoc) throw new Error('PDF document missing');
      if (tags.Title) pdfDoc.setTitle(tags.Title);
      if (tags.Author) pdfDoc.setAuthor(tags.Author);
      if (tags.Subject) pdfDoc.setSubject(tags.Subject);
      const newBytes = await pdfDoc.save();
      const blob = new Blob([newBytes], { type: 'application/pdf' });
      triggerDownload(blob, currentFile.name.replace(/\\.pdf$/i, '') + '_modified.pdf');
      showMessage('PDF downloaded with updated metadata.');
    } else if (['mp3','flac','m4a'].includes(ext)) {
      showMessage('Client-side audio tag writing is limited in-browser. Consider server-side for full tag writes.');
      // fallback: produce sidecar
      triggerDownload(new Blob([JSON.stringify(tags, null,2)], { type: 'application/json' }), currentFile.name + '.metadata.json');
    } else {
      showMessage('Cannot write this file type client-side. Use server-hosted option.', true);
    }
  } catch (err) {
    showMessage('Save error: ' + err.message, true);
  }
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) { return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
