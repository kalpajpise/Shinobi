const test  = require('tape');
const WS    = require('ws');
let   ready = false;

// Emulate browser with WS without EE
global.window           = {};
global.window.WebSocket = WS;

function sleep() {
  return new Promise(resolve => {
    setTimeout(resolve,100);
  });
}

// Host simple echo server
global.server = new WS.Server({
  perMessageDeflate: false,
  port             : 1337,
}, function(err) {
  if(err) throw err;
  global.server.on('connection', function(socket) {
    socket.on('message', function(data) {
      socket.send(data);
    });
  });
  ready = true;
});

// Stop echo server once done
test.onFinish(() => {
  global.server.close();
});

// Node-style function
test('Ensure CWS is a function', async t => {
  t.plan(2);
  while(!ready) await sleep();
  t.is(typeof require('./browser'), 'function', 'CommonJS style-loading returns a function');
  t.is(typeof window.CWS          , 'function', 'Simple load registers as window.CWS');
});

// TODO: Connect to server
// TODO: Messages
// TODO: Queue test
