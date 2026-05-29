// ── CONFIGURATION & CREDENTIALS ──
const SUPABASE_URL = "https://pwzdccbjuoeqggqsbgsw.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Rk31D1KrVpwxQ4nQWmXHuA_wRRVVy_S";

const HEADERS = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

// ── CORE REGISTRY DATASETS ──
let projects = [];

let members = [
  { name: 'Girald Renz Gicaraya', initial: 'GG' },
  { name: 'Joshua Trei Apostol', initial: 'JA' },
  { name: 'Luke Gabriel Anino', initial: 'LA' },
  { name: 'Rouge Vhincent Hogar', initial: 'RH' },
  { name: 'Julz Benedict Cometa', initial: 'JC' },
  { name: 'Erik Leo Denosta', initial: 'ED' }
];

let editingId = null;
let deletingId = null;

const weekData = [
  { day:'Mon', val:13 }, { day:'Tue', val:19 }, { day:'Wed', val:16 }, { day:'Thu', val:22 },
  { day:'Fri', val:18 }, { day:'Sat', val:8 }, { day:'Sun', val:5 },
];

const STATUS_COLORS = {
  'In Progress':  '#1565c0',
  'Completed':    '#2e7d32',
  'On Hold':      '#f57c00',
  'Not Started':  '#9e9e9e'
};

// Default seed fallback if cloud table returns empty
const MOCK_PROJECTS = [
  { id:'#001', name:'Highway Construction Phase 1', location:'Metro Manila', status:'In Progress', due:'2026-06-15', progress:85, budget:125, scope:'Major highway expansion project connecting northern Metro Manila districts.' },
  { id:'#002', name:'Bridge Repair Project', location:'Cebu City', status:'Completed', due:'2026-05-20', progress:100, budget:85, scope:'Structural rehabilitation of Mactan Bridge and connecting road.' },
  { id:'#003', name:'Road Maintenance - District 5', location:'Davao', status:'In Progress', due:'2026-07-01', progress:45, budget:45, scope:'Regular maintenance and repaving of District 5 roads in Davao.' },
  { id:'#004', name:'Flood Control System', location:'Quezon City', status:'Not Started', due:'2026-08-10', progress:0, budget:200, scope:'Installation of new flood mitigation infrastructure.' },
  { id:'#005', name:'Drainage Improvement Project', location:'Pasig', status:'On Hold', due:'2026-06-30', progress:30, budget:65, scope:'Upgrade and expansion of drainage systems in Pasig City.' },
  { id:'#006', name:'Coastal Road Expansion', location:'Cavite', status:'In Progress', due:'2026-09-15', progress:60, budget:320, scope:'Expansion of the coastal road connecting Manila Bay and Cavite province.' },
];

// ── CLOUD SYNC: SUPABASE NETWORK CALLS ──

// Fetch list from Supabase
async function fetchFromSupabase() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=*`, { method: "GET", headers: HEADERS });
    if (!res.ok) throw new Error("Could not fetch cloud entries");
    
    const data = await res.json();
    
    if (data.length === 0) {
      // Database is fresh, load the seed entries up to the cloud automatically
      for (const item of MOCK_PROJECTS) {
        await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(item)
        });
      }
      return await fetchFromSupabase(); // Reload from cloud once populated
    }
    
    projects = data;
    refreshAll();
  } catch (err) {
    console.error(err);
    showToast("Database loading failed. Running local safe-mode.", "error");
    projects = MOCK_PROJECTS;
    refreshAll();
  }
}

// ── UTILITIES & GRAPHIC CONSTRUCTORS ──
function statusClass(s) {
  return { 'In Progress':'status-inprogress', 'Completed':'status-completed', 'On Hold':'status-onhold', 'Not Started':'status-notstarted' }[s] || '';
}
function progressColor(p) {
  if (p === 100) return '#16a34a';
  if (p >= 70)  return '#2563eb';
  if (p >= 40)  return '#f57c00';
  return '#ef4444';
}
function formatDate(d) { return d ? new Date(d + 'T00:00').toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
function totalBudget() { return projects.reduce((a,p) => a + (p.budget||0), 0); }
function countByStatus(s) { return projects.filter(p => p.status === s).length; }

// ── ENGINE CONTROLLER VIEW SWITCHING ──
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t,i) => {
    const views = ['overview','dashboard','projects','members'];
    t.classList.toggle('active', views[i] === name);
  });
  document.getElementById('view-' + name).classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'projects')  renderProjectCards();
  if (name === 'overview')  renderOverview();
  if (name === 'members')   renderMembers();
}

function renderMembers() {
  document.getElementById('membersGrid').innerHTML = members.map(m => `
    <div class="member-card">
      <div class="member-avatar">${m.initial}</div>
      <div class="member-info">
        <h4>${m.name}</h4>
      </div>
    </div>
  `).join('');
}

function renderDashboard() {
  renderStats();
  renderDonut();
  renderBars();
  renderTracker();
  renderTable(projects);
}

function renderStats() {
  const open = projects.filter(p => p.status !== 'Completed').length;
  const dueSoon = projects.filter(p => {
    if (!p.due) return false;
    const diff = (new Date(p.due) - new Date()) / (1000*60*60*24);
    return diff >= 0 && diff <= 7 && p.status !== 'Completed';
  }).length;
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-clipboard-list"></i></div><div class="stat-num">${projects.length}</div><div class="stat-label">Total Projects</div></div>
    <div class="stat-card green"><div class="stat-icon"><i class="fas fa-tasks"></i></div><div class="stat-num">${open * 4 - 1}</div><div class="stat-label">Open Tasks</div></div>
    <div class="stat-card amber"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-num">${members.length}</div><div class="stat-label">Team Members</div></div>
    <div class="stat-card red"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-num">${dueSoon}</div><div class="stat-label">Due Soon</div></div>
  `;
}

