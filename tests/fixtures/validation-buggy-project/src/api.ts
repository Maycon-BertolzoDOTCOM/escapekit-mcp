// Hardcoded localhost - will break in production
const API_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000/ws';

export async function fetchData(path: string) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export function connectWebSocket(onMessage: (data: any) => void) {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = event => {
    onMessage(JSON.parse(event.data));
  };
  return ws;
}
