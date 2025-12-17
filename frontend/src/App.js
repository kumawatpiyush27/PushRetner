import './App.css';
import { regSw, subscribe } from './helper';

function App() {
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
      <button onClick={registerAndSubscribe}>
        Subscribe for push notifications
      </button>
    </div>
  );
}

export default App;

