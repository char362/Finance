// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAU2chsUSbefNXS3w69C28NaYZdeUeCJlo",
    authDomain: "financetracker-7798a.firebaseapp.com",
    projectId: "financetracker-7798a",
    storageBucket: "financetracker-7798a.firebasestorage.app",
    messagingSenderId: "870535230273",
    appId: "1:870535230273:web:10f37c7a7f56f41225e7c0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
