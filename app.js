// using this simple server to test networking between the Windows and WSL
const http = require('http');

const hostname = '127.0.0.1'

const port = 3000

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain')
    res.end('Hello World')
});
let foo = '\x1b[33m%s\x1b[0m'
server.listen(port, hostname, () => {
    console.log(foo, `server running at http://${hostname}:${port}`)
})