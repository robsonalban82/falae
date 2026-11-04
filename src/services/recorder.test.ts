import { noteSpeakTurn, recorderSupported, resetRecorderPolicy, startRecording } from './recorder';

class FakeRecorder {
  static throwOnStart = false;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    if (FakeRecorder.throwOnStart) throw new Error('NotSupportedError');
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice']) });
    this.onstop?.();
  }
}

describe('recorder', () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();

  beforeEach(() => {
    resetRecorderPolicy();
    noteSpeakTurn(true, false); // recognition already worked: no extra prompt to avoid
    FakeRecorder.throwOnStart = false;
    trackStop.mockClear();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('records and returns the audio, releasing the microphone', async () => {
    const rec = await startRecording();
    expect(rec.active).toBe(true);
    const blob = await rec.stop();
    expect(blob?.type).toBe('audio/mp4');
    expect(blob?.size).toBeGreaterThan(0);
    expect(trackStop).toHaveBeenCalled();
    expect(await rec.stop()).toBe(blob); // idempotent
  });

  it('cancel() drops the audio and releases the microphone', async () => {
    const rec = await startRecording();
    rec.cancel();
    expect(await rec.stop()).toBeNull();
    expect(trackStop).toHaveBeenCalled();
  });

  it('denied microphone → no-op recording', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
    expect(await (await startRecording()).stop()).toBeNull();
  });

  it('MediaRecorder failing to start → no-op recording, microphone released', async () => {
    FakeRecorder.throwOnStart = true;
    expect(await (await startRecording()).stop()).toBeNull();
    expect(trackStop).toHaveBeenCalled();
  });

  it('unsupported browser → no-op recording without asking for the microphone', async () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'MediaRecorder');
    expect(recorderSupported()).toBe(false);
    expect(await (await startRecording()).stop()).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('before recognition ever worked: records only if the microphone is already granted', async () => {
    resetRecorderPolicy();
    expect((await startRecording()).active).toBe(false); // no permissions API
    expect(getUserMedia).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'permissions', {
      value: { query: () => Promise.resolve({ state: 'granted' }) },
      configurable: true,
    });
    expect((await startRecording()).active).toBe(true);
    Reflect.deleteProperty(navigator, 'permissions');
  });

  it('a recorded turn that heard nothing turns recording off for the session', async () => {
    noteSpeakTurn(false, false); // not recording: no effect
    expect((await startRecording()).active).toBe(true);
    noteSpeakTurn(false, true);
    expect((await startRecording()).active).toBe(false);
  });
});
