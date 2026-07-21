let editingNodeId = null;
let editingEntity = null;

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
        // Apply left border color if it's a person
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

// --- NODE MODAL (Click outside to save) ---
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

function populateCheckboxes(containerId, list, selectedIds) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    list.forEach(item => {
        const isChecked = selectedIds.includes(item.id) ? 'checked' : '';
        container.innerHTML += `<label><input type="checkbox" value="${item.id}" ${isChecked}> ${item.name}</label>`;
    });
}

function openNodeModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc || '';
    
    populateSelect('edit-owner', data.people, node.ownerId);
    populateCheckboxes('edit-prereqs-list', data.items, node.prereqIds || []);
    populateCheckboxes('edit-outputs-list', data.items, node.outputIds || []);
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function saveNodeAndClose() {
    if (!editingNodeId) return;
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.ownerId = document.getElementById('edit-owner').value;
        node.prereqIds = Array.from(document.querySelectorAll('#edit-prereqs-list input:checked')).map(cb => cb.value);
        node.outputIds = Array.from(document.querySelectorAll('#edit-outputs-list input:checked')).map(cb => cb.value);
        renderAll();
    }
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
}

// Click background to save
document.getElementById('edit-modal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('edit-modal')) {
        saveNodeAndClose();
    }
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

// --- ENTITY (ITEM/PERSON) MODAL (Click outside to save) ---
document.getElementById('btn-add-item').addEventListener('click', () => openEntityModal('items', null));
document.getElementById('btn-add-person').addEventListener('click', () => openEntityModal('people', null));

function openEntityModal(type, id) {
    editingEntity = { type, id };
    document.getElementById('entity-modal-title').textContent = id ? `Edit ${type === 'items' ? 'Item' : 'Person'}` : `New ${type === 'items' ? 'Item' : 'Person'}`;
    
    const colorLabel = document.getElementById('color-picker-label');
    if (type === 'people') {
        colorLabel.classList.remove('hidden');
    } else {
        colorLabel.classList.add('hidden');
    }

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

// Click background to save
document.getElementById('edit-entity-modal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('edit-entity-modal')) {
        saveEntityAndClose();
    }
});

document.getElementById('delete-entity').addEventListener('click', () => {
    if (editingEntity.id) {
        data[editingEntity.type] = data[editingEntity.type].filter(e => e.id !== editingEntity.id);
    }
    renderAll();
    document.getElementById('edit-entity-modal').classList.add('hidden');
    editingEntity = null;
});

// Initial render
setTimeout(renderAll, 100);

// --- NEW CANCEL / SAVE BUTTONS LOGIC ---

// Stop clicks *inside* the modal content from bubbling up to the background
document.querySelector('#edit-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());
document.querySelector('#edit-entity-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());

// Node Buttons
document.getElementById('save-node-btn').addEventListener('click', saveNodeAndClose);
document.getElementById('cancel-node-btn').addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
});

// Entity Buttons
document.getElementById('save-entity-btn').addEventListener('click', saveEntityAndClose);
document.getElementById('cancel-entity-btn').addEventListener('click', () => {
    document.getElementById('edit-entity-modal').classList.add('hidden');
    editingEntity = null;
});