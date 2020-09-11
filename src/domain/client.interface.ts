import { Queue } from "./queue.interface";

export interface MQClient {
    subscribe(queue: Queue, listener: (msg: any) => any): Promise<unknown>;
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown>;
    publish(msg: any, queue: string): Promise<any>;
    rpc<T>(msg: any, queue: string, callback: (msg: T) => void): Promise<any>;
}