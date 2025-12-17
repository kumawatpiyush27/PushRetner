import axios from 'axios';

async function regSw() {
    if ('serviceWorker' in navigator) {
        let url = process.env.PUBLIC_URL + '/sw.js';
        const reg = await navigator.serviceWorker.register(url, { scope: '/' });
        console.log('service config is', { reg });
        return reg;
    }
    throw Error('serviceworker not supported');
}

async function subscribe(serviceWorkerReg) {
    let subscription = await serviceWorkerReg.pushManager.getSubscription();
    console.log({ subscription });

    if (subscription === null) {
        subscription = await serviceWorkerReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s',
        });

        // Send subscription to server
        const baseUrl = process.env.REACT_APP_API_URL || '';
        await axios.post(`${baseUrl}/subscribe`, subscription);
    }
}

export { regSw, subscribe };
