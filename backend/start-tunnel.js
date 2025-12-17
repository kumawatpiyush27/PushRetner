const localtunnel = require('localtunnel');

(async () => {
    const tunnel = await localtunnel({ port: 9000 });
    console.log('TUNNEL_URL=' + tunnel.url);

    // Keep the process alive
    tunnel.on('close', () => {
        console.log('Tunnel closed');
    });
})();
