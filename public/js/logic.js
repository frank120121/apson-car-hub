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
        currentView: 'home', // 'home', 'favorites', 'profile'
        
        selectedCar: null, 
        searchOpen: false,
        loading: true,
        error: null,

        // LIFECYCLE
        async init() {
            console.log("App initialized.");
            
            // Load Favorites from phone
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
                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido",
                        price: data.price || 0,
                        year: data.year || "2000",
                        km: data.mileage || "0",
                        trans: data.transmission || "Auto",
                        // Use placeholder if no image
                        image: (data.images && data.images.length > 0) ? data.images[0] : 'https://placehold.co/600x400?text=Sin+Foto',
                        // Flags
                        verified: data.verified || false,
                        promoted: data.promoted || false, 
                        warranty: data.warranty || false,
                        legal: data.legal_status || "Nacional"
                    };
                });
                
            } catch (err) {
                console.error("Firebase Error:", err);
                if (err.message.includes("requires an index")) {
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

            // 1. Filter by Tab (Favorites vs Home)
            if (this.currentView === 'favorites') {
                list = list.filter(car => this.favorites.includes(car.id));
            }

            // 2. Filter by Search / Chips
            let result = list;
            if (this.search !== '') {
                const lowerSearch = this.search.toLowerCase();
                
                result = list.filter(car => {
                    // Text Match
                    const matchesText = car.model.toLowerCase().includes(lowerSearch) || 
                                      car.year.toString().includes(lowerSearch);
                    
                    // Chip Logic
                    if (lowerSearch === 'trokas') {
                        return car.model.toLowerCase().includes('lobo') || 
                               car.model.toLowerCase().includes('sierra') ||
                               car.model.toLowerCase().includes('silverado') ||
                               car.model.toLowerCase().includes('tacoma') ||
                               car.model.toLowerCase().includes('ram');
                    }
                    if (lowerSearch === 'nacional') return car.legal.toLowerCase() === 'nacional';
                    if (lowerSearch === 'economico') return car.price < 150000;
                    if (lowerSearch === '4x4') return car.model.toLowerCase().includes('4x4');

                    return matchesText || car.legal.toLowerCase().includes(lowerSearch);
                });
            }

            // 3. Sort (Promoted First)
            return result.sort((a, b) => {
                if (a.promoted && !b.promoted) return -1;
                if (!a.promoted && b.promoted) return 1;
                return 0; // Keep original order
            });
        },

        // Helper for Profile Tab
        get profileView() {
            return this.currentView === 'profile';
        },

        // UTILS
        formatMoney(amount) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
        },

        // UI ACTIONS
        openSearch() {
            this.searchOpen = true;
            // Fix: Use getElementById to bypass Alpine scope issues
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
        }
    }
}

// 3. START ALPINE
Alpine.start();