// ── CardVault App ──

// ── Utilities ──
function escH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function specBadge(spec) {
  if (!spec) return '';
  const map = { RC: 'rc', 'Future Stars': 'fs', 'Team Card': 'tc', 'Combo Card': 'cc' };
  const cls = map[spec] || 'tc';
  const label = { RC: 'RC', 'Future Stars': 'FS', 'Team Card': 'TC', 'Combo Card': 'CC' }[spec] || spec;
  return `<span class="badge badge-${cls}" style="margin-left:4px">${label}</span>`;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Navigation ──
const pages = {
  search: SearchPage,
  collection: CollectionPage,
  sets: SetsPage,
  graded: GradedPage,
  wantlist: WantListPage,
  misc: MiscPage,
  upload: UploadPage,
  checklist: ChecklistPage
};

let currentPage = 'search';

function navigate(page) {
  // Warn if leaving checklist page with unsaved changes
  if (currentPage === 'checklist' && page !== 'checklist') {
    const hasChanges = typeof ChecklistPage !== 'undefined' 
      && ChecklistPage.changes 
      && Object.keys(ChecklistPage.changes).length > 0;
    if (hasChanges) {
      const confirmed = confirm('You have unsaved changes in Checklist Entry. If you leave now your changes will be lost.\n\nClick OK to leave anyway, or Cancel to go back and save.');
      if (!confirmed) return;
      // Clear changes so warning doesn't re-trigger
      ChecklistPage.changes = {};
    }
  }

  // Update nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));

  // Show/hide pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  currentPage = page;
  pages[page].render();
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// ── Sidebar stats ──
async function updateSidebarStats() {
  try {
    const stats = await Collection.getStats();
    document.getElementById('ss-total').textContent = (stats.totalOwned + stats.totalMisc).toLocaleString();
    document.getElementById('ss-sets').textContent = stats.totalSets;
    document.getElementById('ss-graded').textContent = stats.totalGraded;
  } catch(err) {
    // silently fail stats
  }
}

// ── Unsaved changes warning on tab close/refresh ──
window.addEventListener('beforeunload', function(e) {
  const hasChanges = typeof ChecklistPage !== 'undefined'
    && ChecklistPage.changes
    && Object.keys(ChecklistPage.changes).length > 0;
  if (hasChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes in Checklist Entry. Are you sure you want to leave?';
    return e.returnValue;
  }
});

// ── Init ──
async function init() {
  // Check config
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    document.getElementById('page-search').classList.add('active');
    document.getElementById('page-search').innerHTML = `
      <div style="max-width:500px;margin:4rem auto;text-align:center">
        <div style="font-size:48px;margin-bottom:1rem">⚙️</div>
        <h2 style="margin-bottom:.75rem">Setup Required</h2>
        <p style="color:var(--text2);margin-bottom:1.5rem">Open <code>config.js</code> and replace <code>YOUR_SUPABASE_URL</code> and <code>YOUR_SUPABASE_ANON_KEY</code> with your actual Supabase credentials.</p>
        <div style="background:var(--surface2);border-radius:var(--radius);padding:1rem;font-family:monospace;font-size:13px;text-align:left">
          const SUPABASE_URL = '<strong>https://xxxx.supabase.co</strong>';<br>
          const SUPABASE_ANON_KEY = '<strong>eyJ...</strong>';
        </div>
      </div>`;
    return;
  }

  await updateSidebarStats();
  navigate('search');
}

init();
