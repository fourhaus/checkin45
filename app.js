// Check-in Instructions Framework
class CheckInApp {
    constructor() {
        this.config = null;
        this.currentTopic = 0;
        this.currentStep = 0;
        this.map = null;
        this.markers = {};
        this.routes = {};
        this.activeRoute = null;

        this.init();
    }

    async init() {
        try {
            // Load configuration
            await this.loadConfig();

            // Initialize splash screen
            this.initSplash();

            // Initialize map
            this.initMap();

            // Render topic tabs
            this.renderTopicTabs();

            // Load initial topic
            this.goToTopic(0);

            // Setup modal handlers
            this.setupModalHandlers();

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load check-in instructions');
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config = await response.json();
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    }

    initSplash() {
        const splash = document.querySelector('.logo-splash-container');
        const logoSplash = document.querySelector('.logo-splash');
        const headerLogo = document.querySelector('.app-header .logo');

        setTimeout(() => {
            const logoRect = headerLogo.getBoundingClientRect();
            const splashRect = logoSplash.getBoundingClientRect();

            const offsetX = logoRect.left + logoRect.width / 2 - (splashRect.left + splashRect.width / 2);
            const offsetY = logoRect.top + logoRect.height / 2 - (splashRect.top + splashRect.height / 2);

            logoSplash.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            logoSplash.style.width = `${logoRect.width}px`;
            logoSplash.style.height = `${logoRect.height}px`;

            setTimeout(() => {
                logoSplash.style.opacity = 0;
            }, 2500);
        }, 1500);

        logoSplash.addEventListener("transitionend", () => {
            splash.style.display = "none";
        });
    }

    initMap() {
        try {
            if (!this.config.map) return;

            // Initialize map
            this.map = L.map('map', { zoomControl: false })
                .setView(this.config.map.center, this.config.map.zoom);

            // Add tile layer
            L.tileLayer(this.config.map.tileLayer, {
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(this.map);

            // Add zoom control
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);

            // Create main location markers
            this.createMainMarkers();

            // Initialize markers and routes for all topics
            this.initializeMapElements();
        } catch (error) {
            console.error('Error initializing map:', error);
            throw error;
        }
    }

    initializeMapElements() {
        try {
            this.config.topics.forEach(topic => {
                if (!topic.useMap) return;

                // Initialize markers array for this topic
                this.markers[topic.id] = [];

                // Initialize routes array for this topic
                this.routes[topic.id] = [];

                // Create markers for steps that have locations
                topic.steps.forEach((step, index) => {
                    if (step.location) {
                        const marker = this.createMarker(step, topic);
                        if (marker) {
                            this.markers[topic.id].push(marker);
                        }
                    }
                });

                // Create routes
                if (topic.routes) {
                    topic.routes.forEach((route, index) => {
                        // Skip empty routes
                        if (route && route.points && route.points.length > 0) {
                            try {
                                const polyline = L.polyline(route.points, {
                                    color: route.color,
                                    weight: route.weight
                                });
                                this.routes[topic.id].push(polyline);
                                console.log(`Created route ${index} for topic ${topic.id}`);
                            } catch (error) {
                                console.error(`Error creating route ${index} for topic ${topic.id}:`, error);
                                this.routes[topic.id].push(null);
                            }
                        } else {
                            // Push null for empty routes to maintain index alignment
                            this.routes[topic.id].push(null);
                            console.log(`Route ${index} for topic ${topic.id} is empty, pushing null`);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error initializing map elements:', error);
            throw error;
        }
    }

    createMarker(step, topic) {
        let location = step.location;

        // Check if location is a marker placeholder like {lockbox}
        if (typeof location === 'string' && location.startsWith('{') && location.endsWith('}')) {
            const markerKey = location.slice(1, -1); // Remove { and }
            console.log(`Reusing main marker: ${markerKey}`);

            // Don't create a new marker - return null since main marker already exists
            // The main marker is created by createMainMarkers()
            return null;
        }

        const iconHtml = this.getBootstrapIcon(topic.id);
        const icon = iconHtml ?
            L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-wrapper"><i class="${iconHtml}"></i></div>`,
                iconAnchor: [15, 15]
            }) : null;

        const marker = L.marker([location.lat, location.lng], { icon });

        if (location.popup) {
            marker.bindPopup(location.popup);
        }

        return marker;
    }

    getBootstrapIcon(topicId) {
        // All steps use normal pin icons
        return 'bi bi-geo-alt-fill';
    }

    getTopicIcon(topicId) {
        const iconMap = {
            'lockbox': 'fas fa-lock',
            'parking': 'fas fa-car',
            'home': 'fas fa-home',
            'building-entry': 'fas fa-door-open',
            'amenities': 'fas fa-swimming-pool'
        };
        return iconMap[topicId] || 'fas fa-map-marker-alt';
    }

    createMainMarkers() {
        if (!this.config.markers) return;

        Object.entries(this.config.markers).forEach(([key, location]) => {
            // Hardcode icons for main markers
            let iconHtml;
            switch (key) {
                case 'lockbox':
                    iconHtml = 'bi bi-lock';
                    break;
                case 'parking':
                    iconHtml = 'bi bi-car-front';
                    break;
                case 'home':
                    iconHtml = 'bi bi-house';
                    break;
                default:
                    iconHtml = 'bi bi-geo-alt-fill';
            }


            const icon = iconHtml ?
                L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="marker-wrapper"><i class="${iconHtml}"></i></div>`,
                    iconAnchor: [15, 15]
                }) : null;

            const marker = L.marker([location.lat, location.lng], { icon });

            if (location.popup) {
                marker.bindPopup(location.popup);
            }

            marker.addTo(this.map);
        });
    }

    renderTopicTabs() {
        try {
            const tabsContainer = document.getElementById('topicTabs');
            tabsContainer.innerHTML = '';

            this.config.topics.forEach((topic, index) => {
                const tab = document.createElement('button');
                tab.className = 'topic-tab';
                tab.id = `tab-${index}`;
                tab.onclick = () => this.goToTopic(index);

                const icon = this.getTopicIcon(topic.id);
                console.log(`Topic: ${topic.id}, Icon: ${icon}`);
                tab.innerHTML = `<i class="${icon}"></i><span class="tab-text">${topic.title}</span>`;
                tabsContainer.appendChild(tab);
            });

            // Add General Info tab
            const generalTab = document.createElement('button');
            generalTab.className = 'topic-tab';
            generalTab.id = 'tab-general';
            generalTab.onclick = () => this.showGeneralInfo();
            generalTab.innerHTML = `<i class="fas fa-info-circle"></i><span class="tab-text">General Info</span>`;
            tabsContainer.appendChild(generalTab);

        } catch (error) {
            console.error('Error rendering topic tabs:', error);
        }
    }

    goToTopic(topicIndex) {
        if (topicIndex < 0 || topicIndex >= this.config.topics.length) return;

        this.currentTopic = topicIndex;
        this.currentStep = 0;
        this.renderStep();
        this.updateActiveTab();
    }

    renderStep() {
        const topic = this.config.topics[this.currentTopic];
        const step = topic.steps[this.currentStep];

        // Update step navigation
        document.getElementById('stepText').innerHTML =
            `<strong>${step.title}</strong><br>${step.text}`;

        document.getElementById('prevBtn').disabled = this.currentStep === 0;
        document.getElementById('nextBtn').disabled = this.currentStep === topic.steps.length - 1;

        // Show/hide map or content
        if (topic.useMap) {
            this.showMapView(topic, step);
        } else {
            this.showContentView(step);
        }

        // Show step navigation
        document.getElementById('stepNav').style.display = 'flex';
    }

    showMapView(topic, step) {
        document.getElementById('map').style.display = 'block';
        document.getElementById('content').style.display = 'none';

        // Invalidate map size to fix rendering issues
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 100);

        // Hide all markers and routes from other topics
        this.hideAllMapElements();

        // Show current topic markers and routes
        this.showTopicElements(topic.id);

        // Show specific route for this step if available
        if (topic.routes && topic.routes[this.currentStep]) {
            this.showRoute(topic.id, this.currentStep);
        }

        // Open popup for this step's location
        if (step.location) {
            this.openPopupForStep(step);
        }
    }

    showContentView(step) {
        document.getElementById('map').style.display = 'none';
        document.getElementById('content').style.display = 'block';

        const contentHtml = `
            <div class="step-content">
                ${step.media ? `<img src="${step.media}" alt="${step.title}">` : ''}
            </div>
        `;

        document.getElementById('content').innerHTML = contentHtml;
    }

    hideAllMapElements() {
        Object.keys(this.markers).forEach(topicId => {
            if (this.markers[topicId]) {
                this.markers[topicId].forEach(marker => {
                    if (this.map.hasLayer(marker)) {
                        this.map.removeLayer(marker);
                    }
                });
            }
        });

        Object.keys(this.routes).forEach(topicId => {
            if (this.routes[topicId]) {
                this.routes[topicId].forEach(route => {
                    if (route && this.map.hasLayer(route)) {
                        this.map.removeLayer(route);
                    }
                });
            }
        });

        if (this.activeRoute && this.map.hasLayer(this.activeRoute)) {
            this.map.removeLayer(this.activeRoute);
        }
    }

    showTopicElements(topicId) {
        // Show markers
        if (this.markers[topicId]) {
            this.markers[topicId].forEach(marker => {
                if (!this.map.hasLayer(marker)) {
                    marker.addTo(this.map);
                }
            });
        }

        // Routes are now shown individually per step, not all at once
    }

    showRoute(topicId, routeIndex) {
        try {
            // First, hide all routes for this topic
            if (this.routes[topicId]) {
                this.routes[topicId].forEach(route => {
                    if (route && this.map.hasLayer(route)) {
                        this.map.removeLayer(route);
                    }
                });
            }

            // Also hide any active route
            if (this.activeRoute && this.map.hasLayer(this.activeRoute)) {
                this.map.removeLayer(this.activeRoute);
            }

            // Now show only specific route for this step (if it exists and is not null)
            if (this.routes[topicId] && this.routes[topicId][routeIndex] !== null) {
                this.activeRoute = this.routes[topicId][routeIndex];
                this.activeRoute.addTo(this.map);
                console.log(`Showing route ${routeIndex} for topic ${topicId}`);
            } else {
                console.log(`No route found for topic ${topicId}, index ${routeIndex} (null or undefined)`);
            }
        } catch (error) {
            console.error('Error in showRoute:', error);
        }
    }

    openPopupForStep(step) {
        if (!step.location) return;

        const topic = this.config.topics[this.currentTopic];
        const stepIndex = this.currentStep;

        // Get actual location (handle placeholders)
        let location = step.location;
        let marker = null;

        console.log(`Step location:`, location);

        if (typeof location === 'string' && location.startsWith('{') && location.endsWith('}')) {
            const markerKey = location.slice(1, -1);
            console.log(`Using main marker: ${markerKey}`);

            // For placeholders, we need to find the main marker on the map
            // Since main markers are added directly to the map, we need to find them
            if (this.config.markers && this.config.markers[markerKey]) {
                location = this.config.markers[markerKey];
                console.log(`Resolved location:`, location);

                // Find the main marker by checking its position
                this.map.eachLayer((layer) => {
                    if (layer instanceof L.Marker) {
                        const markerLatLng = layer.getLatLng();
                        if (Math.abs(markerLatLng.lat - location.lat) < 0.0001 &&
                            Math.abs(markerLatLng.lng - location.lng) < 0.0001) {
                            marker = layer;
                            console.log(`Found main marker at position:`, markerLatLng);
                        }
                    }
                });
            }
        } else {
            // For regular coordinates, use the step marker
            if (this.markers[topic.id] && this.markers[topic.id][stepIndex]) {
                marker = this.markers[topic.id][stepIndex];
            }
        }

        // Fly to location and open popup
        if (location && location.lat && location.lng) {
            this.map.flyTo([location.lat, location.lng], 18);

            if (marker) {
                marker.openPopup();
            }

        }
    }

    showGeneralInfo() {
        this.currentTopic = -1; // Special value for general info
        this.currentStep = 0;

        document.getElementById('map').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        document.getElementById('stepNav').style.display = 'none';

        const infoHtml = `
            <div class="info-section">
                <h3><i class="bi bi-info-circle"></i> Property Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Address:</strong> ${this.config.property.address}
                    </div>
                    <div class="info-item">
                        <strong>Check-in / Check-out:</strong> ${this.config.property.checkInTime} / ${this.config.property.checkOutTime}
                    </div>
                    <div class="info-item">
                        <strong>Wi-Fi Network:</strong> ${this.config.property.wifi.network}
                    </div>
                    <div class="info-item">
                        <strong>Wi-Fi Password:</strong> ${this.config.property.wifi.password}
                    </div>
                    <div class="info-item">
                        <strong>Amenities:</strong> ${this.config.property.amenitiesLevel}
                    </div>
                    <div class="info-item">
                        <strong>Parking:</strong> ${this.config.property.parkingLevel}, Spot ${this.config.property.parkingSpot}
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h3><i class="bi bi-exclamation-triangle"></i> House Rules</h3>
                <ul class="rules-list">
                    ${this.config.generalInfo.houseRules.map(rule => `<li>${rule}</li>`).join('')}
                </ul>
            </div>
        `;

        document.getElementById('content').innerHTML = infoHtml;
        this.updateActiveTab();
    }

    updateActiveTab() {
        document.querySelectorAll('.topic-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        if (this.currentTopic === -1) {
            document.getElementById('tab-general')?.classList.add('active');
        } else {
            document.getElementById(`tab-${this.currentTopic}`)?.classList.add('active');
        }
    }

    showError(message) {
        document.getElementById('content').innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle"></i> ${message}
            </div>
        `;
        document.getElementById('content').style.display = 'block';
        document.getElementById('map').style.display = 'none';
        document.getElementById('stepNav').style.display = 'none';
    }

    // Public methods for button handlers
    nextStep() {
        const topic = this.config.topics[this.currentTopic];
        if (this.currentStep < topic.steps.length - 1) {
            this.currentStep++;
            this.renderStep();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    setupModalHandlers() {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImg');

        // Close modal handlers
        document.querySelector('.modal-close').onclick = () => {
            modal.style.display = 'none';
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Image click handlers
        document.addEventListener('click', (e) => {
            const img = e.target.closest('.step-content img, .popup-content img, .leaflet-popup-content img');
            if (!img) return;

            modal.style.display = 'flex';
            modalImg.src = img.src;
            document.body.style.overflow = 'hidden';
        });
    }

    // Routes are now shown individually per step, not all at once
}

// Global functions for button onclick handlers
let app;

function nextStep() {
    if (app) app.nextStep();
}

function prevStep() {
    if (app) app.prevStep();
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new CheckInApp();
});
