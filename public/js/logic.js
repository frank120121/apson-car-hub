// public/js/logic.js

// 1. IMPORTS
import { db, auth } from './config.js';
import { collection, getDocs, query, orderBy, limit, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    updateProfile,
    sendEmailVerification, 
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
        signupIntent: 'buy', // 'buy' or 'sell'
        
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
        authMode: 'login', // 'login' or 'register'
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
            city: ''           // only if not on file
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
                        photo: user.photoURL || this.userProfile?.photo || null,
                        emailVerified: user.emailVerified // Track verification status
                    };
                    
                    // Handle pending actions
                    if (localStorage.getItem('pending_sell_action')) {
                        localStorage.removeItem('pending_sell_action');
                        if (this.userProfile?.sellerStatus === 'approved') {
                            setTimeout(() => { window.location.href = 'sell.html'; }, 500);
                        } else {
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
                    email: data.email || null,
                    phone: data.phone || null,
                    photo: data.photo || null,
                    sellerStatus: 'none',
                    intent: this.signupIntent,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.userProfile = {
                    name: data.name,
                    email: data.email || null,
                    phone: data.phone || null,
                    sellerStatus: 'none'
                };
            } catch (err) {
                console.error("Error creating user profile:", err);
            }
        },

        // --- AUTH ACTIONS (Email Only) ---
        async submitAuth() {
            this.authError = null;
            this.loading = true;
            
            try {
                if (this.authMode === 'login') {
                    // LOGIN
                    await signInWithEmailAndPassword(auth, this.email, this.password);
                } else {
                    // REGISTER
                    if (!this.displayName.trim()) {
                        this.authError = "Por favor ingresa tu nombre.";
                        this.loading = false;
                        return;
                    }
                    
                    // 1. Create Account
                    const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password);
                    
                    // 2. Update Name
                    await updateProfile(userCredential.user, {
                        displayName: this.displayName.trim()
                    });
                    
                    // 3. Create DB Profile
                    await this.createUserProfile(userCredential.user.uid, {
                        name: this.displayName.trim(),
                        email: this.email,
                        phone: null
                    });

                    // 4. Send Verification Email (THE FREE "OTP" ALTERNATIVE)
                    await sendEmailVerification(userCredential.user);
                    alert("¡Cuenta creada! Hemos enviado un enlace a tu correo para verificarlo.");

                    // 5. Trigger Seller Flow if needed
                    if (this.signupIntent === 'sell') {
                        setTimeout(() => { this.sellerModalOpen = true; }, 500);
                    }
                }
            } catch (err) {
                console.error("Auth Error", err);
                if (err.code === 'auth/wrong-password') this.authError = "Contraseña incorrecta.";
                else if (err.code === 'auth/user-not-found') this.authError = "Usuario no encontrado.";
                else if (err.code === 'auth/email-already-in-use') this.authError = "El correo ya está registrado.";
                else if (err.code === 'auth/weak-password') this.authError = "La contraseña debe tener 6 caracteres.";
                else if (err.code === 'auth/invalid-credential') this.authError = "Credenciales inválidas.";
                else this.authError = "Error al iniciar sesión: " + err.message;
            } finally {
                this.loading = false;
            }
        },

        async loginGoogle() {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                const userDoc = await getDoc(doc(db, "users", result.user.uid));
                
                if (!userDoc.exists()) {
                    await this.createUserProfile(result.user.uid, {
                        name: result.user.displayName || result.user.email.split('@')[0],
                        email: result.user.email,
                        photo: result.user.photoURL
                    });
                    if (this.signupIntent === 'sell') {
                        setTimeout(() => { this.sellerModalOpen = true; }, 500);
                    }
                } else {
                    this.userProfile = userDoc.data();
                }
            } catch (err) {
                console.error("Google Login Error:", err);
                this.authError = "No se pudo iniciar con Google.";
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

        // --- SELLER LOGIC ---
        // (Copied from your previous code, logic remains the same)
        get canSubmitSellerForm() {
            const hasType = this.sellerForm.type !== '';
            const hasVolume = this.sellerForm.volume !== '';
            const hasCity = this.sellerForm.city.trim().length >= 2;
            const hasBusinessName = this.sellerForm.type === 'dealer' ? this.sellerForm.businessName.trim().length >= 2 : true;
            // Phone is optional if not already on file, but recommended
            const hasPhone = this.userProfile?.phone || this.sellerForm.phone.trim().length >= 10;
            return hasType && hasVolume && hasPhone && hasCity && hasBusinessName;
        },
        
        get needsPhoneForSeller() { return !this.userProfile?.phone; },
        
        resetSellerForm() {
            this.sellerForm = { type: '', businessName: '', volume: '', phone: '', city: '' };
        },

        async submitSellerRequest() {
            if (!this.user || !this.canSubmitSellerForm) return;
            this.sellerFormLoading = true;
            const phoneNumber = this.userProfile?.phone || this.sellerForm.phone.trim();
            
            try {
                await setDoc(doc(db, "users", this.user.uid), {
                    ...this.userProfile,
                    phone: phoneNumber, 
                    sellerStatus: 'pending',
                    sellerRequest: {
                        type: this.sellerForm.type,
                        businessName: this.sellerForm.businessName || null,
                        volume: this.sellerForm.volume,
                        phone: phoneNumber,
                        city: this.sellerForm.city.trim(),
                        requestedAt: new Date()
                    },
                    updatedAt: new Date()
                }, { merge: true });
                
                this.userProfile.sellerStatus = 'pending';
                this.userProfile.phone = phoneNumber;
                this.sellerModalOpen = false;
                this.resetSellerForm();
                alert('¡Solicitud enviada! Te contactaremos pronto.');
            } catch (err) {
                console.error("Error submitting seller request:", err);
                alert('Error al enviar solicitud.');
            } finally {
                this.sellerFormLoading = false;
            }
        },

        async requestSellerAccess() { this.sellerModalOpen = true; },

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
                    
                    // --- ROBUST MAKE/MODEL PARSING ---
                    let displayMake = data.make;
                    let displayModel = data.model_name;
                    
                    // Fallback for old listings that only have 'model' string
                    if (!displayMake || !displayModel) {
                        const parts = (data.model || "").split(" ");
                        if (parts.length >= 1) displayMake = parts[0];
                        if (parts.length >= 2) displayModel = parts.slice(1).join(" ");
                        if (!displayMake) displayMake = "Marca";
                        if (!displayModel) displayModel = "Modelo";
                    }

                    const is4x4 = (data.model || "").toLowerCase().includes("4x4") || (data.transmission || "").toLowerCase().includes("4x4");
                    
                    return {
                        id: doc.id,
                        make: displayMake,
                        modelName: displayModel,
                        model: data.model || "Modelo Desconocido",
                        price: Number(data.price) || 0,
                        year: Number(data.year) || 2000,
                        km: Number(data.mileage) || 0,
                        trans: data.transmission || "Auto",
                        image: (data.images && data.images.length > 0) ? data.images[0] : 'https://placehold.co/600x400?text=Sin+Foto',
                        verified: data.verified || false,
                        promoted: data.promoted || false, 
                        warranty: data.warranty || false,
                        description: data.description || null,
                        legal: data.legal_status || "Nacional",
                        is4x4: is4x4,
                        date: date
                    };
                });
            } catch (err) { console.error(err); } 
            finally { this.loading = false; }
        },

        // --- CORE LOGIC (Filter/Sort/Actions) ---
        get filteredCars() {
            let list = this.cars;
            if (this.currentView === 'favorites') list = list.filter(car => this.favorites.includes(car.id));
            
            const lowerSearch = this.search.toLowerCase();
            const isPickup = lowerSearch === 'pickup';
            const isNacional = lowerSearch === 'nacional';
            const is4x4 = lowerSearch === '4x4';
            const isEco = lowerSearch === 'economico';

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
                    if (isPickup) return ['lobo','sierra','silverado','tacoma'].some(t => car.model.toLowerCase().includes(t));
                    if (isNacional) return car.legal.toLowerCase() === 'nacional';
                    if (is4x4) return car.is4x4;
                    if (isEco) return car.price < 200000;

                    // Standard text search
                    return car.model.toLowerCase().includes(lowerSearch) || car.year.toString().includes(lowerSearch);
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

        // Nav/Utils
        get canSubmit() {
            const validEmail = this.email.includes('@') && this.email.includes('.');
            const validPass = this.password.length >= 8;
            if (this.authMode === 'register') return validEmail && validPass && this.displayName.trim().length >= 2;
            return validEmail && validPass;
        },
        
        // Seller status helpers
        get isApprovedSeller() { return this.userProfile?.sellerStatus === 'approved'; },
        get isPendingSeller() { return this.userProfile?.sellerStatus === 'pending'; },
        get sellerStatusText() {
            switch(this.userProfile?.sellerStatus) {
                case 'approved': return 'Vendedor Verificado ✓';
                case 'pending': return 'Solicitud en Revisión...';
                case 'rejected': return 'Solicitud Rechazada';
                default: return 'Usuario';
            }
        },

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
        enterApp(action) {
            if (action === 'vender') this.startSelling();
            else if (action === 'cambiar') window.location.href = 'https://wa.me/526333331107?text=Quiero cambiar mi auto';
            else { this.introOpen = false; window.scrollTo({top:0, behavior:'smooth'}); }
        },
        startSelling() {
            if (!this.isLoggedIn) {
                localStorage.setItem('pending_sell_action', 'true'); 
                this.introOpen = false;
                this.currentView = 'profile';
                window.scrollTo({top:0, behavior:'smooth'});
            } else if (this.isApprovedSeller) {
                window.location.href = 'sell.html';
            } else {
                this.introOpen = false;
                this.sellerModalOpen = true;
            }
        },
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