// public/js/logic.js

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

window.app = function() {
    return {
        // --- DATA ---
        cars: [],
        favorites: [],
        
        // --- UI & HERO CARDS DATA (OPTIMIZATION) ---
        headerVisible: true,
        navCompact: false,
        searchPlaceholder: '',
        lastScroll: 0,
        
        heroCards: [
            {
                id: 'finance',
                title: 'Llévatelo a<br>Crédito',
                subtitle: 'Pagos desde<br><span class="text-white font-bold">$3,000/mes</span>',
                tag: 'Financiamiento',
                icon: '🏦',
                btnText: 'Simular',
                gradient: 'from-blue-600 to-indigo-800',
                textColor: 'text-blue-100',
                btnColor: 'text-blue-700',
                action: () => window.open('https://wa.me/526333331107?text=Me interesa crédito', '_blank')
            },
            {
                id: 'sell',
                title: '¿Cambias<br>de Auto?',
                subtitle: 'Recibe oferta<br>inmediata',
                tag: 'Vender',
                icon: '🤝',
                btnText: 'Cotizar',
                gradient: 'from-purple-600 to-fuchsia-700',
                textColor: 'text-purple-100',
                btnColor: 'text-purple-700',
                action: function() { this.startSelling() }
            },
            {
                id: 'warranty',
                title: 'Compra<br>Segura',
                subtitle: '3 meses de<br>cobertura',
                tag: 'Garantía',
                icon: '🛡️',
                btnText: 'Ver Planes',
                gradient: 'from-emerald-600 to-teal-700',
                textColor: 'text-emerald-100',
                btnColor: 'text-emerald-800',
                action: () => window.open('https://wa.me/526333331107?text=Me interesa garantía', '_blank')
            }
        ],
        
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
        signupIntent: 'buy',
        
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
            type: '',
            businessName: '',
            volume: '',
            phone: '',
            city: ''
        },
        sellerFormLoading: false,

        // --- LIFECYCLE ---
        async init() {
            this.initUI();
            
            const saved = localStorage.getItem('apson_favorites');
            if (saved) this.favorites = JSON.parse(saved);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    this.isLoggedIn = true;
                    await this.fetchUserProfile(user.uid);
                    this.user = { 
                        uid: user.uid,
                        name: user.displayName || this.userProfile?.name || user.email.split('@')[0], 
                        email: user.email, 
                        photo: user.photoURL || this.userProfile?.photo || null,
                        emailVerified: user.emailVerified
                    };
                    
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

        initUI() {
            window.addEventListener('scroll', () => {
                const current = window.pageYOffset;
                if (current <= 10) { this.headerVisible = true; this.navCompact = false; this.lastScroll = current; return; }
                const diff = current - this.lastScroll;
                if (Math.abs(diff) > 10) { this.headerVisible = diff < 0; this.navCompact = diff > 0; }
                this.lastScroll = current;
            });

            this.startTypewriter();
        },

        startTypewriter() {
            const examples = ['Busca por marca...', 'Busca por modelo...', 'Busca por año...', 'Busca por versión...'];
            let textIndex = 0;
            let charIndex = 0;
            let isDeleting = false;

            const type = () => {
                const current = examples[textIndex];
                if (isDeleting) {
                    this.searchPlaceholder = current.substring(0, charIndex - 1);
                    charIndex--;
                } else {
                    this.searchPlaceholder = current.substring(0, charIndex + 1);
                    charIndex++;
                }

                if (!isDeleting && charIndex === current.length) {
                    isDeleting = true;
                    setTimeout(type, 1500);
                } else if (isDeleting && charIndex === 0) {
                    isDeleting = false;
                    textIndex = (textIndex + 1) % examples.length;
                    setTimeout(type, 500);
                } else {
                    setTimeout(type, isDeleting ? 50 : 100);
                }
            };
            type();
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
                    
                    let displayMake = data.make;
                    let displayModel = data.model_name;
                    
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
            } catch (err) { 
                console.error(err); 
                this.error = "No se pudieron cargar los autos.";
            } finally { 
                this.loading = false; 
            }
        },

        // --- USER PROFILE ---
        async fetchUserProfile(uid) {
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) this.userProfile = userDoc.data();
            } catch (err) { console.error(err); }
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
                this.userProfile = { name: data.name, email: data.email || null, phone: data.phone || null, sellerStatus: 'none' };
            } catch (err) { console.error(err); }
        },

        async submitAuth() {
            this.authError = null;
            this.loading = true;
            try {
                if (this.authMode === 'login') {
                    await signInWithEmailAndPassword(auth, this.email, this.password);
                } else {
                    if (!this.displayName.trim()) { this.authError = "Por favor ingresa tu nombre."; this.loading = false; return; }
                    const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password);
                    await updateProfile(userCredential.user, { displayName: this.displayName.trim() });
                    await this.createUserProfile(userCredential.user.uid, { name: this.displayName.trim(), email: this.email, phone: null });
                    await sendEmailVerification(userCredential.user);
                    if (this.signupIntent === 'sell') setTimeout(() => { this.sellerModalOpen = true; }, 500);
                }
            } catch (err) {
                console.error("Auth Error", err);
                if (err.code === 'auth/wrong-password') this.authError = "Contraseña incorrecta.";
                else if (err.code === 'auth/user-not-found') this.authError = "Usuario no encontrado.";
                else if (err.code === 'auth/email-already-in-use') this.authError = "El correo ya está registrado.";
                else if (err.code === 'auth/weak-password') this.authError = "Contraseña muy corta (mín 6).";
                else this.authError = "Error: " + err.message;
            } finally { this.loading = false; }
        },

        async loginGoogle() {
            try {
                const result = await signInWithPopup(auth, new GoogleAuthProvider());
                const userDoc = await getDoc(doc(db, "users", result.user.uid));
                if (!userDoc.exists()) {
                    await this.createUserProfile(result.user.uid, {
                        name: result.user.displayName || result.user.email.split('@')[0],
                        email: result.user.email,
                        photo: result.user.photoURL
                    });
                    if (this.signupIntent === 'sell') setTimeout(() => { this.sellerModalOpen = true; }, 500);
                } else { this.userProfile = userDoc.data(); }
            } catch (err) { this.authError = "Error con Google."; }
        },

        async logout() {
            await signOut(auth);
            this.isLoggedIn = false;
            this.user = null;
            this.userProfile = null;
            this.email = '';
            this.password = '';
        },

        toggleAuthMode() { this.authMode = this.authMode === 'login' ? 'register' : 'login'; this.authError = null; },

        // --- FILTER & SORT ---
        get filteredCars() {
            let list = this.cars;
            if (this.currentView === 'favorites') list = list.filter(car => this.favorites.includes(car.id));
            
            const lowerSearch = this.search.toLowerCase();
            list = list.filter(car => {
                if (this.minPrice && car.price < Number(this.minPrice)) return false;
                if (this.maxPrice && car.price > Number(this.maxPrice)) return false;
                if (this.selectedBrands.length > 0 && !this.selectedBrands.some(b => car.model.toLowerCase().includes(b.toLowerCase()))) return false;
                
                if (lowerSearch !== '') {
                    if (lowerSearch === 'pickup') return ['lobo','sierra','silverado','tacoma','ranger'].some(t => car.model.toLowerCase().includes(t));
                    if (lowerSearch === 'nacional') return car.legal.toLowerCase() === 'nacional';
                    if (lowerSearch === '4x4') return car.is4x4;
                    if (lowerSearch === 'economico') return car.price < 200000;
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

        // --- HELPERS ---
        toggleFavorite(id) {
            if (this.favorites.includes(id)) this.favorites = this.favorites.filter(favId => favId !== id);
            else this.favorites.push(id);
            localStorage.setItem('apson_favorites', JSON.stringify(this.favorites));
        },
        
        get canSubmit() {
            const validEmail = this.email.includes('@') && this.email.includes('.');
            const validPass = this.password.length >= 8;
            if (this.authMode === 'register') return validEmail && validPass && this.displayName.trim().length >= 2;
            return validEmail && validPass;
        },

        get canSubmitSellerForm() {
            const hasType = this.sellerForm.type !== '';
            const hasVolume = this.sellerForm.volume !== '';
            const hasCity = this.sellerForm.city.trim().length >= 2;
            const hasBusinessName = this.sellerForm.type === 'dealer' ? this.sellerForm.businessName.trim().length >= 2 : true;
            const hasPhone = this.userProfile?.phone || this.sellerForm.phone.trim().length >= 10;
            return hasType && hasVolume && hasPhone && hasCity && hasBusinessName;
        },
        
        get needsPhoneForSeller() { return !this.userProfile?.phone; },
        
        resetSellerForm() { this.sellerForm = { type: '', businessName: '', volume: '', phone: '', city: '' }; },
        
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
                alert('¡Solicitud enviada!');
            } catch (err) { alert('Error al enviar solicitud.'); } finally { this.sellerFormLoading = false; }
        },

        // --- GETTERS & ACTIONS ---
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
        formatMoney(amount) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount); }
    }
}
Alpine.start();