# 🔔 Zyra Push Notifications

A complete **Web Push Notification System** built with **MERN Stack** (MongoDB, Express, React, Node.js) and deployed on **Vercel**.

## ✨ Features

- 🔔 **Web Push Notifications** - Send notifications to users even when they're not on your site
- 📊 **Admin Dashboard** - Beautiful UI to manage campaigns and subscribers
- 🎨 **Campaign Builder** - Multi-step campaign creation with live preview
- 📈 **Analytics** - Track subscribers, campaigns, and success rates
- 🚀 **Automated Welcome Messages** - Greet new subscribers automatically
- 💾 **MongoDB Integration** - Persistent storage for subscriptions
- 🔐 **VAPID Authentication** - Secure push notification delivery
- 📱 **Mobile Responsive** - Works on all devices

## 🏗️ Tech Stack

### Frontend
- **React** - UI library
- **Service Workers** - For push notification handling
- **Web Push API** - Browser notification API

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB** - Database
- **web-push** - Push notification library
- **Mongoose** - MongoDB ODM

### Deployment
- **Vercel** - Serverless hosting for both frontend and backend
- **MongoDB Atlas** - Cloud database

## 📁 Project Structure

```
piyush-push-not/
├── backend/                    # Backend API
│   ├── server.js              # Main server file
│   ├── subscriptionModel.js   # MongoDB schema
│   ├── vercel.json            # Vercel configuration
│   └── package.json
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.js             # Main app component
│   │   ├── AdminDashboard.js  # Admin panel
│   │   └── helper.js          # Service worker helpers
│   ├── public/
│   └── package.json
├── DEPLOYMENT.md              # Deployment guide
└── deploy.ps1                 # Automated deployment script
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kumawatpiyush27/piyush-push-not.git
   cd piyush-push-not
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   
   # Create .env file
   echo PUBLIC_KEY=BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04 > .env
   echo PRIVATE_KEY=l_uWy8qBj22_JqzEAHlj6TvxTYM7xCqR2V7SFa_fmb4 >> .env
   echo MONGODB_URI=mongodb://localhost:27017/pushnotifications >> .env
   
   # Start backend
   npm start
   ```

3. **Setup Frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   
   # Start frontend
   npm start
   ```

4. **Open your browser**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:9000

### Production Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed deployment instructions.

**Quick Deploy**:
```bash
# Login to Vercel
vercel login

# Run deployment script
.\deploy.ps1
```

## 📖 Usage

### For Users (Frontend)

1. **Subscribe to Notifications**:
   - Click "Subscribe for push notifications"
   - Allow notifications when prompted
   - You'll receive a welcome notification

2. **Receive Notifications**:
   - Notifications will appear even when the site is closed
   - Click on notifications to visit the linked URL

### For Admins (Dashboard)

1. **Access Admin Dashboard**:
   - Click "Admin Dashboard" button
   - Or visit `/admin` endpoint

2. **Send Quick Campaign**:
   - Enter title, message, and URL
   - Click "Send Campaign"
   - All subscribers will receive the notification

3. **Create Advanced Campaign**:
   - Go to "Campaigns" tab
   - Click "New Campaign"
   - Follow the 4-step wizard:
     - Step 1: Campaign details
     - Step 2: Message content (with live preview)
     - Step 3: Link, images, and icons
     - Step 4: Send options

4. **View Statistics**:
   - Dashboard shows total subscribers
   - Campaigns sent count
   - Success rate
   - Impressions

## 🔧 Configuration

### Environment Variables

**Backend** (`.env`):
```env
PUBLIC_KEY=<your-vapid-public-key>
PRIVATE_KEY=<your-vapid-private-key>
MONGODB_URI=<your-mongodb-connection-string>
PORT=9000
```

**Frontend** (`.env.production`):
```env
REACT_APP_API_URL=https://your-backend.vercel.app
REACT_APP_PUBLIC_KEY=<your-vapid-public-key>
```

### Generate New VAPID Keys

```bash
cd backend
npm run gen_vapid_keys
```

## 🎨 Customization

### Change Branding
Edit `backend/server.js`:
- Line 440: Update logo text
- Lines 189-434: Customize CSS styles
- Line 793: Change default icon URL

### Modify Welcome Message
Edit `backend/server.js` around line 1200 (search for "Welcome to Zyra Push")

### Update Service Worker
Edit `backend/server.js` lines 16-90 (sw.js endpoint)

## 🐛 Troubleshooting

### Common Issues

**1. Notifications not working**:
- Ensure you're on HTTPS (required for service workers)
- Check browser console for errors
- Verify VAPID keys are correct

**2. MongoDB connection failed**:
- Check MongoDB URI in `.env`
- Ensure MongoDB is running (local) or accessible (Atlas)
- Whitelist IP in MongoDB Atlas

**3. CORS errors**:
- Backend has CORS enabled by default
- Check if frontend URL is correct
- Verify `REACT_APP_API_URL` is set

**4. Service Worker not registering**:
- Clear browser cache
- Check browser console
- Ensure `/sw.js` endpoint is accessible

## 📊 API Endpoints

### Public Endpoints
- `POST /subscribe` - Subscribe to push notifications
- `GET /sw.js` - Service worker file
- `GET /subscribe-window` - Subscription popup
- `GET /stats` - Get subscriber count

### Admin Endpoints
- `GET /admin` - Admin dashboard
- `POST /broadcast` - Send notification to all subscribers
- `POST /send-notification` - Send to specific subscriber

## 🔒 Security

- ✅ VAPID keys for authentication
- ✅ HTTPS required for production
- ✅ Environment variables for sensitive data
- ✅ CORS configured
- ⚠️ Add admin authentication for production use

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👨‍💻 Author

**Piyush Kumawat**
- GitHub: [@kumawatpiyush27](https://github.com/kumawatpiyush27)

## 🙏 Acknowledgments

- Web Push API
- Vercel for hosting
- MongoDB Atlas for database
- React community

## 📞 Support

For issues or questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Review browser console errors
3. Check Vercel deployment logs
4. Open an issue on GitHub

---

**Made with ❤️ for Zyra Jewel**
