// Check-in Map Application
class CheckinMap {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.userLocation = null;
        this.checkins = [];
        
        this.init();
    }

    init() {
        // Initialize the map
        this.initMap();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Try to get user's location immediately
        this.requestUserLocation();
    }

    initMap() {
        // Create map centered on a default location (will be updated when user location is found)
        this.map = L.map('map', {
            center: [40.7128, -74.0060], // Default to New York
            zoom: 13,
            zoomControl: false // We'll add it manually to control position
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Add click event to map
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });
    }

    setupEventListeners() {
        const locateBtn = document.getElementById('locate-btn');
        const checkinBtn = document.getElementById('checkin-btn');

        locateBtn.addEventListener('click', () => {
            this.requestUserLocation();
        });

        checkinBtn.addEventListener('click', () => {
            this.performCheckin();
        });
    }

    requestUserLocation() {
        this.showStatus('Getting your location...', 'info');
        this.setButtonLoading('locate-btn', true);

        if (!navigator.geolocation) {
            this.showStatus('Geolocation is not supported by your browser', 'error');
            this.setButtonLoading('locate-btn', false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.onLocationFound(position);
                this.setButtonLoading('locate-btn', false);
            },
            (error) => {
                this.onLocationError(error);
                this.setButtonLoading('locate-btn', false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );

        // Watch position for real-time updates
        navigator.geolocation.watchPosition(
            (position) => {
                this.onLocationFound(position);
            },
            (error) => {
                console.error('Location watch error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000 // 1 minute
            }
        );
    }

    onLocationFound(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        this.userLocation = { lat, lng, accuracy };

        // Update map view to user's location
        this.map.setView([lat, lng], 15);

        // Remove existing user marker
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        // Create custom icon for user location
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #667eea; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        // Add user marker
        this.userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(this.map)
            .bindPopup('Your location')
            .openPopup();

        // Add accuracy circle
        L.circle([lat, lng], {
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.1,
            radius: accuracy
        }).addTo(this.map);

        this.showStatus('Location found successfully!', 'success');
    }

    onLocationError(error) {
        let message = 'Unable to retrieve your location';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied. Please enable location services.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
        }

        this.showStatus(message, 'error');
    }

    onMapClick(e) {
        const { lat, lng } = e.latlng;
        
        // Remove any existing temporary markers
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
        }

        // Add temporary marker at clicked location
        this.tempMarker = L.marker([lat, lng])
            .addTo(this.map)
            .bindPopup('Potential check-in location')
            .openPopup();

        this.showStatus('Click "Check In" to confirm this location', 'info');
    }

    performCheckin() {
        let checkinLocation;

        if (this.tempMarker) {
            // Use the clicked location
            const latlng = this.tempMarker.getLatLng();
            checkinLocation = {
                lat: latlng.lat,
                lng: latlng.lng,
                type: 'manual'
            };
        } else if (this.userLocation) {
            // Use the user's current location
            checkinLocation = {
                lat: this.userLocation.lat,
                lng: this.userLocation.lng,
                type: 'auto'
            };
        } else {
            this.showStatus('Please get your location first or click on the map', 'error');
            return;
        }

        // Create check-in record
        const checkin = {
            id: Date.now(),
            location: checkinLocation,
            timestamp: new Date().toISOString(),
            note: prompt('Add a note for this check-in (optional):') || ''
        };

        // Add to check-ins array
        this.checkins.push(checkin);

        // Create permanent marker for check-in
        const checkinIcon = L.divIcon({
            className: 'checkin-marker',
            html: '<div style="background: #28a745; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        L.marker([checkinLocation.lat, checkinLocation.lng], { icon: checkinIcon })
            .addTo(this.map)
            .bindPopup(`
                <strong>Check-in</strong><br>
                ${new Date(checkin.timestamp).toLocaleString()}<br>
                ${checkin.note ? `<em>${checkin.note}</em><br>` : ''}
                <small>Type: ${checkin.type === 'auto' ? 'Auto' : 'Manual'}</small>
            `);

        // Clean up temporary marker
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }

        this.showStatus(`Successfully checked in at ${new Date(checkin.timestamp).toLocaleTimeString()}`, 'success');
        console.log('Check-in recorded:', checkin);
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }, 5000);
        }
    }

    setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    // Utility methods for future expansion
    getCheckins() {
        return this.checkins;
    }

    clearCheckins() {
        this.checkins = [];
        // Note: In a real implementation, you'd want to remove markers from map too
    }

    exportCheckins() {
        const dataStr = JSON.stringify(this.checkins, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `checkins_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
}

// Initialize the map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.checkinMap = new CheckinMap();
});

// Handle page visibility changes for better mobile experience
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.checkinMap) {
        // Refresh location when page becomes visible again
        window.checkinMap.requestUserLocation();
    }
});
