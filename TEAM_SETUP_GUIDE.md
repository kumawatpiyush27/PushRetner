# 🤝 Team Collaboration & Setup Guide

This guide explains how to set up this project on a new machine and collaborate via GitHub and Vercel.

## 1. Prerequisites
Make sure the following are installed:
- [Node.js (v18+)](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Vercel CLI](https://vercel.com/download) (`npm i -g vercel`)

## 2. Cloning the Project
```bash
git clone https://github.com/kumawatpiyush27/PushRetner.git
cd PushRetner
```

## 3. Environment Variables (CRITICAL)
GitHub does not store `.env` files. You must manually create them:

### Root Directory `.env`
Create a file named `.env` in the root and add:
- `DATABASE_URL`: (PostgreSQL URL)
- `PUBLIC_KEY`: (VAPID Public Key)
- `PRIVATE_KEY`: (VAPID Private Key)
- `SHOPIFY_API_SECRET`: (From Shopify Partners Dashboard)

### Shopify App Directory `.env`
Go to `shopify-public-app/retner-smart-push/` and create another `.env`:
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`

## 4. Installation
```bash
# Install backend dependencies
npm install

# Install Shopify app dependencies
cd shopify-public-app/retner-smart-push
npm install
```

## 5. Collaboration Workflow
1.  **Pull latest changes** before starting: `git pull origin main`
2.  **Make changes** and test locally.
3.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "Brief description of changes"
    git push origin main
    ```
4.  **Deploy to Vercel**:
    Make sure you are logged in to Vercel CLI (`vercel login`).
    ```bash
    vercel --prod
    ```

## 6. Project Structure
- `backend/`: Core API and Push Logic.
- `shopify-public-app/`: Remix dashboard shown inside Shopify.
- `shopify-files/`: Script tags and Service Workers for the store front.
