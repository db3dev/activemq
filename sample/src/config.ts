import { Frame } from "@stomp/stompjs";

export const config = {
    host: 'localhost',
    port: 61614,
    username: 'admin',
    password: 'admin',
    ssl: false,
    debugCallback: (msg: string) => console.log(msg),
    stompExceptionCallback: (frame: Frame) => console.error(frame),
    websocketExceptionCallback: (evt: Event) => console.error(evt)
}