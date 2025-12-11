// public/js/sell.js

import { db } from './config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

const storage = getStorage();

// DATABASE OF MODELS
const CAR_DATABASE = {
    'Ford': ['Lobo', 'F-150', 'Ranger', 'Maverick', 'Explorer', 'Edge', 'Mustang', 'Escape', 'Expedition', 'Figo', 'Fiesta', 'Focus', 'Bronco'],
    'Chevrolet': ['Silverado', 'Cheyenne', 'Colorado', 'Aveo', 'Spark', 'Beat', 'Cavalier', 'Trax', 'Suburban', 'Tahoe', 'Camaro', 'Captiva', 'Onix'],
    'Nissan': ['Versa', 'Sentra', 'NP300', 'Frontier', 'March', 'Kicks', 'Altima', 'X-Trail', 'Urvan', 'Tsuru', 'Maxima'],
    'Toyota': ['Hilux', 'Tacoma', 'Tundra', 'Corolla', 'Yaris', 'RAV4', 'Camry', 'Sienna', 'Prius', 'Avanza', 'Highlander', 'Supra'],
    'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'City', 'Fit', 'Pilot', 'Odyssey', 'BR-V'],
    'Dodge': ['Ram 700', 'Ram 1500', 'Ram 2500', 'Attitude', 'Charger', 'Challenger', 'Durango', 'Journey', 'Neon'],
    'Jeep': ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Rubicon'],
    'Volkswagen': ['Jetta', 'Vento', 'Gol', 'Polo', 'Tiguan', 'Saveiro', 'Amarok', 'Virtus', 'Taos', 'Beetle'],
    'Mazda': ['Mazda3', 'Mazda2', 'CX-5', 'CX-30', 'CX-3', 'MX-5', 'CX-9'],
    'Kia': ['Rio', 'Forte', 'Seltos', 'Sportage', 'Soul', 'Sorento'],
    'Hyundai': ['Grand i10', 'Accent', 'Elantra', 'Creta', 'Tucson', 'Santa Fe'],
    'BMW': ['Serie 3', 'Serie 1', 'Serie 5', 'X1', 'X3', 'X5', 'M3', 'M4'],
    'Mercedes-Benz': ['Clase C', 'Clase A', 'Clase E', 'GLA', 'GLC', 'GLE'],
    'Audi': ['A1', 'A3', 'A4', 'A5', 'Q3', 'Q5', 'Q7'],
    'GMC': ['Sierra', 'Yukon', 'Terrain', 'Acadia', 'Canyon'],
    'Ram': ['700', '1500', '2500', '4000', 'Promaster'],
    'Otro': ['Otro']
};

const YEARS_LIST = Array.from({length: 30}, (_, i) => new Date().getFullYear() + 1 - i);
const MAKES_LIST = Object.keys(CAR_DATABASE).sort();
const TYPES_LIST = ['Pickup', 'Sedan', 'SUV', 'Hatchback', 'Van', 'Coupe', 'Convertible', 'Deportivo', 'Moto', 'Otro'];

window.sellApp = function() {
    return {
        // STATE
        files: [],
        previewUrls: [],
        uploading: false,
        
        // Data Sources
        years: YEARS_LIST,
        makes: MAKES_LIST,
        types: TYPES_LIST,
        
        // Dynamic Models List
        availableModels: [],

        // Form Data
        form: {
            year: new Date().getFullYear(),
            make: 'Ford',
            model: 'Lobo',
            trim: '',
            type: 'Pickup',
            price: '',
            km: '',
            desc: '', 
            legal: 'Importado',
            trans: 'Auto'
        },

        init() {
            // Load initial models for default make
            this.updateModels();
            
            // Watch for changes in Make to update Models
            this.$watch('form.make', (value) => {
                this.updateModels();
                this.form.model = this.availableModels[0];
            });
        },

        updateModels() {
            this.availableModels = CAR_DATABASE[this.form.make] || ['Otro'];
        },

        // FILES LOGIC
        handleFile(event) {
            const selectedFiles = Array.from(event.target.files);
            if (!selectedFiles.length) return;

            const remainingSlots = 5 - this.files.length;
            if (remainingSlots <= 0) return alert("¡Límite de 5 fotos alcanzado!");

            const filesToAdd = selectedFiles.slice(0, remainingSlots);
            this.files = [...this.files, ...filesToAdd];
            filesToAdd.forEach(file => this.previewUrls.push(URL.createObjectURL(file)));
            event.target.value = '';
        },

        removeFile(index) {
            this.files.splice(index, 1);
            this.previewUrls.splice(index, 1);
        },

        // SUBMIT LOGIC
        async submitCar() {
            if (this.files.length === 0) return alert("¡Debes subir al menos 1 foto!");
            if (!this.form.price) return alert("Escribe el precio.");
            if (!this.form.km) return alert("Escribe el kilometraje.");

            this.uploading = true;

            try {
                // 1. Upload Images

                const uploadPromises = this.files.map((file, i) => {
                    const fileName = `cars/${Date.now()}_${i}_${file.name}`;
                    const storageRef = ref(storage, fileName);
                    return uploadBytes(storageRef, file)
                        .then(snapshot => getDownloadURL(snapshot.ref));
                });

                const imageUrls = await Promise.all(uploadPromises);
                // 2. Format Data
                const trimString = this.form.trim ? ` ${this.form.trim}` : '';
                const fullModelString = `${this.form.make} ${this.form.model}${trimString}`;

                // 3. Save to Firestore
                await addDoc(collection(db, "cars"), {
                    make: this.form.make,
                    model_name: this.form.model,
                    trim: this.form.trim,
                    body_type: this.form.type,
                    
                    model: fullModelString,
                    year: parseInt(this.form.year),
                    price: parseInt(this.form.price),
                    mileage: parseInt(this.form.km),    
                    description: this.form.desc,        
                    
                    legal_status: this.form.legal,
                    transmission: this.form.trans,
                    images: imageUrls,
                    verified: false,
                    warranty: false,
                    created_at: serverTimestamp()
                });

                alert("¡Auto publicado correctamente!");
                window.location.href = "index.html";

            } catch (error) {
                console.error("Error:", error);
                alert("Error: " + error.message);
            } finally {
                this.uploading = false;
            }
        }
    }
}

Alpine.start();