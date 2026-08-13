/**
 * REDROOM - Standalone Admin Panel JavaScript Logic
 * Smart Streamtape Parser automatically extracts video ID and formats playable embed URLs.
 */

const ADMIN_PASSWORD = '911';
const DEFAULT_CATEGORIES = ['All', 'Trending', '4K Ultra', 'Amateur', 'VR 360', 'Exclusive', 'HD'];
const DEFAULT_VIDEOS = [];

class RedroomAdmin {
  constructor() {
    this.videos = [];
    this.movies = [];
    this.playlists = [];
    this.categories = [...DEFAULT_CATEGORIES];
    this.currentTab = 'stats';
    this.selectedPlaylistVideoIds = new Set();
    this.init();
    this.fetchDataFromFirebase();
  }

  fetchDataFromFirebase() {
    // Fetch Categories
    db.collection('settings').doc('categories').onSnapshot(doc => {
      if (doc.exists && doc.data().list) {
        this.categories = doc.data().list;
        this.renderCategories();
        this.populateCategoryDropdowns();
      } else {
        db.collection('settings').doc('categories').set({ list: [...DEFAULT_CATEGORIES] });
      }
    });

    // Fetch Videos
    db.collection('videos').onSnapshot(snapshot => {
      const vids = [];
      snapshot.forEach(doc => {
        vids.push({ id: doc.id, ...doc.data() });
      });
      // Sort by newest
      this.videos = vids.sort((a, b) => b.createdAt - a.createdAt);
      this.updateAdvancedStats();
      this.renderTable();
      this.renderPlaylistVideoChecklist();
    }, (error) => {
      console.error('Error fetching videos from Admin:', error);
    });

    // Fetch Movies
    db.collection('movies').onSnapshot(snapshot => {
      const mvs = [];
      snapshot.forEach(doc => {
        mvs.push({ id: doc.id, ...doc.data() });
      });
      this.movies = mvs.sort((a, b) => b.createdAt - a.createdAt);
      this.updateAdvancedStats();
      this.renderMoviesTable();
    }, (error) => {
      console.error('Error fetching movies from Admin:', error);
    });

    // Fetch Playlists Real-time
    db.collection('playlists').onSnapshot(snapshot => {
      const pls = [];
      snapshot.forEach(doc => {
        pls.push({ id: doc.id, ...doc.data() });
      });
      this.playlists = pls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.renderAdminPlaylists();
    }, (error) => {
      console.error('Error fetching playlists:', error);
    });
  }

  getVideos() { return this.videos; }
  saveVideos() { } // Handled by Firebase realtime
  getCategories() { return this.categories; }
  saveCategories() {
    db.collection('settings').doc('categories').set({ list: this.categories });
  }

  init() {
    this.checkAuth();
  }

  checkAuth() {
    const authed = sessionStorage.getItem('redroom_admin_authed') === 'true';
    const authContainer = document.getElementById('adminAuthContainer');
    const layout = document.getElementById('adminDashboardLayout');

    if (authed) {
      if (authContainer) authContainer.classList.add('hidden');
      if (layout) layout.classList.remove('hidden');
      this.populateCategoryDropdowns();
      this.updateAdvancedStats();
      this.renderTable();
      this.renderCategories();
    } else {
      if (authContainer) authContainer.classList.remove('hidden');
      if (layout) layout.classList.add('hidden');
    }
  }

