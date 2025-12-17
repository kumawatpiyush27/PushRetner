import './App.css';
import { regSw, subscribe } from './helper';
import AdminDashboard from './AdminDashboard';
import { useState } from 'react';

function App() {
  const [showAdmin, setShowAdmin] = useState(false);

  async function registerAndSubscribe() {
    try {
      const serviceWorkerReg = await regSw();
      await subscribe(serviceWorkerReg);
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div className="App">
      {showAdmin ? (
        <AdminDashboard />
      ) : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Zyra Push Notifications</h1>
          <button onClick={registerAndSubscribe} style={{ margin: '10px' }}>
            Subscribe for push notifications
          </button>
          <button onClick={() => setShowAdmin(true)} style={{ margin: '10px' }}>
            Admin Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

