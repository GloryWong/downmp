export {
  pad,
  parseProxy,
}

function pad(num, length = 2) {
  const numStr = num.toString();
  return numStr.length < length ? '0' + numStr : numStr;
}

// http://username:password@host:proxyport
function parseProxy(proxy) {
  const matches = proxy.match(/^(.+):\/\/(?:(.+):(.+)@)?(.+):(.+)/);
  return {
    protocol: matches[1],
    auth: {
      username: matches[2],
      password: matches[3]
    },
    host: matches[4],
    port: matches[5]
  }
} 