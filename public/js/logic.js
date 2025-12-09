// public/js/logic.js

// 1. IMPORTS
import { db, auth } from './config.js';
import { collection, getDocs, query, orderBy, limit, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    updateProfile,
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
        searchOpen: false,
        sortOpen: false,
        filterOpen: false,
        introOpen: true,
        sellerModalOpen: false,

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
        userProfile: null,
        authMode: 'login',
        email: '',
        password: '',
        displayName: '',
        authError: null,

        // --- SELLER FORM STATE ---
        sellerForm: {
            type: '',           // 'independent' or 'dealer'
            businessName: '',   // only for dealers
            volume: '',         // '1-3', '4-10', '10+'
            phone: '',
            city: ''
        },
        sellerFormLoading: false,

        // --- LIFECYCLE ---
        async init() {
            const saved = localStorage.getItem('apson_favorites');
            if (saved) this.favorites = JSON.parse(saved);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    this.isLoggedIn = true;
                    
                    // Fetch user profile from Firestore
                    await this.fetchUserProfile(user.uid);
                    
                    this.user = { 
                        uid: user.uid,
                        name: user.displayName || this.userProfile?.name || user.email.split('@')[0], 
                        email: user.email, 
                        photo: user.photoURL || this.userProfile?.photo || null
                    };
                    
                    if (localStorage.getItem('pending_sell_action')) {
                        localStorage.removeItem('pending_sell_action');
                        // Check if user is approved seller before redirecting
                        if (this.userProfile?.sellerStatus === 'approved') {
                            setTimeout(() => { window.location.href = 'sell.html'; }, 500);
                        } else {
                            // Show seller request modal or message
                            setTimeout(() => { this.sellerModalOpen = true; }, 500);
                        }
                    }
                } else {
                    this.isLoggedIn = false;
                    this.user = null;
                    this.userProfile = null;
                }
            });

            await this.fetchCars();
        },

        // --- USER PROFILE ---
        async fetchUserProfile(uid) {
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                    this.userProfile = userDoc.data();
                } else {
                    this.userProfile = null;
                }
            } catch (err) {
                console.error("Error fetching user profile:", err);
                this.userProfile = null;
            }
        },

        async createUserProfile(uid, data) {
            try {
                await setDoc(doc(db, "users", uid), {
                    name: data.name,
                    email: data.email,
                    photo: data.photo || null,
                    sellerStatus: 'none', // none, pending, approved, rejected
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.userProfile = {
                    name: data.name,
                    email: data.email,
                    sellerStatus: 'none'
                };
            } catch (err) {
                console.error("Error creating user profile:", err);
            }
        },

        async requestSellerAccess() {
            // Legacy method - now using submitSellerRequest
            this.sellerModalOpen = true;
        },

        // Seller form validation
        get canSubmitSellerForm() {
            const hasType = this.sellerForm.type !== '';
            const hasVolume = this.sellerForm.volume !== '';
            const hasPhone = this.sellerForm.phone.trim().length >= 7;
            const hasCity = this.sellerForm.city.trim().length >= 2;
            const hasBusinessName = this.sellerForm.type === 'dealer' ? this.sellerForm.businessName.trim().length >= 2 : true;
            
            return hasType && hasVolume && hasPhone && hasCity && hasBusinessName;
        },

        resetSellerForm() {
            this.sellerForm = {
                type: '',
                businessName: '',
                volume: '',
                phone: '',
                city: ''
            };
        },

        async submitSellerRequest() {
            if (!this.user || !this.canSubmitSellerForm) return;
            
            this.sellerFormLoading = true;
            
            try {
                await setDoc(doc(db, "users", this.user.uid), {
                    ...this.userProfile,
                    sellerStatus: 'pending',
                    sellerRequest: {
                        type: this.sellerForm.type,
                        businessName: this.sellerForm.businessName || null,
                        volume: this.sellerForm.volume,
                        phone: this.sellerForm.phone.trim(),
                        city: this.sellerForm.city.trim(),
                        requestedAt: new Date()
                    },
                    updatedAt: new Date()
                }, { merge: true });
                
                this.userProfile.sellerStatus = 'pending';
                this.sellerModalOpen = false;
                this.resetSellerForm();
                
                // Show success message
                alert('¡Solicitud enviada! Te contactaremos pronto por WhatsApp.');
                
            } catch (err) {
                console.error("Error submitting seller request:", err);
                alert('Error al enviar solicitud. Intenta de nuevo.');
            } finally {
                this.sellerFormLoading = false;
            }
        },

        // --- AUTH ACTIONS ---
        async submitAuth() {
            this.loading = true;
            this.authError = null;
            
            try {
                if (this.authMode === 'login') {
                    await signInWithEmailAndPassword(auth, this.email, this.password);
                } else {
                    // Registration - require name
                    if (!this.displayName.trim()) {
                        this.authError = "Por favor ingresa tu nombre.";
                        this.loading = false;
                        return;
                    }
                    
                    const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password);
                    
                    // Update Firebase Auth profile with display name
                    await updateProfile(userCredential.user, {
                        displayName: this.displayName.trim()
                    });
                    
                    // Create user profile in Firestore
                    await this.createUserProfile(userCredential.user.uid, {
                        name: this.displayName.trim(),
                        email: this.email
                    });
                }
            } catch (err) {
                console.error("Auth Error", err);
                if (err.code === 'auth/wrong-password') this.authError = "Contraseña incorrecta.";
                else if (err.code === 'auth/user-not-found') this.authError = "Usuario no encontrado.";
                else if (err.code === 'auth/email-already-in-use') this.authError = "El correo ya está registrado.";
                else if (err.code === 'auth/weak-password') this.authError = "La contraseña debe tener 6 caracteres.";
                else if (err.code === 'auth/invalid-credential') this.authError = "Credenciales inválidas.";
                else this.authError = "Error al iniciar sesión.";
            } finally {
                this.loading = false;
            }
        },

        async loginGoogle() {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                
                // Check if user profile exists, if not create one
                const userDoc = await getDoc(doc(db, "users", result.user.uid));
                if (!userDoc.exists()) {
                    await this.createUserProfile(result.user.uid, {
                        name: result.user.displayName || result.user.email.split('@')[0],
                        email: result.user.email,
                        photo: result.user.photoURL
                    });
                } else {
                    this.userProfile = userDoc.data();
                }
                
                console.log("Google login successful:", result.user.email);
            } catch (err) {
                console.error("Google Login Error:", err);
                if (err.code === 'auth/popup-closed-by-user') {
                    this.authError = "Cerraste la ventana de inicio de sesión.";
                } else if (err.code === 'auth/popup-blocked') {
                    this.authError = "Tu navegador bloqueó la ventana emergente. Permite pop-ups e intenta de nuevo.";
                } else {
                    this.authError = "No se pudo iniciar con Google: " + err.message;
                }
            }
        },

        async logout() {
            await signOut(auth);
            this.isLoggedIn = false;
            this.user = null;
            this.userProfile = null;
            this.email = '';
            this.password = '';
            this.displayName = '';
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
            const validEmail = this.email.includes('@') && this.email.includes('.');
            const validPass = this.password.length >= 8;
            
            if (this.authMode === 'register') {
                return validEmail && validPass && this.displayName.trim().length >= 2;
            }
            return validEmail && validPass;
        },

        // Seller status helpers
        get isApprovedSeller() {
            return this.userProfile?.sellerStatus === 'approved';
        },
        
        get isPendingSeller() {
            return this.userProfile?.sellerStatus === 'pending';
        },

        get sellerStatusText() {
            switch(this.userProfile?.sellerStatus) {
                case 'approved': return 'Vendedor Verificado ✓';
                case 'pending': return 'Solicitud en Revisión...';
                case 'rejected': return 'Solicitud Rechazada';
                default: return 'Usuario';
            }
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
            if (!this.isLoggedIn) {
                // Not logged in - go to profile to login/register
                localStorage.setItem('pending_sell_action', 'true'); 
                this.introOpen = false;
                this.currentView = 'profile';
                window.scrollTo({top:0, behavior:'smooth'});
            } else if (this.isApprovedSeller) {
                // Approved seller - go to sell page
                window.location.href = 'sell.html';
            } else {
                // Logged in but not approved seller - show modal
                this.introOpen = false;
                this.sellerModalOpen = true;
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