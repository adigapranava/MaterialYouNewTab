// notes.js

const NotesApp = {
    notes: [],
    currentNoteId: null,
    
    // UI Elements
    elements: {
        container: document.getElementById('notesContainer'),
        button: document.getElementById('notesButton'),
        closeBtn: document.getElementById('closeNotesBtn'),
        addBtn: document.getElementById('addNoteBtn'),
        deleteBtn: document.getElementById('deleteNoteBtn'),
        previewBtn: document.getElementById('togglePreviewBtn'),
        
        list: document.getElementById('notesList'),
        titleInput: document.getElementById('currentNoteTitle'),
        editor: document.getElementById('noteEditor'),
        preview: document.getElementById('notePreview'),
        themeSelect: document.getElementById('notesThemeSelect'),
    },

    // Initialize
    async init() {
        if (!this.elements.container) return;

        // Initialize marked.js options
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true, // Convert \n to <br>
                gfm: true     // GitHub Flavored Markdown
            });
        }

        // Initialize mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }

        this.bindEvents();
        await this.loadNotes();
        this.renderList();
    },

    bindEvents() {
        // Toggle Sidebar
        this.elements.button.addEventListener('click', () => {
            if (this.elements.container.style.display === 'none') {
                this.elements.container.style.display = 'flex';
                if (this.notes.length === 0) this.createNote();
            } else {
                this.elements.container.style.display = 'none';
            }
        });
        
        this.elements.closeBtn.addEventListener('click', () => {
            this.elements.container.style.display = 'none';
        });

        // Note Management
        this.elements.addBtn.addEventListener('click', () => this.createNote());
        this.elements.deleteBtn.addEventListener('click', () => this.deleteCurrentNote());
        
        // Editor Events
        this.elements.titleInput.addEventListener('input', () => this.saveCurrentNote());
        this.elements.editor.addEventListener('input', () => this.saveCurrentNote());
        this.elements.themeSelect.addEventListener('change', () => {
            this.applyTheme(this.elements.themeSelect.value);
            this.saveCurrentNote();
        });

        // Toggle Preview
        this.elements.previewBtn.addEventListener('click', () => this.togglePreview());

        // Handle Image Paste
        this.elements.editor.addEventListener('paste', this.handlePaste.bind(this));
    },

    async loadNotes() {
        return new Promise(resolve => {
            chrome.storage.local.get(['mynt_notes'], (result) => {
                this.notes = result.mynt_notes || [];
                
                // Sort by last edited descending
                this.notes.sort((a, b) => b.updatedAt - a.updatedAt);
                
                if (this.notes.length > 0 && !this.currentNoteId) {
                    this.selectNote(this.notes[0].id);
                }
                resolve();
            });
        });
    },

    async saveNotes() {
        return new Promise(resolve => {
            chrome.storage.local.set({ 'mynt_notes': this.notes }, () => resolve());
        });
    },

    saveCurrentNote() {
        if (!this.currentNoteId) return;
        
        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (note) {
            note.title = this.elements.titleInput.value || 'Untitled';
            note.content = this.elements.editor.value;
            note.theme = this.elements.themeSelect.value;
            note.updatedAt = Date.now();
            
            this.saveNotes();
            
            // Only re-render the specific list item to avoid losing focus
            this.updateListItem(note);
        }
    },

    createNote() {
        const newNote = {
            id: 'note_' + Date.now().toString(),
            title: '',
            content: '',
            theme: 'default',
            images: {},
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.notes.unshift(newNote);
        this.saveNotes();
        this.renderList();
        this.selectNote(newNote.id);
        
        // Wait for render then focus title
        setTimeout(() => this.elements.titleInput.focus(), 50);
    },

    deleteCurrentNote() {
        if (!this.currentNoteId) return;
        
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(n => n.id !== this.currentNoteId);
            this.saveNotes();
            
            this.currentNoteId = null;
            if (this.notes.length > 0) {
                this.selectNote(this.notes[0].id);
            } else {
                this.clearEditor();
            }
            this.renderList();
        }
    },

    selectNote(id) {
        this.currentNoteId = id;
        const note = this.notes.find(n => n.id === id);
        
        if (note) {
            this.elements.titleInput.value = note.title;
            this.elements.editor.value = note.content;
            this.elements.themeSelect.value = note.theme || 'default';
            
            this.applyTheme(note.theme || 'default');
            
            // Highlight selected in list
            document.querySelectorAll('#notesList li').forEach(li => li.classList.remove('active'));
            const activeLi = document.getElementById(`list-item-${id}`);
            if (activeLi) activeLi.classList.add('active');

            // If in preview mode, re-render
            if (this.elements.previewBtn.textContent === 'Edit') {
                this.renderPreview();
            }
        }
    },

    clearEditor() {
        this.elements.titleInput.value = '';
        this.elements.editor.value = '';
        this.elements.currentNoteId = null;
        this.applyTheme('default');
        
        if (this.elements.previewBtn.textContent === 'Edit') {
            this.togglePreview(); // Switch back to edit
        }
    },

    renderList() {
        this.elements.list.innerHTML = '';
        this.notes.forEach(note => {
            const li = document.createElement('li');
            li.id = `list-item-${note.id}`;
            li.className = this.currentNoteId === note.id ? 'active' : '';
            li.textContent = note.title || 'Untitled note';
            
            const dateSpan = document.createElement('span');
            dateSpan.className = 'note-date';
            const d = new Date(note.updatedAt);
            dateSpan.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            li.appendChild(dateSpan);

            li.addEventListener('click', () => this.selectNote(note.id));
            this.elements.list.appendChild(li);
        });
    },

    updateListItem(note) {
        const li = document.getElementById(`list-item-${note.id}`);
        if (li) {
            // Reconstruct text node
            li.childNodes[0].nodeValue = note.title || 'Untitled note';
            
            const d = new Date(note.updatedAt);
            li.querySelector('.note-date').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    },

    applyTheme(themeName) {
        // Remove old theme classes
        const classes = Array.from(this.elements.container.classList);
        classes.forEach(c => {
            if (c.startsWith('theme-')) {
                this.elements.container.classList.remove(c);
            }
        });
        
        if (themeName !== 'default') {
            this.elements.container.classList.add(`theme-${themeName}`);
        }
    },

    togglePreview() {
        const isEditing = this.elements.editor.style.display !== 'none';
        
        if (isEditing) {
            // Switch to Preview
            this.elements.editor.style.display = 'none';
            this.elements.preview.style.display = 'block';
            this.elements.previewBtn.textContent = 'Edit';
            this.renderPreview();
        } else {
            // Switch to Edit
            this.elements.editor.style.display = 'block';
            this.elements.preview.style.display = 'none';
            this.elements.previewBtn.textContent = 'View';
        }
    },

    renderPreview() {
        let content = this.elements.editor.value;
        const note = this.notes.find(n => n.id === this.currentNoteId);
        
        // Restore base64 images from their short placeholders
        if (note && note.images) {
            content = content.replace(/!\[IMAGE:\s*(img_\d+)(?:\|([^\]]+))?\]/g, (match, imgId, sizeStr) => {
                if (note.images[imgId]) {
                    if (sizeStr) {
                        return `<img src="${note.images[imgId]}" width="${sizeStr.trim()}" alt="Pasted Image">`;
                    }
                    return `![Image](${note.images[imgId]})`;
                }
                return match;
            });
        }
        
        // Basic YouTube URL replacement to embed iframe
        // Matches: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID
        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?/g;
        content = content.replace(ytRegex, (match, videoId) => {
            return `<br><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe><br>`;
        });

        if (typeof marked !== 'undefined') {
            const rawHtml = marked.parse(content);
            // Sanitize
            const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['allowfullscreen', 'frameborder', 'allow', 'target'] }) : rawHtml;
            
            this.elements.preview.innerHTML = cleanHtml;
            
            // Render Mermaid diagrams
            if (typeof mermaid !== 'undefined') {
                const mermaidBlocks = this.elements.preview.querySelectorAll('code.language-mermaid');
                mermaidBlocks.forEach((block, index) => {
                    const id = `mermaid-${Date.now()}-${index}`;
                    const graphDefinition = block.textContent;
                    
                    const div = document.createElement('div');
                    div.className = 'mermaid';
                    div.id = id;
                    div.textContent = graphDefinition;
                    
                    block.parentNode.replaceWith(div);
                });
                
                // Initialize mermaid on these blocks
                try {
                    mermaid.run();
                } catch (e) {
                    console.error("Mermaid error:", e);
                }
            }

            // Trigger Syntax Highlighting
            if (typeof Prism !== 'undefined') {
                try {
                    Prism.highlightAllUnder(this.elements.preview);
                } catch (e) {
                    console.error("Prism syntax highlight error:", e);
                }
            }
            
            // Make links open in new tab
            this.elements.preview.querySelectorAll('a').forEach(a => {
                a.target = '_blank';
                a.rel = 'noopener';
            });
            
            // Handle checkboxes styling
            this.elements.preview.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.disabled = true; // Read-only in preview
            });
        } else {
            this.elements.preview.innerHTML = "<p>Markdown parser not loaded.</p>";
        }
    },

    handlePaste(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const base64Data = event.target.result;
                    const imgId = 'img_' + Date.now();
                    
                    if (this.currentNoteId) {
                        const note = this.notes.find(n => n.id === this.currentNoteId);
                        if (note) {
                            if (!note.images) note.images = {};
                            note.images[imgId] = base64Data;
                            
                            this.insertTextAtCursor(`\n![IMAGE: ${imgId}|100%]\n`);
                            // Wait a tiny bit for insertTextAtCursor to update element value before saving
                            setTimeout(() => this.saveCurrentNote(), 10);
                        }
                    }
                };
                reader.readAsDataURL(blob);
                
                // Optional: prevent default paste behavior (if we only handled images)
                // e.preventDefault(); 
            }
        }
    },

    insertTextAtCursor(text) {
        const el = this.elements.editor;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        
        const currentValue = el.value;
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        
        el.value = newValue;
        el.selectionStart = el.selectionEnd = start + text.length;
        
        // Trigger input event to save
        el.dispatchEvent(new Event('input'));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    NotesApp.init();
});
