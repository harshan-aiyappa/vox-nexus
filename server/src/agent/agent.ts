import { Room, RoomEvent, RemoteTrack, RemoteParticipant, DataPacket_Kind } from 'livekit-server-sdk';
import { WorkerClient } from './worker_client';
import { AudioStream } from './audio_stream';

export class Agent {
    private room: Room;
    private workerClient: WorkerClient;
    private audioStreams: Map<string, AudioStream> = new Map();

    constructor(roomUrl: string, token: string, workerUrl: string) {
        this.room = new Room();
        this.workerClient = new WorkerClient(workerUrl);

        this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed.bind(this));
        this.room.on(RoomEvent.DataReceived, this.onDataReceived.bind(this));
        this.room.on(RoomEvent.Disconnected, this.onDisconnected.bind(this));

        this.workerClient.on('transcription', (text: string) => {
            // Broadcast transcription to room
            const data = JSON.stringify({ type: 'transcription', text });
            const encoder = new TextEncoder();
            this.room.localParticipant.publishData(encoder.encode(data), DataPacket_Kind.RELIABLE);
        });

        this.connect(roomUrl, token);
    }

    async connect(url: string, token: string) {
        await this.workerClient.connect();
        await this.room.connect(url, token);
        console.log('Agent connected to room:', this.room.name);
    }

    onTrackSubscribed(track: RemoteTrack, publication: any, participant: RemoteParticipant) {
        if (track.kind === 'audio') {
            console.log('Subscribed to audio track from:', participant.identity);
            const audioStream = new AudioStream(track, this.workerClient);
            this.audioStreams.set(participant.identity, audioStream);
            audioStream.start();
        }
    }

    onDataReceived(payload: Uint8Array, participant?: RemoteParticipant) {
        // Handle control messages if needed
    }

    onDisconnected() {
        console.log('Agent disconnected');
        this.audioStreams.forEach(stream => stream.stop());
        this.audioStreams.clear();
        this.workerClient.close();
    }
}
