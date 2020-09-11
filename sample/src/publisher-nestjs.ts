import 'reflect-metadata';
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import { ActiveMQClient } from '@db3dev/activemq';
import { config } from './config';

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
        this.client.rpc(packet, this.queue, (msg: any) => {callback({err: null, response: msg, isDisposed: true})});

        return () => {};
    }
    protected dispatchEvent<T = any>(packet: ReadPacket<any>): Promise<T> {
        return this.client.publish(packet, this.queue) as Promise<any>;
    }
}

const client = new ActiveMQ(new ActiveMQClient(config), 'developmentQueue');
// Send an RPC Request
client.send('message', 'RPC Request').subscribe((msg) => console.log(`Response: ${JSON.stringify(msg)}`));

// Publish a one way message expecting no response
client.emit('event', 'Event Published');