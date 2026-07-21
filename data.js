// --- STATE MANAGEMENT ---
let data = { nodes: [], knees: {}, items: [], people: [] };

const generateId = () => Math.random().toString(36).substr(2, 9);

const getName = (list, id) => {
    const item = list.find(i => i.id === id);
    return item ? item.name : 'Unknown';
};

const getColor = (id) => {
    const person = data.people.find(p => p.id === id);
    return person && person.color ? person.color : '#444444';
};

// --- FILE I/O ---
document.getElementById('btn-save').addEventListener('click', () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "taraxaplan_data.json";
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('file-load').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            data = JSON.parse(event.target.result);
            // Ensure backwards compatibility
            data.nodes.forEach(n => {
                if (!n.prereqIds) n.prereqIds = n.prereqId ? [n.prereqId] : [];
                if (!n.outputIds) n.outputIds = n.outputId ? [n.outputId] : [];
            });
            if (!data.items) data.items = [];
            if (!data.people) data.people = [];
            
            // Re-render everything
            if(typeof renderAll === 'function') renderAll();
            if(typeof centerAndFitGraph === 'function') centerAndFitGraph();
            
        } catch (err) { alert("Error parsing JSON file!"); }
    };
    reader.readAsText(file);
});