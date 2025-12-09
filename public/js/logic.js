// public/js/logic.js

// 1. IMPORTS
import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

// 2. APP LOGIC
window.app = function() {
    return {
        // --- DATA ---
        cars: [],
        favorites: [],
        
        // --- UI STATE ---
        currentView: 'home', // 'home', 'favorites', 'profile'
        selectedCar: null,
        loading: true,
        error: null,
        
        // --- MODAL STATES ---
        searchOpen: false,  // Top Search Bar (Typewriter)
        sortOpen: false,    // Bottom Sheet Sort
        filterOpen: false,  // Sidebar Filter Modal
        introOpen: true,    // Splash Screen

        // --- FILTER & SORT STATE ---
        search: '',
        sortBy: 'relevance', // 'relevance', 'price_asc', 'price_desc', 'km_asc', 'km_desc', 'year_desc'
        
        // Filter Variables
        activeFilterTab: 'price', // Controls the sidebar in Filter Modal
        minPrice: '',
        maxPrice: '',
        selectedBrands: [],

        // --- PROMOS (Rotation) ---
        promos: [
            {
                title: "¿Te falta capital?",
                desc: "Obtén tu crédito automotriz con tasa preferencial.",
                btn: "Simular Crédito",
                link: "https://wa.me/526333331107?text=Me interesa crédito",
                icon: "🏦",
                color: "from-blue-900 to-blue-700",
                tag: "Financiamiento"
            },
            {
                title: "¿Vendes tu auto?",
                desc: "Recibe una oferta inmediata y segura hoy mismo.",
                btn: "Cotizar Ahora",
                link: "sell.html",
                icon: "🤝",
                color: "from-purple-900 to-purple-700",
                tag: "Vender"
            },
            {
                title: "Garantía Extendida",
                desc: "Protege tu inversión con nuestra cobertura mecánica.",
                btn: "Ver Planes",
                link: "https://wa.me/526333331107?text=Me interesa garantía",
                icon: "🛡️",
                color: "from-emerald-900 to-teal-700",
                tag: "Garantía"
            }
        ],

        // --- AUTH STATE ---
        isLoggedIn: false,
        user: null,

        // --- LIFECYCLE ---
        async init() {
            console.log("App initialized.");
            const saved = localStorage.getItem('apson_favorites');
            if (saved) this.favorites = JSON.parse(saved);
            await this.fetchCars();
        },

        // --- FETCH ---
        async fetchCars() {
            this.loading = true;
            this.error = null;
            try {
                const q = query(collection(db, "cars"), orderBy("created_at", "desc"), limit(50));
                const querySnapshot = await getDocs(q);
                
                this.cars = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    let date = new Date();
                    if (data.created_at && data.created_at.toDate) date = data.created_at.toDate();

                    // Normalize Data
                    const is4x4 = (data.model || "").toLowerCase().includes("4x4") || 
                                  (data.transmission || "").toLowerCase().includes("4x4");
                    
                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido",
                        // Ensure numeric types for sorting
                        price: Number(data.price) || 0,
                        year: Number(data.year) || 2000,
                        km: Number(data.mileage) || 0,
                        trans: data.transmission || "Auto",
                        image: (data.images && data.images.length > 0) ? data.images[0] : 'https://placehold.co/600x400?text=Sin+Foto',
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
                this.error = "Error cargando inventario.";
            } finally {
                this.loading = false;
            }
        },

        // --- CORE LOGIC (Sort & Filter) ---
        get filteredCars() {
            let list = this.cars;

            // 1. Favorites Tab
            if (this.currentView === 'favorites') {
                list = list.filter(car => this.favorites.includes(car.id));
            }

            // 2. Apply Filters
            list = list.filter(car => {
                // Price Filter
                if (this.minPrice && car.price < Number(this.minPrice)) return false;
                if (this.maxPrice && car.price > Number(this.maxPrice)) return false;

                // Brand Filter
                if (this.selectedBrands.length > 0) {
                     // Check if model string contains any of the selected brands
                     const modelLower = car.model.toLowerCase();
                     const hasBrand = this.selectedBrands.some(brand => modelLower.includes(brand.toLowerCase()));
                     if (!hasBrand) return false;
                }

                // Search Filter
                if (this.search !== '') {
                    const lowerSearch = this.search.toLowerCase();
                    const matchesText = car.model.toLowerCase().includes(lowerSearch) || 
                                      car.year.toString().includes(lowerSearch);
                    
                    if (lowerSearch === 'trokas') return car.model.toLowerCase().includes('lobo') || car.model.toLowerCase().includes('sierra') || car.model.toLowerCase().includes('silverado') || car.model.toLowerCase().includes('tacoma') || car.model.toLowerCase().includes('ram') || car.model.toLowerCase().includes('ranger') || car.model.toLowerCase().includes('colorado');
                    if (lowerSearch === 'nacional') return car.legal.toLowerCase() === 'nacional';
                    if (lowerSearch === '4x4') return car.is4x4;
                    if (lowerSearch === 'economico') return car.price < 200000;

                    if (!matchesText) return false;
                }
                return true;
            });

            // 3. Apply Sort
            return list.sort((a, b) => {
                // Promoted always top
                if (a.promoted && !b.promoted) return -1;
                if (!a.promoted && b.promoted) return 1;

                switch (this.sortBy) {
                    case 'price_asc': return a.price - b.price;
                    case 'price_desc': return b.price - a.price;
                    case 'km_asc': return a.km - b.km;
                    case 'km_desc': return b.km - a.km;
                    case 'year_desc': return b.year - a.year;
                    case 'year_asc': return a.year - b.year;
                    case 'relevance': default: return b.date - a.date;
                }
            });
        },

        // --- ACTIONS ---
        toggleFavorite(id) {
            if (this.favorites.includes(id)) {
                this.favorites = this.favorites.filter(favId => favId !== id);
            } else {
                this.favorites.push(id);
            }
            localStorage.setItem('apson_favorites', JSON.stringify(this.favorites));
        },

        // Sort Actions
        openSort() { this.sortOpen = true; document.body.style.overflow = 'hidden'; },
        closeSort() { this.sortOpen = false; document.body.style.overflow = 'auto'; },
        applySort(val) { 
            this.sortBy = val; 
            this.closeSort(); 
            window.scrollTo({top:0, behavior:'smooth'}); 
        },

        // Filter Actions
        openFilter() { this.filterOpen = true; document.body.style.overflow = 'hidden'; },
        closeFilter() { this.filterOpen = false; document.body.style.overflow = 'auto'; },
        clearFilters() {
            this.minPrice = '';
            this.maxPrice = '';
            this.selectedBrands = [];
            this.search = '';
            this.closeFilter();
        },
        
        // Search Actions
        openSearch() { 
            this.searchOpen = true; 
            setTimeout(() => document.getElementById('mobileSearchInput')?.focus(), 100); 
        },
        closeSearch() { this.searchOpen = false; },

        // Car Modal Actions
        openCar(car) { this.selectedCar = car; document.body.style.overflow = 'hidden'; },
        closeCar() { this.selectedCar = null; document.body.style.overflow = 'auto'; },

        // Enter App (Splash Screen)
        enterApp(action) {
            if (action === 'vender') {
                this.startSelling();
            } else if (action === 'cambiar') {
                window.location.href = 'https://wa.me/526333331107?text=Quiero cambiar mi auto';
                this.introOpen = false;
            } else if (action === 'comprar') {
                this.introOpen = false;
                window.scrollTo({top:0, behavior:'smooth'});
            }
        },

        // Selling Gatekeeper
        startSelling() {
            if (this.isLoggedIn) {
                window.location.href = 'sell.html';
            } else {
                this.introOpen = false;
                this.currentView = 'profile';
                window.scrollTo({top:0, behavior:'smooth'});
            }
        },

        // Auth
        login() { 
            this.loading = true; 
            setTimeout(() => { this.isLoggedIn = true; this.user = { name: "Usuario Demo" }; this.loading = false; }, 1000); 
        },
        logout() { this.isLoggedIn = false; this.user = null; },

        // Utils
        formatMoney(amount) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount); },
        timeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            if (seconds < 3600) return "Hace instantes";
            if (seconds < 86400) return Math.floor(seconds/3600) + "h";
            return Math.floor(seconds/86400) + "d";
        },
        get profileView() { return this.currentView === 'profile'; }
    }
}
Alpine.start();