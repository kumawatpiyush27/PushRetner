# 🚀 Vercel Deployment Guide

## Prerequisites
1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
3. **Vercel CLI** (Optional): `npm install -g vercel`

---

## 📦 Part 1: Deploy Backend

### Option A: Deploy via Vercel Dashboard (Recommended for Beginners)

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Go to [vercel.com/new](https://vercel.com/new)**

3. **Import your repository**:
   - Click "Import Git Repository"
   - Select your `piyush-push-not` repository
   - Click "Import"

4. **Configure the project**:
   - **Project Name**: `piyush-push-backend` (or any name)
   - **Framework Preset**: Other
   - **Root Directory**: Click "Edit" → Select `backend`
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`

5. **Add Environment Variables**:
   Click "Environment Variables" and add these:
   
   ```
   PUBLIC_KEY=BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04
   PRIVATE_KEY=l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4
   MONGODB_URI=<YOUR_MONGODB_ATLAS_CONNECTION_STRING>
   NODE_ENV=production
   ```

   **To get MongoDB URI**:
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a free cluster (if you haven't)
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pushnotifications?retryWrites=true&w=majority`

6. **Click "Deploy"**

7. **Save your backend URL**: After deployment, you'll get a URL like:
   ```
   https://piyush-push-backend.vercel.app
   ```
   **SAVE THIS URL** - you'll need it for the frontend!

---

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Navigate to backend folder**:
   ```bash
   cd backend
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

4. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? `piyush-push-backend`
   - In which directory is your code located? `./`

5. **Add environment variables**:
   ```bash
   vercel env add PUBLIC_KEY
   vercel env add PRIVATE_KEY
   vercel env add MONGODB_URI
   ```

6. **Deploy to production**:
   ```bash
   vercel --prod
   ```

---

## 📱 Part 2: Deploy Frontend

### Option A: Deploy via Vercel Dashboard

1. **Go to [vercel.com/new](https://vercel.com/new)** again

2. **Import the same repository** (or click "Add New Project")

3. **Configure the project**:
   - **Project Name**: `piyush-push-frontend`
   - **Framework Preset**: Create React App
   - **Root Directory**: Click "Edit" → Select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

4. **Add Environment Variables**:
   ```
   REACT_APP_API_URL=https://piyush-push-backend.vercel.app
   REACT_APP_PUBLIC_KEY=BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04
   ```
   
   **⚠️ IMPORTANT**: Replace `https://piyush-push-backend.vercel.app` with YOUR actual backend URL from Part 1!

5. **Click "Deploy"**

6. **Your frontend will be live at**:
   ```
   https://piyush-push-frontend.vercel.app
   ```

---

### Option B: Deploy via Vercel CLI

1. **Navigate to frontend folder**:
   ```bash
   cd ../frontend
   ```

2. **Create `.env.production` file**:
   ```bash
   echo REACT_APP_API_URL=https://your-backend-url.vercel.app > .env.production
   echo REACT_APP_PUBLIC_KEY=BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04 >> .env.production
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

---

## 🔧 Part 3: Update Frontend Code

After deploying the backend, you need to update your frontend to use the deployed backend URL instead of localhost.

### Update `helper.js`:

Open `frontend/src/helper.js` and update the API URL:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:9000';

export async function regSw() {
  // ... existing code
}

export async function subscribe(serviceWorkerReg) {
  // Update the subscribe endpoint
  const response = await fetch(`${API_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });
}
```

---

## ✅ Verification Steps

### Test Backend:
1. Visit: `https://your-backend-url.vercel.app/stats`
2. You should see: `{"count":0}` or similar

### Test Frontend:
1. Visit: `https://your-frontend-url.vercel.app`
2. Click "Subscribe for push notifications"
3. Allow notifications when prompted
4. Go to Admin Dashboard
5. Send a test notification

---

## 🔄 Updating Your Deployment

### Auto-Deploy (Recommended):
- Every time you push to GitHub, Vercel will automatically redeploy
- Push changes: `git push origin main`

### Manual Deploy:
```bash
cd backend
vercel --prod

cd ../frontend
vercel --prod
```

---

## 🐛 Troubleshooting

### Backend Issues:
- **500 Error**: Check Vercel logs → Project → Deployments → Click deployment → View Logs
- **MongoDB Connection**: Ensure your IP is whitelisted in MongoDB Atlas (0.0.0.0/0 for all IPs)
- **Environment Variables**: Verify they're set in Vercel Dashboard → Project → Settings → Environment Variables

### Frontend Issues:
- **Can't connect to backend**: Verify `REACT_APP_API_URL` is correct
- **CORS errors**: Backend should have CORS enabled (already configured in your code)
- **Service Worker not loading**: Check browser console for errors

---

## 📝 Important Notes

1. **MongoDB Atlas Setup**:
   - Create a free cluster
   - Create a database user
   - Whitelist all IPs (0.0.0.0/0) for Vercel
   - Get connection string from "Connect" button

2. **Environment Variables**:
   - Backend needs: `PUBLIC_KEY`, `PRIVATE_KEY`, `MONGODB_URI`
   - Frontend needs: `REACT_APP_API_URL`, `REACT_APP_PUBLIC_KEY`

3. **CORS Configuration**:
   - Your backend already has CORS enabled
   - Make sure to update allowed origins if needed

4. **Service Worker**:
   - Service workers only work on HTTPS (Vercel provides this automatically)
   - Test on the deployed URL, not localhost

---

## 🎉 Success!

Once deployed, you'll have:
- ✅ Backend API running on Vercel
- ✅ Frontend app running on Vercel
- ✅ Push notifications working end-to-end
- ✅ Admin dashboard accessible
- ✅ MongoDB database connected

**Share your deployed URLs**:
- Frontend: `https://your-frontend.vercel.app`
- Backend: `https://your-backend.vercel.app`

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Ensure MongoDB connection string is correct
