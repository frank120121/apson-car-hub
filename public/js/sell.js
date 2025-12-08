// public/js/sell.js

// 1. IMPORTS
import { db } from './config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.12.0/dist/module.esm.js";

// Initialize Storage Service
const storage = getStorage();

window.sellApp = function() {
    return {
        // STATE
        file: null,
        previewUrl: null,
        uploading: false,
        form: {
            year: '',
            model: '',
            price: '',
            legal: 'Importado',
            trans: 'Auto'
        },

        // ACTION: User selected a photo from phone gallery
        handleFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Compress/Validation could go here later
            this.file = file;
            this.previewUrl = URL.createObjectURL(file);
        },

        // ACTION: Upload to Cloud & Save to DB
        async submitCar() {
            // Validation
            if (!this.file) return alert("¡Falta la foto! Toca el cuadro gris.");
            if (!this.form.model) return alert("Escribe el modelo del auto.");
            if (!this.form.price) return alert("Escribe el precio.");

            this.uploading = true;

            try {
                // 1. Create unique filename (e.g., cars/17150000-ford.jpg)
                const fileName = `cars/${Date.now()}-${this.file.name}`;
                const storageRef = ref(storage, fileName);
                
                // 2. Upload the raw file to Firebase Storage
                console.log("Subiendo imagen...");
                const snapshot = await uploadBytes(storageRef, this.file);
                
                // 3. Get the public URL (https://firebasestorage...)
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log("Imagen lista:", downloadURL);

                // 4. Save data to Firestore Database
                await addDoc(collection(db, "cars"), {
                    model: this.form.model,
                    year: parseInt(this.form.year),
                    price: parseInt(this.form.price),
                    legal_status: this.form.legal,
                    transmission: this.form.trans,
                    images: [downloadURL], // <--- This is the key connection
                    verified: false,       // Default to false
                    warranty: false,
                    mileage: "0",
                    created_at: serverTimestamp()
                });

                // 5. Success
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

// Start Alpine
Alpine.start();