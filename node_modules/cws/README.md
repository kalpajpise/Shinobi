# cws

Cross-platform interface for websockets

## Install

```bash
npm install --save cws
```

## API

For node usage, look at the [ws package][ws] as that's what's returned.

[src/browser.js](src/browser.js) can either be loaded directly or you can
require the module through [browserify][browserify]. Creating a server is not
supported in the browser. Arguments to the constructor are passed directly to
[WebSocket][websocket] & this module wraps around it to provide a node-style
api.

[browserify]: https://npmjs.com/package/browserify
[ws]: https://npmjs.com/package/ws
[websocket]: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
