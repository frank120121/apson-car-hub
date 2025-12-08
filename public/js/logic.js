// public/js/logic.js

// 1. IMPORTS
import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

// 2. APP LOGIC
window.app = function() {
    return {
        // DATA STATE
        cars: [],
        favorites: [],
        search: '',
        currentView: 'home',
        
        // UI STATE
        selectedCar: null, 
        searchOpen: false,
        loading: true,
        error: null,

        // AUTH STATE
        isLoggedIn: false,
        user: null,

        // LIFECYCLE
        async init() {
            console.log("App initialized.");
            
            // Load Favorites
            const saved = localStorage.getItem('apson_favorites');
            if (saved) this.favorites = JSON.parse(saved);

            await this.fetchCars();
        },

        // FETCH FROM FIREBASE
        async fetchCars() {
            this.loading = true;
            this.error = null;
            
            try {
                // Get top 20 newest cars
                const q = query(collection(db, "cars"), orderBy("created_at", "desc"), limit(20));
                const querySnapshot = await getDocs(q);
                
                this.cars = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    
                    // Handle Date (Convert Firebase Timestamp to JS Date)
                    let date = new Date();
                    if (data.created_at && data.created_at.toDate) {
                        date = data.created_at.toDate();
                    }

                    // Auto-Detect 4x4
                    const is4x4 = (data.model || "").toLowerCase().includes("4x4") || 
                                  (data.transmission || "").toLowerCase().includes("4x4");

                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido",
                        price: data.price || 0,
                        year: data.year || "2000",
                        km: data.mileage || "0",
                        trans: data.transmission || "Auto",
                        // Smart Image Loading
                        image: (data.images && data.images.length > 0) ? data.images[0] : 'https://placehold.co/600x400?text=Sin+Foto',
                        
                        // Flags & Metadata
                        verified: data.verified || false,
                        promoted: data.promoted || false, 
                        warranty: data.warranty || false,
                        legal: data.legal_status || "Nacional",
                        is4x4: is4x4,
                        date: date
                    };
                });
                
            } catch (err) {
                console.error("Firebase Error:", err);
                if (err.message && err.message.includes("requires an index")) {
                    this.error = "Falta índice en Firebase (Revisa consola F12).";
                } else {
                    this.error = "No se pudieron cargar los carros.";
                }
            } finally {
                this.loading = false;
            }
        },

        // TOGGLE FAVORITE
        toggleFavorite(id) {
            if (this.favorites.includes(id)) {
                this.favorites = this.favorites.filter(favId => favId !== id);
            } else {
                this.favorites.push(id);
            }
            localStorage.setItem('apson_favorites', JSON.stringify(this.favorites));
        },

        // COMPUTED: SEARCH + FILTER + SORT
        get filteredCars() {
            let list = this.cars;

            // 1. Filter by Tab
            if (this.currentView === 'favorites') {
                list = list.filter(car => this.favorites.includes(car.id));
            }

            // 2. Filter by Search / Chips
            let result = list;
            if (this.search !== '') {
                const lowerSearch = this.search.toLowerCase();
                
                result = list.filter(car => {
                    const matchesText = car.model.toLowerCase().includes(lowerSearch) || 
                                      car.year.toString().includes(lowerSearch);
                    
                    if (lowerSearch === 'trokas') {
                        return car.model.toLowerCase().includes('lobo') || 
                               car.model.toLowerCase().includes('sierra') ||
                               car.model.toLowerCase().includes('silverado') ||
                               car.model.toLowerCase().includes('tacoma') ||
                               car.model.toLowerCase().includes('ram');
                    }
                    if (lowerSearch === 'nacional') return car.legal.toLowerCase() === 'nacional';
                    if (lowerSearch === 'economico') return car.price < 150000;
                    if (lowerSearch === '4x4') return car.is4x4 || car.model.toLowerCase().includes('4x4');

                    return matchesText || car.legal.toLowerCase().includes(lowerSearch);
                });
            }

            // 3. Sort (Promoted First)
            return result.sort((a, b) => {
                if (a.promoted && !b.promoted) return -1;
                if (!a.promoted && b.promoted) return 1;
                return 0; 
            });
        },

        // VIEW HELPERS
        get profileView() {
            return this.currentView === 'profile';
        },

        // FORMATTERS
        formatMoney(amount) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
        },

        timeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " años";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " mes";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + "d";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + "h";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " min";
            return "Hace instantes";
        },

        // UI ACTIONS
        openSearch() {
            this.searchOpen = true;
            // Safe focus
            setTimeout(() => {
                const input = document.getElementById('mobileSearchInput');
                if (input) input.focus();
            }, 100);
        },

        closeSearch() {
            this.searchOpen = false;
        },

        openCar(car) {
            this.selectedCar = car;
            document.body.style.overflow = 'hidden'; 
        },

        closeCar() {
            this.selectedCar = null;
            document.body.style.overflow = 'auto';
        },

        // AUTH ACTIONS
        login() {
            this.loading = true;
            setTimeout(() => {
                this.isLoggedIn = true;
                this.user = { name: "Usuario Demo", email: "demo@apson.com" };
                this.loading = false;
            }, 1000);
        },

        logout() {
            this.isLoggedIn = false;
            this.user = null;
        }
    }
}

// 3. START ALPINE
Alpine.start();