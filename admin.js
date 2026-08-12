/**
 * REDROOM - Standalone Admin Panel JavaScript Logic
 * Smart Streamtape Parser automatically extracts video ID and formats playable embed URLs.
 */

const ADMIN_PASSWORD = '911';
const DEFAULT_CATEGORIES = ['All', 'Trending', '4K Ultra', 'Amateur', 'VR 360', 'Exclusive', 'HD'];
const DEFAULT_VIDEOS = [];

class RedroomAdmin {
  constructor() {
    this.videos = this.getVideos();
    this.categories = this.getCategories();
    this.currentTab = 'stats';
    this.init();
  }

  getVideos() {
    const saved = localStorage.getItem('redroom_custom_videos');
    if (saved) {
      try {
        const customArr = JSON.parse(saved);
        return [...customArr];
      } catch (e) {
        console.error('Error loading videos:', e);
      }
    }
    return [...DEFAULT_VIDEOS];
  }

  saveVideos() {
    localStorage.setItem('redroom_custom_videos', JSON.stringify(this.videos));
  }

  getCategories() {
    const saved = localStorage.getItem('redroom_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    }
    return [...DEFAULT_CATEGORIES];
  }

  saveCategories() {
    localStorage.setItem('redroom_categories', JSON.stringify(this.categories));
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
    const tabs = ['stats', 'add', 'categories', 'view'];
    const titleMap = {
      stats: 'System Statistics',
      add: 'Add New Streamtape Video',
      categories: 'Category Manager',
      view: 'Manage & Edit Videos'
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
    if (tabName === 'add') this.populateCategoryDropdowns();
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
    const totalViews = document.getElementById('statTotalViews');
    const totalCategories = document.getElementById('statCategories');
    const countBadge = document.getElementById('videoCountBadge');

    if (totalVids) totalVids.textContent = this.videos.length;
    if (totalCategories) totalCategories.textContent = this.categories.length;
    if (countBadge) countBadge.textContent = `${this.videos.length} Videos Total`;

    let viewsSum = this.videos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
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
    this.videos.unshift(videoData);
    this.saveVideos();
    this.updateAdvancedStats();
    alert('Video published successfully!');
    this.switchTab('view');
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
    const index = this.videos.findIndex(v => v.id === updatedData.id);
    if (index !== -1) {
      this.videos[index] = { ...this.videos[index], ...updatedData };
      this.saveVideos();
      this.renderTable();
      closeEditModal();
      alert('Video updated successfully!');
    }
  }

  deleteVideo(videoId) {
    if (confirm('Are you sure you want to delete this video from Redroom?')) {
      this.videos = this.videos.filter(v => v.id !== videoId);
      this.saveVideos();
      this.updateAdvancedStats();
      this.renderTable();
    }
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

function updateAddPreview() {
  const rawUrl = document.getElementById('addStreamtapeUrl').value.trim();
  const title = document.getElementById('addTitle').value.trim() || 'Video Title Preview';
  const thumb = document.getElementById('addThumbnail').value.trim() || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
  
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

function handlePublishVideo(e) {
  e.preventDefault();
  const title = document.getElementById('addTitle').value.trim();
  const rawStreamtapeUrl = document.getElementById('addStreamtapeUrl').value.trim();
  const categorySelect = document.getElementById('addCategorySelect');
  const category = categorySelect ? categorySelect.value : 'Amateur';
  const durationInput = document.getElementById('addDuration');
  const duration = durationInput && durationInput.value.trim() !== '' ? durationInput.value.trim() : '15:00 Mins';
  const thumbnail = document.getElementById('addThumbnail').value.trim() || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
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
    thumbnail: document.getElementById('editThumbnail').value.trim()
  };
  adminApp.saveEdit(updated);
}