  populateCategoryDropdowns() {
    const addSelect = document.getElementById('addCategorySelect');
    const editSelect = document.getElementById('editCategorySelect');

    const filteredCats = this.categories.filter(c => c !== 'All');
    const optionsHtml = filteredCats.map(c => `<option value="${c}">${c}</option>`).join('');

    if (addSelect) addSelect.innerHTML = optionsHtml;
    if (editSelect) editSelect.innerHTML = optionsHtml;
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    const tabs = ['stats', 'add', 'addMovie', 'categories', 'view', 'viewMovies', 'playlists'];
    const titleMap = {
      stats: 'System Statistics',
      add: 'Add New Streamtape Video',
      addMovie: 'Add New Movie',
      categories: 'Category Manager',
      view: 'Manage & Edit Videos',
      viewMovies: 'Manage & Edit Movies',
      playlists: 'Playlist Manager'
    };

    tabs.forEach(t => {
      const btn = document.getElementById(`tabBtn-${t}`);
      const content = document.getElementById(`tabContent-${t}`);

      if (t === tabName) {
        if (btn) btn.classList.add('active');
        if (content) content.classList.remove('hidden');
      } else {
        if (btn) btn.classList.remove('active');
        if (content) content.classList.add('hidden');
      }
    });

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titleMap[tabName] || 'Admin Portal';

    if (tabName === 'stats') this.updateAdvancedStats();
    if (tabName === 'categories') this.renderCategories();
    if (tabName === 'view') this.renderTable();
    if (tabName === 'viewMovies') this.renderMoviesTable();
    if (tabName === 'add' || tabName === 'addMovie') this.populateCategoryDropdowns();
    if (tabName === 'playlists') {
      this.renderPlaylistVideoChecklist();
      this.renderAdminPlaylists();
    }
  }

  /**
   * Smart Streamtape Embed Parser
   * Converts share links (/v/CODE), embed links (/e/CODE), iframe HTML,
   * into clean embed URL: https://streamtape.com/e/CODE/
   */
  parseStreamtapeUrl(inputUrl) {
    if (!inputUrl) return '';
    let cleanUrl = inputUrl.trim();

    // 1. If full iframe tag pasted, extract src attribute
    if (cleanUrl.includes('<iframe')) {
      const match = cleanUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) cleanUrl = match[1];
    }

    // 2. Try to extract video ID from streamtape URL patterns
    const stMatch = cleanUrl.match(/streamtape\.[a-z]+\/(?:v|e)\/([a-zA-Z0-9_\-]+)/i);
    if (stMatch && stMatch[1]) {
      return `https://streamtape.com/e/${stMatch[1]}/`;
    }

    // 3. Simple /v/ to /e/ replacement fallback
    if (cleanUrl.includes('/v/')) {
      cleanUrl = cleanUrl.replace('/v/', '/e/');
    }

