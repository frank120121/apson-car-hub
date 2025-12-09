// public/js/logic.js

// 1. IMPORTS
import { db, auth } from './config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    getRedirectResult,  
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

// 2. APP LOGIC
window.app = function() {
    return {
        // --- DATA ---
        cars: [],
        favorites: [],

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

        // --- UI STATE ---
        currentView: 'home',
        selectedCar: null,
        loading: true,
        error: null,
        
        // --- MODAL STATES ---
        searchOpen: false,  // Top Search Bar (Typewriter)
        sortOpen: false,    // Bottom Sheet Sort
        filterOpen: false,  // Sidebar Filter Modal
        introOpen: true,    // Splash Screen

        // --- FILTERS ---
        search: '',
        sortBy: 'relevance',
        activeFilterTab: 'price',
        minPrice: '',
        maxPrice: '',
        selectedBrands: [],
        sortDesc: true,

        // --- AUTH STATE ---
        isLoggedIn: false,
        user: null,
        authMode: 'login',
        email: '',
        password: '',
        authError: null,

        // --- LIFECYCLE ---
        async init() {
            // alert("Debug: App Starting..."); // Uncomment if you suspect app isn't loading at all
            
            const saved = localStorage.getItem('apson_favorites');
            if (saved) this.favorites = JSON.parse(saved);

            try {
                // Debugging Redirect
                const result = await getRedirectResult(auth);
                if (result) {
                    // alert("Debug: Google returned user: " + result.user.email);
                } else {
                    // alert("Debug: No redirect result found.");
                }
            } catch (error) {
                alert("Debug Error: " + error.message); // <--- THIS IS WHAT WE NEED TO SEE
            }

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    // alert("Debug: Auth Changed - LOGGED IN as " + user.email);
                    this.isLoggedIn = true;
                    this.user = { 
                        name: user.displayName || user.email.split('@')[0], 
                        email: user.email, 
                        photo: user.photoURL 
                    };
                    
                    if (localStorage.getItem('pending_sell_action')) {
                        localStorage.removeItem('pending_sell_action');
                        setTimeout(() => { window.location.href = 'sell.html'; }, 500);
                    }
                } else {
                    // alert("Debug: Auth Changed - LOGGED OUT");
                    this.isLoggedIn = false;
                    this.user = null;
                }
            });

            await this.fetchCars();
        },


        // --- AUTH ACTIONS ---
        async submitAuth() {
            this.loading = true;
            this.authError = null;
            
            try {
                if (this.authMode === 'login') {
                    await signInWithEmailAndPassword(auth, this.email, this.password);
                } else {
                    await createUserWithEmailAndPassword(auth, this.email, this.password);
                }
                // Success is handled by onAuthStateChanged automatically
            } catch (err) {
                console.error("Auth Error", err);
                if (err.code === 'auth/wrong-password') this.authError = "Contraseña incorrecta.";
                else if (err.code === 'auth/user-not-found') this.authError = "Usuario no encontrado.";
                else if (err.code === 'auth/email-already-in-use') this.authError = "El correo ya está registrado.";
                else if (err.code === 'auth/weak-password') this.authError = "La contraseña debe tener 6 caracteres.";
                else this.authError = "Error al iniciar sesión.";
            } finally {
                this.loading = false;
            }
        },

        async loginGoogle() {
            const provider = new GoogleAuthProvider();
            try {
                // CHANGE: Use Popup instead of Redirect for better localhost support
                await signInWithPopup(auth, provider);
                
                // Success! The onAuthStateChanged listener will handle the state update automatically.
                
            } catch (err) {
                console.error("Google Login Error:", err);
                this.authError = "No se pudo iniciar con Google.";
            }
        },

        async logout() {
            await signOut(auth);
            this.isLoggedIn = false;
            this.user = null;
            this.email = '';
            this.password = '';
        },

        toggleAuthMode() {
            this.authMode = this.authMode === 'login' ? 'register' : 'login';
            this.authError = null;
        },

        // --- FETCH CARS ---
        async fetchCars() {
            this.loading = true;
            try {
                const q = query(collection(db, "cars"), orderBy("created_at", "desc"), limit(50));
                const querySnapshot = await getDocs(q);
                this.cars = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    let date = new Date();
                    if (data.created_at && data.created_at.toDate) date = data.created_at.toDate();
                    const is4x4 = (data.model || "").toLowerCase().includes("4x4") || (data.transmission || "").toLowerCase().includes("4x4");
                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido",
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
                console.error(err);
            } finally {
                this.loading = false;
            }
        },

        // Form Validation Logic
        get canSubmit() {
            // 1. Check if email has "@" and "."
            const validEmail = this.email.includes('@') && this.email.includes('.');
            
            // 2. Check if password is at least 6 chars (Firebase Requirement)
            const validPass = this.password.length >= 8;

            return validEmail && validPass;
        },

        // --- CORE LOGIC (Filter/Sort/Actions) ---
        get filteredCars() {
            let list = this.cars;
            if (this.currentView === 'favorites') list = list.filter(car => this.favorites.includes(car.id));
            
            list = list.filter(car => {
                if (this.minPrice && car.price < Number(this.minPrice)) return false;
                if (this.maxPrice && car.price > Number(this.maxPrice)) return false;
                if (this.selectedBrands.length > 0) {
                     const modelLower = car.model.toLowerCase();
                     if (!this.selectedBrands.some(brand => modelLower.includes(brand.toLowerCase()))) return false;
                }
                if (this.search !== '') {
                    const lowerSearch = this.search.toLowerCase();
                    const matchesText = car.model.toLowerCase().includes(lowerSearch) || car.year.toString().includes(lowerSearch);
                    if (lowerSearch === 'trokas') return car.model.toLowerCase().includes('lobo') || car.model.toLowerCase().includes('sierra') || car.model.toLowerCase().includes('silverado') || car.model.toLowerCase().includes('tacoma');
                    if (lowerSearch === 'nacional') return car.legal.toLowerCase() === 'nacional';
                    if (lowerSearch === '4x4') return car.is4x4;
                    if (lowerSearch === 'economico') return car.price < 200000;
                    if (!matchesText) return false;
                }
                return true;
            });

            return list.sort((a, b) => {
                if (a.promoted && !b.promoted) return -1;
                if (!a.promoted && b.promoted) return 1;
                switch (this.sortBy) {
                    case 'price_asc': return a.price - b.price;
                    case 'price_desc': return b.price - a.price;
                    case 'km_asc': return a.km - b.km;
                    case 'year_desc': return b.year - a.year;
                    case 'year_asc': return a.year - b.year;
                    case 'relevance': default: return b.date - a.date;
                }
            });
        },

        toggleFavorite(id) {
            if (this.favorites.includes(id)) this.favorites = this.favorites.filter(favId => favId !== id);
            else this.favorites.push(id);
            localStorage.setItem('apson_favorites', JSON.stringify(this.favorites));
        },

        // Nav Actions
        openSort() { this.sortOpen = true; document.body.style.overflow = 'hidden'; },
        closeSort() { this.sortOpen = false; document.body.style.overflow = 'auto'; },
        applySort(val) { this.sortBy = val; this.closeSort(); window.scrollTo({top:0, behavior:'smooth'}); },
        openFilter() { this.filterOpen = true; document.body.style.overflow = 'hidden'; },
        closeFilter() { this.filterOpen = false; document.body.style.overflow = 'auto'; },
        clearFilters() { this.minPrice=''; this.maxPrice=''; this.selectedBrands=[]; this.search=''; this.closeFilter(); },
        openSearch() { this.searchOpen = true; setTimeout(() => document.getElementById('mobileSearchInput')?.focus(), 100); },
        closeSearch() { this.searchOpen = false; },
        openCar(car) { this.selectedCar = car; document.body.style.overflow = 'hidden'; },
        closeCar() { this.selectedCar = null; document.body.style.overflow = 'auto'; },

        // Gatekeepers
        enterApp(action) {
            if (action === 'vender') this.startSelling();
            else if (action === 'cambiar') window.location.href = 'https://wa.me/526333331107?text=Quiero cambiar mi auto';
            else { this.introOpen = false; window.scrollTo({top:0, behavior:'smooth'}); }
        },
        startSelling() {
            if (this.isLoggedIn) {
                window.location.href = 'sell.html';
            } else {
                // Remember user wanted to sell
                localStorage.setItem('pending_sell_action', 'true'); 
                
                this.introOpen = false;
                this.currentView = 'profile';
                window.scrollTo({top:0, behavior:'smooth'});
            }
        },

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