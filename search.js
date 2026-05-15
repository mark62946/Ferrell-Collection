// ── Master Search Page ──
const SearchPage = {
  searchTimer: null,

  render() {
    const el = document.getElementById('page-search');
    el.innerHTML = `
      <div class="page-header">
        <div class="page-title">Master Search</div>
        <div class="page-subtitle">Search across every set, year, and card type in your collection</div>
      </div>
      <div class="search-wrap" style="max-width:600px">
        <span class="search-icon">🔍</span>
        <input type="text" id="master-search-input" placeholder="Search any player name… e.g. Ian Happ, Shohei Ohtani" autocomplete="off">
      </div>
      <div id="search-results"></div>
    `;

    document.getElementById('search-results').innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text3)">
        <div style="font-size:48px;margin-bottom:1rem">⚾</div>
        <div style="font-size:15px">Type a player name to search across all your sets</div>
        <div style="font-size:13px;margin-top:6px">Results show all cards in database — owned, needed, graded, and want list</div>
      </div>`;

    document.getElementById('master-search-input').addEventListener('input', e => {
      clearTimeout(this.searchTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        document.getElementById('search-results').innerHTML = `
          <div style="text-align:center;padding:3rem;color:var(--text3)">
            <div style="font-size:48px;margin-bottom:1rem">⚾</div>
            <div style="font-size:15px">Type a player name to search across all your sets</div>
            <div style="font-size:13px;margin-top:6px">Results show all cards in database — owned, needed, graded, and want list</div>
          </div>`;
        return;
      }
      document.getElementById('search-results').innerHTML = `<div class="loading"><div class="spinner"></div> Searching...</div>`;
      this.searchTimer = setTimeout(() => this.runSearch(q), 300);
    });
  },

  async runSearch(query) {
    try {
      const results = await Search.player(query);
      this.renderResults(query, results);
    } catch (err) {
      document.getElementById('search-results').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
      console.error('Search error:', err);
    }
  },

  renderResults(query, { cards, misc }) {
    const total = cards.length + misc.length;
    if (total === 0) {
      document.getElementById('search-results').innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text3)">
          <div style="font-size:32px;margin-bottom:.75rem">No results found for "${query}"</div>
          <div style="font-size:12px;margin-top:6px">Check spelling or try a partial name</div>
        </div>`;
      return;
    }

    const playerMap = {};
    cards.forEach(card => {
      if (!playerMap[card.player]) playerMap[card.player] = [];
      playerMap[card.player].push(card);
    });

    let html = `<div style="font-size:13px;color:var(--text3);margin-bottom:1rem">
      ${total} result${total !== 1 ? 's' : ''} for "<strong style="color:var(--text)">${query}</strong>"
    </div>`;

    Object.entries(playerMap).forEach(([player, playerCards]) => {
      const ownedCards = playerCards.filter(c => c.collection);
      const totalCopies = ownedCards.reduce((a, c) => a + (c.collection ? (c.collection.quantity || 0) : 0), 0);
      const totalParallels = ownedCards.reduce((a, c) => a + (c.collection && c.collection.parallels ? c.collection.parallels.length : 0), 0);
      const totalGraded = playerCards.reduce((a, c) => a + (c.graded ? c.graded.length : 0), 0);
      const totalWanted = playerCards.reduce((a, c) => a + (c.wanted ? c.wanted.length : 0), 0);
      const playerMisc = misc.filter(m => m.player.toLowerCase() === player.toLowerCase());

      html += '<div class="player-card">';
      html += '<div class="player-card-header" onclick="this.nextElementSibling.classList.toggle(\'open\')">';
      html += '<div>';
      html += '<div class="player-name">' + player + '</div>';
      html += '<div class="player-meta">';
      html += '<span style="color:var(--text3)">' + playerCards.length + ' card' + (playerCards.length !== 1 ? 's' : '') + ' in database</span>';
      if (totalCopies > 0) html += '<span style="margin-left:10px;color:var(--accent)">Owned: ' + totalCopies + '</span>';
      if (totalParallels > 0) html += '<span style="margin-left:10px;color:var(--purple)">Parallels: ' + totalParallels + '</span>';
      if (totalGraded > 0) html += '<span style="margin-left:10px;color:var(--accent2)">Graded: ' + totalGraded + '</span>';
      if (totalWanted > 0) html += '<span style="margin-left:10px;color:var(--warn)">Wanted: ' + totalWanted + '</span>';
      html += '</div></div>';
      html += '<span style="color:var(--text3);font-size:18px">+</span>';
      html += '</div>';
      html += '<div class="player-card-body">';

      const setMap = {};
      playerCards.forEach(card => {
        const s = card.sets;
        const setKey = s.year + ' ' + s.brand + ' ' + s.set_name + (s.series ? ' - ' + s.series : '');
        if (!setMap[setKey]) setMap[setKey] = [];
        setMap[setKey].push(card);
      });

      Object.entries(setMap).forEach(function(entry) {
        var setName = entry[0];
        var setCards = entry[1];
        html += '<div class="player-set-group">';
        html += '<div class="player-set-name">' + setName + '</div>';

        setCards.forEach(card => {
          var col = card.collection;
          var pars = (col && col.parallels) ? col.parallels : [];
          var isOwned = !!col;
          var cardGraded = card.graded || [];
          var cardWanted = card.wanted || [];

          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">';
          html += '<div style="flex:1">';
          html += '<span style="font-weight:500">#' + card.card_number + '</span>';
          html += '<span style="margin-left:6px">' + card.player + '</span>';
          if (card.specialty) html += '<span class="badge badge-rc" style="margin-left:4px">' + card.specialty + '</span>';
          if (isOwned) {
            html += '<span style="margin-left:8px;font-size:11px;color:var(--accent);font-weight:500">Owned x' + col.quantity + '</span>';
          } else {
            html += '<span style="margin-left:8px;font-size:11px;color:var(--text3)">Not owned</span>';
          }
          if (pars.length > 0) {
            html += '<div class="par-tags">';
            pars.forEach(p => {
              html += '<span class="par-tag">' + p.parallel_name + ' x' + p.quantity;
              if (p.serial_number) html += ' <span class="serial">' + p.serial_number + '</span>';
              html += '</span>';
            });
            html += '</div>';
          }
          if (cardGraded.length > 0) {
            html += '<div style="margin-top:4px">';
            cardGraded.forEach(g => {
              html += '<span class="badge badge-' + g.grader.toLowerCase() + '" style="margin-right:4px">' + g.grader + '</span>';
              html += '<span class="badge badge-grade">' + g.grade + '</span>';
              if (g.cert_number) html += '<span style="font-size:11px;color:var(--text3);margin-left:4px">Cert# ' + g.cert_number + '</span>';
            });
            html += '</div>';
          }
          if (cardWanted.length > 0) {
            html += '<div style="margin-top:4px">';
            cardWanted.forEach(w => {
              html += '<span class="badge badge-priority-' + w.priority + '" style="margin-right:4px">Wanted';
              if (w.parallel_name) html += ' - ' + w.parallel_name;
              html += '</span>';
            });
            html += '</div>';
          }
          html += '</div></div>';
        });

        html += '</div>';
      });

      if (playerMisc.length > 0) {
        html += '<div class="player-set-name" style="margin-top:8px">Misc Cards</div>';
        playerMisc.forEach(m => {
          html += '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">';
          if (m.card_number) html += '<span style="font-weight:500">#' + m.card_number + '</span> ';
          html += [m.year, m.brand, m.set_name].filter(Boolean).join(' ');
          if (m.is_graded) html += '<span class="badge badge-' + (m.grader || '').toLowerCase() + '" style="margin-left:6px">' + m.grader + ' ' + m.grade + '</span>';
          html += '<span style="margin-left:8px;color:var(--accent);font-weight:500">x' + m.quantity + '</span>';
          html += '</div>';
        });
      }

      html += '</div></div>';
    });

    document.getElementById('search-results').innerHTML = html;
  }
};
