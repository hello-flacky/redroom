/**
 * REDROOM - Modern 18+ Video Streaming Frontend App Logic
 * Features: Smart Streamtape Embed Parser (Auto-converts /v/ to /e/), Full-Screen Theater Player,
 * Neon Loading Animation, Light/Dark Theme Switcher, Logged-in Download Gate,
 * and Real-Time Page Views Counter.
 */

const DEFAULT_CATEGORIES = ['All', 'Trending', '4K Ultra', 'Amateur', 'VR 360', 'Exclusive', 'HD'];
const INITIAL_SITE_VIEWS = 100;

// Monetag Direct Link popunder settings
const MONETAG_DIRECT_LINK = 'https://omg10.com/4/10523396';
let lastAdClickTime = 0;
const AD_COOLDOWN_MS = 60000; // 1 minute
let firstDownloadClicked = false;

// EMPTY Initial Video Dataset - Only populated when Admin adds videos!
const INITIAL_VIDEOS = [];

class RedroomApp {
  constructor() {
    this.videos = [];
    this.categories = [...DEFAULT_CATEGORIES];
    this.siteViews = this.loadSiteViews();
    this.currentCategory = 'All';
    this.searchQuery = '';
    this.currentVideo = null;
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
      this.hideLoader();
    }, (error) => {
      console.error('Error fetching videos:', error);
      this.hideLoader();
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
      this.setupMonetagAd();
      this.hideLoader();
    }, 300);
  }

  setupMonetagAd() {
    document.body.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastAdClickTime > AD_COOLDOWN_MS) {
        lastAdClickTime = now;
        window.open(MONETAG_DIRECT_LINK, '_blank');
      }
    });
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

  checkAgeGate() {
    const ageModal = document.getElementById('ageGateModal');
    const isVerified = localStorage.getItem('redroom_age_verified');
    if (!isVerified && ageModal) {
      ageModal.classList.remove('hidden');
    }
  }

  confirmAge() {
    localStorage.setItem('redroom_age_verified', 'true');
    const ageModal = document.getElementById('ageGateModal');
    if (ageModal) ageModal.classList.add('hidden');
    this.showToast('Access Granted to Redroom 18+ Portal', 'success');
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
    if (views) views.textContent = topVideo.views || topVideo.viewCount || '0';
    if (duration) duration.textContent = topVideo.duration || '15:00';
    if (uploader) uploader.textContent = topVideo.uploader || 'Redroom Admin';
    if (catBadge) {
      catBadge.innerHTML = `<i class="fa-solid fa-tag text-xs mr-1"></i> ${topVideo.category || 'General'}`;
    }

    // Show hero if not searching
    if (!this.searchQuery && this.currentCategory === 'All') {
      heroSection.classList.remove('hidden');
    }
  }

  renderVideoGrid() {
    const grid = document.getElementById('videoGrid');
    const resultCount = document.getElementById('resultCount');
    const heroSection = document.getElementById('heroSection');

    // Hero banner: only show when videos exist AND not searching/filtering
    if (heroSection) {
      if (this.videos.length === 0 || this.searchQuery || this.currentCategory !== 'All') {
        heroSection.classList.add('hidden');
      } else {
        heroSection.classList.remove('hidden');
      }
    }

    if (!grid) return;

    let filtered = this.videos.filter(vid => {
      const matchesCat = (this.currentCategory === 'All') || (vid.category === this.currentCategory);
      const matchesSearch = !this.searchQuery || 
        vid.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (vid.category && vid.category.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        vid.uploader.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });

    if (resultCount) {
      resultCount.textContent = `Showing ${filtered.length} Videos`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center glass-card rounded-3xl p-10 border border-rose-900/30">
          <div class="w-20 h-20 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-500 inline-flex items-center justify-center mb-4 shadow-lg shadow-rose-600/30 animate-pulse">
            <i class="fa-solid fa-film text-3xl"></i>
          </div>
          <h3 class="text-2xl font-black dark:text-gray-100 text-slate-800 mb-2 tracking-tight">No Redroom Videos Uploaded Yet</h3>
          <p class="dark:text-gray-400 text-slate-500 text-sm max-w-md mx-auto mb-6">
            ${this.searchQuery || this.currentCategory !== 'All' ? `No videos found matching "${this.searchQuery || this.currentCategory}".` : 'The admin has not published any videos yet. Log in to the Admin Panel (Password: 911) to publish Streamtape video links!'}
          </p>
          <a href="admin.html" class="btn-outline-red px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2">
            <i class="fa-solid fa-user-shield"></i> Go to Admin Panel
          </a>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(vid => `
      <div class="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col" onclick="window.app.openPlayer('${vid.id}')">
        <div class="thumb-container relative aspect-video bg-black/80">
          <img src="${vid.thumbnail}" alt="${vid.title}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'">
          
          <div class="absolute top-3 left-3 bg-red-950/80 backdrop-blur-md border border-rose-500/30 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
            ${vid.quality || 'HD'}
          </div>

          <div class="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-gray-200 text-xs font-semibold px-2 py-1 rounded-md border border-white/10">
            ${vid.duration || '15:00'}
          </div>

          <div class="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1">
            <i class="fa-solid fa-star text-[10px]"></i> ${vid.rating || 98}%
          </div>

          <div class="play-overlay absolute inset-0 bg-gradient-to-t from-red-950/90 via-black/40 to-transparent flex items-center justify-center">
            <div class="w-14 h-14 rounded-full bg-rose-600/90 border border-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/50 transform group-hover:scale-110 transition-transform duration-300">
              <i class="fa-solid fa-play text-xl ml-1"></i>
            </div>
          </div>
        </div>

        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-bold dark:text-gray-100 text-slate-800 text-base group-hover:text-rose-500 transition-colors line-clamp-2 leading-snug mb-2">
              ${vid.title}
            </h3>
            <div class="flex items-center gap-2 text-xs dark:text-gray-400 text-slate-500 mb-3">
              <img src="${vid.uploaderAvatar}" alt="${vid.uploader}" class="w-5 h-5 rounded-full object-cover border border-rose-500/30">
              <span class="truncate">${vid.uploader}</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs dark:text-gray-400 text-slate-500 pt-2 border-t border-white/5">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-eye text-rose-500/70"></i> ${(vid.viewCount || vid.views || 0).toLocaleString()} views</span>
            <span>${vid.uploadDate}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  openPlayer(videoId) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;

    this.showLoader('Opening Full Screen Streamtape Player...');
    this.currentVideo = video;
    const playerModal = document.getElementById('playerModal');
    const iframeContainer = document.getElementById('streamtapeIframeContainer');
    
    const embedUrl = this.parseStreamtapeUrl(video.streamtapeUrl);
    
    if (iframeContainer) {
      iframeContainer.innerHTML = `
        <iframe 
          src="${embedUrl}" 
          width="100%" 
          height="100%" 
          allowfullscreen 
          scrolling="no" 
          frameborder="0"
          allow="autoplay; encrypted-media; fullscreen"
          title="${video.title}">
        </iframe>
      `;
    }

    document.getElementById('playerTitle').textContent = video.title;
    document.getElementById('playerUploader').textContent = video.uploader;
    document.getElementById('playerUploaderAvatar').src = video.uploaderAvatar;
    document.getElementById('playerViews').textContent = (video.viewCount || video.views || 0).toLocaleString() + ' Views';
    document.getElementById('playerUploadDate').textContent = video.uploadDate;
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

  closePlayer() {
    const playerModal = document.getElementById('playerModal');
    const iframeContainer = document.getElementById('streamtapeIframeContainer');
    if (iframeContainer) iframeContainer.innerHTML = '';
    if (playerModal) {
      playerModal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
    this.currentVideo = null;
  }

  downloadVideo() {
    if (!this.currentVideo) return;
    
    if (!firstDownloadClicked) {
      // First click: Open direct link
      firstDownloadClicked = true;
      this.showToast('Preparing download...', 'info');
      window.open(MONETAG_DIRECT_LINK, '_blank');
    } else {
      // Subsequent click: actual download (open streamtape link)
      this.showToast('Starting Streamtape Video Download...', 'success');
      window.open(this.currentVideo.streamtapeUrl, '_blank');
    }
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

    const recommended = this.videos.filter(v => v.id !== this.currentVideo.id).slice(0, 4);
    recList.innerHTML = recommended.map(v => `
      <div class="flex gap-3 cursor-pointer group" onclick="window.app.openPlayer('${v.id}')">
        <div class="w-28 aspect-video rounded-lg overflow-hidden relative bg-black shrink-0">
          <img src="${v.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
          <span class="absolute bottom-1 right-1 text-[9px] bg-black/80 px-1 rounded text-gray-200 font-semibold">${v.duration || '15:00'}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-semibold dark:text-gray-200 text-slate-800 group-hover:text-rose-400 line-clamp-2 leading-tight mb-1">${v.title}</h4>
          <span class="text-[11px] text-gray-400 block truncate">${v.uploader}</span>
          <span class="text-[10px] text-gray-500">${v.views} views</span>
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
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderVideoGrid();
      });
    }

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
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new RedroomApp();
});
