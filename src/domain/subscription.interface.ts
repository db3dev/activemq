import { Queue } from "./queue.interface";

export interface Subscription {
  queue: Queue;
  listener: (msg: {replyTo?: string}) => any;
  unsubscribe?: () => void;
}