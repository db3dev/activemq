import { ActiveMQClient } from '@db3dev/activemq';
import { config } from './config';

const simulatedEnvironmentVariable = 'SampleQueue1';
const simulatedEnvironmentVariable2 = 'SampleQueue2';
const client = new ActiveMQClient(config);

// Start Client
client.connect().then(() => init());

function init() {
  // Listen For Messages
  client.publish('Hello Queue', simulatedEnvironmentVariable2);

  client.rpc({key: 'Please Respond'}, simulatedEnvironmentVariable, (msg) => {
    console.log(`Received ${msg}`);
    client.disconnect();
  }); 
}