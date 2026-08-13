/**
 * REDROOM - Modern 18+ Video Streaming Frontend App Logic
 * Features: Smart Streamtape Embed Parser (Auto-converts /v/ to /e/), Full-Screen Theater Player,
 * Neon Loading Animation, Light/Dark Theme Switcher, Logged-in Download Gate,
 * and Real-Time Page Views Counter.
 */

const DEFAULT_CATEGORIES = ['All', 'Trending', '4K Ultra', 'Amateur', 'VR 360', 'Exclusive', 'HD'];
const INITIAL_SITE_VIEWS = 100;

// Monetag Direct Link popunder settings
const MONETAG_DIRECT_LINK = 'https://omg10.com/4/11563306';
let lastAdClickTime = 0;
const AD_COOLDOWN_MS = 60000; // 1 minute
let firstDownloadClicked = false;

// EMPTY Initial Video Dataset - Only populated when Admin adds videos!
const INITIAL_VIDEOS = [];

class RedroomApp {
  constructor() {
    this.videos = [];
    this.playlists = [];
    this.movies = []; // Added movies
    this.categories = [...DEFAULT_CATEGORIES];
    this.siteViews = this.loadSiteViews();
    this.currentCategory = 'All';
    this.searchQuery = '';
    this.currentVideo = null;
    this.activePlaylist = null; // Currently viewing playlist
    this.playlistVideoIndex = 0; // Current index in playlist playback
    this.currentPage = 1;
    this.itemsPerPage = 12; // Load 12 videos on home page
    this.currentPlaylistPage = 1;
    this.playlistsPerPage = 5;
    this.init();
    this.fetchDataFromFirebase();
  }

  showLoader(message = 'Loading Redroom VOD...') {
    const loader = document.getElementById('globalLoader');
    const msgEl = document.getElementById('globalLoaderMessage');
    if (msgEl) msgEl.textContent = message;
    if (loader) loader.classList.remove('hidden');
  }

  hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  fetchDataFromFirebase() {
    this.showLoader('Syncing Global Database...');
    // Fetch Categories
    db.collection('settings').doc('categories').onSnapshot(doc => {
      if (doc.exists && doc.data().list) {
        this.categories = doc.data().list;
        this.renderCategoryPills();
      }
    });

    // Fetch Videos Real-time
    db.collection('videos').onSnapshot(snapshot => {
      const vids = [];
      snapshot.forEach(doc => {
        vids.push({ id: doc.id, ...doc.data() });
      });
      // Sort by uploadDate descending (newest first)
      this.videos = vids.sort((a, b) => b.createdAt - a.createdAt);
      this.renderHeroSection();
      this.renderVideoGrid();
      this.renderPlaylists(); // Re-render playlists when videos change (for thumbnails)
      this.hideLoader();
    }, (error) => {
      console.error('Error fetching videos:', error);
      this.hideLoader();
    });

    // Fetch Playlists Real-time
    db.collection('playlists').onSnapshot(snapshot => {
      const pls = [];
      snapshot.forEach(doc => {
        pls.push({ id: doc.id, ...doc.data() });
      });
      this.playlists = pls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.renderPlaylists();
    });

    // Fetch Movies Real-time
    db.collection('movies').onSnapshot(snapshot => {
      const mvs = [];
      snapshot.forEach(doc => {
        mvs.push({ id: doc.id, ...doc.data() });
      });
      this.movies = mvs.sort((a, b) => b.createdAt - a.createdAt);
      this.renderMoviesSection();
    });

    // Sync Global Site Views
    db.collection('settings').doc('stats').onSnapshot(doc => {
      if (doc.exists && doc.data().totalViews) {
        this.siteViews = doc.data().totalViews;
        this.updateSiteViewsDisplay();
      }
    });
  }

  loadVideos() {
    const saved = localStorage.getItem('redroom_custom_videos');
    if (saved) {
      try {
        const customVids = JSON.parse(saved);
        return [...customVids];
      } catch (e) {
        console.error('Failed to parse saved custom videos:', e);
      }
    }
    return [...INITIAL_VIDEOS];
  }

