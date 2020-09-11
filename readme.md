# Installing
**npm install @db3dev/activemq**

# ActiveMQ
## Connection Configuration Object
**host:** String for message broker uri. Do not include protocol or port

**port:** Number for port to connect to on message broker

**username:** String for login credentials

**password:** String password for login credentials

**ssl:** Boolean indicating that messages should be encrypted

**reconnectDelay:** Number overriding default reconnection retry wait time

**debugCallback:** Function to call for debug messages. Should not fill console for production

**stompExceptionCallback:** Function to call when STOMP client fails

**websocketExceptionCallback:** Function to call when Websocket Connection fails

## API
**connect()** --- Triggers websocket and STOMP protocols to activate and maintain connection to message queue.

**disconnect()** --- Triggers websocket and STOMP protocols to deactivate (close) and not attempt to maintain a connection to message queue.

**publish(msg, queue)** --- Serializes and sends message to designated queue.

**rpc(msg, queue, responseCallback, replyTo?)** --- Wraps publish functionality but subscribes to a replyTo queue (randomly named if undefined) that will pass the response to the responseCallback when received.

**subscribe(queue, listener)** --- Subscribes to designated queue name and passes all messages received to listener function. Return a promised unsubscribe function.

## Implementing into NestJS as Listener Example
```typescript
class ApplicationModule { ... }
await NestFactory.createMicroservice(ApplicationModule, {
    strategy: new class ActiveMQ extends Server implements CustomTransportStrategy {
        constructor(private readonly client: ActiveMQClient, private readonly queue: string) {
            super();
        }

        listen(callback: () => void) {
            this.client.connect();

            this.client.subscribe(
                // Defines the queue the strategy will subscribe to
                {hash: this.queue, queueName: this.queue, prefetchSize: 1}, 
                
                // The ActiveMQ Client is written to parse the incoming message.
                // NestJS will then use its handler map to execute decorated function that matches pattern
                async (msg: {pattern: any, data: any, replyTo?: string}) => {
                    const pattern = JSON.stringify(msg.pattern);
                    const handler = this.getHandlerByPattern(pattern);

                    if (!handler) {
                        return;
                    }

                    return await handler(msg.data);
                }
            ).then(() => callback());
        }

        close() {
            return this.client.disconnect()
        }


    }(new ActiveMQClient(config), 'developmentQueue')
});
```

## Using as NestJS Client Example
```typescript
class ActiveMQ extends ClientProxy {
    constructor(private readonly client: ActiveMQClient, private readonly queue: string) {
        super();
    }

    connect(): Promise<any> {
        return this.client.connect();
    }

    close() {
        return this.client.disconnect();
    }

    protected publish(packet: ReadPacket<any>, callback: (packet: WritePacket<any>) => void): Function {
        // NestJS callback is wrapped with a new function that adds RPC response to NestJS observer response
        this.client.rpc(packet, this.queue, (msg: any) => {callback({err: null, response: msg, isDisposed: true})});

        // No-Op code, usually handles connection cleanup but library handles this for us.
        return () => {};
    }
    protected dispatchEvent<T = any>(packet: ReadPacket<any>): Promise<T> {
        return this.client.publish(packet, this.queue) as Promise<any>;
    }
}

const client = new ActiveMQ(new ActiveMQClient({ ... }), 'developmentQueue');
// Send an RPC Request
client.send('patternA', 'msg').subscribe((msg) => console.log(JSON.stringify(msg)));

// Publish a one way message expecting no response
client.emit('patternB', 'msg');
```