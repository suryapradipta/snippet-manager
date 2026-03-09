import './style.css'
import { supabase } from './supabase'

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
let isSignUpMode = false;
let currentUser: any = null;

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
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

// Auth DOM Elements
const authOverlay = document.getElementById('auth-overlay') as HTMLElement;
const authForm = document.getElementById('auth-form') as HTMLFormElement;
const authEmail = document.getElementById('auth-email') as HTMLInputElement;
const authPassword = document.getElementById('auth-password') as HTMLInputElement;
const authError = document.getElementById('auth-error') as HTMLElement;
const authSubtitle = document.getElementById('auth-subtitle') as HTMLElement;
const btnAuthSubmit = document.getElementById('btn-auth-submit') as HTMLButtonElement;
const btnToggleAuth = document.getElementById('btn-toggle-auth') as HTMLButtonElement;

async function init() {
  console.log('[App] Initializing App...');
  if (!window.electronAPI) {
    resultsList.innerHTML = '<li class="snippet-item" style="text-align: center; color: #ff5555; pointer-events: none;">Critical Error: Electron API not found.</li>';
    return;
  }

  // Check Auth Session
  const { data: { session } } = await supabase.auth.getSession();
  updateAuthState(session?.user ?? null);

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthState(session?.user ?? null);
  });

  try {
    platform = await window.electronAPI.getPlatform();
    modKey = platform === 'darwin' ? '⌘' : 'Ctrl';

    // Update all initial mod-key labels
    document.querySelectorAll('.mod-key').forEach(el => {
      el.textContent = modKey;
    });

    currentSettings = await window.electronAPI.getSettings();
    syncSettingsUI();

    if (currentUser) {
      await loadSnippets();
    }
  } catch (err) {
    console.error('[App] Failed to load data:', err);
  }

  searchInput.focus();
}

function updateAuthState(user: any) {
  currentUser = user;
  if (user) {
    authOverlay.classList.add('hidden');
    appContainer.classList.remove('modal-open');
    loadSnippets();
  } else {
    authOverlay.classList.remove('hidden');
    appContainer.classList.add('modal-open');
    resultsList.innerHTML = '';
  }
}

async function loadSnippets() {
  try {
    // Always start with local snippets as a baseline/offline mode
    snippets = await window.electronAPI.getSnippets();

    if (currentUser) {
      console.log('[App] Fetching snippets from Supabase...');
      const { data, error } = await supabase
        .from('snippets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[App] Supabase fetch error:', error);
      } else if (data) {
        console.log('[App] Supabase loaded:', data.length, 'items');
        // Simple merge: Use cloud data if it exists
        if (data.length > 0) {
          snippets = data.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            createdAt: d.created_at
          }));
          // Sync back to local for offline use
          await window.electronAPI.saveSnippets(snippets);
        }
      }
    }

    console.log('[App] Final snippet count:', snippets.length);
    filterSnippets(searchInput.value || '');
  } catch (err) {
    console.error('[App] Failed to load snippets:', err);
  }
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

  if (currentUser) {
    const { error } = await supabase
      .from('snippets')
      .delete()
      .eq('id', id);
    if (error) console.error('[App] Cloud delete error:', error);
    else console.log('[App] Cloud delete successful');
  }

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

  // Sync to Cloud if logged in
  if (currentUser) {
    const finalSnippet = snippets.find(s => s.id === (editingSnippetId || snippets[snippets.length - 1].id));

    if (finalSnippet) {
      console.log('[App] Attempting cloud sync for:', finalSnippet.title);
      const { error } = await supabase
        .from('snippets')
        .upsert({
          id: finalSnippet.id,
          user_id: currentUser.id,
          title: finalSnippet.title,
          content: finalSnippet.content,
          created_at: finalSnippet.createdAt
        });

      if (error) {
        console.error('[App] Cloud sync error:', error.message, error.details);
        alert('Cloud sync failed: ' + error.message);
      } else {
        console.log('[App] Cloud sync successful');
      }
    }
  }

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

btnLogout.onclick = async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await supabase.auth.signOut();
    closeModal();
  }
};

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
  if (currentUser === null) {
    // If not logged in, only allow interaction with the auth form.
    // Escape shouldn't hide window or anything.
    return;
  }

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

// Auth Event Listeners
btnToggleAuth.onclick = () => {
  isSignUpMode = !isSignUpMode;
  authSubtitle.textContent = isSignUpMode
    ? 'Create an account to start syncing snippets.'
    : 'Sign in to sync your snippets across devices.';
  btnAuthSubmit.querySelector('span')!.textContent = isSignUpMode ? 'Sign Up' : 'Continue';
  btnToggleAuth.textContent = isSignUpMode ? 'Already have an account? Sign In' : 'Need an account? Sign Up';
  authError.classList.add('hidden');
  authForm.classList.remove('hidden');
};

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = authEmail.value;
  const password = authPassword.value;

  authError.classList.add('hidden');
  btnAuthSubmit.disabled = true;
  const originalBtnText = btnAuthSubmit.querySelector('span')!.textContent;
  btnAuthSubmit.querySelector('span')!.textContent = 'Processing...';

  try {
    let result;
    if (isSignUpMode) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      authError.textContent = result.error.message;
      authError.classList.remove('hidden');
    } else if (isSignUpMode && result.data.user && !result.data.session) {
      // Supabase returns user but no session if email confirmation is enabled
      authSubtitle.innerHTML = '<span style="color: var(--success); font-weight: 600;">Check your email!</span><br>We\'ve sent a confirmation link to ' + email + '. Please click it to activate your account.';
      authForm.classList.add('hidden');
      btnToggleAuth.textContent = 'Back to Sign In';
      isSignUpMode = false;
    }
  } catch (err: any) {
    authError.textContent = err.message || 'An unexpected error occurred.';
    authError.classList.remove('hidden');
  } finally {
    btnAuthSubmit.disabled = false;
    btnAuthSubmit.querySelector('span')!.textContent = originalBtnText;
  }
};

init();
