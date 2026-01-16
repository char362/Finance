// Firebase Configuration (Global Scope)
const firebaseConfig = {
    apiKey: "AIzaSyAU2chsUSbefNXS3w69C28NaYZdeUeCJlo",
    authDomain: "financetracker-7798a.firebaseapp.com",
    projectId: "financetracker-7798a",
    storageBucket: "financetracker-7798a.firebasestorage.app",
    messagingSenderId: "870535230273",
    appId: "1:870535230273:web:10f37c7a7f56f41225e7c0"
};

// Initialize Firebase (Compat)
// Checks if firebase is already initialized to avoid errors on reload
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// Expose globals for app.js
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log('Firebase Initialized (Compat Mode)');
