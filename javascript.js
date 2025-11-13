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

let currentFile = null;
let currentMetadata = {};

function showMessage(msg, err=false) {
  message.textContent = msg;
  message.style.color = err ? 'crimson' : 'green';
}

readBtn.addEventListener('click', async () => {
  const f = fileInput.files[0];
  if (!f) return showMessage('Select a file first', true);

  const form = new FormData();
  form.append('file', f);
  showMessage('Reading metadata...');

  const res = await fetch('/api/read-metadata', { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok) return showMessage(data.error, true);

  currentFile = data.file;
  currentMetadata = data.metadata;
  fileNameSpan.textContent = currentFile.originalname;

  renderMetadataList(currentMetadata);
  metaSection.classList.remove('hidden');
  downloadLink.classList.add('hidden');

  if (/\.exe$/i.test(currentFile.originalname)) exeHints.classList.remove('hidden');
});

function renderMetadataList(md) {
  metadataList.innerHTML = '';
  editPairs.innerHTML = '';

  Object.keys(md).sort().forEach(k => {
    const v = md[k];

    const row = document.createElement('div');
    row.className = 'pair';
    row.innerHTML = `<strong>${k}</strong>: ${v}`;
    metadataList.appendChild(row);

    const edit = document.createElement('div');
    edit.className = 'pair';
    edit.innerHTML = `<input class="key" value="${k}"> <input class="val" value="${v}"> <button class="rem">Remove</button>`;
    edit.querySelector('.rem').addEventListener('click', () => edit.remove());
    editPairs.appendChild(edit);
  });
}

addPairBtn.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'pair';
  row.innerHTML = `<input class="key" placeholder="key"> <input class="val" placeholder="value"> <button class="rem">Remove</button>`;
  row.querySelector('.rem').addEventListener('click', () => row.remove());
  editPairs.appendChild(row);
});

saveBtn.addEventListener('click', async () => {
  const tags = {};
  document.querySelectorAll('.pair').forEach(p => {
    const k = p.querySelector('.key')?.value;
    const v = p.querySelector('.val')?.value;
    if (k) tags[k] = v;
  });

  const body = new URLSearchParams();
  body.append('filepath', currentFile.path);
  body.append('tags', JSON.stringify(tags));

  const res = await fetch('/api/write-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok) return showMessage(data.error, true);

  currentMetadata = data.metadata;
  renderMetadataList(currentMetadata);
  showMessage('Saved');

  downloadLink.href = `/download?filepath=${encodeURIComponent(currentFile.path)}`;
  downloadLink.classList.remove('hidden');
});