function renderDonut() {
  const total = projects.length;
  if (total === 0) {
    document.getElementById('donutSvg').innerHTML = '';
    document.getElementById('donutLegend').innerHTML = '';
    return;
  }

  const ORDER = ['In Progress', 'Completed', 'On Hold', 'Not Started'];
  const counts = {};
  ORDER.forEach(s => { counts[s] = 0; });
  projects.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });

  const cx = 80, cy = 80, r = 54;
  const circumference = 2 * Math.PI * r; 
  const gap = 3; 

  let svgParts = '';
  let legendParts = '';
  let currentOffset = 0; 

  ORDER.forEach(status => {
    const count = counts[status];
    if (count === 0) return;
    const color = STATUS_COLORS[status];
    const fraction = count / total;
    const dash = (circumference * fraction) - gap;
    const space = circumference - dash;

    svgParts += `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none"
      stroke="${color}"
      stroke-width="26"
      stroke-dasharray="${dash.toFixed(2)} ${space.toFixed(2)}"
      stroke-dashoffset="${(-currentOffset).toFixed(2)}"
      stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})"
    />`;

    currentOffset += circumference * fraction;

    const pct = Math.round(fraction * 100);
    legendParts += `
      <div class="legend-item">
        <div class="legend-dot" style="background:${color}"></div>
        <div>
          <strong>${status}</strong><br/>
          <span style="color:#6b7280">${pct}% · ${count} project${count !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
  });

  svgParts += `
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="central"
      font-family="'Barlow Condensed', sans-serif" font-size="26" font-weight="800" fill="#1a1f3c">${total}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" dominant-baseline="central"
      font-family="'Barlow', sans-serif" font-size="10" font-weight="600" fill="#6b7280">PROJECTS</text>
  `;

  document.getElementById('donutSvg').innerHTML = svgParts;
  document.getElementById('donutLegend').innerHTML = legendParts;
}

function renderBars() {
  const max = Math.max(...weekData.map(d => d.val));
  document.getElementById('barChart').innerHTML = weekData.map(d => `
    <div class="bar-col">
      <div class="bar-val">${d.val}</div>
      <div class="bar" style="height:${(d.val/max)*110}px" title="${d.val} tasks on ${d.day}"></div>
      <div class="bar-label">${d.day}</div>
    </div>`).join('');
}

function renderTracker() {
  document.getElementById('trackerList').innerHTML = projects.slice(0,5).map(p => `
    <div class="tracker-item">
      <div class="tracker-header">
        <span class="tracker-name">${p.name}</span>
        <span class="tracker-pct">${p.progress}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${p.progress}%;background:${progressColor(p.progress)}"></div>
      </div>
    </div>`).join('');
}

function renderTable(data) {
  document.getElementById('projectTableBody').innerHTML = data.map(p => `
    <tr>
      <td class="id-cell">${p.id}</td>
      <td><div class="proj-name">${p.name}</div><div class="proj-loc"><i class="fas fa-map-marker-alt" style="font-size:10px"></i>${p.location}</div></td>
      <td><span class="status-badge ${statusClass(p.status)}">${p.status}</span></td>
      <td>${formatDate(p.due)}</td>
      <td><div class="prog-wrap"><div class="prog-bar-sm"><div class="prog-fill-sm" style="width:${p.progress}%;background:${progressColor(p.progress)}"></div></div><span class="prog-pct">${p.progress}%</span></div></td>
      <td class="budget">₱${p.budget}M</td>
      <td><div class="action-btns">
        <button class="action-btn btn-view" onclick="openViewModal('${p.id}')" title="View"><i class="fas fa-eye"></i></button>
        <button class="action-btn btn-edit" onclick="openEditModal('${p.id}')" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="action-btn btn-done" onclick="markComplete('${p.id}')" title="Mark Complete"><i class="fas fa-check-circle"></i></button>
        <button class="action-btn btn-del" onclick="openDeleteModal('${p.id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
}

function renderProjectCards() {
  const filter = document.getElementById('statusFilter').value;
  const data = filter ? projects.filter(p => p.status === filter) : projects;
  document.getElementById('projectsGrid').innerHTML = data.map(p => `
    <div class="proj-card">
      <div class="proj-card-top">
        <span class="proj-card-id">${p.id}</span>
        <span class="status-badge ${statusClass(p.status)}">${p.status}</span>
      </div>
      <div class="proj-card-name">${p.name}</div>
      <div class="proj-card-loc"><i class="fas fa-map-marker-alt" style="font-size:10px;margin-right:4px"></i>${p.location}</div>
      <div class="progress-bar" style="margin-top:12px">
        <div class="progress-fill" style="width:${p.progress}%;background:${progressColor(p.progress)}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <span style="font-size:11px;color:var(--muted)">Progress</span>
        <span style="font-size:12px;font-weight:700">${p.progress}%</span>
      </div>
      <div class="proj-card-meta">
        <div class="proj-meta-item"><label>Budget</label><span>₱${p.budget}M</span></div>
        <div class="proj-meta-item"><label>Due</label><span>${formatDate(p.due)}</span></div>
      </div>
      <div class="proj-card-actions">
        <button class="proj-action-btn" style="background:#dbeafe;color:#1e40af" onclick="openViewModal('${p.id}')"><i class="fas fa-eye"></i> View</button>
        <button class="proj-action-btn" style="background:#d1fae5;color:#065f46" onclick="openEditModal('${p.id}')"><i class="fas fa-pen"></i> Edit</button>
        <button class="proj-action-btn" style="background:#fee2e2;color:#b91c1c" onclick="openDeleteModal('${p.id}')"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`).join('') || '<p style="color:var(--muted);padding:20px">No projects match this filter.</p>';
}

function renderOverview() {
  document.getElementById('ov-total').textContent = projects.length;
  document.getElementById('ov-budget').textContent = '₱' + totalBudget() + 'M';
  document.getElementById('ov-done').textContent = countByStatus('Completed');
  const statuses = ['In Progress','Completed','On Hold','Not Started'];
  document.getElementById('overviewSummary').innerHTML = statuses.map(s => `
    <div class="summary-row">
      <span class="summary-label"><span class="status-badge ${statusClass(s)}" style="margin-right:8px">${s}</span></span>
      <span class="summary-val">${countByStatus(s)} project${countByStatus(s)!==1?'s':''}</span>
    </div>`).join('');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target === o) o.classList.remove('open'); });
});

function openNewProjectModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'New Project';
  ['name','loc','desc'].forEach(f => document.getElementById('f-'+f).value='');
  document.getElementById('f-status').value = 'In Progress';
  document.getElementById('f-due').value = '';
  document.getElementById('f-budget').value = '';
  document.getElementById('f-progress').value = '0';
  openModal('projectModal');
}

function openEditModal(id) {
  const p = projects.find(x=>x.id===id); if(!p) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Project';
  document.getElementById('f-name').value = p.name;
  document.getElementById('f-loc').value = p.location;
  document.getElementById('f-status').value = p.status;
  document.getElementById('f-due').value = p.due || '';
  document.getElementById('f-budget').value = p.budget;
  document.getElementById('f-progress').value = p.progress;
  document.getElementById('f-desc').value = p.scope || p.desc || '';
  openModal('projectModal');
}

// ── CONNECTED CLOUD WRITES (CREATE / UPDATE) ──
async function saveProject() {
  const name = document.getElementById('f-name').value.trim();
  const loc  = document.getElementById('f-loc').value.trim();
  if (!name) { showToast('Project name is required','error'); return; }
  
  let rawProgress = Math.min(100, Math.max(0, parseInt(document.getElementById('f-progress').value)||0));
  let status = document.getElementById('f-status').value;
  if (rawProgress === 100) status = 'Completed';

  // Generate clean unique key if creating a brand new item
  const targetId = editingId || '#' + Date.now().toString().slice(-3);

  // Payload structure maps description window output straight into the database table 'scope' column
  const proj = {
    id: targetId,
    name, 
    location: loc || '—',
    status: status,
    due: document.getElementById('f-due').value || null,
    progress: rawProgress,
    budget: parseInt(document.getElementById('f-budget').value)||0,
    scope: document.getElementById('f-desc').value.trim(), 
  };

  try {
    let url = `${SUPABASE_URL}/rest/v1/projects`;
    let method = "POST";

    if (editingId) {
      url = `${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(editingId)}`;
      method = "PATCH";
    }

    const res = await fetch(url, {
      method: method,
      headers: HEADERS,
      body: JSON.stringify(proj)
    });

    if (!res.ok) throw new Error("Cloud write transaction rejected.");

    showToast(editingId ? 'Project updated successfully' : 'Project added successfully', 'success');
    closeModal('projectModal');
    fetchFromSupabase(); // Instantly pull down fresh clean dataset arrays
  } catch (err) {
    console.error(err);
    showToast("Failed to sync structural item with cloud server.", "error");
  }
}

