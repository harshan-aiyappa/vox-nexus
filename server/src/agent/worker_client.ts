import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class WorkerClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private url: string;
    private isConnected = false;

    constructor(url: string) {
        super();
        this.url = url;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('Connected to Whisper Worker');
                this.isConnected = true;
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'transcription') {
                        this.emit('transcription', msg.text);
                    }
                } catch (e) {
                    console.error('Error parsing worker message', e);
                }
            });

            this.ws.on('error', (err) => {
                console.error('Worker WebSocket error:', err);
                reject(err);
            });

            this.ws.on('close', () => {
                console.log('Worker WebSocket closed');
                this.isConnected = false;
            });
        });
    }

    sendAudio(chunk: Buffer) {
        if (this.isConnected && this.ws) {
            this.ws.send(chunk);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
