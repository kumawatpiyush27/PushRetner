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
            applicationServerKey: 'BPj1sl5Dtd7yap6_bCwqGyBVga2KtU-KwMJ1UjnIJ77_1dx1MYKVl8ZcgG-68e6tdcUudmX9H135uh-sjl3trhE',
        });

        // Send subscription to server
        await axios.post('/subscribe', subscription);
    }
}

export { regSw, subscribe };
