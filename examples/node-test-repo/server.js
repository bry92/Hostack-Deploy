const http = require("http");

const port = Number(process.env.PORT || 3000);

http
  .createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("NODE TEST OK");
  })
  .listen(port, "127.0.0.1");
