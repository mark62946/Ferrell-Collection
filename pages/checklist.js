// ── Last-used parallel memory ──
const LAST_PARALLEL_KEY = 'checklist.lastParallel';
const DEFAULT_PARALLEL = 'Rainbow Foil';

function getLastParallel() {
  try {
    const saved = localStorage.getItem(LAST_PARALLEL_KEY);
    return saved && PARALLEL_OPTIONS.includes(saved) ? saved : DEFAULT_PARALLEL;
  } catch (e) {
    return DEFAULT_PARALLEL;
  }
}

function setLastParallel(name) {
  try {
    localStorage.setItem(LAST_PARALLEL_KEY, name);
  } catch (e) { /* storage unavailable: just skip remembering */ }
}

// ── Checklist Bulk Entry Page ──
const ChecklistPage = {
  sets: [],
  activeSetId: null,
  cards: [],
  activeSectionName: 'Base',
  sections: [],
  colMap: {},
  changes: {},

  async render() {
    const el = document.getElementById('page-checklist');
    el.innerHTML = `<div class="loading"><div class="spinner"></div> Loading sets...</div>`;
    if (!ChecklistPage._parClicksInit) { ChecklistPage.initParClicks(); ChecklistPage._parClicksInit = true; }
    try {
      this.sets = await Sets.getAll();
      if (!this.sets.length) {
        el.innerHTML = `
          <div class="page-header"><div class="page-title">Checklist Entry</div></div>
          <div style="text-align:center;padding:3rem;color:var(--text3)">
            <div style="font-size:48px;margin-bottom:1rem">📋</div>
            <div style="font-size:15px">No sets loaded yet</div>
            <div style="margin-top:1rem"><button class="btn btn-primary" onclick="navigate('upload')">Upload a Checklist</button></div>
          </div>`;
        return;
      }
      el.innerHTML = `
        <div class="page-header flex-between">
          <div>
            <div class="page-title">Checklist Entry</div>
            <div class="page-subtitle">Bulk add cards section by section</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="cl-set-picker" style="height:36px;border:1px solid var(--border2);border-radius:var(--radius-sm);padding:0 10px;font-size:14px;min-width:300px">
              <option value="">Select a set to begin...</option>
              ${this.sets.map(s => '<option value="' + s.id + '">' + s.year + ' ' + s.brand + ' ' + s.set_name + (s.series ? ' - ' + s.series : '') + '</option>').join('')}
            </select>
            <button class="btn btn-primary" onclick="ChecklistPage.loadSet()">Load</button>
          </div>
        </div>
        <div id="cl-main"></div>`;
    } catch(err) {
      el.innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  async loadSet() {
    const setId = document.getElementById('cl-set-picker').value;
    if (!setId) { showToast('Please select a set', 'error'); return; }
    this.activeSetId = setId;
    this.changes = {};
    document.getElementById('cl-main').innerHTML = `<div class="loading"><div class="spinner"></div> Loading cards...</div>`;

    try {
      // Fetch ALL cards using pagination (Supabase max 1000 per request)
      var allCards = [];
      var fetchFrom = 0;
      var fetchSize = 1000;
      var fetchDone = false;
      while (!fetchDone) {
        var fetchRes = await db
          .from('cards')
          .select('id, card_number, player, team, specialty, section')
          .eq('set_id', setId)
          .order('id', { ascending: true })
          .range(fetchFrom, fetchFrom + fetchSize - 1);
        if (fetchRes.error) throw fetchRes.error;
        if (!fetchRes.data || fetchRes.data.length === 0) break;
        allCards = allCards.concat(fetchRes.data);
        if (fetchRes.data.length < fetchSize) fetchDone = true;
        fetchFrom += fetchSize;
      }
      var error = null;

      // Sort cards: first by section order of appearance, then numerically within section
      // We need to preserve the original section order from the checklist
      // Group by section preserving insertion order
      const sectionOrder = [];
      const sectionMap = {};
      allCards.forEach(card => {
        const sec = card.section || 'Base';
        if (!sectionMap[sec]) {
          sectionMap[sec] = [];
          sectionOrder.push(sec);
        }
        sectionMap[sec].push(card);
      });

      // Sort cards within each section numerically where possible
      sectionOrder.forEach(sec => {
        sectionMap[sec].sort((a, b) => {
          // Extract trailing number from card number (handles BSA2-1, 91B2-10, etc.)
          const extractNum = (s) => {
            const m = String(s).trim().match(/(\d+)$/);
            return m ? parseInt(m[1]) : 0;
          };
          const aPrefix = String(a.card_number).trim().replace(/\d+$/, '');
          const bPrefix = String(b.card_number).trim().replace(/\d+$/, '');
          if (aPrefix === bPrefix) return extractNum(a.card_number) - extractNum(b.card_number);
          return String(a.card_number).trim().localeCompare(String(b.card_number).trim());
        });
      });

      this.cards = allCards;
      this.sections = sectionOrder.map(name => ({ name, cards: sectionMap[name] }));
      this.activeSectionName = this.sections[0].name;

      // Load existing collection entries in chunks (avoid URL length limit with large IN clauses)
      const cardIds = allCards.map(c => c.id);
      const colChunkSize = 200;
      let colData = [];
      for (let ci = 0; ci < cardIds.length; ci +=
