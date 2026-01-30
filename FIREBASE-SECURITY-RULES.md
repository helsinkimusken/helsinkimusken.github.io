# Firebase Security Rules Configuration

This document provides step-by-step instructions for configuring Firebase Realtime Database security rules to protect your Xteam application data.

## Important Note

**CRITICAL:** The current database rules are WIDE OPEN (read/write access for everyone). You **MUST** update them before deploying to production.

---

## Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your Google account
3. Select your project: **xteam-coordination**

---

## Step 2: Navigate to Database Rules

1. In the left sidebar, click **Realtime Database**
2. Click on the **Rules** tab at the top
3. You will see the current rules (which are currently insecure)

---

## Step 3: Choose Security Level

Choose the security rules based on your requirements:

### Option 1: Require Authentication (RECOMMENDED)

This is the **recommended** approach. Only authenticated users can access the database.

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

**Pros:**
- Strong security
- Simple to implement
- Works with email/password authentication
- Flexible for future expansion

**Cons:**
- All authenticated users have full access (use Option 2 for more granular control)

---

### Option 2: Email Whitelist (MOST SECURE - RECOMMENDED FOR PRODUCTION)

Only specific authorized email addresses can access the database.

```json
{
  "rules": {
    ".read": "auth != null && (
      auth.token.email == 'user1@yourcompany.com' ||
      auth.token.email == 'user2@yourcompany.com' ||
      auth.token.email == 'user3@yourcompany.com'
    )",
    ".write": "auth != null && (
      auth.token.email == 'user1@yourcompany.com' ||
      auth.token.email == 'user2@yourcompany.com' ||
      auth.token.email == 'user3@yourcompany.com'
    )"
  }
}
```

**Important:** Replace `user1@yourcompany.com`, `user2@yourcompany.com`, etc. with actual team member email addresses.

**Pros:**
- Maximum security
- Granular access control
- Easy to add/remove users

**Cons:**
- Must update rules when adding/removing users
- Requires managing whitelist in two places (rules + firebase-config.js)

---

### Option 3: Email Domain Restriction

Allow all users from a specific email domain (e.g., @yourcompany.com).

```json
{
  "rules": {
    ".read": "auth != null && auth.token.email.matches(/.*@yourcompany\\.com$/)",
    ".write": "auth != null && auth.token.email.matches(/.*@yourcompany\\.com$/)"
  }
}
```

**Important:** Replace `yourcompany.com` with your actual company domain.

**Pros:**
- Easy to manage for large teams
- Automatic access for new team members with company email

**Cons:**
- Less granular control
- Anyone with company email can access

---

### Option 4: Per-User Data Access (Advanced)

Users can only read/write their own data.

```json
{
  "rules": {
    "records": {
      "$recordId": {
        ".read": "auth != null",
        ".write": "auth != null && (
          !data.exists() ||
          data.child('userEmail').val() == auth.token.email
        )"
      }
    }
  }
}
```

**Pros:**
- Maximum data isolation
- Users can't modify others' records

**Cons:**
- More complex
- May need to modify app logic to store userEmail field

---

## Step 4: Apply the Rules

1. **Copy** the security rules you chose (Option 1, 2, 3, or 4)
2. **Paste** them into the Rules editor in Firebase Console
3. Click **Publish** button
4. You will see a confirmation message: "Rules have been published"

**IMPORTANT:** Test the rules after publishing to ensure they work as expected.

---

## Step 5: Update Authorized Users List

After setting up security rules, you need to update the authorized users list in your application configuration:

1. Open `firebase-config.js` (this file is gitignored and local only)
2. Update the `authorizedUsers` array with the actual email addresses:

```javascript
const authorizedUsers = [
  "alice@yourcompany.com",
  "bob@yourcompany.com",
  "charlie@yourcompany.com"
  // Add more authorized users as needed
];
```

3. Save the file

**Note:** The `authorizedUsers` list in `firebase-config.js` provides client-side validation and better user experience (showing clear error messages). The Firebase Security Rules provide server-side enforcement.

---

## Step 6: Verify Security Rules

### Test 1: Unauthenticated Access (Should Fail)

1. Open Firebase Console > Realtime Database > Data tab
2. Try to read data without signing in
3. You should see "Permission denied" error

### Test 2: Authenticated Access (Should Succeed)

1. Sign in to your Xteam app with an authorized email
2. Try to submit a record
3. Check Firebase Console > Data tab to verify the record was saved

### Test 3: Unauthorized User (Should Fail)

1. Try to sign in with an email NOT in the `authorizedUsers` list
2. You should see "Access denied. Your email is not authorized." error

---

## Security Best Practices

### 1. Enable Email Verification (Recommended)

In Firebase Console:
1. Go to **Authentication** > **Sign-in method**
2. Click on **Email/Password**
3. Enable **Email link (passwordless sign-in)** (optional)
4. Save

### 2. Set Up User Accounts

For each authorized user:
1. Go to **Authentication** > **Users** tab
2. Click **Add user**
3. Enter the user's email and a temporary password
4. Send the credentials securely (e.g., encrypted messaging)
5. Ask the user to change their password on first login

### 3. Monitor Access

1. Go to **Authentication** > **Usage** tab
2. Monitor sign-in attempts
3. Review any suspicious activity

### 4. Enable Multi-Factor Authentication (Advanced)

1. Go to **Authentication** > **Sign-in method**
2. Scroll to **Advanced** section
3. Enable **Multi-factor authentication**
4. Configure SMS or TOTP-based 2FA

---

## Recommended Security Rules for Xteam

For the Xteam application, we recommend **Option 2 (Email Whitelist)** because:

1. **Small Team:** Xteam is designed for cross-team coordination with a known set of users
2. **Data Sensitivity:** Vendor performance and team coordination data should be restricted
3. **Easy Management:** Adding/removing users is straightforward
4. **Clear Access Control:** You know exactly who has access

### Production-Ready Rules

```json
{
  "rules": {
    ".read": "auth != null && (
      auth.token.email == 'user1@yourcompany.com' ||
      auth.token.email == 'user2@yourcompany.com'
    )",
    ".write": "auth != null && (
      auth.token.email == 'user1@yourcompany.com' ||
      auth.token.email == 'user2@yourcompany.com'
    )",
    "records": {
      ".indexOn": ["timestamp", "category", "userName"]
    }
  }
}
```

**Note:** The `.indexOn` rule improves query performance for filtering by timestamp, category, or userName.

---

## Troubleshooting

### Problem: "Permission denied" error when reading data

**Solution:**
1. Check that you're signed in (user should see their email in the header)
2. Verify your email is in the `authorizedUsers` list
3. Check Firebase Rules are published correctly
4. Clear browser cache and try again

### Problem: Can sign in but can't save records

**Solution:**
1. Check Firebase Console > Realtime Database > Rules
2. Ensure both `.read` and `.write` rules include your email
3. Check browser console for specific error messages

### Problem: "Access denied. Your email is not authorized."

**Solution:**
1. Your email is not in the `authorizedUsers` array in `firebase-config.js`
2. Ask the administrator to add your email to the authorized list
3. If you are the administrator, update `firebase-config.js` and redeploy

---

## Next Steps

After setting up security rules:

1. ✅ Test authentication with multiple user accounts
2. ✅ Verify data access works correctly
3. ✅ Set up regular backups (see FIREBASE-SETUP.md)
4. ✅ Monitor usage and access logs
5. ✅ Document authorized users list
6. ✅ Set up password policies for team members

---

## Additional Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/database/security)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Security Checklist](https://firebase.google.com/support/guides/security-checklist)

---

**Last Updated:** 2025-01-30
**Version:** 1.0
