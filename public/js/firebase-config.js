// Firebase Configuration
// REPLACE THE FOLLOWING WITH YOUR OWN FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyC0OTCnSUorZ_nr_WDC4YwBIqxw8rZDVDg",
    authDomain: "trufslot.firebaseapp.com",
    projectId: "trufslot",
    storageBucket: "trufslot.firebasestorage.app",
    messagingSenderId: "980581503389",
    appId: "1:980581503389:web:7f18c9342919d404075f74"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Console log to check if firebase is loaded
console.log("Firebase Initialized");
