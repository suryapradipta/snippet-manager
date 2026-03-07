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
    }
  }
}

// State
let snippets: Snippet[] = [];
let filteredSnippets: Snippet[] = [];
let selectedIndex = 0;

// DOM Elements
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLUListElement;
const addForm = document.getElementById('add-form') as HTMLDivElement;
const addTitle = document.getElementById('add-title') as HTMLInputElement;
const addContent = document.getElementById('add-content') as HTMLTextAreaElement;
const mainFooter = document.getElementById('main-footer') as HTMLDivElement;
const addFooter = document.getElementById('add-footer') as HTMLDivElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;

let isAdding = false;

async function init() {
  console.log('[App] Initializing...');
  if (!window.electronAPI) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: #ff5555; pointer-events: none;">Critical Error: Electron API not found. Preload script might have failed.</li>';
    return;
  }
  
  try {
    snippets = await window.electronAPI.getSnippets();
    console.log('[App] Loaded snippets:', snippets.length);
  } catch (err) {
    console.error('[App] Failed to load snippets:', err);
    snippets = [];
  }

  // Seed with example if empty (REMOVED)
  
  filterSnippets('');

  // Focus input automatically
  searchInput.focus();
}

btnSave.onclick = () => saveNewSnippet();
btnCancel.onclick = () => toggleAddForm();

async function deleteSnippet(id: string, event?: MouseEvent) {
  if (event) {
    event.stopPropagation();
  }

  if (!confirm('Are you sure you want to delete this snippet?')) {
    return;
  }

  snippets = snippets.filter(s => s.id !== id);
  await window.electronAPI.saveSnippets(snippets);
  filterSnippets(searchInput.value);
}

function renderResults() {
  resultsList.innerHTML = '';

  if (filteredSnippets.length === 0) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: var(--text-secondary); pointer-events: none;">No snippets found. Press Cmd+Ctrl+N to add.</li>';
    return;
  }

  filteredSnippets.forEach((snippet, index) => {
    const li = document.createElement('li');
    li.className = `snippet-item ${index === selectedIndex ? 'selected' : ''}`;

    // We handle click
    li.onclick = () => {
      selectedIndex = index;
      renderResults();
      triggerPaste();
    };

    const titleDiv = document.createElement('div');
    titleDiv.className = 'snippet-title';
    titleDiv.textContent = snippet.title;

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSnippet(snippet.id, e);
    };

    const headerDiv = document.createElement('div');
    headerDiv.className = 'snippet-header';
    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(deleteBtn);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'snippet-preview';
    // Single line preview mapping newlines to spaces
    previewDiv.textContent = snippet.content.replace(/\n/g, ' ↵ ');

    li.appendChild(headerDiv);
    li.appendChild(previewDiv);
    resultsList.appendChild(li);
  });

  // Ensure selected item is scrolled into view
  const selectedEl = resultsList.querySelector('.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function filterSnippets(query: string) {
  if (!query.trim()) {
    filteredSnippets = [...snippets].sort((a, b) => b.createdAt - a.createdAt);
  } else {
    const q = query.toLowerCase();
    filteredSnippets = snippets.filter(s =>
      s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    ).sort((a, b) => b.createdAt - a.createdAt);
  }
  selectedIndex = 0;
  renderResults();
}

async function triggerPaste() {
  console.log('[App] triggerPaste called, filteredSnippets length:', filteredSnippets.length);
  if (filteredSnippets.length > 0) {
    const selected = filteredSnippets[selectedIndex];
    console.log('[App] Sending paste IPC for snippet:', selected.title);
    await window.electronAPI.pasteSnippet(selected.content);
  }
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  filterSnippets(target.value);
});

async function toggleAddForm() {
  isAdding = !isAdding;
  if (isAdding) {
    addForm.classList.remove('hidden');
    resultsList.classList.add('hidden');
    searchInput.disabled = true;
    addTitle.focus();
    addTitle.value = searchInput.value; // pre-fill with search term if any
    addContent.value = '';
    mainFooter.classList.add('hidden');
    addFooter.classList.remove('hidden');
  } else {
    addForm.classList.add('hidden');
    resultsList.classList.remove('hidden');
    searchInput.disabled = false;
    searchInput.focus();
    mainFooter.classList.remove('hidden');
    addFooter.classList.add('hidden');
  }
}

async function saveNewSnippet() {
  if (!addTitle.value.trim() || !addContent.value.trim()) {
    toggleAddForm();
    return;
  }

  const newSnippet: Snippet = {
    id: Math.random().toString(36).substring(7),
    title: addTitle.value.trim(),
    content: addContent.value,
    createdAt: Date.now()
  };

  snippets.push(newSnippet);
  await window.electronAPI.saveSnippets(snippets);
  
  // Clear search input so the new snippet is visible at the top of the list
  searchInput.value = '';
  filterSnippets('');
  
  toggleAddForm(); // Close form
}

document.addEventListener('keydown', (e) => {
  // Toggle form trigger: Cmd+N or Ctrl+N
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    toggleAddForm();
    return;
  }

  if (isAdding) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleAddForm();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter allows newline in textarea, do nothing special
        return;
      } else {
        // Simple Enter to save snippet
        e.preventDefault();
        saveNewSnippet();
      }
    }
    return;
  }

  // Normal mode
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
    if (filteredSnippets.length > 0) {
      e.preventDefault();
      deleteSnippet(filteredSnippets[selectedIndex].id);
    }
  } else if (e.key === 'Escape') {
    // Hide window logic could optionally go here, but blur handles it
  }
});

init();
