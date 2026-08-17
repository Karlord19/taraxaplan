// --- THEME & NAVIGATION ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('taraxaplan-theme') || 'dark';

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taraxaplan-theme', theme);
    themeToggleBtn.innerHTML = theme === 'light' ? '🌙 Switch to Dark Mode' : '☀️ Switch to Light Mode';
}
setTheme(currentTheme);
themeToggleBtn.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

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
document.getElementById('toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

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
    if(typeof renderNodes === 'function') { renderNodes(); renderConnections(); }
    renderEntities('items', 'items-list'); 
    renderEntities('people', 'people-list');
    renderCleanup(); // Refresh Cleanup Dashboard
}

// --- DYNAMIC MULTI-SELECT COMPONENT ---
function createMultiSelectWidget(container, initialIds, onChangeCallback) {
    container.innerHTML = '';
    container.className = 'multi-select-container';
    
    let selectedIds = [...(initialIds || [])];

    const pillsDiv = document.createElement('div');
    pillsDiv.className = 'pills-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = 'Search or create...';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-list hidden';
    
    container.appendChild(pillsDiv);
    container.appendChild(input);
    container.appendChild(dropdown);

    const renderSelectedPills = () => {
        pillsDiv.innerHTML = '';
        selectedIds.forEach(id => {
            const item = data.items.find(i => i.id === id);
            if (!item) return;
            const pill = document.createElement('div');
            pill.className = 'pill';
            pill.innerHTML = `<span class="pill-delete">✖</span> ${item.name}`;
            pill.querySelector('.pill-delete').addEventListener('mousedown', (e) => {
                e.stopPropagation(); e.preventDefault();
                selectedIds = selectedIds.filter(pid => pid !== id);
                onChangeCallback(selectedIds);
                renderSelectedPills();
            });
            pillsDiv.appendChild(pill);
        });
    };

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        
        let matches = data.items.filter(i => !selectedIds.includes(i.id));
        if (val) matches = matches.filter(i => i.name.toLowerCase().includes(val));
        
        if (val && !data.items.some(i => i.name.toLowerCase() === val)) {
            const createDiv = document.createElement('div');
            createDiv.className = 'dropdown-item create-item';
            createDiv.innerHTML = `<strong>+ Create:</strong> "${input.value.trim()}"`;
            createDiv.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const newItem = { id: generateId(), name: input.value.trim(), description: '' };
                data.items.push(newItem);
                selectedIds.push(newItem.id);
                onChangeCallback(selectedIds);
                input.value = '';
                dropdown.classList.add('hidden');
                renderSelectedPills();
                renderEntities('items', 'items-list');
                renderCleanup();
            });
            dropdown.appendChild(createDiv);
        }

        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = match.name;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectedIds.push(match.id);
                onChangeCallback(selectedIds);
                input.value = '';
                dropdown.classList.add('hidden');
                renderSelectedPills();
            });
            dropdown.appendChild(div);
        });

        if (dropdown.innerHTML !== '') dropdown.classList.remove('hidden');
        else dropdown.classList.add('hidden');
    });

    input.addEventListener('blur', () => { dropdown.classList.add('hidden'); input.value = ''; });
    input.addEventListener('focus', () => input.dispatchEvent(new Event('input')));

    renderSelectedPills();
}

// --- NODE MODAL LOGIC ---
let editingNodeId = null;
let currentPrereqs = [];
let currentOutputs = [];
let currentOptions = [];
let currentIsDecision = false;

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

