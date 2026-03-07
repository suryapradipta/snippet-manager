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

let isAdding = false;

async function init() {
  snippets = await window.electronAPI.getSnippets();

  // Seed with example if empty
  if (snippets.length === 0) {
    snippets = [
      { id: '1', title: 'React Functional Component', content: 'export default function Component() {\n  return <div>Hello</div>;\n}', createdAt: Date.now() },
      { id: '2', title: 'Console Log', content: 'console.log("Here:", );', createdAt: Date.now() - 1000 },
      { id: '3', title: 'Current Date', content: new Date().toISOString().split('T')[0], createdAt: Date.now() - 2000 }
    ];
    await window.electronAPI.saveSnippets(snippets);
  }

  filterSnippets('');

  // Focus input automatically
  searchInput.focus();
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

    const previewDiv = document.createElement('div');
    previewDiv.className = 'snippet-preview';
    // Single line preview mapping newlines to spaces
    previewDiv.textContent = snippet.content.replace(/\n/g, ' ↵ ');

    li.appendChild(titleDiv);
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
  if (filteredSnippets.length > 0) {
    const selected = filteredSnippets[selectedIndex];
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
  } else {
    addForm.classList.add('hidden');
    resultsList.classList.remove('hidden');
    searchInput.disabled = false;
    searchInput.focus();
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
  filterSnippets(searchInput.value); // Re-filter and render
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
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Cmd+Enter to save snippet
      e.preventDefault();
      saveNewSnippet();
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
  } else if (e.key === 'Escape') {
    // Hide window logic could optionally go here, but blur handles it
  }
});

init();
