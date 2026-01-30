# Xteam Developer Setup Guide

**Complete Step-by-Step Instructions for Secure Development & Deployment**

This guide will help you set up the Xteam application securely with Firebase Authentication and proper security rules.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Firebase Configuration](#firebase-configuration)
4. [Security Setup](#security-setup)
5. [User Management](#user-management)
6. [WeChat Integration (Optional)](#wechat-integration-optional)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ A Firebase account (free tier is sufficient)
- ✅ Firebase project: `xteam-coordination` (already created)
- ✅ Git installed on your computer
- ✅ A text editor (VS Code, Sublime, etc.)
- ✅ GitHub account: `helsinkimusken`
- ✅ GitHub repository: `helsinkimusken.github.io`

---

## Initial Setup

### Step 1: Clone the Repository (If Not Done)

If you haven't already cloned the repository:

```bash
cd d:\Tools
git clone https://github.com/helsinkimusken/helsinkimusken.github.io.git Xteam
cd Xteam
```

If you already have the repository:

```bash
cd d:\Tools\Xteam
git pull origin main
```

### Step 2: Verify File Structure

Ensure you have the following files:

```
Xteam/
├── index.html
├── app.js
├── auth.js                          # NEW: Authentication manager
├── styles.css
├── firebase-config.js               # Gitignored - your local secure config
├── firebase-config-public.js        # Public placeholder (safe to commit)
├── firebase-config.template.js      # Template for new developers
├── CLAUDE.md
├── FIREBASE-SETUP.md
├── SECURITY-GUIDE.md
├── FIREBASE-SECURITY-RULES.md       # NEW: Security rules guide
├── DEVELOPER-SETUP-GUIDE.md         # THIS FILE
├── .gitignore
└── README.md
```

**Important:** The `firebase-config.js` file contains your real Firebase credentials and is **gitignored** (never committed to GitHub).

---

## Firebase Configuration

### Step 3: Configure Firebase Credentials

1. **Open** `firebase-config.js` in your text editor

2. **Verify** the Firebase credentials are correct:

```javascript
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
```

3. **Update** the `authorizedUsers` array with your team members' email addresses:

```javascript
const authorizedUsers = [
  "your.email@company.com",        // Replace with your email
  "teammate1@company.com",          // Add team members
  "teammate2@company.com"
  // Add more as needed
];
```

4. **Save** the file

**Note:** This file is **local only** and will never be pushed to GitHub (protected by `.gitignore`).

---

## Security Setup

### Step 4: Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **xteam-coordination**
3. Click **Authentication** in the left sidebar
4. Click **Get started** (if first time)
5. Click **Sign-in method** tab
6. Click on **Email/Password**
7. **Enable** the toggle switch
8. Click **Save**

✅ Email/Password authentication is now enabled!

### Step 5: Create User Accounts

For each team member (including yourself):

1. In Firebase Console > **Authentication** > **Users** tab
2. Click **Add user** button
3. Enter the user's email address (e.g., `your.email@company.com`)
4. Enter a **temporary password** (e.g., `TempPass123!`)
5. Click **Add user**

**Important:**
- Share credentials securely with team members (encrypted messaging, password manager, etc.)
- Ask users to change their password on first login
- Never send passwords via plain email

### Step 6: Configure Security Rules

This is **CRITICAL** for protecting your data.

1. Go to Firebase Console > **Realtime Database**
2. Click **Rules** tab
3. **Replace** the existing rules with:

```json
{
  "rules": {
    ".read": "auth != null && (
      auth.token.email == 'your.email@company.com' ||
      auth.token.email == 'teammate1@company.com' ||
      auth.token.email == 'teammate2@company.com'
    )",
    ".write": "auth != null && (
      auth.token.email == 'your.email@company.com' ||
      auth.token.email == 'teammate1@company.com' ||
      auth.token.email == 'teammate2@company.com'
    )",
    "records": {
      ".indexOn": ["timestamp", "category", "userName"]
    }
  }
}
```

4. **Replace** the email addresses with the same ones from Step 3
5. Click **Publish**
6. Confirm the publish action

✅ Your database is now protected!

**For more security options, see [FIREBASE-SECURITY-RULES.md](./FIREBASE-SECURITY-RULES.md)**

---

## User Management

### Adding a New User

When a new team member joins:

1. **Add their email** to `firebase-config.js`:
   ```javascript
   const authorizedUsers = [
     "existing@company.com",
     "newuser@company.com"  // Add here
   ];
   ```

2. **Update Firebase Security Rules:**
   - Go to Firebase Console > Realtime Database > Rules
   - Add their email to both `.read` and `.write` rules
   - Click **Publish**

3. **Create their account:**
   - Firebase Console > Authentication > Users
   - Click **Add user**
   - Enter their email and temporary password
   - Share credentials securely

4. **Redeploy** your changes:
   ```bash
   git add firebase-config.js  # This WON'T work (gitignored)
   # You need to manually update firebase-config.js on deployment server
   git commit -m "Update authorized users list"
   git push origin main
   ```

### Removing a User

When a team member leaves:

1. **Remove their email** from `firebase-config.js`
2. **Update Firebase Security Rules** (remove their email)
3. **Disable their account:**
   - Firebase Console > Authentication > Users
   - Find the user
   - Click the three dots menu
   - Select **Disable user**

---

## WeChat Integration (Optional)

If you want to enable WeChat QR code login:

### Step 7: Configure WeChat

1. **Get WeChat App Credentials:**
   - Register a WeChat Mini Program or Official Account
   - Obtain your App ID

2. **Update** `firebase-config.js`:
   ```javascript
   const wechatConfig = {
     enabled: true,
     appId: "YOUR_WECHAT_APP_ID",  // Add your WeChat App ID here
     loginTimeout: 180000,
     refreshInterval: 3000
   };
   ```

3. **Backend Integration** (Advanced):
   - WeChat QR code login requires a backend server
   - The backend verifies WeChat authentication
   - Returns a Firebase custom token
   - See `auth.js` comments for implementation details

**Note:** WeChat integration is optional and requires additional backend development.

---

## Testing

### Step 8: Local Testing

1. **Open** `index.html` in your browser
   - You should see the **login modal** (not the main app)

2. **Test Login:**
   - Enter your authorized email
   - Enter the password you created
   - Click **Sign In**

3. **Expected Result:**
   - Login modal disappears
   - Main app appears
   - Your email shows in the header
   - You can submit records

4. **Test Logout:**
   - Click the **Logout** button
   - Login modal reappears
   - Main app is hidden

5. **Test Unauthorized Access:**
   - Try logging in with an email NOT in `authorizedUsers`
   - You should see: "Access denied. Your email is not authorized."

### Step 9: Security Testing

Test the following scenarios:

**Test 1: Unauthenticated Access**
- Open browser in incognito/private mode
- Navigate to your site
- Should see login modal, NOT main app
- Cannot access database

**Test 2: Authorized User**
- Login with authorized email
- Can submit records
- Can view existing records
- Can delete records

**Test 3: Unauthorized User** (if you have test account)
- Create a test account in Firebase (email NOT in whitelist)
- Try to login
- Should see "Access denied" error

---

## Deployment

### Step 10: Deploy to GitHub Pages

1. **Verify** `.gitignore` is protecting secrets:
   ```bash
   cat .gitignore  # Should include firebase-config.js
   ```

2. **Verify** you're using the public config in production:
   - **Option A (Recommended):** Manually edit `index.html` on GitHub to use `firebase-config.js` only after deployment
   - **Option B:** Use build scripts to replace config file during deployment

3. **Commit and Push:**
   ```bash
   git add .
   git commit -m "Add Firebase Authentication and security improvements"
   git push origin main
   ```

4. **IMPORTANT - Post-Deployment Configuration:**

   After pushing to GitHub, you need to manually configure the production environment:

   **Option A: GitHub Web Editor (Easiest)**
   - Go to `https://github.com/helsinkimusken/helsinkimusken.github.io`
   - Open `firebase-config.js` in the web editor
   - Update `authorizedUsers` array with production user emails
   - Commit directly to main branch

   **Option B: Separate Branch for Production**
   - Create a `production` branch with production config
   - Deploy from `production` branch on GitHub Pages settings

5. **Wait 2-3 minutes** for GitHub Pages to rebuild

6. **Test Production:**
   - Navigate to `https://helsinkimusken.github.io`
   - Should see login modal
   - Test authentication flow
   - Verify database access works

---

## Troubleshooting

### Issue: "firebase-config.js not found" error

**Solution:**
- Ensure `firebase-config.js` exists in your project root
- Verify the file is referenced in `index.html`:
  ```html
  <script src="firebase-config.js"></script>
  ```

### Issue: "Access denied" after successful login

**Solution:**
- Check your email is in `authorizedUsers` array in `firebase-config.js`
- Check Firebase Security Rules include your email
- Verify rules are published
- Clear browser cache and try again

### Issue: Login modal doesn't appear

**Solution:**
- Check browser console for errors (F12 > Console tab)
- Verify `auth.js` is loaded before `app.js` in `index.html`
- Verify Firebase Auth SDK is loaded
- Check that `mainApp` div has `style="display: none;"` in HTML

### Issue: Can't save records after login

**Solution:**
- Check Firebase Security Rules are configured correctly
- Verify your email matches EXACTLY in both places
- Check browser console for permission errors
- Try logging out and back in

### Issue: "Permission denied" errors in console

**Solution:**
- Your Firebase Security Rules are blocking access
- Verify you're authenticated (email should show in header)
- Check Firebase Console > Realtime Database > Rules
- Ensure rules are published

### Issue: WeChat QR code not showing

**Solution:**
- Check `wechatConfig.enabled` is `true` in `firebase-config.js`
- Verify QRCode.js library is loaded in `index.html`
- Check browser console for errors
- Note: Full WeChat integration requires backend development

---

## Security Checklist

Before going to production, verify:

- ✅ `firebase-config.js` is in `.gitignore`
- ✅ `firebase-config-public.js` has placeholder values (no real credentials)
- ✅ Firebase Authentication is enabled
- ✅ User accounts created for all team members
- ✅ Firebase Security Rules are published
- ✅ `authorizedUsers` array is updated with real emails
- ✅ Tested login/logout flow
- ✅ Tested unauthorized access (should be blocked)
- ✅ Verified GitHub repository is PRIVATE (or using placeholder config)
- ✅ Production `firebase-config.js` configured manually on GitHub
- ✅ All team members have changed their temporary passwords

---

## Important Security Notes

### GitHub Repository Privacy

**CRITICAL:** Your GitHub repository `helsinkimusken.github.io` is **PUBLIC** because it's a GitHub Pages site. This means:

1. ✅ The website itself is public (accessible to anyone)
2. ✅ The source code is public
3. ❌ **BUT** `firebase-config.js` is gitignored (won't be committed)
4. ✅ `firebase-config-public.js` has placeholder values (safe to commit)

**Best Practice:**
- Keep sensitive configuration in `firebase-config.js` (gitignored)
- Only commit `firebase-config-public.js` with placeholders
- Manually configure `firebase-config.js` on production server
- Use Firebase Security Rules as the primary security layer

### Credential Management

**What's Safe to Expose:**
- ✅ Firebase API Key (public, safe to expose)
- ✅ Project ID (public)
- ✅ App ID (public)

**What's NOT Safe to Expose:**
- ❌ Database access without security rules
- ❌ List of authorized user emails (could be sensitive)
- ❌ User passwords (never store in code!)

**How Xteam Stays Secure:**
1. Firebase Security Rules require authentication
2. Only whitelisted emails can access data
3. Client-side validation provides better UX
4. Server-side rules (Firebase) provide actual security

---

## File Reference

### Files You MUST Edit:

1. **firebase-config.js** (local only, gitignored)
   - Update `authorizedUsers` array with real emails
   - Optional: Configure `wechatConfig`

2. **Firebase Security Rules** (Firebase Console)
   - Add authorized user emails
   - Publish the rules

3. **Firebase Authentication** (Firebase Console)
   - Create user accounts for team members

### Files You DON'T Need to Edit:

- ✅ `index.html` - Already configured
- ✅ `app.js` - Authentication integrated
- ✅ `auth.js` - Authentication logic ready
- ✅ `styles.css` - Login UI styled
- ✅ `.gitignore` - Protecting secrets
- ✅ `firebase-config-public.js` - Safe placeholder

---

## Next Steps

After completing this setup:

1. ✅ Share login credentials with team members securely
2. ✅ Test the application with multiple users
3. ✅ Set up Firebase backups (see FIREBASE-SETUP.md)
4. ✅ Monitor Firebase usage and costs
5. ✅ Document your authorized users list (keep secure)
6. ✅ Set up analytics (Step 3 in CLAUDE.md)
7. ✅ Plan WeChat integration (if needed)

---

## Getting Help

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review Firebase Console error messages
3. Check browser console (F12) for JavaScript errors
4. Read [FIREBASE-SECURITY-RULES.md](./FIREBASE-SECURITY-RULES.md)
5. Read [SECURITY-GUIDE.md](./SECURITY-GUIDE.md)
6. Check Firebase documentation: https://firebase.google.com/docs

---

## Additional Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase Security Rules Docs](https://firebase.google.com/docs/database/security)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [Xteam Project Documentation](./CLAUDE.md)

---

**Congratulations!** Your Xteam application is now secure and ready for production use.

---

**Last Updated:** 2025-01-30
**Version:** 1.0
**Author:** Claude Code Assistant
