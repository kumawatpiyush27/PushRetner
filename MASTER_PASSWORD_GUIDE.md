# Store Admin Login - Master Password & Forgot Password Guide

## ✅ What's Been Added

### 1. **Master Password Feature**
- Added a checkbox "Use Master Password" on the login page
- When checked, the Store ID field is automatically set to "MASTER" and disabled
- Master password: `admin@2025`
- Master admin can:
  - View total subscribers across ALL stores
  - Send broadcast notifications to ALL stores
  - Access the dashboard without needing individual store credentials

### 2. **Forgot Password Feature**
- Added "Forgot Password?" link on the login page
- Users can enter their Store ID to retrieve their password
- The system will display the password for the entered Store ID

### 3. **Create New Account**
- Users can register a new store account
- Required fields:
  - Store ID (e.g., "mybrand")
  - Store Name (e.g., "My Brand")
  - Password

## 🔐 How to Use Master Password

1. Go to: `https://your-domain.vercel.app/store-admin`
2. Check the "Use Master Password" checkbox
3. Store ID will automatically change to "MASTER"
4. Enter password: `admin@2025`
5. Click "Login"
6. You'll see "Master Admin" dashboard with access to all stores

## 🔑 How to Use Forgot Password

1. Go to: `https://your-domain.vercel.app/store-admin`
2. Click "Forgot Password?" link
3. Enter your Store ID
4. Click "Show Password"
5. Your password will be displayed
6. Use it to login

## 📝 How to Create New Account

1. Go to: `https://your-domain.vercel.app/store-admin`
2. Click "Create New Account" link
3. Fill in:
   - Store ID (unique identifier)
   - Store Name (display name)
   - Password (your chosen password)
4. Click "Create Account"
5. You can now login with your credentials

## 🚀 Testing Instructions

### Test Master Password:
```
1. Open: https://piyush-retner.vercel.app/store-admin
2. Check "Use Master Password"
3. Password: admin@2025
4. Login
5. Should see "Master Admin" dashboard
```

### Test Regular Login:
```
1. Store ID: dupattabazaar1
2. Password: (your store password)
3. Login
4. Should see store-specific dashboard
```

### Test Forgot Password:
```
1. Click "Forgot Password?"
2. Enter Store ID: dupattabazaar1
3. Click "Show Password"
4. Password will be displayed
```

## 🔒 Security Notes

⚠️ **IMPORTANT**: The master password `admin@2025` is hardcoded for testing purposes. 

For production:
1. Change the master password in `backend/server.js` (line 248)
2. Store it securely in environment variables
3. Consider implementing proper authentication with JWT tokens

## 📊 Master Admin Features

When logged in as Master Admin:
- **Total Subscribers**: Shows count across ALL stores
- **Send Broadcast**: Sends to ALL subscribers from ALL stores
- **Dashboard Title**: Shows "Master Admin"

## 🏪 Regular Store Admin Features

When logged in as a specific store:
- **Total Subscribers**: Shows count for YOUR store only
- **Send Broadcast**: Sends to YOUR store's subscribers only
- **Dashboard Title**: Shows your store name

## 🔄 Deployment

After making these changes, deploy to Vercel:

```bash
git add .
git commit -m "Added master password and forgot password features"
git push
```

Vercel will automatically redeploy.

## 🧪 API Endpoints

### New Endpoints Added:

1. **GET /stats** - Get total subscribers (all stores)
   - Used by master admin
   - Returns: `{ count: 123 }`

2. **POST /broadcast** - Send to all stores
   - Used by master admin
   - Body: `{ title, message, url }`
   - Returns: `{ success: true, sent: 123 }`

3. **POST /store-forgot** - Retrieve password
   - Body: `{ storeId }`
   - Returns: `{ success: true, password: "..." }`

### Existing Endpoints:

1. **POST /store-login** - Login
2. **POST /store-register** - Register new store
3. **GET /my-store/stats** - Get store-specific stats
4. **POST /my-store/broadcast** - Send to specific store

## 📱 UI Changes

The login page now shows:
- ✅ Store ID field
- ✅ Password field
- ✅ "Use Master Password" checkbox
- ✅ "Forgot Password?" link
- ✅ "Create New Account" link
- ✅ Login button

## 🎯 Next Steps

1. Test the master password login
2. Test forgot password functionality
3. Test creating a new account
4. Verify master admin can see all subscribers
5. Verify master admin can send to all stores
6. Change master password for production use
