// public/js/logic.js

// 1. IMPORT Database & Alpine
// Note: We import Alpine here so we can control EXACTLY when it starts
import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

// 2. DEFINE THE APP LOGIC
window.app = function() {
    return {
        // DATA
        cars: [],
        search: '',
        loading: true,
        error: null,

        // LIFECYCLE
        async init() {
            console.log("App initialized. Fetching cars...");
            await this.fetchCars();
        },

        // ACTIONS
        async fetchCars() {
            this.loading = true;
            this.error = null;
            
            try {
                // Query: Top 20 cars, ordered by newest
                const q = query(collection(db, "cars"), orderBy("created_at", "desc"), limit(20));
                
                const querySnapshot = await getDocs(q);
                
                // Map Firestore data to our App format
                this.cars = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido",
                        price: data.price || 0,
                        year: data.year || "2000",
                        km: data.mileage || "0",
                        trans: data.transmission || "Auto",
                        // Use a placeholder if no image exists
                        image: (data.images && data.images.length > 0) ? data.images[0] : 'https://placehold.co/600x400?text=Sin+Foto',
                        verified: data.verified || false,
                        warranty: data.warranty || false,
                        legal: data.legal_status || "Nacional"
                    };
                });
                
            } catch (err) {
                console.error("Firebase Error:", err);
                
                if (err.message.includes("requires an index")) {
                    this.error = "Falta el índice en Firebase. Abre la consola (F12) y haz clic en el enlace largo.";
                } else if (err.message.includes("offline")) {
                    this.error = "Sin conexión a internet.";
                } else {
                    this.error = "No se pudieron cargar los carros.";
                }
            } finally {
                this.loading = false;
            }
        },

        // COMPUTED (Search Filter)
        get filteredCars() {
            if (this.search === '') return this.cars;
            
            const lowerSearch = this.search.toLowerCase();
            return this.cars.filter(car => 
                car.model.toLowerCase().includes(lowerSearch) || 
                car.year.toString().includes(lowerSearch) ||
                car.legal.toLowerCase().includes(lowerSearch)
            );
        },

        // FORMATTER ($250,000)
        formatMoney(amount) {
            return new Intl.NumberFormat('es-MX', { 
                style: 'currency', 
                currency: 'MXN', 
                maximumFractionDigits: 0 
            }).format(amount);
        },

        // NAVIGATION
        openCar(car) {
            alert(`Has seleccionado: ${car.model}`);
        }
    }
}

// 3. START ALPINE MANUALLY
// This ensures 'window.app' is defined BEFORE Alpine looks for it
Alpine.start();