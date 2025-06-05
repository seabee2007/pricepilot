declare module 'mic-recorder-to-mp3' {
  interface MicRecorderOptions {
    bitRate?: number;
    sampleRate?: number;
    channels?: number;
  }

  class MicRecorder {
    constructor(options?: MicRecorderOptions);
    start(): Promise<void>;
    stop(): {
      getMp3(): Promise<[Float32Array, Blob]>;
    };
  }

  export default MicRecorder;
} 