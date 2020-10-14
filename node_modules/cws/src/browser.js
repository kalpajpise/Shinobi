;(() => {
  if ('object' !== typeof window) return; // Not running in a browser
  const WebSocket = window.WebSocket || false;
  if (!WebSocket) throw new Error('This browser does not support websockets');

  // Our wrapper
  function CWS(address, protocols, options) {

    // protocols is optional
    if (('object'===typeof protocols)&&(!Array.isArray(protocols))) {
      options   = protocols;
      protocols = undefined;
    }

    // options = optional
    options = Object.assign({queue:true},options);

    // Initialize ws and response
    let ws     = new WebSocket(address, protocols);
    let out    = new EventEmitter();

    // readyState passthrough
    Object.defineProperty(out,'readyState',{
      configurable: false,
      enumerable  : true,
      get         : () => ws.readyState
    });

    // Register event passthrough
    ws.onopen  = function (e) { out.emit('open' ,e); };
    ws.onclose = function (e) { out.emit('close',e); };
    ws.onerror = function (e) { out.emit('error',e); };

    // Message receiver
    ws.onmessage = async function (event) {
      let message = event.data;

      // Convert blob into buffer (provided by browserify/webpack)
      if (('function' === typeof Blob) && (message instanceof Blob)) {
        message = Buffer.from(await new Response(message).arrayBuffer());
      }

      out.emit('message', message);
    };

    // Message transmitter with queue
    out.queue = [];
    out.send  = function (chunk) {

      // Handle queue-less
      if (!options.queue) {
        ws.send(current);
        return out;
      }

      // Append message to queue
      out.queue.push(chunk);

      // Return if not ready
      if (ws.readyState !== 1) return;

      // Send while we have a queue
      let current = false;
      try {
        while (out.queue.length) {
          current = out.queue.shift();
          ws.send(current);
        }
      } catch (e) {
        if (current) out.queue.unshift(current);
      }
    };

    // Allow closing of the socket
    out.close = function() {

      // Closing or closed = done
      if (ws.readyState > 1) return;

      // Close the socket
      ws.close();
      return this;
    };

    return out;
  }

  // Browser export
  window.CWS = window.CWS || CWS;

  // Browserify/webpack
  if ('object' === typeof module) {
    module.exports = CWS;
  }

})();