  loadCategories() {
    const saved = localStorage.getItem('redroom_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved categories:', e);
      }
    }
    return [...DEFAULT_CATEGORIES];
  }

  loadSiteViews() {
    return INITIAL_SITE_VIEWS; // Managed by Firebase now
  }

  incrementSiteViews() {
    this.siteViews++;
    this.updateSiteViewsDisplay();
    // Fire-and-forget sync to Firebase
    try {
      if (typeof db !== 'undefined') {
        db.collection('settings').doc('stats').set(
          { totalViews: firebase.firestore.FieldValue.increment(1) }, 
          { merge: true }
        );
      }
    } catch(e) {}
  }

  updateSiteViewsDisplay() {
    const headerEl = document.getElementById('siteViewsCounter');
    const footerEl = document.getElementById('footerSiteViews');
    const formatted = this.siteViews.toLocaleString();

    if (headerEl) headerEl.textContent = formatted;
    if (footerEl) footerEl.textContent = formatted;
  }

  init() {
    this.showLoader('Initializing Redroom Platform...');
    setTimeout(() => {
      this.checkTheme();
      this.checkAgeGate();
      this.renderCategoryPills();
      this.renderHeroSection();
      this.renderVideoGrid();
      this.incrementSiteViews();
      this.setupEventListeners();
      this.hideLoader();
    }, 300);
  }



  logoutUser() {
    localStorage.removeItem('redroom_user_logged_in');
    this.showToast('Logged out of Redroom', 'info');
  }

  checkTheme() {
    const savedTheme = localStorage.getItem('redroom_theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    this.updateThemeIcon();
  }

  toggleTheme() {
    this.showLoader('Switching Theme...');
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('redroom_theme', 'light');
      this.showToast('Switched to Light Mode', 'info');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('redroom_theme', 'dark');
      this.showToast('Switched to Dark Mode', 'info');
    }
    this.updateThemeIcon();
    setTimeout(() => this.hideLoader(), 250);
  }

  updateThemeIcon() {
    const icon = document.getElementById('themeToggleIcon');
    const isDark = document.documentElement.classList.contains('dark');
    if (icon) {
      if (isDark) {
        icon.className = 'fa-solid fa-sun text-amber-400 theme-toggle-icon';
      } else {
        icon.className = 'fa-solid fa-moon text-rose-500 theme-toggle-icon';
      }
    }
    // Sync mobile bottom nav theme icon
    const mobileIcon = document.getElementById('mobileThemeIcon');
    if (mobileIcon) {
      mobileIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  /**
   * Smart Streamtape URL Embed Parser
   * Converts any share link (/v/...), embed link (/e/...), iframe snippet, or raw video ID
   * into a clean playable Streamtape embed URL: https://streamtape.com/e/ID/
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
    //    Matches: streamtape.com/v/CODE, streamtape.com/e/CODE, streamtape.to/v/CODE, etc.
    const stMatch = cleanUrl.match(/streamtape\.[a-z]+\/(?:v|e)\/([a-zA-Z0-9_\-]+)/i);
    if (stMatch && stMatch[1]) {
      return `https://streamtape.com/e/${stMatch[1]}/`;
    }

    // 3. Simple /v/ to /e/ replacement for any other streamtape-like URL
    if (cleanUrl.includes('/v/')) {
      cleanUrl = cleanUrl.replace('/v/', '/e/');
    }

    // 4. Ensure https:// prefix
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    return cleanUrl;
  }

  formatTimeAgo(timestamp, fallback) {
    if (!timestamp) return fallback || 'Just now';
    const diff = Date.now() - timestamp;
    if (diff < 5 * 60 * 1000) return 'Just now';
    const date = new Date(timestamp);
    const dStr = date.toLocaleDateString();
    const tStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return `${dStr} ${tStr}`;
  }

  isNewVideo(timestamp) {
    if (!timestamp) return false;
    const diff = Date.now() - timestamp;
    return diff <= 48 * 60 * 60 * 1000;
  }

  checkAgeGate() {
    const ageModal = document.getElementById('ageGateModal');
    const isVerified = localStorage.getItem('redroom_age_verified');
    if (!isVerified && ageModal) {
      ageModal.classList.remove('hidden');
    } else {
      this.initDirectLinkAd();
    }
  }

  confirmAge() {
    localStorage.setItem('redroom_age_verified', 'true');
    const ageModal = document.getElementById('ageGateModal');
    if (ageModal) ageModal.classList.add('hidden');
    this.showToast('Access Granted to Redroom 18+ Portal', 'success');
    this.initDirectLinkAd();
  }

  initDirectLinkAd() {
    const adHandler = (e) => {
      // Allow modal buttons or very specific elements to bypass if needed, 
      // but the user said "anywhere you click".
      const now = Date.now();
      // Initially lastAdClickTime is 0, so it triggers on first click.
      if (now - lastAdClickTime >= AD_COOLDOWN_MS) {
        lastAdClickTime = now;
        window.open(MONETAG_DIRECT_LINK, '_blank');
      }
    };

    // Use capturing phase so it catches everything before any stopPropagation
    document.addEventListener('click', adHandler, true);
    document.addEventListener('touchend', adHandler, true);
  }

  renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    container.innerHTML = this.categories.map(cat => `
      <button 
        class="cat-pill px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${cat === this.currentCategory ? 'active' : ''}"
        onclick="window.app.setCategory('${cat}')">
        ${cat === '4K Ultra' ? '<i class="fa-solid fa-bolt text-xs mr-1"></i>' : ''}${cat}
      </button>
    `).join('');
  }

  setCategory(category) {
    this.showLoader(`Loading ${category} Videos...`);
    this.currentCategory = category;
    this.currentPage = 1;
    this.renderCategoryPills();
    setTimeout(() => {
      this.renderVideoGrid();
      this.hideLoader();
    }, 200);
  }

  /**
   * Render the Hero Featured Banner with the TOP VIEWED video.
   * Sorts all videos by viewCount descending and populates the hero section
   * with the #1 most watched video. Hides hero if no videos exist.
   */
  renderHeroSection() {
    const heroSection = document.getElementById('heroSection');
    if (!heroSection) return;

    // No videos? Keep hero hidden
    if (this.videos.length === 0) {
      heroSection.classList.add('hidden');
      this.topVideoId = null;
      return;
    }

    // Sort by viewCount descending to find the most watched video
    const sorted = [...this.videos].sort((a, b) => {
      const aViews = parseInt(String(a.viewCount || a.views || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const bViews = parseInt(String(b.viewCount || b.views || '0').replace(/[^0-9]/g, ''), 10) || 0;
      return bViews - aViews;
    });

    const topVideo = sorted[0];
    this.topVideoId = topVideo.id;

    // Populate hero elements
    const bgImg = document.getElementById('heroBgImage');
    const title = document.getElementById('heroTitle');
    const desc = document.getElementById('heroDescription');
    const rating = document.getElementById('heroRating');
    const views = document.getElementById('heroViews');
    const duration = document.getElementById('heroDuration');
    const uploader = document.getElementById('heroUploader');
    const catBadge = document.getElementById('heroCategoryBadge');

    if (bgImg) bgImg.src = topVideo.thumbnail || '';
    if (title) title.textContent = topVideo.title;
    if (desc) desc.textContent = topVideo.description || 'The most watched video on Redroom right now.';
    if (rating) rating.textContent = topVideo.rating || 98;
    if (views) views.textContent = (topVideo.viewCount || topVideo.views || 0).toLocaleString();
    if (duration) duration.textContent = topVideo.duration || '15:00';
    if (uploader) uploader.textContent = topVideo.uploader || 'Redroom Admin';
    if (catBadge) {
      catBadge.innerHTML = `<i class="fa-solid fa-tag text-xs mr-1"></i> ${topVideo.category || 'General'}`;
    }

    // Show hero if not searching
    if (!this.searchQuery && this.currentCategory === 'All' && !this.activePlaylist) {
      heroSection.classList.remove('hidden');
    } else {
      heroSection.classList.add('hidden');
    }
  }

  renderVideoGrid() {
    const grid = document.getElementById('videoGrid');
    const resultCount = document.getElementById('resultCount');
    const heroSection = document.getElementById('heroSection');

    // Hero banner: only show when videos exist AND not searching/filtering
    if (heroSection) {
      if (this.videos.length === 0 || this.searchQuery || this.currentCategory !== 'All' || this.activePlaylist) {
        heroSection.classList.add('hidden');
      } else {
        heroSection.classList.remove('hidden');
      }
    }

    if (!grid) return;

    let filtered = this.videos.filter(vid => {
      // If viewing a playlist, only show videos in that playlist
      if (this.activePlaylist) {
        const plVideoIds = this.activePlaylist.videoIds || [];
        if (!plVideoIds.includes(vid.id)) return false;
      }
      const matchesCat = (this.currentCategory === 'All') || (vid.category === this.currentCategory);
      const matchesSearch = !this.searchQuery || 
        vid.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (vid.category && vid.category.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        vid.uploader.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });

    // If in playlist view, sort by playlist order
    if (this.activePlaylist) {
      const orderMap = {};
      (this.activePlaylist.videoIds || []).forEach((id, idx) => orderMap[id] = idx);
      filtered.sort((a, b) => (orderMap[a.id] || 0) - (orderMap[b.id] || 0));
    }

    // Pagination logic
    const totalVideos = filtered.length;
    const totalPages = Math.ceil(totalVideos / this.itemsPerPage);
    
    if (this.currentPage > totalPages && totalPages > 0) {
        this.currentPage = totalPages;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const paginatedVideos = filtered.slice(startIndex, endIndex);

    if (resultCount) {
      resultCount.textContent = `Showing ${paginatedVideos.length} of ${totalVideos} Videos`;
    }

    if (paginatedVideos.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center glass-card rounded-3xl p-10 border border-rose-900/30">
          <div class="w-20 h-20 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-500 inline-flex items-center justify-center mb-4 shadow-lg shadow-rose-600/30 animate-pulse">
            <i class="fa-solid fa-film text-3xl"></i>
          </div>
          <h3 class="text-2xl font-black dark:text-gray-100 text-slate-800 tracking-tight">No Videos</h3>
        </div>
      `;
      this.renderPagination(totalPages);
      return;
    }

    grid.innerHTML = paginatedVideos.map(vid => `
      <div class="glass-card rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer group flex flex-col" onclick="window.app.openPlayer('${vid.id}')">
        <div class="thumb-container relative aspect-video bg-black/80">
          <img src="${vid.thumbnail}" alt="${vid.title}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='./assets/Thumbnail.png'">
          
          <div class="absolute top-1.5 sm:top-3 left-1.5 sm:left-3 bg-red-950/80 backdrop-blur-md border border-rose-500/30 text-rose-400 text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded sm:rounded-md uppercase tracking-wider">
            ${vid.category || 'General'}
          </div>

          ${this.isNewVideo(vid.createdAt) ? `
          <div class="absolute top-1.5 sm:top-3 right-1.5 sm:right-3 bg-rose-600/90 backdrop-blur-md border border-rose-400 text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded sm:rounded-md uppercase tracking-wider shadow-lg shadow-rose-600/30">
            NEW
          </div>
          ` : ''}

          <div class="absolute bottom-1.5 sm:bottom-3 right-1.5 sm:right-3 bg-black/80 backdrop-blur-md text-gray-200 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded sm:rounded-md border border-white/10">
            ${vid.duration || '15:00'}
          </div>

          <div class="play-overlay absolute inset-0 bg-gradient-to-t from-red-950/90 via-black/40 to-transparent flex items-center justify-center">
            <div class="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-rose-600/90 border border-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/50 transform group-hover:scale-110 transition-transform duration-300">
              <i class="fa-solid fa-play text-base sm:text-xl ml-0.5"></i>
            </div>
          </div>
        </div>

        <div class="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-bold dark:text-gray-100 text-slate-800 text-xs sm:text-base group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug mb-1 sm:mb-2">
              ${vid.title}
            </h3>
          </div>

          <div class="flex items-center justify-between text-[9px] sm:text-xs dark:text-gray-400 text-slate-500 pt-1.5 sm:pt-2 border-t border-white/5">
            <span class="flex items-center gap-1"><i class="fa-solid fa-eye text-rose-500/70 text-[8px] sm:text-xs"></i> ${(vid.viewCount || vid.views || 0).toLocaleString()}</span>
            <span class="hidden sm:inline">${this.formatTimeAgo(vid.createdAt, vid.uploadDate)}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="flex items-center gap-2 sm:gap-4 bg-slate-100 dark:bg-black/40 p-2 sm:p-3 rounded-full border border-slate-300 dark:border-rose-900/30 shadow-lg">
        <button onclick="window.app.changePage(${this.currentPage - 1})" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-white/5 hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-slate-200 disabled:dark:hover:bg-white/5 disabled:hover:text-slate-700 disabled:dark:hover:text-gray-300 cursor-pointer disabled:cursor-not-allowed" ${this.currentPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left text-xs sm:text-sm"></i>
        </button>
        
        <span class="text-xs sm:text-sm font-semibold dark:text-gray-200 text-slate-700 px-2 sm:px-4">
          Page <span class="text-rose-500 font-black">${this.currentPage}</span> of ${totalPages}
        </span>
        
        <button onclick="window.app.changePage(${this.currentPage + 1})" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-white/5 hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-slate-200 disabled:dark:hover:bg-white/5 disabled:hover:text-slate-700 disabled:dark:hover:text-gray-300 cursor-pointer disabled:cursor-not-allowed" ${this.currentPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right text-xs sm:text-sm"></i>
        </button>
      </div>
    `;
  }

  changePage(newPage) {
    this.currentPage = newPage;
    this.renderVideoGrid();
    
    const gridEl = document.getElementById('mainBrowseSection');
    if (gridEl) {
      gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  parseStreamtapeUrl(inputUrl) {
    if (!inputUrl) return '';
    let cleanUrl = inputUrl.trim();
    if (cleanUrl.includes('<iframe')) {
      const match = cleanUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) cleanUrl = match[1];
    }
    const stMatch = cleanUrl.match(/streamtape\.[a-z]+\/(?:v|e)\/([a-zA-Z0-9_\-]+)/i);
    if (stMatch && stMatch[1]) {
      return `https://streamtape.com/e/${stMatch[1]}/`;
    }
    if (cleanUrl.includes('/v/')) {
      cleanUrl = cleanUrl.replace('/v/', '/e/');
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    return cleanUrl;
  }

  openPlayer(videoId, fromHistory = false) {
    let video = this.videos.find(v => v.id === videoId);
    let isMovie = false;
    
    if (!video) {
      video = this.movies.find(m => m.id === videoId);
      if (video) isMovie = true;
    }
    
    if (!video) return;

    if (!fromHistory) {
      history.pushState({ view: 'player', id: videoId }, '', `?video=${videoId}`);
    }

    this.showLoader('Opening Full Screen Streamtape Player...');
    this.currentVideo = video;
    this.currentVideo.isMovie = isMovie;
    const playerModal = document.getElementById('playerModal');
    const iframeContainer = document.getElementById('streamtapeIframeContainer');
    
    const embedUrl = this.parseStreamtapeUrl(video.streamtapeUrl);
    
    if (iframeContainer) {
      iframeContainer.innerHTML = `
        <iframe 
          src="${embedUrl}" 
          width="100%" 
          height="100%" 
          allowfullscreen="true" 
          webkitallowfullscreen="true" 
          mozallowfullscreen="true"
          scrolling="no" 
          frameborder="0"
          allow="autoplay; encrypted-media; fullscreen"
          title="${video.title}"
          style="position:absolute; top:0; left:0; width:100%; height:100%;">
        </iframe>
      `;
    }

    document.getElementById('playerTitle').textContent = video.title;
    document.getElementById('playerUploader').textContent = video.uploader;
    document.getElementById('playerUploaderAvatar').src = video.uploaderAvatar;
    document.getElementById('playerViews').textContent = (video.viewCount || video.views || 0).toLocaleString() + ' Views';
    document.getElementById('playerUploadDate').textContent = this.formatTimeAgo(video.createdAt, video.uploadDate);
    document.getElementById('playerCategory').textContent = video.category || 'General';
    document.getElementById('playerDescription').textContent = video.description || 'Exclusive Redroom video stream.';
    document.getElementById('playerLikeCount').textContent = (video.likes || 0).toLocaleString();
    document.getElementById('playerDislikeCount').textContent = (video.dislikes || 0).toLocaleString();

    this.renderRecommendedList();
    this.incrementSiteViews();

    // Increment Video View Count in Firebase
    try {
      if (typeof db !== 'undefined') {
        db.collection('videos').doc(video.id).update({
          viewCount: firebase.firestore.FieldValue.increment(1)
        });
      }
    } catch(e) {}

    setTimeout(() => {
      if (playerModal) {
        playerModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
      this.hideLoader();
    }, 350);
  }

  closePlayer(fromHistory = false) {
    const playerModal = document.getElementById('playerModal');
    const iframeContainer = document.getElementById('streamtapeIframeContainer');
    if (iframeContainer) iframeContainer.innerHTML = '';
    if (playerModal) {
      playerModal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
    this.currentVideo = null;
    
    if (!fromHistory) {
      if (history.state && history.state.view === 'player') {
        history.back();
      } else {
        history.replaceState(null, '', window.location.pathname);
      }
    }
  }

  downloadVideo() {
    if (!this.currentVideo) return;
    this.showToast('Starting Video Download...', 'success');
    window.open(MONETAG_DIRECT_LINK, '_blank');
  }

  toggleLike() {
    if (!this.currentVideo) return;
    
    // Check local storage to prevent spam likes
    const likedVideos = JSON.parse(localStorage.getItem('redroom_liked') || '{}');
    if (likedVideos[this.currentVideo.id] === 'like') return;

    this.currentVideo.likes = (this.currentVideo.likes || 0) + 1;
    likedVideos[this.currentVideo.id] = 'like';
    localStorage.setItem('redroom_liked', JSON.stringify(likedVideos));

    document.getElementById('playerLikeCount').textContent = this.currentVideo.likes.toLocaleString();
    this.showToast('Added to Liked Videos', 'info');

    // Sync to Firebase
    try {
      if (typeof db !== 'undefined') {
        db.collection('videos').doc(this.currentVideo.id).update({
          likes: firebase.firestore.FieldValue.increment(1)
        });
      }
    } catch(e) {}
  }

  toggleDislike() {
    if (!this.currentVideo) return;

    const likedVideos = JSON.parse(localStorage.getItem('redroom_liked') || '{}');
    if (likedVideos[this.currentVideo.id] === 'dislike') return;

    this.currentVideo.dislikes = (this.currentVideo.dislikes || 0) + 1;
    likedVideos[this.currentVideo.id] = 'dislike';
    localStorage.setItem('redroom_liked', JSON.stringify(likedVideos));

    document.getElementById('playerDislikeCount').textContent = this.currentVideo.dislikes.toLocaleString();

    // Sync to Firebase
    try {
      if (typeof db !== 'undefined') {
        db.collection('videos').doc(this.currentVideo.id).update({
          dislikes: firebase.firestore.FieldValue.increment(1)
        });
      }
    } catch(e) {}
  }

  copyShareLink() {
    if (!this.currentVideo) return;
    const url = this.currentVideo.streamtapeUrl;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Streamtape Link copied to clipboard!', 'success');
    }).catch(err => {
      this.showToast('Failed to copy link', 'error');
    });
  }

  renderRecommendedList() {
    const recList = document.getElementById('recommendedList');
    if (!recList || !this.currentVideo) return;

    let recommended;
    if (this.currentVideo && this.currentVideo.isMovie) {
       recommended = this.movies.filter(v => v.id !== this.currentVideo.id).slice(0, 4);
    } else if (this.activePlaylist) {
      // In playlist mode: show next videos in the playlist
      const plVids = (this.activePlaylist.videoIds || [])
        .map(id => this.videos.find(v => v.id === id))
        .filter(Boolean);
      const currentIdx = plVids.findIndex(v => v.id === this.currentVideo.id);
      recommended = plVids.filter((v, i) => i !== currentIdx).slice(0, 4);
    } else {
      recommended = this.videos.filter(v => v.id !== this.currentVideo.id).slice(0, 4);
    }

    recList.innerHTML = recommended.map(v => `
      <div class="flex gap-2 sm:gap-3 cursor-pointer group" onclick="window.app.openPlayer('${v.id}')">
        <div class="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden relative bg-black shrink-0">
          <img src="${v.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
          <span class="absolute bottom-1 right-1 text-[8px] sm:text-[9px] bg-black/80 px-1 rounded text-gray-200 font-semibold">${v.duration || '15:00'}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-[10px] sm:text-xs font-semibold dark:text-gray-200 text-slate-800 group-hover:text-rose-400 line-clamp-2 leading-tight mb-1">${v.title}</h4>
          <span class="text-[10px] sm:text-[11px] text-gray-400 block truncate">${v.uploader}</span>
          <span class="text-[9px] sm:text-[10px] text-gray-500">${v.views} views</span>
        </div>
      </div>
    `).join('');
  }

  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-rose-950/90 border-rose-500 text-rose-200',
      error: 'bg-red-950/90 border-red-600 text-red-200',
      info: 'bg-gray-900/90 border-gray-700 text-gray-200'
    };

    const icons = {
      success: '<i class="fa-solid fa-circle-check text-rose-400"></i>',
      error: '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>',
      info: '<i class="fa-solid fa-circle-info text-rose-400"></i>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg shadow-black/50 transition-all duration-300 transform translate-y-2 opacity-0 text-sm ${colors[type] || colors.info}`;
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  setupEventListeners() {
    const searchHandler = (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.currentPlaylistPage = 1; // Reset playlist pagination on search
      if (this.activePlaylist) this.exitPlaylistView(); // Exit playlist view when searching
      this.renderVideoGrid();
      this.renderPlaylists();

      // Sync inputs
      const val = e.target.value;
      if (e.target.id === 'searchInput' && document.getElementById('mobileSearchInput')) {
        document.getElementById('mobileSearchInput').value = val;
      } else if (e.target.id === 'mobileSearchInput' && document.getElementById('searchInput')) {
        document.getElementById('searchInput').value = val;
      }
    };

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', searchHandler);

    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) mobileSearchInput.addEventListener('input', searchHandler);

    window.addEventListener('popstate', (e) => {
      const playerModal = document.getElementById('playerModal');
      if (playerModal && !playerModal.classList.contains('hidden')) {
        this.closePlayer(true);
      }

      if (e.state && e.state.view === 'player') {
        this.openPlayer(e.state.id, true);
      } else if (e.state && e.state.view === 'playlist') {
        if (!this.activePlaylist || this.activePlaylist.id !== e.state.id) {
          this.openPlaylist(e.state.id, true);
        }
      } else if (this.activePlaylist) {
        this.exitPlaylistView(true);
      }
    });

    const heroWatchBtn = document.getElementById('heroWatchBtn');
    if (heroWatchBtn) {
      heroWatchBtn.addEventListener('click', () => {
        if (this.topVideoId) {
          this.openPlayer(this.topVideoId);
        } else if (this.videos.length > 0) {
          this.openPlayer(this.videos[0].id);
        } else {
          this.showToast('No videos available yet. Admin must upload videos first.', 'error');
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePlayer();
      }
    });
  }

  // ==============================
  // PLAYLIST VIEWER METHODS
  // ==============================

  renderPlaylists() {
    const section = document.getElementById('playlistsSection');
    const container = document.getElementById('playlistCardsRow');
    const countEl = document.getElementById('playlistTotalCount');
    if (!section || !container) return;

    // Only show playlists that have at least 1 video
    let activePlaylists = this.playlists.filter(pl => (pl.videoIds || []).length > 0);

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      activePlaylists = activePlaylists.filter(pl => 
        pl.name.toLowerCase().includes(q) || 
        (pl.description && pl.description.toLowerCase().includes(q))
      );
    }

    if (activePlaylists.length === 0) {
      section.classList.add('hidden');
      return;
    }

    if (!this.activePlaylist) {
      section.classList.remove('hidden');
    }
    
    if (countEl) countEl.textContent = `${activePlaylists.length} playlist${activePlaylists.length !== 1 ? 's' : ''}`;

    const totalPages = Math.ceil(activePlaylists.length / this.playlistsPerPage);
    if (this.currentPlaylistPage > totalPages && totalPages > 0) this.currentPlaylistPage = totalPages;
    
    const startIndex = (this.currentPlaylistPage - 1) * this.playlistsPerPage;
    const paginatedPlaylists = activePlaylists.slice(startIndex, startIndex + this.playlistsPerPage);

    container.innerHTML = paginatedPlaylists.map(pl => {
      const vidCount = (pl.videoIds || []).length;
      const firstVid = this.videos.find(v => (pl.videoIds || [])[0] === v.id);
      const rawThumb = pl.thumbnail || (firstVid ? firstVid.thumbnail : './assets/Thumbnail.png');
      const thumbSrc = this.formatThumbnailUrl(rawThumb);

      return `
        <div class="flex-shrink-0 w-40 sm:w-52 cursor-pointer group" onclick="window.app.openPlaylist('${pl.id}')">
          <div class="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black/80 border border-white/10 group-hover:border-rose-500/50 transition-all shadow-lg group-hover:shadow-rose-600/20">
            <img src="${thumbSrc}" alt="${pl.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='./assets/Thumbnail.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div class="absolute bottom-2 left-2 right-2">
              <span class="text-white text-[10px] sm:text-xs font-bold bg-rose-600/90 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                <i class="fa-solid fa-layer-group text-[8px] sm:text-[10px]"></i> ${vidCount} videos
              </span>
            </div>
            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg">
                <i class="fa-solid fa-play text-xs ml-0.5"></i>
              </div>
            </div>
          </div>
          <h3 class="mt-2 text-xs sm:text-sm font-bold dark:text-gray-100 text-slate-800 group-hover:text-rose-500 transition-colors truncate">${pl.name}</h3>
          <p class="text-[9px] sm:text-[11px] dark:text-gray-400 text-slate-500 truncate">${pl.description || vidCount + ' videos'}</p>
        </div>
      `;
    }).join('');
    
    this.renderPlaylistPagination(totalPages);
  }

  renderPlaylistPagination(totalPages) {
    const container = document.getElementById('playlistPaginationContainer');
    if (!container) return;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-black/20 p-1.5 sm:p-2 rounded-full border border-slate-300 dark:border-white/5">
        <button onclick="window.app.changePlaylistPage(${this.currentPlaylistPage - 1})" class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-slate-200 dark:bg-white/5 hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" ${this.currentPlaylistPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left text-[10px] sm:text-xs"></i>
        </button>
        <span class="text-[10px] sm:text-xs font-semibold dark:text-gray-400 text-slate-500 px-1 sm:px-2">
          ${this.currentPlaylistPage} / ${totalPages}
        </span>
        <button onclick="window.app.changePlaylistPage(${this.currentPlaylistPage + 1})" class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-slate-200 dark:bg-white/5 hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" ${this.currentPlaylistPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right text-[10px] sm:text-xs"></i>
        </button>
      </div>
    `;
  }

  changePlaylistPage(newPage) {
    this.currentPlaylistPage = newPage;
    this.renderPlaylists();
  }

  openAllPlaylists() {
    const modal = document.getElementById('allPlaylistsModal');
    const grid = document.getElementById('allPlaylistsGrid');
    if (!modal || !grid) return;
    
    const activePlaylists = this.playlists.filter(pl => (pl.videoIds || []).length > 0);
    
    grid.innerHTML = activePlaylists.map(pl => {
      const vidCount = (pl.videoIds || []).length;
      const firstVid = this.videos.find(v => (pl.videoIds || [])[0] === v.id);
      const rawThumb = pl.thumbnail || (firstVid ? firstVid.thumbnail : './assets/Thumbnail.png');
      const thumbSrc = this.formatThumbnailUrl(rawThumb);

      return `
        <div class="cursor-pointer group flex flex-col h-full" onclick="window.app.closeAllPlaylists(); window.app.openPlaylist('${pl.id}')">
          <div class="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black/80 border border-white/10 group-hover:border-rose-500/50 transition-all shadow-lg group-hover:shadow-rose-600/20 w-full">
            <img src="${thumbSrc}" alt="${pl.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='./assets/Thumbnail.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div class="absolute bottom-2 left-2 right-2">
              <span class="text-white text-[10px] sm:text-xs font-bold bg-rose-600/90 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                <i class="fa-solid fa-layer-group text-[8px] sm:text-[10px]"></i> ${vidCount} vids
              </span>
            </div>
            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg">
                <i class="fa-solid fa-play text-xs ml-0.5"></i>
              </div>
            </div>
          </div>
          <h3 class="mt-2 text-xs sm:text-sm font-bold dark:text-gray-100 text-slate-800 group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug">${pl.name}</h3>
          <p class="text-[9px] sm:text-[11px] dark:text-gray-400 text-slate-500 truncate mt-0.5">${pl.description || vidCount + ' videos'}</p>
        </div>
      `;
    }).join('');
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeAllPlaylists() {
    const modal = document.getElementById('allPlaylistsModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  formatThumbnailUrl(url) {
    if (!url) return url;
    if (url.includes('imgur.com') && !url.includes('i.imgur.com') && !url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
      const parts = url.split('/');
      let id = parts[parts.length - 1];
      if (id.includes('?')) id = id.split('?')[0];
      return `https://i.imgur.com/${id}.png`;
    }
    return url;
  }

  openAllVideos() {
    const modal = document.getElementById('allVideosModal');
    const grid = document.getElementById('allVideosGrid');
    const countEl = document.getElementById('allVideosCount');
    if (!modal || !grid) return;

    if (countEl) countEl.textContent = `(${this.videos.length})`;

    grid.innerHTML = this.videos.map(vid => `
      <div class="cursor-pointer group flex flex-col" onclick="window.app.closeAllVideos(); window.app.openPlayer('${vid.id}')">
        <div class="relative aspect-video rounded-xl overflow-hidden bg-black/80 border border-white/10 group-hover:border-rose-500/50 transition-all shadow-lg w-full">
          <img src="${vid.thumbnail}" alt="${vid.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onerror="this.src='./assets/Thumbnail.png'">
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
          <div class="absolute top-1.5 left-1.5 bg-red-950/80 backdrop-blur-md border border-rose-500/30 text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            ${vid.category || 'General'}
          </div>
          ${this.isNewVideo(vid.createdAt) ? `
          <div class="absolute top-1.5 right-1.5 bg-rose-600/90 backdrop-blur-md border border-rose-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-lg">
            NEW
          </div>
          ` : ''}
          <div class="absolute bottom-1.5 right-1.5 bg-black/80 text-gray-200 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-white/10">
            ${vid.duration || '15:00'}
          </div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-10 h-10 rounded-full bg-rose-600/90 border border-rose-400 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-play text-sm ml-0.5"></i>
            </div>
          </div>
        </div>
        <h3 class="mt-1.5 text-[11px] sm:text-xs font-bold dark:text-gray-100 text-slate-800 group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug">${vid.title}</h3>
        <span class="text-[9px] dark:text-gray-400 text-slate-500">${(vid.viewCount || vid.views || 0).toLocaleString()} views • ${this.formatTimeAgo(vid.createdAt, vid.uploadDate)}</span>
      </div>
    `).join('');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeAllVideos() {
    const modal = document.getElementById('allVideosModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  // ==============================
  // MOVIES SECTION METHODS
  // ==============================

  renderMoviesSection() {
    const section = document.getElementById('moviesSection');
    const container = document.getElementById('moviesCardsRow');
    const countEl = document.getElementById('moviesTotalCount');
    if (!section || !container) return;

    if (this.movies.length === 0) {
      section.classList.add('hidden');
      return;
    }

    // Only show movies section if not searching and current category is All
    if (this.searchQuery || this.currentCategory !== 'All' || this.activePlaylist) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    if (countEl) countEl.textContent = `${this.movies.length} movie${this.movies.length !== 1 ? 's' : ''}`;

    const limit = 12; // Load up to 12 movies on home page
    const displayMovies = this.movies.slice(0, limit);

    container.innerHTML = displayMovies.map(mv => `
      <div class="flex-shrink-0 w-36 sm:w-48 cursor-pointer group flex flex-col" onclick="window.app.openPlayer('${mv.id}')">
        <div class="relative aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-black/80 border border-white/10 group-hover:border-rose-500/50 transition-all shadow-lg group-hover:shadow-rose-600/20">
          <img src="${mv.thumbnail}" alt="${mv.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='./assets/Thumbnail.png'">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          
          <div class="absolute bottom-2 left-2 right-2 flex justify-between items-end">
            <span class="text-white text-[10px] sm:text-xs font-bold bg-rose-600/90 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 rounded-md flex items-center gap-1 w-fit border border-rose-400">
              <i class="fa-solid fa-star text-yellow-400 text-[8px] sm:text-[10px]"></i> ${mv.rating || '90%'}
            </span>
            <span class="text-white text-[9px] sm:text-[10px] font-semibold bg-black/80 px-1.5 py-0.5 rounded border border-white/20">
              ${mv.duration || '1:30:00'}
            </span>
          </div>
          
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg border border-rose-400 transform group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-play text-sm sm:text-base ml-1"></i>
            </div>
          </div>
        </div>
        <h3 class="mt-2 text-xs sm:text-sm font-bold dark:text-gray-100 text-slate-800 group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug">${mv.title}</h3>
        <p class="text-[9px] sm:text-[11px] dark:text-gray-400 text-slate-500 truncate mt-0.5">${mv.category || 'Movie'} • ${(mv.viewCount || mv.views || 0).toLocaleString()} views</p>
      </div>
    `).join('');
  }

  openAllMovies() {
    const modal = document.getElementById('allMoviesModal');
    const grid = document.getElementById('allMoviesGrid');
    const countEl = document.getElementById('allMoviesCount');
    if (!modal || !grid) return;

    if (countEl) countEl.textContent = `(${this.movies.length})`;

    grid.innerHTML = this.movies.map(mv => `
      <div class="cursor-pointer group flex flex-col h-full" onclick="window.app.closeAllMovies(); window.app.openPlayer('${mv.id}')">
        <div class="relative aspect-[2/3] rounded-xl overflow-hidden bg-black/80 border border-white/10 group-hover:border-rose-500/50 transition-all shadow-lg w-full">
          <img src="${mv.thumbnail}" alt="${mv.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onerror="this.src='./assets/Thumbnail.png'">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          
          <div class="absolute top-1.5 left-1.5 bg-red-950/80 backdrop-blur-md border border-rose-500/30 text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            ${mv.category || 'Movie'}
          </div>
          ${this.isNewVideo(mv.createdAt) ? `
          <div class="absolute top-1.5 right-1.5 bg-rose-600/90 backdrop-blur-md border border-rose-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-lg">
            NEW
          </div>
          ` : ''}
          
          <div class="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-end">
            <span class="text-white text-[9px] font-bold bg-rose-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1 border border-rose-400">
              <i class="fa-solid fa-star text-yellow-400 text-[8px]"></i> ${mv.rating || '90%'}
            </span>
            <span class="text-white text-[9px] font-semibold bg-black/80 px-1.5 py-0.5 rounded border border-white/20">
              ${mv.duration || '1:30:00'}
            </span>
          </div>

          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-10 h-10 rounded-full bg-rose-600/90 border border-rose-400 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-play text-sm ml-0.5"></i>
            </div>
          </div>
        </div>
        <h3 class="mt-1.5 text-[11px] sm:text-xs font-bold dark:text-gray-100 text-slate-800 group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug">${mv.title}</h3>
        <span class="text-[9px] dark:text-gray-400 text-slate-500">${(mv.viewCount || mv.views || 0).toLocaleString()} views • ${this.formatTimeAgo(mv.createdAt, mv.uploadDate)}</span>
      </div>
    `).join('');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeAllMovies() {
    const modal = document.getElementById('allMoviesModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  openPlaylist(playlistId, fromHistory = false) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    this.activePlaylist = playlist;
    this.playlistVideoIndex = 0;
    this.currentCategory = 'All';
    this.searchQuery = '';
    this.currentPage = 1;

    if (!fromHistory) {
      history.pushState({ view: 'playlist', id: playlistId }, '', '#playlist-' + playlistId);
    }

    // Update UI: hide hero, playlists section, main browse section; show playlist view
    const heroSection = document.getElementById('heroSection');
    const playlistsSection = document.getElementById('playlistsSection');
    const mainBrowse = document.getElementById('mainBrowseSection');
    const playlistView = document.getElementById('playlistViewSection');

    if (heroSection) heroSection.classList.add('hidden');
    if (playlistsSection) playlistsSection.classList.add('hidden');
    if (mainBrowse) mainBrowse.classList.add('hidden');
    if (playlistView) playlistView.classList.remove('hidden');

    // Populate playlist view info
    const nameEl = document.getElementById('playlistViewName');
    const descEl = document.getElementById('playlistViewDesc');
    const countEl = document.getElementById('playlistViewCount');

    if (nameEl) nameEl.textContent = playlist.name;
    if (descEl) descEl.textContent = playlist.description || '';
    if (countEl) countEl.textContent = `${(playlist.videoIds || []).length} videos`;

    this.renderVideoGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  exitPlaylistView(fromHistory = false) {
    this.activePlaylist = null;
    this.playlistVideoIndex = 0;

    if (!fromHistory) {
      if (history.state && history.state.view === 'playlist') {
        history.back();
      } else {
        history.replaceState(null, '', window.location.pathname);
      }
    }

    // Restore UI
    const mainBrowse = document.getElementById('mainBrowseSection');
    const playlistView = document.getElementById('playlistViewSection');

    if (mainBrowse) mainBrowse.classList.remove('hidden');
    if (playlistView) playlistView.classList.add('hidden');

    this.renderHeroSection();
    this.renderPlaylists();
    this.renderCategoryPills();
    this.renderVideoGrid();
  }

  playPlaylistAll() {
    if (!this.activePlaylist) return;
    const videoIds = this.activePlaylist.videoIds || [];
    if (videoIds.length === 0) {
      this.showToast('This playlist has no videos.', 'error');
      return;
    }
    this.playlistVideoIndex = 0;
    this.openPlayer(videoIds[0]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new RedroomApp();
});
