import './style.css'

interface Snippet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

// Global declaration for our exposed Electron API
declare global {
  interface Window {
    electronAPI: {
      getSnippets: () => Promise<Snippet[]>;
      saveSnippets: (snippets: Snippet[]) => Promise<void>;
      pasteSnippet: (text: string) => Promise<void>;
      hideWindow: () => Promise<void>;
    }
  }
}

// State
let snippets: Snippet[] = [];
let filteredSnippets: Snippet[] = [];
let selectedIndex = 0;
let editingSnippetId: string | null = null;
let isModalOpen = false;

// DOM Elements
const appContainer = document.getElementById('app') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLUListElement;

const modalOverlay = document.getElementById('modal-overlay') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
const addTitle = document.getElementById('add-title') as HTMLInputElement;
const addContent = document.getElementById('add-content') as HTMLTextAreaElement;

const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;
const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;

async function init() {
  console.log('[App] Initializing App...');
  if (!window.electronAPI) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: #ff5555; pointer-events: none;">Critical Error: Electron API not found.</li>';
    return;
  }
  
  try {
    snippets = await window.electronAPI.getSnippets();
    console.log('[App] Loaded snippets:', snippets.length);
  } catch (err) {
    console.error('[App] Failed to load snippets:', err);
    snippets = [];
  }

  filterSnippets('');
  searchInput.focus();
}

// Logic: Filtering & Rendering
function filterSnippets(query: string) {
  if (!query.trim()) {
    filteredSnippets = [...snippets].sort((a, b) => b.createdAt - a.createdAt);
  } else {
    const q = query.toLowerCase();
    filteredSnippets = snippets.filter(s =>
      s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    ).sort((a, b) => b.createdAt - a.createdAt);
  }
  
  if (selectedIndex >= filteredSnippets.length) {
    selectedIndex = Math.max(0, filteredSnippets.length - 1);
  } else if (filteredSnippets.length > 0 && selectedIndex < 0) {
    selectedIndex = 0;
  }

  renderResults();
}

function renderResults() {
  resultsList.innerHTML = '';

  if (filteredSnippets.length === 0) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: var(--text-muted); pointer-events: none; opacity: 0.5; padding: 20px; height: auto;">No snippets found. Press ⌘N to create one.</li>';
    return;
  }

  filteredSnippets.forEach((snippet, index) => {
    const li = document.createElement('li');
    li.className = `snippet-item ${index === selectedIndex ? 'selected' : ''}`;

    li.onclick = () => {
      selectedIndex = index;
      const allItems = resultsList.querySelectorAll('.snippet-item');
      allItems.forEach(item => item.classList.remove('selected'));
      li.classList.add('selected');
    };

    // Double-click to paste
    li.ondblclick = () => {
      triggerPaste();
    };

    const iconDiv = document.createElement('div');
    iconDiv.className = 'snippet-item-icon';
    iconDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">code</span>';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'snippet-item-info';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'snippet-title';
    titleSpan.textContent = snippet.title;
    
    const previewSpan = document.createElement('span');
    previewSpan.className = 'snippet-preview';
    // Single line preview (replace newlines with spaces)
    previewSpan.textContent = snippet.content.replace(/\n/g, ' ').substring(0, 80);
    
    infoDiv.appendChild(titleSpan);
    infoDiv.appendChild(previewSpan);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'snippet-item-right';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'snippet-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">edit</span>';
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openModal(snippet.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete';
    deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">delete</span>';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSnippet(snippet.id);
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    const tagSpan = document.createElement('span');
    tagSpan.className = 'snippet-item-tag';
    tagSpan.textContent = 'TEXT';

    rightDiv.appendChild(actionsDiv);
    rightDiv.appendChild(tagSpan);

    li.appendChild(iconDiv);
    li.appendChild(infoDiv);
    li.appendChild(rightDiv);
    resultsList.appendChild(li);
  });

  const selectedEl = resultsList.querySelector('.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

// Logic: Actions
async function deleteSnippet(id: string) {
  if (!confirm('Are you sure you want to delete this snippet?')) {
    return;
  }

  snippets = snippets.filter(s => s.id !== id);
  await window.electronAPI.saveSnippets(snippets);
  filterSnippets(searchInput.value);
}

async function triggerPaste() {
  if (filteredSnippets.length > 0 && selectedIndex >= 0) {
    const selected = filteredSnippets[selectedIndex];
    await window.electronAPI.pasteSnippet(selected.content);
  }
}

function openModal(snippetId: string | null = null) {
  const snippet = snippetId ? snippets.find(s => s.id === snippetId) : null;
  
  editingSnippetId = snippetId;
  isModalOpen = true;
  appContainer.classList.add('modal-open');
  modalOverlay.classList.remove('hidden');
  
  if (snippet) {
    modalTitle.textContent = 'Edit Snippet';
    addTitle.value = snippet.title;
    addContent.value = snippet.content;
  } else {
    modalTitle.textContent = 'Create Snippet';
    addTitle.value = searchInput.value;
    addContent.value = '';
  }
  
  setTimeout(() => addTitle.focus(), 50);
}

function closeModal() {
  isModalOpen = false;
  editingSnippetId = null;
  appContainer.classList.remove('modal-open');
  modalOverlay.classList.add('hidden');
  searchInput.focus();
}

async function handleSave() {
  const title = addTitle.value.trim();
  const content = addContent.value.trim();
  
  if (!title || !content) {
    alert('Title and content are required.');
    return;
  }

  if (editingSnippetId) {
    snippets = snippets.map(s => s.id === editingSnippetId ? {
      ...s,
      title,
      content
    } : s);
  } else {
    const newSnippet: Snippet = {
      id: Math.random().toString(36).substring(7),
      title,
      content,
      createdAt: Date.now()
    };
    snippets.push(newSnippet);
    searchInput.value = '';
  }

  await window.electronAPI.saveSnippets(snippets);
  filterSnippets(searchInput.value);
  closeModal();
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  filterSnippets(target.value);
});

btnSave.onclick = handleSave;
btnCancel.onclick = closeModal;
btnCloseModal.onclick = closeModal;

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openModal();
    return;
  }

  if (isModalOpen) {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndex < filteredSnippets.length - 1) {
      selectedIndex++;
      renderResults();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex > 0) {
      selectedIndex--;
      renderResults();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    triggerPaste();
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    if (filteredSnippets.length > 0 && selectedIndex >= 0) {
      e.preventDefault();
      deleteSnippet(filteredSnippets[selectedIndex].id);
    }
  } else if (e.key === 'Escape') {
    if (searchInput.value) {
      searchInput.value = '';
      filterSnippets('');
    } else {
      window.electronAPI.hideWindow();
    }
  }
});

init();
