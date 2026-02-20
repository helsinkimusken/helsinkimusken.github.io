// Firebase Configuration - PUBLIC VERSION
// This file is SAFE to commit to public repositories
// Firebase API keys are PUBLIC by design and not secret credentials
// Security is enforced by Firebase Security Rules (server-side), NOT by hiding API keys

// Your web app's Firebase configuration
// These credentials are PUBLIC and safe to expose
const firebaseConfig = {
  apiKey: "AIzaSyDMpqrKLYJfyvcrhCM0NR251gC-cDVr_B8",
  authDomain: "xteam-coordination.firebaseapp.com",
  databaseURL: "https://xteam-coordination-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xteam-coordination",
  storageBucket: "xteam-coordination.firebasestorage.app",
  messagingSenderId: "819640954036",
  appId: "1:819640954036:web:92f257ebdf5b1899403be1",
  measurementId: "G-EJF6CM9TJ7"
};

// Authorized Users Configuration
// IMPORTANT: Only these users can access the system after authentication
// This list should match your Firebase Security Rules
const authorizedUsers = [
    "helsinkimusken@gmail.com",
    "james.chow@hyzl.xyz",
    "jon.schmit@gmail.com"
  // TODO: Replace with actual team member emails before deployment
];

// WeChat QR Code Configuration
const wechatConfig = {
  enabled: true,   // WeChat QR tab enabled
  mode: 'contact', // Simple contact mode (no OAuth backend needed)
  wechatId: "wxid_vy4trddsp10a22",  // Your WeChat ID
  qrCodeImage: "wechat-admin-qr.png",  // Your actual WeChat QR code image
  adminName: "Helsinkimusken",  // Your name to display
  instructions: "Scan to contact admin for access",  // Custom instructions
  appId: "",       // Not needed for contact mode
  loginTimeout: 180000,
  refreshInterval: 3000
};

// SECURITY NOTES:
// 1. Firebase API keys are PUBLIC and safe to expose (by design)
// 2. Real security comes from Firebase Security Rules (see FIREBASE-SECURITY-RULES.md)
// 3. Only authenticated users in the authorizedUsers list can access data
// 4. Update authorizedUsers array before deploying to production
