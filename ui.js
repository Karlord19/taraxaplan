// --- THEME TOGGLE LOGIC ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('taraxaplan-theme') || 'dark';

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taraxaplan-theme', theme);
    if (theme === 'light') {
        themeToggleBtn.innerHTML = '🌙 Switch to Dark Mode';
    } else {
        themeToggleBtn.innerHTML = '☀️ Switch to Light Mode';
    }
}
setTheme(currentTheme);
themeToggleBtn.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// --- NAVIGATION ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.workspace').forEach(w => w.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
        renderAll();
    });
});

document.getElementById('toggle-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

function renderEntities(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    data[type].forEach(entity => {
        const el = document.createElement('div');
        el.className = 'entity-card';
        if (entity.color) el.style.borderLeftColor = entity.color;
        
        el.innerHTML = `<h4>${entity.name || 'Unnamed'}</h4><p>${entity.description || ''}</p>`;
        el.addEventListener('click', () => openEntityModal(type, entity.id));
        container.appendChild(el);
    });
}

function renderAll() {
    if(typeof renderNodes === 'function') {
        renderNodes();
        renderConnections();
    }
    renderEntities('items', 'items-list');
    renderEntities('people', 'people-list');
}

// --- NODE MODAL LOGIC ---
let editingNodeId = null;
let currentPrereqs = [];
let currentOutputs = [];

function populateSelect(selectId, list, selectedValue) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- None --</option>';
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id; option.textContent = item.name;
        if (item.id === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

function renderPills(containerId, idsArray, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    idsArray.forEach(id => {
        const item = data.items.find(i => i.id === id);
        if (!item) return;
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerHTML = `<span class="pill-delete" data-id="${id}">✖</span> ${item.name}`;
        
        pill.querySelector('.pill-delete').addEventListener('click', () => {
            if (type === 'prereq') {
                currentPrereqs = currentPrereqs.filter(p => p !== id);
                renderPills('edit-prereqs-pills', currentPrereqs, 'prereq');
            } else {
                currentOutputs = currentOutputs.filter(p => p !== id);
                renderPills('edit-outputs-pills', currentOutputs, 'output');
            }
        });
        container.appendChild(pill);
    });
}

function setupMultiSelect(inputId, dropdownId, pillsContainerId, idsArrayGetter, onAdd) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    input.addEventListener('input', () => {
        const val = input.value.toLowerCase();
        dropdown.innerHTML = '';
        if (!val) {
            dropdown.classList.add('hidden');
            return;
        }
        
        const currentIds = idsArrayGetter();
        const matches = data.items.filter(i => 
            i.name.toLowerCase().includes(val) && !currentIds.includes(i.id)
        );
        
        if (matches.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }
        
        dropdown.classList.remove('hidden');
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = match.name;
            div.addEventListener('mousedown', (e) => { 
                e.preventDefault(); 
                onAdd(match.id);
                input.value = '';
                dropdown.classList.add('hidden');
            });
            dropdown.appendChild(div);
        });
    });

    input.addEventListener('blur', () => {
        dropdown.classList.add('hidden');
        input.value = ''; 
    });
    
    input.addEventListener('focus', () => {
        input.dispatchEvent(new Event('input')); 
    });
}

setupMultiSelect('search-prereqs', 'dropdown-prereqs', 'edit-prereqs-pills', 
    () => currentPrereqs, 
    (id) => { currentPrereqs.push(id); renderPills('edit-prereqs-pills', currentPrereqs, 'prereq'); }
);

setupMultiSelect('search-outputs', 'dropdown-outputs', 'edit-outputs-pills', 
    () => currentOutputs, 
    (id) => { currentOutputs.push(id); renderPills('edit-outputs-pills', currentOutputs, 'output'); }
);

function openNodeModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc || '';
    
    populateSelect('edit-owner', data.people, node.ownerId);
    
    currentPrereqs = [...(node.prereqIds || [])];
    currentOutputs = [...(node.outputIds || [])];
    
    renderPills('edit-prereqs-pills', currentPrereqs, 'prereq');
    renderPills('edit-outputs-pills', currentOutputs, 'output');
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function saveNodeAndClose() {
    if (!editingNodeId) return;
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.ownerId = document.getElementById('edit-owner').value;
        node.prereqIds = [...currentPrereqs];
        node.outputIds = [...currentOutputs];
        renderAll();
    }
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
}

document.getElementById('edit-modal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('edit-modal')) saveNodeAndClose();
});

document.getElementById('save-node-btn').addEventListener('click', saveNodeAndClose);
document.getElementById('cancel-node-btn').addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
});

document.getElementById('delete-node').addEventListener('click', () => {
    data.nodes = data.nodes.filter(n => n.id !== editingNodeId);
    for (const key in data.knees) {
        if (key.startsWith(editingNodeId + '-') || key.endsWith('-' + editingNodeId)) delete data.knees[key];
    }
    renderAll();
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
});

// --- ENTITY MODAL LOGIC ---
let editingEntity = null;

document.getElementById('btn-add-item').addEventListener('click', () => openEntityModal('items', null));
document.getElementById('btn-add-person').addEventListener('click', () => openEntityModal('people', null));

function openEntityModal(type, id) {
    editingEntity = { type, id };
    document.getElementById('entity-modal-title').textContent = id ? `Edit ${type === 'items' ? 'Item' : 'Person'}` : `New ${type === 'items' ? 'Item' : 'Person'}`;
    
    const colorLabel = document.getElementById('color-picker-label');
    if (type === 'people') colorLabel.classList.remove('hidden');
    else colorLabel.classList.add('hidden');

    if (id) {
        const entity = data[type].find(e => e.id === id);
        document.getElementById('edit-entity-name').value = entity.name || '';
        document.getElementById('edit-entity-desc').value = entity.description || '';
        if (type === 'people') document.getElementById('edit-entity-color').value = entity.color || '#444444';
    } else {
        document.getElementById('edit-entity-name').value = '';
        document.getElementById('edit-entity-desc').value = '';
        document.getElementById('edit-entity-color').value = '#444444';
    }
    document.getElementById('edit-entity-modal').classList.remove('hidden');
}

function saveEntityAndClose() {
    if (!editingEntity) return;
    const name = document.getElementById('edit-entity-name').value;
    const desc = document.getElementById('edit-entity-desc').value;
    const color = document.getElementById('edit-entity-color').value;
    
    if (editingEntity.id) {
        const entity = data[editingEntity.type].find(e => e.id === editingEntity.id);
        entity.name = name; 
        entity.description = desc;
        if (editingEntity.type === 'people') entity.color = color;
    } else {
        let newEntity = { id: generateId(), name: name, description: desc };
        if (editingEntity.type === 'people') newEntity.color = color;
        data[editingEntity.type].push(newEntity);
    }
    
    renderAll();
    document.getElementById('edit-entity-modal').classList.add('hidden');
    editingEntity = null;
}

document.getElementById('edit-entity-modal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('edit-entity-modal')) saveEntityAndClose();
});

document.getElementById('save-entity-btn').addEventListener('click', saveEntityAndClose);
document.getElementById('cancel-entity-btn').addEventListener('click', () => {
    document.getElementById('edit-entity-modal').classList.add('hidden');
    editingEntity = null;
});

document.getElementById('delete-entity').addEventListener('click', () => {
    if (editingEntity.id) {
        data[editingEntity.type] = data[editingEntity.type].filter(e => e.id !== editingEntity.id);
    }
    renderAll();
    document.getElementById('edit-entity-modal').classList.add('hidden');
    editingEntity = null;
});

// Stop clicks inside modal from triggering background close
document.querySelector('#edit-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());
document.querySelector('#edit-entity-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());

// Initial render
setTimeout(() => {
    renderAll();
    if(typeof centerAndFitGraph === 'function') centerAndFitGraph();
}, 100);