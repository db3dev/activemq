import { Frame } from "@stomp/stompjs";

export interface ActiveMQConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    ssl?: boolean;
    reconnectDelay?: number;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;
    debugCallback: (msg: string) => any;
    stompExceptionCallback: (frame: Frame) => any;
    websocketExceptionCallback: (evt: Event) => any;
}