    // 4. Ensure https:// prefix
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    return cleanUrl;
  }

  updateAdvancedStats() {
    const totalVids = document.getElementById('statTotalVideos');
    const totalMovies = document.getElementById('statTotalMovies');
    const totalViews = document.getElementById('statTotalViews');
    const totalCategories = document.getElementById('statCategories');
    const countBadge = document.getElementById('videoCountBadge');
    const movieCountBadge = document.getElementById('movieCountBadge');

    if (totalVids) totalVids.textContent = this.videos.length;
    if (totalMovies) totalMovies.textContent = this.movies.length;
    if (totalCategories) totalCategories.textContent = this.categories.length;
    if (countBadge) countBadge.textContent = `${this.videos.length} Videos Total`;
    if (movieCountBadge) movieCountBadge.textContent = `${this.movies.length} Movies Total`;

    let viewsSum = this.videos.reduce((acc, v) => acc + (v.viewCount || 0), 0) + 
                   this.movies.reduce((acc, m) => acc + (m.viewCount || 0), 0);
    if (totalViews) totalViews.textContent = viewsSum.toLocaleString();

    const catBars = document.getElementById('categoryBreakdownBars');
    if (catBars) {
      if (this.videos.length === 0) {
        catBars.innerHTML = `<p class="text-xs text-slate-500 italic">No videos published yet to display category distribution.</p>`;
      } else {
        const counts = {};
        this.videos.forEach(v => {
          const cat = v.category || 'Amateur';
          counts[cat] = (counts[cat] || 0) + 1;
        });

        const total = this.videos.length || 1;
        catBars.innerHTML = Object.keys(counts).map(cat => {
          const pct = Math.round((counts[cat] / total) * 100);
          return `
            <div>
              <div class="flex justify-between text-xs text-slate-300 mb-1">
                <span>${cat}</span>
                <span>${counts[cat]} (${pct}%)</span>
              </div>
              <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div class="bg-rose-500 h-full rounded-full" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const topBox = document.getElementById('topVideoHighlight');
    if (topBox) {
      if (this.videos.length === 0) {
        topBox.innerHTML = `<p class="text-xs text-slate-500 italic">No trending videos yet. Publish your first video to track performance!</p>`;
      } else {
        const topVid = [...this.videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];
        topBox.innerHTML = `
          <div class="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <img src="${topVid.thumbnail}" class="w-16 h-10 object-cover rounded bg-slate-900 shrink-0">
            <div class="min-w-0 flex-1">
              <strong class="text-white text-xs block truncate font-bold">${topVid.title}</strong>
              <span class="text-[11px] text-rose-400 font-semibold">${topVid.views} views • ${topVid.category}</span>
            </div>
          </div>
        `;
      }
    }
  }

  renderTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (this.videos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">No videos published yet. Use "Add Video" tab to upload your first Streamtape video!</td></tr>`;
      return;
    }

    tbody.innerHTML = this.videos.map(v => `
      <tr class="cursor-pointer hover:bg-slate-800/60" onclick="adminApp.openVideoStatsModal('${v.id}')">
        <td>
          <div class="flex items-center gap-3">
            <img src="${v.thumbnail}" class="w-12 h-8 object-cover rounded bg-slate-800 shrink-0">
            <div class="min-w-0">
              <strong class="text-white block truncate max-w-xs font-semibold hover:text-rose-400">${v.title}</strong>
              <span class="text-xs text-slate-400">${v.uploader || 'Admin'}</span>
            </div>
          </div>
        </td>
        <td><span class="px-2 py-0.5 bg-slate-800 text-rose-400 rounded text-xs font-medium">${v.category || 'General'}</span></td>
        <td><span class="text-xs text-slate-400">${v.views}</span></td>
        <td class="font-mono text-xs text-slate-400 truncate max-w-[180px]">${v.streamtapeUrl}</td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div class="flex items-center justify-end gap-2">
            <button onclick="adminApp.openEditModal('${v.id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold">
              <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
            </button>
            <button onclick="adminApp.deleteVideo('${v.id}')" class="px-3 py-1.5 bg-rose-950 border border-rose-800 hover:bg-rose-600 text-rose-200 hover:text-white rounded text-xs font-semibold">
              <i class="fa-solid fa-trash mr-1"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openVideoStatsModal(videoId) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;

    document.getElementById('statsModalThumb').src = video.thumbnail;
    document.getElementById('statsModalTitle').textContent = video.title;
    document.getElementById('statsModalCategory').textContent = video.category || 'General';
    document.getElementById('statsModalViews').textContent = video.views || '1';
    document.getElementById('statsModalLikes').textContent = (video.likes || 1).toLocaleString();
    document.getElementById('statsModalRating').textContent = (video.rating || 100) + '%';
    document.getElementById('statsModalUrl').textContent = video.streamtapeUrl;
    document.getElementById('statsModalUploader').textContent = video.uploader || 'Redroom Admin';

    const modal = document.getElementById('videoStatsModal');
    if (modal) modal.classList.remove('hidden');
  }

  renderCategories() {
    const list = document.getElementById('adminCategoryList');
    if (!list) return;

    list.innerHTML = this.categories.map(cat => `
      <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200">
        <span>${cat}</span>
        ${cat !== 'All' ? `<button onclick="adminApp.removeCategory('${cat}')" class="text-slate-400 hover:text-rose-400"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
    `).join('');
  }

  addCategory(name) {
    const clean = name.trim();
    if (!clean || this.categories.includes(clean)) return;
    this.categories.push(clean);
    this.saveCategories();
    this.renderCategories();
    this.populateCategoryDropdowns();
    alert(`Category "${clean}" added successfully!`);
  }

  removeCategory(name) {
    if (confirm(`Are you sure you want to delete category "${name}"? This action cannot be undone.`)) {
      this.categories = this.categories.filter(c => c !== name);
      this.saveCategories();
      this.renderCategories();
      this.populateCategoryDropdowns();
    }
  }

  addVideo(videoData) {
    videoData.createdAt = Date.now();
    const docId = videoData.id;
    db.collection('videos').doc(docId).set(videoData)
      .then(() => {
        alert('Video published successfully to Global Database!');
        this.switchTab('view');
      })
      .catch(error => {
        alert('Error publishing video: ' + error.message);
      });
  }

  openEditModal(videoId) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;

    this.populateCategoryDropdowns();
    document.getElementById('editVideoId').value = video.id;
    document.getElementById('editTitle').value = video.title;
    document.getElementById('editStreamtapeUrl').value = video.streamtapeUrl;
    document.getElementById('editCategorySelect').value = video.category || this.categories[1] || 'Amateur';
    document.getElementById('editThumbnail').value = video.thumbnail || '';

    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('hidden');
  }

  saveEdit(updatedData) {
    db.collection('videos').doc(updatedData.id).update(updatedData)
      .then(() => {
        closeEditModal();
        alert('Video updated successfully in Global Database!');
      })
      .catch(error => {
        alert('Error updating video: ' + error.message);
      });
  }

  deleteVideo(videoId) {
    if (confirm('Are you sure you want to delete this video from the Global Database?')) {
      db.collection('videos').doc(videoId).delete().then(() => {
        alert('Video deleted.');
      }).catch(err => {
        alert('Error deleting video: ' + err.message);
      });
    }
  }

  // ==============================
  // MOVIE MANAGEMENT METHODS
  // ==============================
  renderMoviesTable() {
    const tbody = document.getElementById('adminMoviesTableBody');
    if (!tbody) return;

    if (this.movies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">No movies published yet. Use "Add Movie" tab to upload your first Streamtape movie!</td></tr>`;
      return;
    }

    tbody.innerHTML = this.movies.map(m => `
      <tr class="cursor-pointer hover:bg-slate-800/60" onclick="adminApp.openVideoStatsModal('${m.id}')">
        <td>
          <div class="flex items-center gap-3">
            <img src="${m.thumbnail}" class="w-12 h-8 object-cover rounded bg-slate-800 shrink-0">
            <div class="min-w-0">
              <strong class="text-white block truncate max-w-xs font-semibold hover:text-rose-400">${m.title}</strong>
              <span class="text-xs text-slate-400">${m.uploader || 'Admin'}</span>
            </div>
          </div>
        </td>
        <td><span class="px-2 py-0.5 bg-slate-800 text-rose-400 rounded text-xs font-medium">${m.category || 'General'}</span></td>
        <td><span class="text-xs text-slate-400">${m.views}</span></td>
        <td class="font-mono text-xs text-slate-400 truncate max-w-[180px]">${m.streamtapeUrl}</td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div class="flex items-center justify-end gap-2">
            <button onclick="adminApp.openEditMovieModal('${m.id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold">
              <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
            </button>
            <button onclick="adminApp.deleteMovie('${m.id}')" class="px-3 py-1.5 bg-rose-950 border border-rose-800 hover:bg-rose-600 text-rose-200 hover:text-white rounded text-xs font-semibold">
              <i class="fa-solid fa-trash mr-1"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  addMovie(movieData) {
    movieData.createdAt = Date.now();
    const docId = movieData.id;
    db.collection('movies').doc(docId).set(movieData)
      .then(() => {
        alert('Movie published successfully to Global Database!');
        this.switchTab('viewMovies');
      })
      .catch(error => {
        alert('Error publishing movie: ' + error.message);
      });
  }

  openEditMovieModal(movieId) {
    const movie = this.movies.find(m => m.id === movieId);
    if (!movie) return;

    this.populateCategoryDropdowns();
    document.getElementById('editMovieId').value = movie.id;
    document.getElementById('editMovieTitle').value = movie.title;
    document.getElementById('editMovieStreamtapeUrl').value = movie.streamtapeUrl;
    
    // Check if editMovieCategorySelect exists, in case the modal wasn't updated yet.
    const editMovieCategorySelect = document.getElementById('editMovieCategorySelect');
    if (editMovieCategorySelect) {
        // Need to populate it with categories first since we might have just switched to this view
        const filteredCats = this.categories.filter(c => c !== 'All');
        editMovieCategorySelect.innerHTML = filteredCats.map(c => `<option value="${c}">${c}</option>`).join('');
        editMovieCategorySelect.value = movie.category || this.categories[1] || 'Amateur';
    }
    document.getElementById('editMovieThumbnail').value = movie.thumbnail || '';

    const modal = document.getElementById('editMovieModal');
    if (modal) modal.classList.remove('hidden');
  }

  saveMovieEdit(updatedData) {
    db.collection('movies').doc(updatedData.id).update(updatedData)
      .then(() => {
        closeEditMovieModal();
        alert('Movie updated successfully in Global Database!');
      })
      .catch(error => {
        alert('Error updating movie: ' + error.message);
      });
  }

  deleteMovie(movieId) {
    if (confirm('Are you sure you want to delete this movie from the Global Database?')) {
      db.collection('movies').doc(movieId).delete().then(() => {
        alert('Movie deleted.');
      }).catch(err => {
        alert('Error deleting movie: ' + err.message);
      });
    }
  }

  // ==============================
  // PLAYLIST MANAGEMENT METHODS
  // ==============================

  renderPlaylistVideoChecklist(filter = '') {
    const container = document.getElementById('playlistVideoChecklist');
    if (!container) return;

    const search = filter.toLowerCase().trim();
    const filtered = search
      ? this.videos.filter(v => v.title.toLowerCase().includes(search) || (v.category || '').toLowerCase().includes(search))
      : this.videos;

    if (filtered.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">${search ? 'No videos match your search.' : 'No videos uploaded yet. Upload videos first.'}</p>`;
      return;
    }

    container.innerHTML = filtered.map(v => {
      const checked = this.selectedPlaylistVideoIds.has(v.id) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors">
          <input type="checkbox" value="${v.id}" ${checked} onchange="adminApp.togglePlaylistVideo('${v.id}', this.checked)"
            class="w-4 h-4 rounded border-slate-600 text-rose-500 focus:ring-rose-500 bg-slate-800 shrink-0 accent-rose-500">
          <img src="${v.thumbnail}" class="w-10 h-7 object-cover rounded bg-slate-800 shrink-0">
          <div class="min-w-0 flex-1">
            <span class="text-xs text-white font-medium block truncate">${v.title}</span>
            <span class="text-[10px] text-slate-500">${v.category || 'General'} • ${v.duration || ''}</span>
          </div>
        </label>
      `;
    }).join('');

    this.updateSelectedCount();
  }

  filterPlaylistVideos(query) {
    this.renderPlaylistVideoChecklist(query);
  }

  togglePlaylistVideo(videoId, isChecked) {
    if (isChecked) {
      this.selectedPlaylistVideoIds.add(videoId);
    } else {
      this.selectedPlaylistVideoIds.delete(videoId);
    }
    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const el = document.getElementById('selectedVideoCount');
    if (el) el.textContent = this.selectedPlaylistVideoIds.size;
  }

  savePlaylist(playlistData) {
    const docId = playlistData.id;
    db.collection('playlists').doc(docId).set(playlistData, { merge: true })
      .then(() => {
        alert(playlistData._isEdit ? 'Playlist updated successfully!' : 'Playlist created successfully!');
        resetPlaylistForm();
      })
      .catch(error => {
        alert('Error saving playlist: ' + error.message);
      });
  }

  deletePlaylist(playlistId) {
    if (confirm('Are you sure you want to delete this playlist? Videos will NOT be deleted.')) {
      db.collection('playlists').doc(playlistId).delete().then(() => {
        alert('Playlist deleted.');
      }).catch(err => {
        alert('Error deleting playlist: ' + err.message);
      });
    }
  }

  editPlaylist(playlistId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    document.getElementById('editPlaylistId').value = pl.id;
    document.getElementById('playlistName').value = pl.name || '';
    document.getElementById('playlistDescription').value = pl.description || '';
    document.getElementById('playlistThumbnail').value = pl.thumbnail || '';

    // Set selected video IDs
    this.selectedPlaylistVideoIds = new Set(pl.videoIds || []);
    this.renderPlaylistVideoChecklist();

    // Update form UI to edit mode
    const formTitle = document.getElementById('playlistFormTitle');
    if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square mr-2 text-amber-400"></i>Edit Playlist';
    const btnText = document.getElementById('playlistSubmitBtnText');
    if (btnText) btnText.textContent = 'Save Changes';
  }

  renderAdminPlaylists() {
    const container = document.getElementById('adminPlaylistList');
    const badge = document.getElementById('playlistCountBadge');
    if (!container) return;

    if (badge) badge.textContent = `${this.playlists.length} Playlists`;

    if (this.playlists.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-500 italic">No playlists created yet. Create your first playlist!</p>`;
      return;
    }

    container.innerHTML = this.playlists.map(pl => {
      const vidCount = (pl.videoIds || []).length;
      const firstVid = this.videos.find(v => (pl.videoIds || [])[0] === v.id);
      const thumbSrc = pl.thumbnail || (firstVid ? firstVid.thumbnail : './assets/Thumbnail.png');

      return `
        <div class="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
          <div class="relative w-20 sm:w-24 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
            <img src="${thumbSrc}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span class="text-white text-[10px] sm:text-xs font-bold bg-rose-600/90 px-1.5 py-0.5 rounded">${vidCount} videos</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold text-white truncate">${pl.name}</h4>
            <p class="text-[10px] sm:text-xs text-slate-400 truncate">${pl.description || 'No description'}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="adminApp.editPlaylist('${pl.id}')" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs" title="Edit">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="adminApp.deletePlaylist('${pl.id}')" class="p-2 bg-rose-950 hover:bg-rose-600 border border-rose-800 text-rose-300 hover:text-white rounded-lg text-xs" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

const adminApp = new RedroomAdmin();

function handleAdminLogin(e) {
  e.preventDefault();
  const input = document.getElementById('adminPwInput');
  if (input && input.value.trim() === ADMIN_PASSWORD) {
    sessionStorage.setItem('redroom_admin_authed', 'true');
    input.value = '';
    adminApp.checkAuth();
  } else {
    alert('Incorrect Admin Password! (Password is: 911)');
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('redroom_admin_authed');
  adminApp.checkAuth();
}

function switchTab(tabName) {
  adminApp.switchTab(tabName);
}

function formatThumbnailUrl(url) {
  if (!url) return url;
  // Convert standard Imgur links to direct image links
  if (url.includes('imgur.com') && !url.includes('i.imgur.com') && !url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
    const parts = url.split('/');
    let id = parts[parts.length - 1];
    if(id.includes('?')) id = id.split('?')[0]; // strip query params
    return `https://i.imgur.com/${id}.png`;
  }
  return url;
}

function updateAddPreview() {
  const rawUrl = document.getElementById('addStreamtapeUrl').value.trim();
  const title = document.getElementById('addTitle').value.trim() || 'Video Title Preview';
  let thumb = document.getElementById('addThumbnail').value.trim();
  thumb = formatThumbnailUrl(thumb) || './assets/Thumbnail.png';
  
  const titleEl = document.getElementById('previewTitleText');
  const thumbEl = document.getElementById('previewThumbImg');
  const frameContainer = document.getElementById('previewEmbedFrame');

  if (titleEl) titleEl.textContent = title;

  if (rawUrl) {
    const embedUrl = adminApp.parseStreamtapeUrl(rawUrl);
    if (frameContainer) {
      frameContainer.innerHTML = `
        <iframe src="${embedUrl}" width="100%" height="100%" allowfullscreen scrolling="no" frameborder="0"></iframe>
      `;
    }
  } else {
    if (frameContainer) {
      frameContainer.innerHTML = `
        <img id="previewThumbImg" src="${thumb}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg">
            <i class="fa-solid fa-play ml-0.5"></i>
          </div>
        </div>
      `;
    }
  }
}

function updatePlaylistPreview() {
  let thumb = document.getElementById('playlistThumbnail').value.trim();
  const container = document.getElementById('playlistThumbnailPreviewContainer');
  const img = document.getElementById('playlistThumbnailPreview');
  
  if (!thumb) {
    if (container) container.classList.add('hidden');
    return;
  }
  
  thumb = formatThumbnailUrl(thumb);
  if (img) img.src = thumb;
  if (container) container.classList.remove('hidden');
}

function handlePublishVideo(e) {
  e.preventDefault();
  const title = document.getElementById('addTitle').value.trim();
  const rawStreamtapeUrl = document.getElementById('addStreamtapeUrl').value.trim();
  const categorySelect = document.getElementById('addCategorySelect');
  const category = categorySelect ? categorySelect.value : 'Amateur';
  const durationInput = document.getElementById('addDuration');
  const duration = durationInput && durationInput.value.trim() !== '' ? durationInput.value.trim() : '15:00 Mins';
  let thumbnail = document.getElementById('addThumbnail').value.trim();
  thumbnail = formatThumbnailUrl(thumbnail) || './assets/Thumbnail.png';
  const description = document.getElementById('addDescription').value.trim();

  // Smart Streamtape Parser
  const parsedStreamtapeUrl = adminApp.parseStreamtapeUrl(rawStreamtapeUrl);

  const newVid = {
    id: 'vid-custom-' + Date.now(),
    title: title,
    uploader: 'Redroom Admin',
    uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    views: '1',
    viewCount: 1,
    duration: duration,
    rating: 100,
    category: category,
    quality: 'HD',
    thumbnail: thumbnail,
    streamtapeUrl: parsedStreamtapeUrl,
    description: description || 'Streamtape video uploaded via Admin Panel.',
    uploadDate: 'Just now',
    likes: 1,
    dislikes: 0
  };

  adminApp.addVideo(newVid);
  document.getElementById('addStreamtapeUrl').value = '';
  document.getElementById('addTitle').value = '';
  if (durationInput) durationInput.value = '';
  document.getElementById('addThumbnail').value = '';
  document.getElementById('addDescription').value = '';
}

function updateAddMoviePreview() {
  const rawUrl = document.getElementById('addMovieStreamtapeUrl').value.trim();
  const title = document.getElementById('addMovieTitle').value.trim() || 'Movie Title Preview';
  let thumb = document.getElementById('addMovieThumbnail').value.trim();
  thumb = formatThumbnailUrl(thumb) || './assets/Thumbnail.png';
  
  const titleEl = document.getElementById('previewMovieTitleText');
  const thumbEl = document.getElementById('previewMovieThumbImg');
  const frameContainer = document.getElementById('previewMovieEmbedFrame');

  if (titleEl) titleEl.textContent = title;

  if (rawUrl) {
    const embedUrl = adminApp.parseStreamtapeUrl(rawUrl);
    if (frameContainer) {
      frameContainer.innerHTML = `
        <iframe src="${embedUrl}" width="100%" height="100%" allowfullscreen scrolling="no" frameborder="0"></iframe>
      `;
    }
  } else {
    if (frameContainer) {
      frameContainer.innerHTML = `
        <img id="previewMovieThumbImg" src="${thumb}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg">
            <i class="fa-solid fa-play ml-0.5"></i>
          </div>
        </div>
      `;
    }
  }
}

function handlePublishMovie(e) {
  e.preventDefault();
  const title = document.getElementById('addMovieTitle').value.trim();
  const rawStreamtapeUrl = document.getElementById('addMovieStreamtapeUrl').value.trim();
  const categorySelect = document.getElementById('addMovieCategorySelect');
  const category = categorySelect ? categorySelect.value : 'Amateur';
  const durationInput = document.getElementById('addMovieDuration');
  const duration = durationInput && durationInput.value.trim() !== '' ? durationInput.value.trim() : '120:00 Mins';
  let thumbnail = document.getElementById('addMovieThumbnail').value.trim();
  thumbnail = formatThumbnailUrl(thumbnail) || './assets/Thumbnail.png';
  const description = document.getElementById('addMovieDescription').value.trim();

  // Smart Streamtape Parser
  const parsedStreamtapeUrl = adminApp.parseStreamtapeUrl(rawStreamtapeUrl);

  const newMovie = {
    id: 'movie-' + Date.now(),
    title: title,
    uploader: 'Redroom Admin',
    uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    views: '1',
    viewCount: 1,
    duration: duration,
    rating: 100,
    category: category,
    quality: 'HD',
    thumbnail: thumbnail,
    streamtapeUrl: parsedStreamtapeUrl,
    description: description || 'Streamtape movie uploaded via Admin Panel.',
    uploadDate: 'Just now',
    likes: 1,
    dislikes: 0
  };

  adminApp.addMovie(newMovie);
  document.getElementById('addMovieStreamtapeUrl').value = '';
  document.getElementById('addMovieTitle').value = '';
  if (durationInput) durationInput.value = '';
  document.getElementById('addMovieThumbnail').value = '';
  document.getElementById('addMovieDescription').value = '';
}

function handleAddCategory(e) {
  e.preventDefault();
  const input = document.getElementById('newCategoryInput');
  if (input && input.value.trim()) {
    adminApp.addCategory(input.value.trim());
    input.value = '';
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) modal.classList.add('hidden');
}

function closeVideoStatsModal() {
  const modal = document.getElementById('videoStatsModal');
  if (modal) modal.classList.add('hidden');
}

function handleSaveEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editVideoId').value;
  const rawUrl = document.getElementById('editStreamtapeUrl').value.trim();
  const updated = {
    id: id,
    title: document.getElementById('editTitle').value.trim(),
    category: document.getElementById('editCategorySelect').value,
    streamtapeUrl: adminApp.parseStreamtapeUrl(rawUrl),
    thumbnail: formatThumbnailUrl(document.getElementById('editThumbnail').value.trim())
  };
  adminApp.saveEdit(updated);
}

function closeEditMovieModal() {
  const modal = document.getElementById('editMovieModal');
  if (modal) modal.classList.add('hidden');
}

function handleSaveMovieEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editMovieId').value;
  const rawUrl = document.getElementById('editMovieStreamtapeUrl').value.trim();
  const updated = {
    id: id,
    title: document.getElementById('editMovieTitle').value.trim(),
    category: document.getElementById('editMovieCategorySelect').value,
    streamtapeUrl: adminApp.parseStreamtapeUrl(rawUrl),
    thumbnail: formatThumbnailUrl(document.getElementById('editMovieThumbnail').value.trim())
  };
  adminApp.saveMovieEdit(updated);
}

// ================================
// PLAYLIST FORM HANDLER FUNCTIONS
// ================================

function handleSavePlaylist(e) {
  e.preventDefault();
  const editId = document.getElementById('editPlaylistId').value;
  const name = document.getElementById('playlistName').value.trim();
  const description = document.getElementById('playlistDescription').value.trim();
  let thumbnail = document.getElementById('playlistThumbnail').value.trim();
  thumbnail = formatThumbnailUrl(thumbnail) || '';

  const videoIds = Array.from(adminApp.selectedPlaylistVideoIds);

  if (videoIds.length === 0) {
    alert('Please select at least one video for the playlist.');
    return;
  }

  const playlistData = {
    id: editId || ('pl-' + Date.now()),
    name: name,
    description: description,
    thumbnail: thumbnail,
    videoIds: videoIds,
    createdAt: editId ? undefined : Date.now(),
    updatedAt: Date.now(),
    _isEdit: !!editId
  };

  // Remove undefined fields
  Object.keys(playlistData).forEach(k => playlistData[k] === undefined && delete playlistData[k]);

  adminApp.savePlaylist(playlistData);
}

function resetPlaylistForm() {
  document.getElementById('editPlaylistId').value = '';
  document.getElementById('playlistName').value = '';
  document.getElementById('playlistDescription').value = '';
  document.getElementById('playlistThumbnail').value = '';
  document.getElementById('playlistVideoSearch').value = '';

  adminApp.selectedPlaylistVideoIds.clear();
  adminApp.renderPlaylistVideoChecklist();

  const formTitle = document.getElementById('playlistFormTitle');
  if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-plus-circle mr-2 text-rose-500"></i>Create New Playlist';
  const btnText = document.getElementById('playlistSubmitBtnText');
  if (btnText) btnText.textContent = 'Create Playlist';
}
