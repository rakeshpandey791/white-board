import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const wsEndpoint = (() => {
  const configured = (import.meta.env.VITE_WS_ENDPOINT as string | undefined)?.trim();
  if (!configured) {
    return '/ws';
  }
  return configured.replace(/\/+$/, '');
})();

class WebSocketService {
  private client?: Client;
  private onConnectedCallbacks: Array<() => void> = [];

  connect(onConnected: () => void) {
    if (this.client && this.client.connected) {
      onConnected();
      return;
    }

    this.onConnectedCallbacks.push(onConnected);

    if (this.client) {
      return;
    }

    const token = localStorage.getItem('access_token');

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsEndpoint),
      reconnectDelay: 2000,
      connectHeaders: token ? { Authorization: 'Bearer ' + token } : {},
      onConnect: () => {
        const callbacks = [...this.onConnectedCallbacks];
        this.onConnectedCallbacks = [];
        callbacks.forEach((fn) => fn());
      }
    });

    this.client.activate();
  }

  subscribe(topic: string, callback: (payload: any) => void): StompSubscription | undefined {
    if (!this.client || !this.client.connected) {
      return undefined;
    }
    return this.client.subscribe(topic, (message) => callback(JSON.parse(message.body)));
  }

  publish(destination: string, payload: unknown) {
    if (!this.client || !this.client.connected) {
      return;
    }
    this.client.publish({
      destination,
      body: JSON.stringify(payload)
    });
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.client = undefined;
      this.onConnectedCallbacks = [];
    }
  }
}

export const websocketService = new WebSocketService();