function openViewModal(id) {
  const p = projects.find(x=>x.id===id); if(!p) return;
  document.getElementById('viewModalTitle').textContent = p.name;
  document.getElementById('viewModalBody').innerHTML = `
    <div class="view-section">
      <h4>Project Info</h4>
      <div class="view-row">
        <div class="view-field"><label>ID</label><p>${p.id}</p></div>
        <div class="view-field"><label>Location</label><p>${p.location}</p></div>
        <div class="view-field"><label>Status</label><p><span class="status-badge ${statusClass(p.status)}">${p.status}</span></p></div>
        <div class="view-field"><label>Due Date</label><p>${formatDate(p.due)}</p></div>
        <div class="view-field"><label>Budget</label><p>₱${p.budget}M</p></div>
        <div class="view-field"><label>Progress</label><p>${p.progress}%</p></div>
      </div>
    </div>
    <div class="view-section">
      <h4>Description</h4>
      <p style="font-size:13px;line-height:1.6">${p.scope || p.desc || 'No description provided.'}</p>
    </div>
    <div class="view-section" style="margin-bottom:0">
      <h4>Progress</h4>
      <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%;background:${progressColor(p.progress)}"></div></div>
      <div style="text-align:right;font-size:12px;font-weight:700;margin-top:4px">${p.progress}%</div>
    </div>`;
  document.getElementById('viewEditBtn').onclick = () => { closeModal('viewModal'); openEditModal(id); };
  openModal('viewModal');
}

function openDeleteModal(id) {
  const p = projects.find(x=>x.id===id); if(!p) return;
  deletingId = id;
  document.getElementById('deleteModalText').textContent = `"${p.name}" will be permanently removed.`;
  document.getElementById('confirmDeleteBtn').onclick = () => confirmDelete();
  openModal('deleteModal');
}

// ── CONNECTED CLOUD WRITES (DELETE) ──
async function confirmDelete() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(deletingId)}`, {
      method: "DELETE",
      headers: HEADERS
    });
    if (!res.ok) throw new Error("Cloud delete execution rejected.");
    
    closeModal('deleteModal');
    showToast("Project entry successfully removed from cloud registry", "success");
    fetchFromSupabase();
  } catch (err) {
    console.error(err);
    showToast("Delete operation failed to execute in the cloud database.", "error");
  }
}

// ── CONNECTED CLOUD WRITES (MARK QUICK COMPLETE) ──
async function markComplete(id) {
  const p = projects.find(x=>x.id===id); if(!p) return;
  if (p.status === 'Completed') { showToast('Already completed','info'); return; }
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ status: "Completed", progress: 100 })
    });
    if (!res.ok) throw new Error("Status patch operation failed");
    
    showToast(`"${p.name}" marked as complete`, 'success');
    fetchFromSupabase();
  } catch (err) {
    console.error(err);
    showToast("Could not update completion metrics to cloud storage.", "error");
  }
}

// ── FILTERS, SEARCH AND CSV DATA EXPORTS ──
function handleSearch(q) {
  if (!q.trim()) { renderTable(projects); return; }
  const fl = q.toLowerCase();
  renderTable(projects.filter(p => p.name.toLowerCase().includes(fl) || p.location.toLowerCase().includes(fl) || p.id.includes(fl)));
  if (!document.getElementById('view-dashboard').classList.contains('active')) showView('dashboard');
}

function exportCSV() {
  const headers = ['ID','Name','Location','Status','Due Date','Progress (%)','Budget (₱M)'];
  const rows = projects.map(p => [p.id,p.name,p.location,p.status,p.due,p.progress,p.budget]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'DPWH_Projects.csv'; a.click();
  showToast('CSV exported','success');
}

function showNotifications() {
  document.getElementById('notifBadge').style.display = 'none';
  showToast('1 project due soon: Drainage Improvement Project (Jun 30)','info');
}
function showProfile() { showToast('Logged in as: Admin User','info'); }

function showToast(msg, type='info') {
  const icons = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function refreshAll() {
  if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
  if (document.getElementById('view-projects').classList.contains('active'))  renderProjectCards();
  if (document.getElementById('view-overview').classList.contains('active'))  renderOverview();
  if (document.getElementById('view-members').classList.contains('active'))   renderMembers();
}

// ── RUNTIME ARCHITECTURE EXECUTION START ──
fetchFromSupabase();