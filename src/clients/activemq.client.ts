Object.assign(global, { WebSocket: require('ws') });
import * as WS from 'ws';
import { Agent } from 'http';
import { Client as StompClient, Message, StompSubscription, Versions } from '@stomp/stompjs';
import { ActiveMQConnectionConfig } from '../domain/activemq-connection.interface';
import { EventEmitter } from 'events';
import { MQClient } from '../domain/client.interface';
import * as uuid from 'uuid/v4';
import { Subscription } from '../domain/subscription.interface';
import { Queue } from '../domain/queue.interface';

export class ActiveMQClient implements MQClient {
    private readonly client: StompClient
    private readonly subscribers: {[hash:string]: Subscription} = {};
    private readonly connected = new EventEmitter();
    private readonly disconnected = new EventEmitter();
    private readonly rpcListeners: {[replyTo:string]: StompSubscription} = {};

    constructor(init: ActiveMQConnectionConfig, proxy?: Agent) {
        const uri = init.ssl ? `wss://${init.host}:${init.port}` : `ws://${init.host}:${init.port}`;
        const wssFactory = () => {
            if (!proxy) return;

            const websocket = new WS(uri, { agent: proxy });
            websocket.binaryType = 'arraybuffer';

            return websocket;
        }
        
        this.client = new StompClient({
            brokerURL: uri,
            connectHeaders: {
                login: init.username,
                passcode: init.password
            },
            reconnectDelay: init.reconnectDelay || 5000,
            heartbeatIncoming: init.heartbeatIncoming || 4000,
            heartbeatOutgoing: init.heartbeatOutgoing || 4000,
            debug: (msg) => {
                if (init.debugCallback) {
                    return init.debugCallback(msg);
                } else {
                    return null;
                }
            },
            webSocketFactory: proxy ? wssFactory : undefined
        });

        // Error Handling if Configured
        if (init.stompExceptionCallback) {
            this.client.onStompError = init.stompExceptionCallback;
        }

        if (init.websocketExceptionCallback) {
            this.client.onWebSocketError = init.websocketExceptionCallback;
        }

        // Handle Connection and Disconnect Events for Promise resolution and Queue Subscribing
        this.client.onDisconnect = () => {
            this.disconnected.emit('disconnected');
        }

        this.client.onConnect = () => {
            // Subscribe to each registered queue
            Object.values(this.subscribers).forEach((sub) => {
                this.subscribeToQueue(sub);
            });

            this.connected.emit('connected');
        };
    }

    public subscribe(queue: Queue, listener: (msg: any) => any): Promise<() => void> {
        this.subscribers[queue.hash] = {
            queue,
            listener
        };

        if (this.client.connected) {
            const unsubFn = this.subscribeToQueue({
                queue,
                listener
            });

            this.subscribers[queue.hash].unsubscribe = () => unsubFn();

            return Promise.resolve(this.subscribers[queue.hash].unsubscribe);
        } else {
            return new Promise((res) => {
                this.connected.once('connected', () => res(this.subscribers[queue.hash].unsubscribe));
            })
        }
    }

    public connect() {
        if (this.client.active && this.client.connected) {
            return Promise.resolve();
        } else if (!this.client.active) {
            this.client.activate()
        }

        return new Promise((res) => {
            this.connected.once('connected', res);
        });
    }

    public disconnect() {
        if (!this.client.active && !this.client.connected) {
            return Promise.resolve();
        } else if (this.client.active) {
            this.client.deactivate()
        }

        return new Promise((res) => {
            this.disconnected.once('disconnected', res);
        });
    }

    public publish(msg: any, queue: string) {
        return Promise.resolve(this.client.publish({
            destination: `/queue/${queue}`,
            body: JSON.stringify(msg)
        }));
    }

    public rpc<T>(body: any, queue: string, responseCallback: (msg: T) => void, replyTo?: string) {
        const listeners = this.rpcListeners;
        
        const msg = { 
            body,
            replyTo: replyTo || uuid()
        };

        const subscription = this.client.subscribe(
            `/queue/${msg.replyTo}`, 
            (message: Message) => {
                const unsub = listeners[msg.replyTo].unsubscribe;
                this.handleMessage(message, responseCallback, () => unsub());
                delete this.rpcListeners[msg.replyTo];
            },
            {
                ack: 'client', 
                'activemq.prefetchSize': '1'
            }
        );

        listeners[msg.replyTo] = subscription;

        return this.publish(msg, queue);
    }

    private subscribeToQueue(sub: Subscription) {
        const prefetchSize = sub.queue.prefetchSize ? sub.queue.prefetchSize.toString() : '1';
        
        const subscription = this.client.subscribe(
            `/queue/${sub.queue.queueName}`, 
            (message: Message) => {
                this.handleMessage(message, sub.listener);
            },
            {
                ack: 'client', 
                'activemq.prefetchSize': prefetchSize
            }
        );

        return () => subscription.unsubscribe();
    }

    private async handleMessage(message: Message, listener: (msg: {replyTo?: string}) => any, unsubscribe?: () => void) {
        try {
            const { body } = message;
            const messageObj = JSON.parse(body);
            await listener(messageObj);
            
            return messageObj;
        } finally {
            message.ack();
            if (unsubscribe) {
                unsubscribe();
            }
        }
    }
}