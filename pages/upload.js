// ── Upload Checklist Page ──
const UploadPage = {
  parsedCards: [],

  render() {
    const el = document.getElementById('page-upload');
    el.innerHTML = `
      <div class="page-header">
        <div class="page-title">Upload Checklist</div>
        <div class="page-subtitle">Upload any Topps Excel checklist to add it to your database</div>
      </div>
      <div class="card" style="max-width:640px">
        <div class="form-section-title">Set Information</div>
        <div class="form-grid">
          <div class="form-group"><label>Year *</label><input type="number" id="up-year" placeholder="e.g. 2026" min="1900" max="2099"></div>
          <div class="form-group"><label>Brand *</label><input type="text" id="up-brand" placeholder="e.g. Topps, Topps Chrome"></div>
          <div class="form-group"><label>Set Name *</label><input type="text" id="up-setname" placeholder="e.g. Series 2, Chrome Black"></div>
          <div class="form-group"><label>Series (optional)</label><input type="text" id="up-series" placeholder="e.g. Hobby, Retail"></div>
        </div>
        <div class="form-section-title" style="margin-top:1.25rem">Checklist File</div>
        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
          <div class="upload-zone-icon">📄</div>
          <div class="upload-zone-text">Click to select your Excel checklist</div>
          <div class="upload-zone-sub">Supports .xlsx files from Topps checklists</div>
        </div>
        <input type="file" id="file-input" accept=".xlsx,.xls" style="display:none" onchange="UploadPage.handleFile(this.files[0])">
        <div id="upload-preview"></div>
        <div id="upload-progress" style="display:none">
          <div style="font-size:13px;color:var(--text2);margin-bottom:6px" id="upload-status">Uploading...</div>
          <div class="progress-bar"><div class="progress-fill" id="upload-prog-fill" style="width:0%"></div></div>
        </div>
        <div id="upload-actions" style="display:none;margin-top:1rem">
          <button class="btn btn-primary" id="upload-btn" onclick="UploadPage.doUpload()">Upload to Database</button>
          <button class="btn" onclick="UploadPage.reset()" style="margin-left:8px">Cancel</button>
        </div>
      </div>
      <div class="card" style="max-width:640px;margin-top:1rem">
        <div class="card-title">How it works</div>
        <ol style="padding-left:1.25rem;line-height:2;font-size:13px;color:var(--text2)">
          <li>Fill in the set info above (year, brand, set name)</li>
          <li>Upload your Topps Excel checklist file</li>
          <li>All cards and sections are parsed automatically</li>
          <li>Click Upload — cards appear in Checklist Entry grouped by section</li>
        </ol>
      </div>`;

    var zone = document.getElementById('upload-zone');
    zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function(e) { e.preventDefault(); zone.classList.remove('dragover'); UploadPage.handleFile(e.dataTransfer.files[0]); });
  },

  async handleFile(file) {
    if (!file) return;
    document.getElementById('upload-preview').innerHTML = '<div class="loading" style="padding:1rem 0"><div class="spinner"></div> Parsing ' + file.name + '...</div>';
    document.getElementById('upload-actions').style.display = 'none';
    try {
      var cards = await this.parseExcel(file);
      this.parsedCards = cards;
      if (!cards.length) {
        document.getElementById('upload-preview').innerHTML = '<div class="upload-preview" style="color:var(--danger)">No cards found. Make sure the file has a Full Checklist or Sheet1.</div>';
        return;
      }
      var sections = [];
      var counts = {};
      for (var i = 0; i < cards.length; i++) {
        var s = cards[i].section;
        if (!counts[s]) { counts[s] = 0; sections.push(s); }
        counts[s]++;
      }
      var html = '<div class="upload-preview">';
      html += '<div style="font-weight:600;margin-bottom:8px">Found ' + cards.length.toLocaleString() + ' cards across ' + sections.length + ' sections</div>';
      html += '<div style="font-size:12px;color:var(--text3);line-height:2">';
      for (var i = 0; i < Math.min(sections.length, 30); i++) {
        html += '<span style="display:inline-block;margin-right:14px">' + sections[i] + ' (' + counts[sections[i]] + ')</span>';
      }
      if (sections.length > 30) html += '<span style="color:var(--accent)">+ ' + (sections.length - 30) + ' more sections</span>';
      html += '</div></div>';
      document.getElementById('upload-preview').innerHTML = html;
      document.getElementById('upload-btn').textContent = 'Upload ' + cards.length.toLocaleString() + ' Cards to Database';
      document.getElementById('upload-actions').style.display = 'flex';
    } catch(err) {
      document.getElementById('upload-preview').innerHTML = '<div class="upload-preview" style="color:var(--danger)">Parse error: ' + err.message + '</div>';
    }
  },

  // ── Noise detection ──────────────────────────────────────────────────────
  // Returns true if this row should be completely skipped.
  // Handles:
  //   - Blank rows
  //   - Pure digit rows
  //   - Card-count lines like "350 cards"
  //   - Top-level category headers: BASE, INSERT, AUTOGRAPH, RELIC, etc.
  //   - Chrome Black title rows: "2026 Topps Chrome Black Checklist", "** SUBJECT TO CHANGE**"
  //   - Distribution notes: Hobby Exclusive, Retail Exclusive, etc.
  //   - Known noise phrases
  isNoise(v0) {
    if (!v0) return true;
    var v0l = v0.toLowerCase().trim();
    if (/^\*+\s*subject to change\s*\**/i.test(v0)) return true;
    if (/^\d+$/.test(v0)) return true;
    if (/^\d+ (cards?|players?|figures?)/i.test(v0)) return true;

    // Top-level category headers — single words or short phrases that are
    // parent groupings, NOT the real section name we want to store.
    var categoryHeaders = [
      'base', 'insert', 'autograph', 'relic', 'autograph relic',
      'base set', 'autographs', 'inserts', 'relics'
    ];
    if (categoryHeaders.indexOf(v0l) >= 0) return true;

    // Distribution / exclusivity noise
    var qualWords = [
      'hobby exclusive', 'retail exclusive', 'super box exclusive',
      'hobby/hobby jumbo only', 'retail holiday tin exclusive', 'fanatics box exclusive',
      'celebration mega box exclusives', 'hobby/jumbo exclusive', 'tin exclusive',
      'versions tba', 'hobby/jumbo silver pack exclusive',
      'all cards are 1/1 - one card per letter of player\'s last name'
    ];
    for (var i = 0; i < qualWords.length; i++) {
      if (v0l.indexOf(qualWords[i]) >= 0) return true;
    }

    // Prize / redemption noise
    var containsNoise = [
      'victus bat', 'zion case', 'topps rawlings baseball',
      'mitchell & ness jerseys', 'lids hats of your choice', 'franklin custom batting'
    ];
    for (var i = 0; i < containsNoise.length; i++) {
      if (v0l.indexOf(containsNoise[i]) >= 0) return true;
    }

    return false;
  },

  // Returns true if this looks like a checklist title row (not a section header).
  // e.g. "2026 Topps Chrome Black Checklist", "2026 Topps Series 1 Checklist"
  isTitleRow(v0) {
    return /checklist/i.test(v0);
  },

  isBuybackRow(v0, v1) {
    return /^\d{4}\s+Topps,?$/i.test(String(v0 || '').trim()) && String(v1 || '').trim().length > 1;
  },

  parseBuybackCard(v0, v1, v2, section) {
    v0 = String(v0 || '').trim().replace(/,$/, '');
    v1 = String(v1 || '').trim().replace(/,$/, '');
    v2 = String(v2 || '').trim().replace(/,$/, '');
    var yearMatch = v0.match(/^(\d{4})/);
    if (!yearMatch) return null;
    var year = yearMatch[1];
    var v1c = v1.replace(/\s*Graded\s*$/i, '').trim();
    var numMatch = v1c.match(/#([\w]+)/);
    var cardNum, player;
    if (numMatch) {
      cardNum = year + '-' + numMatch[1];
      player = v1c.replace(/\s*#.*/, '').trim();
    } else {
      var parts = v1c.split(' ');
      var last = parts[parts.length - 1];
      if (parts.length > 1 && /^[\w]+$/.test(last)) {
        cardNum = year + '-' + last;
        player = parts.slice(0, parts.length - 1).join(' ').trim();
      } else {
        cardNum = year + '-?';
        player = v1c;
      }
    }
    return { section: section, card_number: cardNum, player: player, team: v2 || null, specialty: v0 + ' ' + v1c };
  },

  titleCase(str) {
    return str.split(' ').map(function(w) {
      return w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join(' ');
  },

  // ── Is this row a real section header? ──────────────────────────────────
  // A section header has text in col A and nothing in col B,
  // and is not noise, not a title row, and not a card number.
  isSectionHeader(v0, v1) {
    if (!v0 || v1) return false;                      // must have A, must not have B
    if (this.isTitleRow(v0)) return false;             // skip title rows
    if (this.isNoise(v0)) return false;                // skip noise (incl. category headers)
    if (/^[\d][\d\-]*$/.test(v0)) return false;       // skip pure number rows
    return true;
  },

  async parseExcel(file) {
    await this.loadSheetJS();
    var self = this;
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array' });

          // Prefer 'Full Checklist' sheet (Series 2 style), fall back to Sheet1
          var sheetName = wb.SheetNames.indexOf('Full Checklist') >= 0
            ? 'Full Checklist'
            : wb.SheetNames[0];
          var ws = wb.Sheets[sheetName];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          // ── First pass: mark section header rows ────────────────────────
          var sectionRows = {};
          for (var i = 0; i < rows.length; i++) {
            var v0 = String(rows[i][0] || '').trim();
            var v1 = String(rows[i][1] || '').trim();
            if (!self.isSectionHeader(v0, v1)) continue;
            // Normalise "BASE SET" → "Base", everything else → Title Case
            sectionRows[i] = (v0.toUpperCase() === 'BASE SET') ? 'Base' : self.titleCase(v0);
          }

          // ── Second pass: parse card rows ────────────────────────────────
          var cards = [];
          var currentSection = 'Base';
          var secCounters = {};

          // Track seen card numbers per section to handle dual-auto rows
          // (same card number, two players on separate rows)
          var seenCardNums = {};

          for (var i = 0; i < rows.length; i++) {
            var v0 = String(rows[i][0] || '').trim();
            var v1 = String(rows[i][1] || '').trim();
            var v2 = String(rows[i][2] || '').trim();
            var v3 = String(rows[i][3] || '').trim();

            // Section header → update current section
            if (sectionRows[i] !== undefined) {
              currentSection = sectionRows[i];
              if (!secCounters[currentSection]) secCounters[currentSection] = 0;
              if (!seenCardNums[currentSection]) seenCardNums[currentSection] = {};
              continue;
            }

            // Skip completely empty rows
            if (!v0 && !v1) continue;

            // Skip title rows (e.g. "2026 Topps Chrome Black Checklist")
            if (v0 && !v1 && self.isTitleRow(v0)) continue;

            // Skip noise-only rows (col A has noise text, col B empty)
            if (v0 && !v1 && self.isNoise(v0)) continue;

            // Must have a player name in col B
            if (!v1 || v1.length < 2) continue;

            var player = v1.replace(/,$/, '').trim();
            var team   = v2.replace(/,$/, '').trim() || null;
            var spec   = v3.replace(/[()]/g, '').trim() || null;
            var cardNum = '';

            if (v0 && /^[\w][\w\-\/#\.]*$/.test(v0)) {
              // ── Normal card with a number in col A ─────────────────────
              if (currentSection === 'Iconic Topps Buyback Cards' && self.isBuybackRow(v0, v1)) {
                var bb = self.parseBuybackCard(v0, v1, v2, currentSection);
                if (bb) { cards.push(bb); secCounters[currentSection]++; }
                continue;
              }
              cardNum = v0;

              // ── Dual autograph handling ─────────────────────────────────
              // If we've already stored a card with this number in this section,
              // append this player's name to it instead of creating a duplicate row.
              var secSeen = seenCardNums[currentSection] || {};
              if (secSeen[cardNum] !== undefined) {
                var existingIdx = secSeen[cardNum];
                cards[existingIdx].player += ' / ' + player;
                // Merge teams if different
                if (team && cards[existingIdx].team && cards[existingIdx].team !== team) {
                  cards[existingIdx].team += ' / ' + team;
                }
                continue;
              }
              // Record this card's index for potential dual-auto merging
              if (!seenCardNums[currentSection]) seenCardNums[currentSection] = {};
              seenCardNums[currentSection][cardNum] = cards.length;

            } else if (!v0) {
              // ── No card number in col A ─────────────────────────────────
              if (!secCounters[currentSection]) secCounters[currentSection] = 0;
              secCounters[currentSection]++;

              if (currentSection === 'Iconic Topps Buyback Cards') {
                // Series 1 style buyback: "1983 Topps Tony Gwynn Card #482 ..."
                var ym = player.match(/^(\d{4})\s+Topps\s+(.+)/i);
                if (ym) {
                  var yr = ym[1];
                  var rest = ym[2].trim();
                  var nm = rest.match(/Card\s+#(\w+)/i);
                  cardNum = nm ? yr + '-' + nm[1] : yr + '-' + secCounters[currentSection];
                  var pm = rest.match(/^(.+?)\s+Card/i);
                  player = pm ? pm[1].trim() : rest.substring(0, 25).trim();
                  spec = yr + ' Topps';
                } else {
                  cardNum = 'BUY' + secCounters[currentSection];
                }
              } else {
                // Redemption / gift / no-number card
                var pfx = currentSection.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
                cardNum = pfx + secCounters[currentSection];
              }
            } else {
              // Col A has something but it doesn't look like a card number — skip
              continue;
            }

            if (!secCounters[currentSection]) secCounters[currentSection] = 0;
            secCounters[currentSection]++;

            cards.push({
              section:     currentSection,
              card_number: cardNum,
              player:      player,
              team:        team,
              specialty:   spec
            });
          }

          resolve(cards);
        } catch(err) { reject(err); }
      };
      reader.onerror = function() { reject(new Error('File read failed')); };
      reader.readAsArrayBuffer(file);
    });
  },

  loadSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  async doUpload() {
    var year    = parseInt(document.getElementById('up-year').value);
    var brand   = document.getElementById('up-brand').value.trim();
    var setName = document.getElementById('up-setname').value.trim();
    var series  = document.getElementById('up-series').value.trim();
    if (!year || !brand || !setName) { showToast('Please fill in Year, Brand, and Set Name', 'error'); return; }
    if (!this.parsedCards.length)    { showToast('No cards to upload', 'error'); return; }

    document.getElementById('upload-progress').style.display = 'block';
    document.getElementById('upload-actions').style.display  = 'none';

    try {
      document.getElementById('upload-status').textContent    = 'Creating set record...';
      document.getElementById('upload-prog-fill').style.width = '5%';

      var set = await Sets.create({
        year: year, brand: brand, set_name: setName,
        series: series || null, total_cards: this.parsedCards.length
      });

      var cards = this.parsedCards.map(function(c) {
        return {
          set_id:      set.id,
          card_number: c.card_number,
          player:      c.player,
          team:        c.team    || null,
          specialty:   c.specialty || null,
          section:     c.section
        };
      });

      var chunkSize = 400;
      for (var i = 0; i < cards.length; i += chunkSize) {
        document.getElementById('upload-prog-fill').style.width =
          (Math.round((i / cards.length) * 88) + 8) + '%';
        document.getElementById('upload-status').textContent =
          'Uploading cards ' + (i + 1) + ' to ' + Math.min(i + chunkSize, cards.length) + ' of ' + cards.length + '...';
        var result = await db.from('cards').insert(cards.slice(i, i + chunkSize));
        if (result.error) throw result.error;
      }

      document.getElementById('upload-prog-fill').style.width  = '100%';
      document.getElementById('upload-status').textContent     = 'Done! ' + cards.length.toLocaleString() + ' cards uploaded.';
      showToast(setName + ' uploaded — ' + cards.length + ' cards ready!', 'success');
      updateSidebarStats();
      setTimeout(function() { UploadPage.reset(); }, 2500);

    } catch(err) {
      document.getElementById('upload-status').textContent    = 'Error: ' + err.message;
      document.getElementById('upload-status').style.color    = 'var(--danger)';
      showToast('Upload failed: ' + err.message, 'error');
    }
  },

  reset() { this.parsedCards = []; this.render(); }
};