function renderDecisionOptionsBuilder() {
    const container = document.getElementById('options-builder-list');
    container.innerHTML = '';
    
    currentOptions.forEach((opt, index) => {
        const block = document.createElement('div');
        block.className = 'option-builder-block';
        
        block.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>Option ${index + 1}</strong>
                <button class="danger-btn" style="padding:2px 8px; margin:0;" data-index="${index}">✖</button>
            </div>
            <input type="text" class="opt-label-input" value="${opt.label}" placeholder="e.g., 'Player gives gold'" style="width:calc(100% - 18px); margin-bottom:10px;">
            <label style="font-size:0.85em; color:var(--text-color); opacity:0.8;">Requires (Inputs):</label>
            <div class="opt-prereqs-widget"></div>
            <label style="font-size:0.85em; color:var(--text-color); opacity:0.8; margin-top:5px;">Grants (Outputs):</label>
            <div class="opt-outputs-widget"></div>
        `;
        
        block.querySelector('.opt-label-input').addEventListener('input', (e) => currentOptions[index].label = e.target.value);
        block.querySelector('.danger-btn').addEventListener('click', (e) => {
            e.preventDefault(); currentOptions.splice(index, 1); renderDecisionOptionsBuilder();
        });

        createMultiSelectWidget(block.querySelector('.opt-prereqs-widget'), opt.prereqIds, (newIds) => currentOptions[index].prereqIds = newIds);
        createMultiSelectWidget(block.querySelector('.opt-outputs-widget'), opt.outputIds, (newIds) => currentOptions[index].outputIds = newIds);

        container.appendChild(block);
    });
}

function openNodeModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc || '';
    populateSelect('edit-owner', data.people, node.ownerId);
    
    currentPrereqs = [...(node.prereqIds || [])];
    currentOutputs = [...(node.outputIds || [])];
    currentOptions = JSON.parse(JSON.stringify(node.options || []));
    currentIsDecision = node.isDecision || false;
    
    document.querySelector(`input[name="nodeType"][value="${currentIsDecision ? 'decision' : 'action'}"]`).checked = true;
    toggleNodeTypeUI();

    createMultiSelectWidget(document.getElementById('edit-prereqs-wrapper'), currentPrereqs, (newIds) => currentPrereqs = newIds);
    createMultiSelectWidget(document.getElementById('edit-outputs-wrapper'), currentOutputs, (newIds) => currentOutputs = newIds);
    renderDecisionOptionsBuilder();
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function toggleNodeTypeUI() {
    currentIsDecision = document.querySelector('input[name="nodeType"]:checked').value === 'decision';
    if (currentIsDecision) {
        document.getElementById('standard-outputs-section').classList.add('hidden');
        document.getElementById('decision-options-section').classList.remove('hidden');
        if (currentOptions.length === 0) currentOptions.push({ id: generateId(), label: '', prereqIds: [], outputIds: [] });
        renderDecisionOptionsBuilder();
    } else {
        document.getElementById('standard-outputs-section').classList.remove('hidden');
        document.getElementById('decision-options-section').classList.add('hidden');
    }
}

document.querySelectorAll('input[name="nodeType"]').forEach(radio => radio.addEventListener('change', toggleNodeTypeUI));
document.getElementById('btn-add-option').addEventListener('click', (e) => {
    e.preventDefault(); currentOptions.push({ id: generateId(), label: '', prereqIds: [], outputIds: [] }); renderDecisionOptionsBuilder();
});

function saveNodeAndClose() {
    if (!editingNodeId) return;
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.ownerId = document.getElementById('edit-owner').value;
        node.prereqIds = [...currentPrereqs];
        node.isDecision = currentIsDecision;
        if (currentIsDecision) {
            node.options = JSON.parse(JSON.stringify(currentOptions));
            node.outputIds = []; 
        } else {
            node.outputIds = [...currentOutputs];
            node.options = []; 
        }
        renderAll();
    }
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
}

document.getElementById('edit-modal').addEventListener('mousedown', (e) => { if (e.target === document.getElementById('edit-modal')) saveNodeAndClose(); });
document.getElementById('save-node-btn').addEventListener('click', saveNodeAndClose);
document.getElementById('cancel-node-btn').addEventListener('click', () => { document.getElementById('edit-modal').classList.add('hidden'); editingNodeId = null; });
document.getElementById('delete-node').addEventListener('click', () => {
    data.nodes = data.nodes.filter(n => n.id !== editingNodeId);
    for (const key in data.knees) { if (key.startsWith(editingNodeId + '-') || key.endsWith('-' + editingNodeId)) delete data.knees[key]; }
    renderAll(); document.getElementById('edit-modal').classList.add('hidden'); editingNodeId = null;
});

// --- ENTITY MODAL LOGIC ---
let editingEntity = null;
document.getElementById('btn-add-item').addEventListener('click', () => openEntityModal('items', null));
document.getElementById('btn-add-person').addEventListener('click', () => openEntityModal('people', null));

function openEntityModal(type, id) {
    editingEntity = { type, id };
    document.getElementById('entity-modal-title').textContent = id ? `Edit ${type === 'items' ? 'Item' : 'Person'}` : `New ${type === 'items' ? 'Item' : 'Person'}`;
    const colorLabel = document.getElementById('color-picker-label');
    if (type === 'people') colorLabel.classList.remove('hidden'); else colorLabel.classList.add('hidden');
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
        entity.name = name; entity.description = desc;
        if (editingEntity.type === 'people') entity.color = color;
    } else {
        let newEntity = { id: generateId(), name: name, description: desc };
        if (editingEntity.type === 'people') newEntity.color = color;
        data[editingEntity.type].push(newEntity);
    }
    renderAll(); document.getElementById('edit-entity-modal').classList.add('hidden'); editingEntity = null;
}

document.getElementById('edit-entity-modal').addEventListener('mousedown', (e) => { if (e.target === document.getElementById('edit-entity-modal')) saveEntityAndClose(); });
document.getElementById('save-entity-btn').addEventListener('click', saveEntityAndClose);
document.getElementById('cancel-entity-btn').addEventListener('click', () => { document.getElementById('edit-entity-modal').classList.add('hidden'); editingEntity = null; });
document.getElementById('delete-entity').addEventListener('click', () => {
    if (editingEntity.id) data[editingEntity.type] = data[editingEntity.type].filter(e => e.id !== editingEntity.id);
    renderAll(); document.getElementById('edit-entity-modal').classList.add('hidden'); editingEntity = null;
});

document.querySelector('#edit-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());
document.querySelector('#edit-entity-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());

// --- CLEANUP DASHBOARD LOGIC ---
function renderCleanup() {
    const container = document.getElementById('cleanup-container');
    if (!container) return;
    container.innerHTML = '';

    let usedItemIds = new Set();
    let inputItemIds = new Set();
    let outputItemIds = new Set();
    let usedPeopleIds = new Set();
    let validLinks = new Set();
    let danglingReferences = []; 

    const itemExists = (id) => data.items.some(i => i.id === id);

    // 1. Gather all uses of items and people
    data.nodes.forEach(node => {
        if (node.ownerId) usedPeopleIds.add(node.ownerId);

        const checkItem = (id, isInput, optId = null) => {
            if (!itemExists(id)) {
                danglingReferences.push({ nodeId: node.id, optId, itemId: id, type: isInput ? 'Prerequisite' : 'Output' });
            } else {
                usedItemIds.add(id);
                if (isInput) inputItemIds.add(id);
                else outputItemIds.add(id);
            }
        };

        (node.prereqIds || []).forEach(id => checkItem(id, true));
        
        if (!node.isDecision) {
            (node.outputIds || []).forEach(id => checkItem(id, false));
        } else {
            (node.options || []).forEach(opt => {
                (opt.prereqIds || []).forEach(id => checkItem(id, true, opt.id));
                (opt.outputIds || []).forEach(id => checkItem(id, false, opt.id));
            });
        }
    });

    // 2. Re-calculate exactly which lines should legally exist
    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id === target.id) return;
            
            let srcBundles = [];
            if (!source.isDecision) srcBundles.push({ subId: 'main', ids: source.outputIds || [] });
            else (source.options || []).forEach(opt => srcBundles.push({ subId: opt.id, ids: opt.outputIds || [] }));

            let tgtBundles = [];
            tgtBundles.push({ subId: 'main', ids: target.prereqIds || [] });
            if (target.isDecision) (target.options || []).forEach(opt => tgtBundles.push({ subId: opt.id, ids: opt.prereqIds || [] }));

            srcBundles.forEach(src => {
                tgtBundles.forEach(tgt => {
                    if (src.ids.some(id => tgt.ids.includes(id))) {
                        validLinks.add(`${source.id}_${src.subId}-${target.id}_${tgt.subId}`);
                    }
                });
            });
        });
    });

    // 3. Filter data into Categories
    const orphanedKnees = Object.keys(data.knees).filter(k => !validLinks.has(k));
    const unusedItems = data.items.filter(i => !usedItemIds.has(i.id));
    const unusedPeople = data.people.filter(p => !usedPeopleIds.has(p.id));
    const disconnectedNodes = data.nodes.filter(n => {
        let hasConnection = (n.prereqIds && n.prereqIds.length > 0) || (!n.isDecision && n.outputIds && n.outputIds.length > 0);
        if (n.isDecision) {
            n.options.forEach(opt => {
                if ((opt.prereqIds && opt.prereqIds.length > 0) || (opt.outputIds && opt.outputIds.length > 0)) hasConnection = true;
            });
        }
        return !hasConnection;
    });
    
    // Warnings for Items
    const unproducedItems = data.items.filter(i => usedItemIds.has(i.id) && !outputItemIds.has(i.id)); 
    const unconsumedItems = data.items.filter(i => usedItemIds.has(i.id) && !inputItemIds.has(i.id)); 

    // Render Engine for Cards
    const buildSection = (title, items, renderItemHTML, actionLabel, actionFn) => {
        if (items.length === 0) return;
        const sec = document.createElement('div');
        sec.className = 'cleanup-section';
        sec.innerHTML = `<h3>${title} (${items.length})</h3>`;
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'cleanup-card';
            card.innerHTML = `<div class="cleanup-info">${renderItemHTML(item)}</div>`;
            const btn = document.createElement('button');
            btn.className = 'danger-btn';
            btn.textContent = actionLabel;
            btn.onclick = () => { actionFn(item); renderAll(); };
            card.appendChild(btn);
            sec.appendChild(card);
        });
        container.appendChild(sec);
    };

    // Render Blocks
    buildSection('Orphaned Lines/Knees', orphanedKnees, 
        (k) => `<span class="cleanup-title">Broken Line Reference</span><span class="cleanup-desc">Internal ID: ${k} (The items connecting these nodes have changed)</span>`, 
        'Delete Knees', (k) => delete data.knees[k]
    );

    buildSection('Missing Item References', danglingReferences, 
        (ref) => {
            const node = data.nodes.find(n => n.id === ref.nodeId);
            return `<span class="cleanup-title">Invalid ${ref.type} in "${node ? node.shortDesc : 'Unknown Node'}"</span>
                    <span class="cleanup-desc">This node references an item ID that no longer exists in your database.</span>`;
        }, 
        'Fix (Remove Reference)', (ref) => {
            const node = data.nodes.find(n => n.id === ref.nodeId);
            if (!node) return;
            if (ref.optId) {
                const opt = node.options.find(o => o.id === ref.optId);
                if (opt) {
                    if (ref.type === 'Prerequisite') opt.prereqIds = opt.prereqIds.filter(id => id !== ref.itemId);
                    else opt.outputIds = opt.outputIds.filter(id => id !== ref.itemId);
                }
            } else {
                if (ref.type === 'Prerequisite') node.prereqIds = node.prereqIds.filter(id => id !== ref.itemId);
                else node.outputIds = node.outputIds.filter(id => id !== ref.itemId);
            }
        }
    );

    buildSection('Disconnected Actions', disconnectedNodes, 
        (n) => `<span class="cleanup-title">"${n.shortDesc}"</span><span class="cleanup-desc">Has no inputs or outputs connecting it to the game.</span>`, 
        'Delete Action', (n) => data.nodes = data.nodes.filter(node => node.id !== n.id)
    );

    buildSection('Completely Unused Items', unusedItems, 
        (i) => `<span class="cleanup-title">${i.name}</span><span class="cleanup-desc">Not required or granted by any action.</span>`, 
        'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id)
    );

    buildSection('Unused People (No Actions Owned)', unusedPeople, 
        (p) => `<span class="cleanup-title">${p.name}</span><span class="cleanup-desc">Not assigned to any action in the graph.</span>`, 
        'Delete Person', (p) => data.people = data.people.filter(person => person.id !== p.id)
    );

    // Warnings
    buildSection('Items Required but NEVER Granted (Missing Sources)', unproducedItems, 
        (i) => `<span class="cleanup-title">${i.name}</span><span class="cleanup-desc">This is an input somewhere, but no action produces it. (Normal for starting items).</span>`, 
        'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id)
    );

    buildSection('Items Granted but NEVER Required (Dead Ends)', unconsumedItems, 
        (i) => `<span class="cleanup-title">${i.name}</span><span class="cleanup-desc">This is an output somewhere, but no action requires it. (Normal for final goals).</span>`, 
        'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id)
    );
    
    if (container.innerHTML === '') {
        container.innerHTML = '<h3 style="color:var(--text-color); opacity:0.7;">Everything looks clean! No errors found.</h3>';
    }
}

// Initial render
setTimeout(() => { renderAll(); if(typeof centerAndFitGraph === 'function') centerAndFitGraph(); }, 100);