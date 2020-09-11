import { ActiveMQClient } from '@db3dev/activemq';
import { config } from './config';

const simulatedEnvironmentVariable = 'SampleQueue1';
const simulatedEnvironmentVariable2 = 'SampleQueue2';
const client = new ActiveMQClient(config);

// Start Client
client.connect();

// Listen For Messages
client.subscribe(
    { hash: 'SampleQueue2', queueName: simulatedEnvironmentVariable2, prefetchSize: 1 },
    (msg) => {
        console.log(`Message Received: ${JSON.stringify(msg)}`);
    }
);

client.subscribe(
    { hash: 'SampleQueue', queueName: simulatedEnvironmentVariable, prefetchSize: 1 },
    (msg) => {
        console.log(`Message Received: ${JSON.stringify(msg)}`);

        // If there is a replyTo address send a response to complete RPC
        if (msg.replyTo) {
            client.publish(`Received message: ${JSON.stringify(msg.body)}`, msg.replyTo);
        }
    }
);