import './style.css'

interface Snippet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

interface Settings {
  launchAtLogin: boolean;
  hideOnBlur: boolean;
  hotkey: string;
}

// Global declaration for our exposed Electron API
declare global {
    interface Window {
    electronAPI: {
      getSnippets: () => Promise<Snippet[]>;
      saveSnippets: (snippets: Snippet[]) => Promise<void>;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
      pasteSnippet: (text: string) => Promise<void>;
      hideWindow: () => Promise<void>;
      getPlatform: () => Promise<string>;
    }
  }
}

let platform = 'darwin';
let modKey = '⌘';
let snippets: Snippet[] = [];
let filteredSnippets: Snippet[] = [];
let currentSettings: Settings = {
  launchAtLogin: true,
  hideOnBlur: true,
  hotkey: 'Command+Shift+Space'
};
let selectedIndex = 0;
let editingSnippetId: string | null = null;
let isModalOpen = false;
let isSettingsOpen = false;
let isRecordingHotkey = false;

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

// Settings DOM Elements
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const editorModal = document.getElementById('editor-modal') as HTMLElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const settingsNavItems = document.querySelectorAll('.nav-item');
const settingsSections = document.querySelectorAll('.settings-section');
const settingsTitle = document.getElementById('settings-section-title') as HTMLElement;
const settingsDesc = document.getElementById('settings-section-desc') as HTMLElement;
const btnReset = document.querySelector('.btn-reset') as HTMLButtonElement;

// Settings Inputs
const settingLaunchLogin = document.getElementById('setting-launch-login') as HTMLInputElement;
const settingHideBlur = document.getElementById('setting-hide-blur') as HTMLInputElement;
const btnHotkey = document.querySelector('.hotkey-display') as HTMLElement;

async function init() {
  console.log('[App] Initializing App...');
  if (!window.electronAPI) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: #ff5555; pointer-events: none;">Critical Error: Electron API not found.</li>';
    return;
  }
  
  try {
    platform = await window.electronAPI.getPlatform();
    modKey = platform === 'darwin' ? '⌘' : 'Ctrl';
    
    // Update all initial mod-key labels
    document.querySelectorAll('.mod-key').forEach(el => {
      el.textContent = modKey;
    });

    snippets = await window.electronAPI.getSnippets();
    currentSettings = await window.electronAPI.getSettings();
    console.log('[App] Loaded snippets:', snippets.length);
    console.log('[App] Loaded settings:', currentSettings);
    
    syncSettingsUI();
  } catch (err) {
    console.error('[App] Failed to load data:', err);
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
    resultsList.innerHTML = `<li class="snippet-item" style="text-align: center; color: var(--text-muted); pointer-events: none; opacity: 0.5; padding: 20px; height: auto;">No snippets found. Press ${modKey}N to create one.</li>`;
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
  isSettingsOpen = false;
  appContainer.classList.add('modal-open');
  modalOverlay.classList.remove('hidden');
  settingsModal.classList.add('hidden');
  editorModal.classList.remove('hidden');
  
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
  isSettingsOpen = false;
  editingSnippetId = null;
  appContainer.classList.remove('modal-open');
  modalOverlay.classList.add('hidden');
  editorModal.classList.add('hidden');
  settingsModal.classList.add('hidden');
  searchInput.focus();
}

function openSettingsModal() {
  isModalOpen = true;
  isSettingsOpen = true;
  appContainer.classList.add('modal-open');
  modalOverlay.classList.remove('hidden');
  editorModal.classList.add('hidden');
  settingsModal.classList.remove('hidden');
  
  // Reset to General section
  switchSettingsSection('general');
}

