/* ==========================================================================
   JavaScript Logic - Mateus Lucena Personal Site
   ========================================================================== */

(function() {
    'use strict';

    /**
     * EventBus for Mediator Pattern - Decoupled Component Communication.
     */
    class EventBus {
        constructor() {
            this.listeners = {};
        }

        subscribe(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
            return () => {
                this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
            };
        }

        publish(event, data) {
            if (!this.listeners[event]) return;
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in event listener for ${event}:`, e);
                }
            });
        }
    }

    /**
     * Shared Utility Functions.
     */
    const Utils = {
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
    };

    /**
     * Controller for managing homepage and banner background carousels.
     */
    class CarouselController {
        constructor(images, intervalMs = 6000) {
            this.images = images;
            this.intervalMs = intervalMs;
            this.currentIndex = 0;
            this.intervalId = null;
        }

        init() {
            const homeSection = document.getElementById('home');
            const tabBanners = document.querySelectorAll('.tab-banner');
            
            this.buildSlider(homeSection, true);
            tabBanners.forEach(banner => this.buildSlider(banner, false));

            const prevBtn = document.getElementById('carousel-prev');
            const nextBtn = document.getElementById('carousel-next');
            if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
            if (nextBtn) nextBtn.addEventListener('click', () => this.next());

            this.startTimer();
        }

        buildSlider(container, isHome) {
            if (!container) return;
            container.style.position = 'relative';
            
            const containerDiv = document.createElement('div');
            containerDiv.className = 'carousel-slides-container';
            
            this.images.forEach((imgUrl, idx) => {
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';
                if (isHome) {
                    slide.style.backgroundImage = `linear-gradient(to right, rgba(12, 13, 13, 0.65) 0%, rgba(12, 13, 13, 0.3) 50%, rgba(0, 0, 0, 0) 100%), url('${imgUrl}')`;
                } else {
                    slide.style.backgroundImage = `url('${imgUrl}')`;
                }
                slide.style.transform = idx === 0 ? 'translateX(0)' : 'translateX(100%)';
                containerDiv.appendChild(slide);
            });
            
            container.insertBefore(containerDiv, container.firstChild);
        }

        _slideContainer(containerDiv, prevIdx, targetIdx, dir) {
            if (!containerDiv) return;
            const slides = containerDiv.querySelectorAll('.carousel-slide');
            if (slides.length <= targetIdx || slides.length <= prevIdx) return;
            
            const currentSlide = slides[prevIdx];
            const targetSlide = slides[targetIdx];
            
            slides.forEach((slide, idx) => {
                if (idx !== prevIdx) {
                    slide.style.transition = 'none';
                    slide.style.transform = idx === targetIdx 
                        ? (dir === 'next' ? 'translateX(100%)' : 'translateX(-100%)') 
                        : 'translateX(100%)';
                }
            });
            
            void containerDiv.offsetWidth; // Force reflow
            
            currentSlide.style.transition = 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
            targetSlide.style.transition = 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
            
            currentSlide.style.transform = dir === 'next' ? 'translateX(-100%)' : 'translateX(100%)';
            targetSlide.style.transform = 'translateX(0)';
        }

        goToImage(targetIndex, direction) {
            if (targetIndex === this.currentIndex) return;
            
            const homeContainer = document.querySelector('#home .carousel-slides-container');
            this._slideContainer(homeContainer, this.currentIndex, targetIndex, direction);
            
            const bannerContainers = document.querySelectorAll('.tab-banner .carousel-slides-container');
            bannerContainers.forEach(container => {
                this._slideContainer(container, this.currentIndex, targetIndex, direction);
            });
            
            this.currentIndex = targetIndex;
        }

        startTimer() {
            if (this.intervalId) clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.next(), this.intervalMs);
        }

        next() {
            const nextIndex = (this.currentIndex + 1) % this.images.length;
            this.goToImage(nextIndex, 'next');
            this.startTimer();
        }

        prev() {
            const prevIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
            this.goToImage(prevIndex, 'prev');
            this.startTimer();
        }
    }

    /**
     * Controller for Substack articles list, search, filters, pagination, and reader view.
     */
    class ArticlesController {
        constructor(articles, eventBus, itemsPerPage = 4) {
            this.articles = articles;
            this.eventBus = eventBus;
            this.itemsPerPage = itemsPerPage;
            this.currentPage = 1;
            this.activeFilter = 'all';
            this.currentSearchQuery = '';
            
            // Cache DOM elements
            this.grid = document.getElementById('articles-grid');
            this.noResults = document.getElementById('no-results');
            this.statusShowing = document.getElementById('status-showing');
            this.paginationRow = document.getElementById('pagination-row');
            this.searchInput = document.getElementById('search-input');
            
            // Calculate reading time dynamically if not present
            this.articles.forEach(art => {
                if (!art.readTime) {
                    const text = (art.bodyHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    const wordCount = text ? text.split(/\s+/).length : 0;
                    art.readTime = Math.max(1, Math.ceil(wordCount / 200));
                }
            });
        }

        init() {
            this.setupFilters();
            this.setupSearch();
            this.setupGridClickListener();
            this.updateBadges();
            this.render();

            // Listen to active section switches for rendering articles dynamically
            this.eventBus.subscribe('section:changed', ({ sectionId, isArticleView, articleSlug }) => {
                if (isArticleView && sectionId === 'single-post') {
                    this.renderSingle(articleSlug);
                }
            });
        }

        updateBadges() {
            const badgeAll = document.getElementById('badge-all');
            const badgeUnder5 = document.getElementById('badge-under5');
            const badgeOver5 = document.getElementById('badge-over5');
            const searchCountTotal = document.getElementById('search-count-total');

            if (badgeAll) badgeAll.textContent = this.articles.length;
            if (badgeUnder5) badgeUnder5.textContent = this.articles.filter(a => a.readTime < 5).length;
            if (badgeOver5) badgeOver5.textContent = this.articles.filter(a => a.readTime >= 5).length;
            if (searchCountTotal) searchCountTotal.textContent = this.articles.length;
        }

        getFiltered() {
            return this.articles.filter(art => {
                if (this.activeFilter === 'under5' && art.readTime >= 5) return false;
                if (this.activeFilter === 'over5' && art.readTime < 5) return false;
                
                if (this.currentSearchQuery) {
                    const query = this.currentSearchQuery.toLowerCase();
                    return art.title.toLowerCase().includes(query) ||
                           art.excerpt.toLowerCase().includes(query) ||
                           art.category.toLowerCase().includes(query) ||
                           art.tags.some(t => t.toLowerCase().includes(query));
                }
                return true;
            });
        }

        render() {
            if (!this.grid) return;
            this.grid.innerHTML = '';
            
            const filtered = this.getFiltered();
            
            if (filtered.length === 0) {
                if (this.noResults) this.noResults.style.display = 'block';
                if (this.statusShowing) this.statusShowing.textContent = 'Showing 0-0 of 0 items';
                if (this.paginationRow) this.paginationRow.innerHTML = '';
                return;
            }
            
            if (this.noResults) this.noResults.style.display = 'none';
            
            const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
            if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
            
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = Math.min(startIndex + this.itemsPerPage, filtered.length);
            const paginated = filtered.slice(startIndex, endIndex);
            
            if (this.statusShowing) {
                this.statusShowing.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filtered.length} items`;
            }
            
            paginated.forEach(article => {
                const slug = article.url.split('/p/')[1];
                const card = document.createElement('article');
                card.className = 'article-card';
                card.innerHTML = `
                    <img src="${article.image}" alt="${article.title}" class="article-image" loading="lazy">
                    <div class="article-content">
                        <div class="article-meta-row">
                            <div class="article-tags-container">
                                ${article.tags.map(tag => `<span class="article-category-tag">${tag}</span>`).join('')}
                            </div>
                            <span class="article-date-time">${article.date} • ${article.readTime} min read</span>
                        </div>
                        <h3 class="article-title">${article.title}</h3>
                        <p class="article-excerpt">${article.excerpt}</p>
                        <a href="#article-${slug}" class="article-link article-read-btn" data-slug="${slug}">
                            Read Article
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </a>
                    </div>
                `;
                this.grid.appendChild(card);
            });
            
            this.renderPagination(totalPages);
        }

        renderPagination(totalPages) {
            if (!this.paginationRow) return;
            this.paginationRow.innerHTML = '';
            
            if (totalPages <= 1) return;
            
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.innerHTML = `&larr;`;
            prevBtn.disabled = (this.currentPage === 1);
            prevBtn.addEventListener('click', () => {
                this.currentPage--;
                this.render();
                document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
            });
            this.paginationRow.appendChild(prevBtn);
            
            for (let i = 1; i <= totalPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${this.currentPage === i ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => {
                    this.currentPage = i;
                    this.render();
                    document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
                });
                this.paginationRow.appendChild(pageBtn);
            }
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.innerHTML = `&rarr;`;
            nextBtn.disabled = (this.currentPage === totalPages);
            nextBtn.addEventListener('click', () => {
                this.currentPage++;
                this.render();
                document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
            });
            this.paginationRow.appendChild(nextBtn);
        }

        setupFilters() {
            const filterButtons = document.querySelectorAll('.filter-btn');
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    this.activeFilter = btn.getAttribute('data-filter');
                    this.currentPage = 1;
                    this.render();
                });
            });
        }

        setupSearch() {
            if (this.searchInput) {
                // Apply debounce optimization to prevent performance lag on typing
                this.searchInput.addEventListener('input', Utils.debounce((e) => {
                    this.currentSearchQuery = e.target.value.trim();
                    this.currentPage = 1;
                    this.render();
                }, 250));
            }
        }

        setupGridClickListener() {
            if (this.grid) {
                this.grid.addEventListener('click', (e) => {
                    const link = e.target.closest('.article-read-btn');
                    if (link) {
                        e.preventDefault();
                        const slug = link.getAttribute('data-slug');
                        this.eventBus.publish('navigation:request', { target: 'article-' + slug });
                    }
                });
            }
        }

        renderSingle(slug) {
            const readerContainer = document.getElementById('reader-container');
            if (!readerContainer) return;

            const article = this.articles.find(art => art.url.endsWith('/p/' + slug));
            if (!article) {
                readerContainer.innerHTML = `<h2>Article not found</h2><p><a href="#articles" class="reader-back-link">← Back to Articles and Posts</a></p>`;
                return;
            }

            const bodyContent = article.bodyHtml || '<p>Content not available.</p>';
            
            readerContainer.innerHTML = `
                <div class="reader-header">
                    <div class="reader-author-info">
                        <img src="https://substack-post-media.s3.amazonaws.com/public/images/09dbaa45-d659-4ee1-8c3e-af49abfd0b2b_640x640.jpeg" alt="Mateus Lucena Avatar" class="reader-avatar">
                        <div class="reader-author-meta">
                            <span class="reader-author-name">Mateus Lucena</span>
                            <span class="reader-post-origin">Originally: ${article.date} | On Substack</span>
                        </div>
                    </div>
                    <span class="reader-read-time">${article.readTime} min read</span>
                </div>
                
                <hr class="reader-divider">
                
                <div class="reader-tags-row">
                    ${article.tags.map(tag => `<span class="reader-tag">${tag}</span>`).join('')}
                </div>
                
                <article class="reader-canvas">
                    <h1 class="reader-title">${article.title}</h1>
                    <div class="reader-body">
                        ${bodyContent}
                    </div>
                </article>
                
                <div class="substack-callout">
                    <p class="substack-callout-text">
                        Originally published on <a href="${article.url}" target="_blank" rel="noopener noreferrer">Substack</a> on ${article.date}. Enhanced for this site with expanded insights and additional resources.
                    </p>
                </div>
                
                <div class="reader-back-container">
                    <a href="#articles" class="reader-back-link" id="reader-back-btn">
                        ← Back to Articles and Posts
                    </a>
                </div>
            `;

            const backBtn = document.getElementById('reader-back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.eventBus.publish('navigation:request', { target: 'articles' });
                });
            }
        }
    }

    /**
     * Controller for publications card rendering.
     */
    class PublicationsController {
        constructor(publications) {
            this.publications = publications;
            this.grid = document.getElementById('publications-grid');
        }

        init() {
            if (!this.grid) return;
            this.grid.innerHTML = '';
            
            this.publications.forEach(pub => {
                const card = document.createElement('div');
                card.className = 'pub-card';
                card.innerHTML = `
                    <div class="pub-header">
                        <img src="${pub.icon}" alt="${pub.badge} Icon" class="pub-icon">
                        <div class="pub-title-container">
                            <h3 class="pub-title">${pub.title}</h3>
                            <span class="pub-authors">${pub.authors} (${pub.year}) • ${pub.venue}</span>
                        </div>
                    </div>
                    <p class="pub-abstract">${pub.abstract}</p>
                    <div class="pub-footer">
                        <span class="pub-badge">${pub.badge}</span>
                        <a href="${pub.url}" target="_blank" rel="noopener noreferrer" class="pub-link">
                            Read on ${pub.badge.split('/')[0].trim()} →
                        </a>
                    </div>
                `;
                this.grid.appendChild(card);
            });
        }
    }

    /**
     * Controller for art pieces in the Atelier gallery.
     */
    class AtelierController {
        constructor(pieces, eventBus) {
            this.pieces = pieces;
            this.eventBus = eventBus;
            this.initialized = false;
        }

        init() {
            // Decoupled activation via Event Bus
            this.eventBus.subscribe('section:changed', ({ sectionId }) => {
                if (sectionId === 'atelier') {
                    this.initAtelier();
                }
            });
        }

        initAtelier() {
            if (this.initialized) return;
            this.initialized = true;

            const pieceCards = document.querySelectorAll('.atelier-piece-card');
            pieceCards.forEach((card, idx) => {
                const openGallery = (e) => {
                    e.stopPropagation();
                    this.eventBus.publish('lightbox:open', { source: 'atelier', index: idx });
                };

                const zoomBtn = card.querySelector('.atelier-zoom-btn');
                if (zoomBtn) zoomBtn.addEventListener('click', openGallery);

                const viewLink = card.querySelector('.atelier-view-link-btn');
                if (viewLink) viewLink.addEventListener('click', openGallery);

                const imgContainer = card.querySelector('.atelier-piece-img-container');
                if (imgContainer) imgContainer.addEventListener('click', openGallery);
            });

            const inquireBtn = document.getElementById('atelier-inquire-btn');
            if (inquireBtn) {
                inquireBtn.addEventListener('click', () => {
                    this.eventBus.publish('navigation:request', { target: 'about', scrollTo: 'about-contact' });
                });
            }
        }
    }

    /**
     * Controller for Leaflet map photogallery and Atelier gallery lightboxes.
     */
    class LightboxController {
        constructor(mapCities, atelierPieces, eventBus) {
            this.mapCities = mapCities;
            this.atelierPieces = atelierPieces;
            this.eventBus = eventBus;
            
            this.currentCityId = '';
            this.currentImgIdx = 0;
            
            this.lightbox = document.getElementById('map-lightbox');
            this.lightboxImg = document.getElementById('lightbox-img');
            this.lightboxCounter = document.getElementById('lightbox-counter');
            this.lightboxCaption = document.getElementById('lightbox-caption');
        }

        init() {
            const closeBtn = document.getElementById('lightbox-close');
            const prevBtn = document.getElementById('lightbox-prev');
            const nextBtn = document.getElementById('lightbox-next');

            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
            if (nextBtn) nextBtn.addEventListener('click', () => this.next());

            if (this.lightbox) {
                this.lightbox.addEventListener('click', (e) => {
                    if (e.target === this.lightbox) this.close();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (this.lightbox && this.lightbox.classList.contains('open')) {
                    if (e.key === 'Escape') this.close();
                    if (e.key === 'ArrowRight') this.next();
                    if (e.key === 'ArrowLeft') this.prev();
                }
            });

            // Decoupled activation trigger from other controllers
            this.eventBus.subscribe('lightbox:open', ({ source, index }) => {
                this.open(source, index);
            });
        }

        open(cityId, index) {
            if (!this.lightbox || !this.lightboxImg) return;

            this.currentCityId = cityId;
            this.currentImgIdx = index;

            if (cityId === 'atelier') {
                this.lightbox.classList.add('pinterest-mode');
            } else {
                this.lightbox.classList.remove('pinterest-mode');
                const city = this.mapCities.find(c => c.id === cityId);
                if (!city || city.images.length === 0) return;
            }

            this.updateContent();
            this.lightbox.classList.add('open');
            this.lightbox.setAttribute('aria-hidden', 'false');
        }

        getCollectionLength() {
            if (this.currentCityId === 'atelier') {
                return this.atelierPieces.length;
            }
            const city = this.mapCities.find(c => c.id === this.currentCityId);
            return city ? city.images.length : 0;
        }

        next() {
            const length = this.getCollectionLength();
            if (length > 0) {
                this.currentImgIdx = (this.currentImgIdx + 1) % length;
                this.updateContent();
            }
        }

        prev() {
            const length = this.getCollectionLength();
            if (length > 0) {
                this.currentImgIdx = (this.currentImgIdx - 1 + length) % length;
                this.updateContent();
            }
        }

        updateContent() {
            if (this.currentCityId === 'atelier') {
                const piece = this.atelierPieces[this.currentImgIdx];
                if (!piece) return;
                this.lightboxImg.src = piece.url;
                this.lightboxImg.alt = piece.title;
                
                this.lightboxCounter.textContent = `${this.currentImgIdx + 1}/${this.atelierPieces.length}`;
                
                const statusClass = piece.status === 'Available' ? 'badge-available' : 'badge-soldout';
                const priceOrStatus = piece.status === 'Available' ? piece.price : piece.status;
                
                this.lightboxCaption.innerHTML = `
                    <div class="lightbox-pinterest-info">
                        <div class="lightbox-pinterest-header">
                            <img src="images/atelier_artist.jpg" alt="Conceição Costa" class="lightbox-pinterest-avatar">
                            <span class="lightbox-pinterest-author">Conceição Costa</span>
                        </div>
                        <h3 class="lightbox-pinterest-title">${piece.title}</h3>
                        <div class="lightbox-pinterest-meta-line">
                            <span>${piece.medium}</span>
                            <span>&bull;</span>
                            <span class="atelier-badge ${statusClass}">${priceOrStatus}</span>
                        </div>
                        <p class="lightbox-pinterest-desc">${piece.description || ''}</p>
                        <a href="${piece.pinterestUrl}" target="_blank" rel="noopener noreferrer" class="lightbox-pinterest-action-btn">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" style="vertical-align: -3px; margin-right: 8px;"><path d="M12 0a12 12 0 0 0-4.37 23.17c-.07-.63-.13-1.6.03-2.29l1.42-6.02s-.36-.72-.36-1.78c0-1.67.97-2.92 2.18-2.92 1.03 0 1.52.77 1.52 1.69 0 1.03-.66 2.58-1 4.02-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.78-2.26 3.78-5.52 0-2.89-2.07-4.91-5.04-4.91-3.44 0-5.46 2.58-5.46 5.25 0 1.04.4 2.16.9 2.76a.33.33 0 0 1 .08.34l-.34 1.38c-.06.22-.18.27-.4.17-1.53-.71-2.48-2.94-2.48-4.73 0-3.86 2.81-7.41 8.09-7.41 4.25 0 7.55 3.03 7.55 7.07 0 4.22-2.66 7.62-6.36 7.62-1.24 0-2.4-.64-2.8-1.4l-.76 2.9c-.28 1.05-1.02 2.37-1.52 3.18A12 12 0 1 0 12 0z"/></svg>
                            View on Pinterest
                        </a>
                    </div>
                `;
                return;
            }

            const city = this.mapCities.find(c => c.id === this.currentCityId);
            if (!city) return;

            const img = city.images[this.currentImgIdx];
            this.lightboxImg.src = img.url;
            this.lightboxImg.alt = img.caption;
            
            this.lightboxCounter.textContent = `${this.currentImgIdx + 1}/${city.images.length}`;
            this.lightboxCaption.textContent = img.caption;
        }

        close() {
            if (!this.lightbox) return;
            this.lightbox.classList.remove('open');
            this.lightbox.classList.remove('pinterest-mode');
            this.lightbox.setAttribute('aria-hidden', 'true');
            this.lightboxImg.src = '';
        }
    }

    /**
     * Controller for Leaflet map markers, Bezier curve paths, and map fullscreen features.
     */
    class MapController {
        constructor(mapCities, eventBus) {
            this.mapCities = mapCities;
            this.eventBus = eventBus;
            this.instance = null;
            this.markers = {};
            this.bounds = [];
            
            this.pathLineVAL = null;
            this.labelVAL = null;
            this.pathLineMAN = null;
            this.labelMAN = null;
            this.pathLineCG = null;
            this.labelCG = null;
        }

        init() {
            // Decoupled activation via Event Bus
            this.eventBus.subscribe('section:changed', ({ sectionId }) => {
                if (sectionId === 'about') {
                    this.initMap();
                }
            });
        }

        initMap() {
            const container = document.getElementById('about-map');
            if (!container || this.instance) return;

            // Defensive architectural check for external Leaflet library load status
            if (typeof L === 'undefined') {
                console.warn('Leaflet map library (L) is not loaded.');
                return;
            }

            try {
                this.instance = L.map('about-map', {
                    scrollWheelZoom: false,
                    zoomControl: true
                });

                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(this.instance);

                const redIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });

                this.instance.on('tooltipopen', (e) => {
                    const el = e.tooltip.getElement();
                    if (el && !el._hasClickListener) {
                        el._hasClickListener = true;
                        el.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            if (e.tooltip._source) e.tooltip._source.openPopup();
                        });
                    }
                });

                this.mapCities.forEach(city => {
                    let popupContent = `<div class="map-popup-gallery"><div class="popup-title">${city.name}</div>`;
                    if (city.images.length > 0) {
                        popupContent += `<div class="popup-thumbnails">`;
                        city.images.forEach((img, idx) => {
                            popupContent += `<img src="${img.url}" class="popup-thumb" data-city="${city.id}" data-index="${idx}" alt="${img.caption}" title="${img.caption}">`;
                        });
                        popupContent += `</div>`;
                    } else {
                        popupContent += `<p style="font-size:0.85rem; color:var(--color-text-secondary); margin:0.5rem 0 0 0;">No photos available yet.</p>`;
                    }
                    popupContent += `</div>`;

                    let tooltipContent = `<div class="tooltip-content-wrapper"><span class="tooltip-text">${city.shortName}</span>`;
                    if (city.images && city.images.length > 0) {
                        tooltipContent += ` <svg class="camera-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
                    }
                    tooltipContent += `</div>`;

                    const initialCoords = city.lowZoomCoords || city.coords;
                    const marker = L.marker(initialCoords, { icon: redIcon });
                    marker.bindPopup(popupContent);
                    marker.bindTooltip(tooltipContent, city.tooltipOptions);
                    marker.addTo(this.instance);

                    this.markers[city.id] = marker;
                    this.bounds.push(city.coords);
                });

                this.updatePaths();
                this.updateLabels();

                this.instance.on('zoomend', () => {
                    const zoom = this.instance.getZoom();
                    this.mapCities.forEach(city => {
                        const marker = this.markers[city.id];
                        if (marker) {
                            marker.setLatLng(zoom <= 4 && city.lowZoomCoords ? city.lowZoomCoords : city.coords);
                        }
                    });
                    this.updatePaths();
                    this.updateLabels();
                });

                this.instance.on('popupopen', (e) => {
                    const popupEl = e.popup.getElement();
                    if (!popupEl) return;
                    const thumbs = popupEl.querySelectorAll('.popup-thumb');
                    thumbs.forEach(thumb => {
                        thumb.addEventListener('click', (ev) => {
                            const cityId = ev.target.getAttribute('data-city');
                            const index = parseInt(ev.target.getAttribute('data-index'), 10);
                            this.eventBus.publish('lightbox:open', { source: cityId, index });
                        });
                    });
                });

                this.instance.fitBounds(this.bounds, { padding: [30, 30] });
                this.setupFullscreen();
            } catch (err) {
                console.error('Error instantiating Leaflet map widget:', err);
            }
        }

        getBezierPoints(start, end, ctrl) {
            const pts = [];
            const steps = 50;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const lat = (1-t)*(1-t)*start.lat + 2*(1-t)*t*ctrl[0] + t*t*end.lat;
                const lng = (1-t)*(1-t)*start.lng + 2*(1-t)*t*ctrl[1] + t*t*end.lng;
                pts.push([lat, lng]);
            }
            return pts;
        }

        updatePaths() {
            const mJP = this.markers['joaopessoa'];
            const mVAL = this.markers['valencia'];
            const mMAN = this.markers['manaus'];
            const mCG = this.markers['campinagrande'];

            const mapCard = document.querySelector('.about-map-card');
            const isFullscreen = mapCard && mapCard.classList.contains('fullscreen');

            if (mJP && mVAL) {
                const start = mJP.getLatLng();
                const end = mVAL.getLatLng();
                const pts = this.getBezierPoints(start, end, [ (start.lat + end.lat) / 2 + 15, (start.lng + end.lng) / 2 - 15 ]);
                if (this.pathLineVAL) this.pathLineVAL.setLatLngs(pts);
                else this.pathLineVAL = L.polyline(pts, { color: 'var(--color-accent)', weight: 2, dashArray: '5, 6', opacity: 0.7 });
                this.pathLineVAL.addTo(this.instance);
            }

            if (mJP && mMAN) {
                const start = mJP.getLatLng();
                const end = mMAN.getLatLng();
                const pts = this.getBezierPoints(start, end, [ (start.lat + end.lat) / 2 - 7, (start.lng + end.lng) / 2 ]);
                if (this.pathLineMAN) this.pathLineMAN.setLatLngs(pts);
                else this.pathLineMAN = L.polyline(pts, { color: 'var(--color-accent)', weight: 2, dashArray: '5, 6', opacity: 0.7 });
                this.pathLineMAN.addTo(this.instance);
            }

            if (mJP && mCG) {
                const start = mJP.getLatLng();
                const end = mCG.getLatLng();
                const pts = this.getBezierPoints(start, end, [ (start.lat + end.lat) / 2 + 0.15, (start.lng + end.lng) / 2 ]);
                if (this.pathLineCG) this.pathLineCG.setLatLngs(pts);
                else this.pathLineCG = L.polyline(pts, { color: 'var(--color-accent)', weight: 2, dashArray: '5, 6', opacity: 0.7 });
                
                if (isFullscreen) this.pathLineCG.addTo(this.instance);
                else this.pathLineCG.remove();
            }
        }

        updateLabels() {
            const mJP = this.markers['joaopessoa'];
            const mVAL = this.markers['valencia'];
            const mMAN = this.markers['manaus'];
            const mCG = this.markers['campinagrande'];

            const mapCard = document.querySelector('.about-map-card');
            const isFullscreen = mapCard && mapCard.classList.contains('fullscreen');

            const createOrUpdateLabel = (marker, start, end, ctrl, labelHtml, iconAnchor) => {
                const t = 0.5;
                const lat = (1-t)*(1-t)*start.lat + 2*(1-t)*t*ctrl[0] + t*t*end.lat;
                const lng = (1-t)*(1-t)*start.lng + 2*(1-t)*t*ctrl[1] + t*t*end.lng;
                
                const customIcon = L.divIcon({
                    html: labelHtml,
                    className: 'flight-label-container',
                    iconSize: [80, 24],
                    iconAnchor: iconAnchor
                });
                
                if (marker) {
                    marker.setLatLng([lat, lng]);
                    marker.setIcon(customIcon);
                    return marker;
                } else {
                    return L.marker([lat, lng], { icon: customIcon, interactive: false });
                }
            };

            // Calculate dates dynamically based on current date to prevent future code rot
            const currentYear = new Date().getFullYear();
            const valenciaYears = currentYear - 2012;
            const manausYears = currentYear - 2020;
            const cgYears = currentYear - 2010;

            if (mJP && mVAL) {
                const start = mJP.getLatLng();
                const end = mVAL.getLatLng();
                const ctrl = [ (start.lat + end.lat) / 2 + 15, (start.lng + end.lng) / 2 - 15 ];
                this.labelVAL = createOrUpdateLabel(this.labelVAL, start, end, ctrl, `<div class="flight-label">✈️ 2012 (${valenciaYears} years ago)</div>`, [40, 12]);
                this.labelVAL.addTo(this.instance);
            }

            if (mJP && mMAN) {
                const start = mJP.getLatLng();
                const end = mMAN.getLatLng();
                const ctrl = [ (start.lat + end.lat) / 2 - 7, (start.lng + end.lng) / 2 ];
                this.labelMAN = createOrUpdateLabel(this.labelMAN, start, end, ctrl, `<div class="flight-label">✈️ 2020 (${manausYears} years ago)</div>`, [40, -10]);
                this.labelMAN.addTo(this.instance);
            }

            if (mJP && mCG) {
                const start = mJP.getLatLng();
                const end = mCG.getLatLng();
                const ctrl = [ (start.lat + end.lat) / 2 + 0.15, (start.lng + end.lng) / 2 ];
                this.labelCG = createOrUpdateLabel(this.labelCG, start, end, ctrl, `<div class="flight-label">🚗 2010 (${cgYears} years ago)</div>`, [40, 12]);
                
                if (isFullscreen) this.labelCG.addTo(this.instance);
                else this.labelCG.remove();
            }
        }

        setupFullscreen() {
            const expandBtn = document.getElementById('expand-map-btn');
            const mapCard = document.querySelector('.about-map-card');

            if (expandBtn && mapCard) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isFullscreen = mapCard.classList.toggle('fullscreen');
                    
                    if (isFullscreen) {
                        expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 14h6v-6M20 10h-6v6M14 10l7-7M10 14l-7 7"/></svg>`;
                        expandBtn.setAttribute('aria-label', 'Minimize Map');
                        document.body.style.overflow = 'hidden';
                        document.body.classList.add('map-fullscreen-active');
                    } else {
                        expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
                        expandBtn.setAttribute('aria-label', 'Expand Map');
                        document.body.style.overflow = '';
                        document.body.classList.remove('map-fullscreen-active');
                    }

                    this.updatePaths();
                    this.updateLabels();

                    setTimeout(() => {
                        if (this.instance) {
                            this.instance.invalidateSize();
                            this.instance.fitBounds(this.bounds, { padding: [30, 30] });
                        }
                    }, 300);
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && mapCard && mapCard.classList.contains('fullscreen')) {
                    mapCard.classList.remove('fullscreen');
                    document.body.classList.remove('map-fullscreen-active');
                    if (expandBtn) {
                        expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
                        expandBtn.setAttribute('aria-label', 'Expand Map');
                    }
                    document.body.style.overflow = '';
                    this.updatePaths();
                    this.updateLabels();

                    setTimeout(() => {
                        if (this.instance) {
                            this.instance.invalidateSize();
                            this.instance.fitBounds(this.bounds, { padding: [30, 30] });
                        }
                    }, 300);
                }
            });
        }
    }

    /**
     * Controller for Services tab sub-sections menu.
     */
    class ServicesController {
        constructor(eventBus) {
            this.eventBus = eventBus;
            this.initialized = false;
        }

        init() {
            // Decoupled activation via Event Bus
            this.eventBus.subscribe('section:changed', ({ sectionId }) => {
                if (sectionId === 'services') {
                    this.initServices();
                }
            });
        }

        initServices() {
            if (this.initialized) return;
            this.initialized = true;

            const menuItems = document.querySelectorAll('.services-menu-item');
            const serviceSections = [
                document.getElementById('service-ai-adoption'),
                document.getElementById('service-sw-mgmt'),
                document.getElementById('service-eng-mgmt'),
                document.getElementById('service-career-mentoring'),
                document.getElementById('service-pm-classes'),
                document.getElementById('service-get-started')
            ].filter(el => el !== null);

            menuItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = item.getAttribute('data-target');
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) {
                        const headerHeight = 100;
                        const elementPosition = targetEl.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                        menuItems.forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    }
                });
            });

            // Optimize window scroll listener with throttle utility
            window.addEventListener('scroll', Utils.throttle(() => {
                if (document.getElementById('services').classList.contains('active')) {
                    let currentActive = null;
                    const triggerPoint = 150;

                    serviceSections.forEach(sec => {
                        const top = sec.getBoundingClientRect().top;
                        if (top <= triggerPoint) currentActive = sec.id;
                    });

                    if (currentActive) {
                        menuItems.forEach(item => {
                            if (item.getAttribute('data-target') === currentActive) {
                                item.classList.add('active');
                            } else {
                                item.classList.remove('active');
                            }
                        });
                    }
                }
            }, 100));
        }
    }

    /**
     * Main Controller for Single Page Application (SPA) tab switching and routing.
     */
    class NavigationController {
        constructor(eventBus) {
            this.eventBus = eventBus;
            this.sections = document.querySelectorAll('.section');
            this.navLinks = document.querySelectorAll('.nav-tab');
            this.mobileMenu = document.getElementById('nav-menu');
            this.menuToggle = document.getElementById('menu-toggle');
        }

        init() {
            this.setupNavLinks();
            this.setupInnerTriggers();
            this.setupFooterSearch();
            this.setupFooterArticles();
            this.setupMobileMenu();
            this.handleInitialHash();
            this.setupPopstateListener();

            // Decoupled listener for navigation requests from other sub-controllers
            this.eventBus.subscribe('navigation:request', ({ target, scrollTo }) => {
                this.switchSection(target);
                history.pushState(null, null, `#${target}`);
                
                if (scrollTo) {
                    setTimeout(() => {
                        const el = document.getElementById(scrollTo);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                }
            });
        }

        switchSection(targetId) {
            let actualTargetId = targetId;
            let isArticleView = false;
            let articleSlug = '';

            if (targetId.startsWith('article-')) {
                actualTargetId = 'single-post';
                isArticleView = true;
                articleSlug = targetId.substring(8);
            }

            const targetSection = document.getElementById(actualTargetId);
            if (!targetSection) return;

            this.sections.forEach(sec => {
                sec.classList.toggle('active', sec.id === actualTargetId);
            });

            document.body.classList.toggle('atelier-page-active', actualTargetId === 'atelier');

            this.navLinks.forEach(link => {
                const navTarget = link.getAttribute('data-target');
                if (isArticleView && navTarget === 'articles') {
                    link.classList.add('active');
                } else {
                    link.classList.toggle('active', !isArticleView && navTarget === targetId);
                }
            });

            // Orchestrate page states decoupled via Mediator/Event Bus
            this.eventBus.publish('section:changed', {
                sectionId: actualTargetId,
                isArticleView,
                articleSlug
            });

            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (this.mobileMenu) this.mobileMenu.classList.remove('open');
            if (this.menuToggle) {
                this.menuToggle.classList.remove('open');
                this.menuToggle.setAttribute('aria-expanded', 'false');
            }
        }

        setupNavLinks() {
            this.navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = link.getAttribute('data-target');
                    this.switchSection(targetId);
                    history.pushState(null, null, `#${targetId}`);
                });
            });
        }

        setupInnerTriggers() {
            const innerTriggers = document.querySelectorAll('.nav-trigger');
            innerTriggers.forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = trigger.getAttribute('data-target');
                    this.switchSection(targetId);
                    history.pushState(null, null, `#${targetId}`);

                    if (trigger.id === 'get-started-contact-btn') {
                        setTimeout(() => {
                            const aboutContact = document.getElementById('about-contact');
                            if (aboutContact) aboutContact.scrollIntoView({ behavior: 'smooth' });
                        }, 300);
                    }
                });
            });
        }

        setupFooterSearch() {
            const form = document.getElementById('footer-search-form');
            const input = document.getElementById('footer-search-input');
            if (form && input) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const query = input.value.trim();
                    if (query) {
                        this.switchSection('articles');
                        history.pushState(null, null, '#articles');
                        
                        const mainSearchInput = document.getElementById('search-input');
                        if (mainSearchInput) {
                            mainSearchInput.value = query;
                            // Trigger input event to let ArticlesController do the search
                            mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        input.value = '';
                    }
                });
            }
        }

        setupFooterArticles() {
            const links = document.querySelectorAll('.footer-article-link');
            links.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const slug = link.getAttribute('data-slug');
                    this.switchSection('article-' + slug);
                    history.pushState(null, null, '#article-' + slug);
                });
            });
        }

        setupMobileMenu() {
            if (this.menuToggle && this.mobileMenu) {
                this.menuToggle.addEventListener('click', () => {
                    const isOpen = this.mobileMenu.classList.toggle('open');
                    this.menuToggle.classList.toggle('open');
                    this.menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });

                document.addEventListener('click', (e) => {
                    if (!this.menuToggle.contains(e.target) && !this.mobileMenu.contains(e.target)) {
                        this.mobileMenu.classList.remove('open');
                        this.menuToggle.classList.remove('open');
                        this.menuToggle.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        }

        handleInitialHash() {
            let hash = window.location.hash.substring(1);
            if (hash) {
                if (hash === 'contact') {
                    hash = 'about';
                    history.replaceState(null, null, '#about');
                    setTimeout(() => {
                        const contact = document.getElementById('about-contact');
                        if (contact) contact.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                }
                if (hash.startsWith('article-') || document.getElementById(hash)) {
                    this.switchSection(hash);
                }
            }
        }

        setupPopstateListener() {
            window.addEventListener('popstate', () => {
                let hash = window.location.hash.substring(1) || 'home';
                if (hash === 'contact') {
                    hash = 'about';
                    history.replaceState(null, null, '#about');
                    setTimeout(() => {
                        const contact = document.getElementById('about-contact');
                        if (contact) contact.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                }
                if (hash.startsWith('article-') || document.getElementById(hash)) {
                    this.switchSection(hash);
                }
            });
        }
    }

    // Central Application Bootstrapping
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Initialize data dependencies
        const { carouselImages, articles, publications, mapCities, atelierPieces } = window.SITE_DATA || {};
        if (!carouselImages) {
            console.error('SITE_DATA is missing. Verify data.js is loaded prior to main.js');
            return;
        }

        // 2. Initialize Event Bus mediator
        const eventBus = new EventBus();

        // 3. Initialize Controllers
        const carousel = new CarouselController(carouselImages);
        const publicationsCtrl = new PublicationsController(publications);
        const articlesCtrl = new ArticlesController(articles, eventBus);
        const mapCtrl = new MapController(mapCities, eventBus);
        const atelierCtrl = new AtelierController(atelierPieces, eventBus);
        const lightboxCtrl = new LightboxController(mapCities, atelierPieces, eventBus);
        const servicesCtrl = new ServicesController(eventBus);
        const navCtrl = new NavigationController(eventBus);

        // 4. Initialize components
        carousel.init();
        publicationsCtrl.init();
        lightboxCtrl.init();
        articlesCtrl.init();
        atelierCtrl.init();
        mapCtrl.init();
        servicesCtrl.init();
        navCtrl.init();

        // Expose application instances to window for diagnostics/extensibility (Namespace Pattern)
        window.App = {
            eventBus,
            controllers: {
                carousel,
                publications: publicationsCtrl,
                articles: articlesCtrl,
                map: mapCtrl,
                atelier: atelierCtrl,
                lightbox: lightboxCtrl,
                services: servicesCtrl,
                navigation: navCtrl
            }
        };
    });

})();
