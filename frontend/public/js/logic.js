// public/js/logic.js
import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// We attach this function to the 'window' so Alpine.js can find it from the HTML
window.app = function() {
    return {
        // DATA STATE
        cars: [],
        search: '',
        loading: true,
        error: null,

        // LIFECYCLE: This runs automatically when the app opens
        async init() {
            console.log("App starting... Fetching cars.");
            await this.fetchCars();
        },

        // CORE LOGIC: Get data from the cloud
        async fetchCars() {
            this.loading = true;
            this.error = null;
            
            try {
                // 1. Create a query (Get top 20 newest cars)
                // Note: 'cars' is the collection name in Firebase
                const q = query(collection(db, "cars"), orderBy("created_at", "desc"), limit(20));
                
                // 2. Execute the fetch
                const querySnapshot = await getDocs(q);
                
                // 3. Map the messy database data to clean UI data
                this.cars = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        model: data.model || "Modelo Desconocido", // Fallback if missing
                        price: data.price || 0,
                        year: data.year || "2000",
                        km: data.mileage || "0",
                        trans: data.transmission || "Auto", // 'Auto' or 'Std'
                        image: data.images ? data.images[0] : 'https://via.placeholder.com/400x300?text=Sin+Foto', // Use first image or placeholder
                        verified: data.verified || false,    // The Trust Badge
                        warranty: data.warranty || false,    // The Warranty Badge
                        legal: data.legal_status || "Nacional" // Importado/Nacional
                    };
                });
                
            } catch (err) {
                console.error("Error connecting to Agua Prieta server:", err);
                this.error = "No se pudo cargar el inventario. Revisa tu conexión.";
            } finally {
                this.loading = false;
            }
        },

        // COMPUTED: Filter the list based on the search bar
        get filteredCars() {
            if (this.search === '') return this.cars;
            
            const lowerSearch = this.search.toLowerCase();
            return this.cars.filter(car => {
                // Search by Model, Year, or Legal Status
                return car.model.toLowerCase().includes(lowerSearch) || 
                       car.year.toString().includes(lowerSearch) ||
                       car.legal.toLowerCase().includes(lowerSearch);
            });
        },

        // FORMATTER: Make money look nice ($250,000)
        formatMoney(amount) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
        },

        // NAVIGATION: Go to details
        openCar(car) {
            // For MVP, we can just use a simple alert or modal
            // Later, this will redirect to details.html?id=xyz
            alert(`Abriendo: ${car.model} - ${this.formatMoney(car.price)}`);
        }
    }
}