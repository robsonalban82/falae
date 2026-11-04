/**
 * Records the learner's voice during a speak turn so they can play it back. Audio stays in memory
 * (a Blob URL owned by the caller); nothing is persisted. Optional: any failure just means no
 * playback, never a broken speak exercise.
 */

export function recorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    'MediaRecorder' in window
  );
}

// Session policy (module state, reset on reload). Recording competes with speech recognition for
// the microphone on some phones, and asking for it on the first turn shows two permission prompts.
let blocked = false; // a recorded turn failed: recording may break recognition here
let speechWorked = false; // recognition already got the microphone once

/** Reports how a speak turn went, so recording backs off where it seems to interfere. */
export function noteSpeakTurn(heardSomething: boolean, wasRecording: boolean): void {
  if (heardSomething) speechWorked = true;
  else if (wasRecording) blocked = true;
}

/** Tests only. */
export function resetRecorderPolicy(): void {
  blocked = false;
  speechWorked = false;
}

async function microphoneGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' });
    return status?.state === 'granted';
  } catch {
    return false; // name not supported (older Safari/Firefox)
  }
}

export type Recording = {
  /** True when audio is really being captured. */
  active: boolean;
  /** Stops and resolves with the audio, or null if nothing was captured. */
  stop: () => Promise<Blob | null>;
  /** Stops and drops the audio. */
  cancel: () => void;
};

const NO_RECORDING: Recording = {
  active: false,
  stop: () => Promise.resolve(null),
  cancel: () => {},
};

/**
 * Starts recording; resolves to a no-op Recording when unsupported, denied, blocked by the policy
 * above, or when it would add a second permission prompt before recognition ever worked.
 */
export async function startRecording(): Promise<Recording> {
  if (!recorderSupported() || blocked) return NO_RECORDING;
  if (!speechWorked && !(await microphoneGranted())) return NO_RECORDING;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return NO_RECORDING;
  }
  const release = () => stream.getTracks().forEach((track) => track.stop());
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream);
    recorder.start();
  } catch {
    release();
    return NO_RECORDING;
  }
  const chunks: Blob[] = [];
  let dropped = false;
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  let done: Promise<Blob | null> | null = null;
  const stop = () => {
    done ??= new Promise<Blob | null>((resolve) => {
      const finish = () => {
        release();
        resolve(
          !dropped && chunks.length > 0
            ? new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' })
            : null,
        );
      };
      if (recorder.state === 'inactive') return finish();
      recorder.onstop = finish;
      recorder.onerror = finish;
      try {
        recorder.stop();
      } catch {
        finish();
      }
    });
    return done;
  };
  return {
    active: true,
    stop,
    cancel: () => {
      dropped = true;
      void stop();
    },
  };
}