function switchSettingsSection(sectionId: string) {
  settingsSections.forEach(section => section.classList.add('hidden'));
  const activeSection = document.getElementById(`section-${sectionId}`);
  if (activeSection) activeSection.classList.remove('hidden');
  
  settingsNavItems.forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-section') === sectionId) {
      item.classList.add('active');
    }
  });

  // Update header text based on section
  const config: Record<string, { title: string, desc: string }> = {
    general: { title: 'General', desc: 'Configure global behavior and application defaults.' },
    hotkeys: { title: 'Hotkeys', desc: 'Customize your global activation shortcuts.' },
    about: { title: 'About', desc: 'Version information and system details.' }
  };

  if (config[sectionId]) {
    settingsTitle.textContent = config[sectionId].title;
    settingsDesc.textContent = config[sectionId].desc;
  }
}

function syncSettingsUI() {
  settingLaunchLogin.checked = currentSettings.launchAtLogin;
  settingHideBlur.checked = currentSettings.hideOnBlur;
  updateHotkeyDisplay(currentSettings.hotkey);
}

function updateHotkeyDisplay(hotkey: string) {
  if (!btnHotkey) return;
  const parts = hotkey.replace(/CommandOrControl/g, modKey).replace(/Command/g, '⌘').replace(/Control/g, 'Ctrl').split('+');
  btnHotkey.innerHTML = parts.map(p => `<kbd>${p}</kbd>`).join('<span>+</span>');
}

async function updateSettings(updates: Partial<Settings>) {
  currentSettings = { ...currentSettings, ...updates };
  await window.electronAPI.saveSettings(currentSettings);
  syncSettingsUI();
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

btnSettings.onclick = openSettingsModal;
btnCloseSettings.onclick = closeModal;

settingsNavItems.forEach(item => {
  item.addEventListener('click', () => {
    const section = item.getAttribute('data-section');
    if (section) switchSettingsSection(section);
  });
});

settingLaunchLogin.onchange = () => updateSettings({ launchAtLogin: settingLaunchLogin.checked });
settingHideBlur.onchange = () => updateSettings({ hideOnBlur: settingHideBlur.checked });

btnReset.onclick = async () => {
  if (confirm('Reset all settings to default?')) {
    const defaultSettings: Settings = {
      launchAtLogin: true,
      hideOnBlur: true,
      hotkey: platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space'
    };
    await window.electronAPI.saveSettings(defaultSettings);
    currentSettings = defaultSettings;
    syncSettingsUI();
  }
};

btnHotkey.onclick = () => {
  isRecordingHotkey = true;
  btnHotkey.classList.add('recording');
  btnHotkey.innerHTML = '<span class="recording-hint">Press keys...</span>';
};

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openModal();
    return;
  }

  if (isRecordingHotkey) {
    e.preventDefault();
    if (e.key === 'Escape') {
      isRecordingHotkey = false;
      btnHotkey.classList.remove('recording');
      syncSettingsUI();
      return;
    }

    const modifiers = [];
    if (e.metaKey) modifiers.push('Command');
    if (e.ctrlKey) modifiers.push('Control');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    // Use e.code to get the physical key and avoid special characters from Alt/Option
    const code = e.code;
    const isModifier = ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(code);
    
    if (!isModifier) {
      // Map e.code to Electron-friendly key names
      let key = code.replace('Key', '').replace('Digit', '');
      
      const keyMap: Record<string, string> = {
        'Space': 'Space',
        'Enter': 'Return',
        'Escape': 'Esc',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'Equal': 'Plus',
        'Minus': 'Minus',
        'Comma': ',',
        'Period': '.',
        'Slash': '/',
        'Backslash': '\\',
        'Quote': "'",
        'Semicolon': ';',
        'BracketLeft': '[',
        'BracketRight': ']',
        'Backquote': '`',
        'Tab': 'Tab',
        'Backspace': 'Backspace',
        'Delete': 'Delete'
      };

      if (keyMap[code]) {
        key = keyMap[code];
      }

      const hotkey = [...modifiers, key].join('+');
      updateSettings({ hotkey });
      isRecordingHotkey = false;
      btnHotkey.classList.remove('recording');
    }
    return;
  }

  if (isModalOpen || isSettingsOpen) {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isSettingsOpen) handleSave();
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
