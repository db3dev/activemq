import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller } from '@nestjs/common';
import { Server, CustomTransportStrategy, EventPattern, MessagePattern } from '@nestjs/microservices';
import { ActiveMQClient } from '@db3dev/activemq';
import { config } from './config';

@Controller()
export class PrototypeController {
    @EventPattern('event')
    eventReceiver(msg: string) {
        console.log(`Listener received: ${msg}`);
    }

    @MessagePattern('message')
    messageReceiver(msg: string) {
        console.log(`Listener received: ${msg}`);

        const response = 'RPC Response'
        console.log(`Listener responding with: ${response}`);
        return response;
    }
}

@Module({
    controllers: [PrototypeController]
})
class ApplicationModule {}

async function start() {
    const app = await NestFactory.createMicroservice(ApplicationModule, {
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

    app.listen(() => {
        console.log('Started');
    });
}

start();