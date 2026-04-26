'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type VoiceState = 'idle' | 'recording' | 'transcribing';

interface VoiceButtonProps {
  /** Called with the transcribed text — should trigger send immediately */
  onTranscript: (text: string) => void;
  /** Called whenever the internal voice state changes */
  onStateChange?: (state: VoiceState) => void;
  /** Called when transcription fails */
  onError?: (msg: string) => void;
  disabled?: boolean;
}

function useMicDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    async function load() {
      try {
        // Request permission first so labels are populated
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        const mics = all.filter((d) => d.kind === 'audioinput');
        setDevices(mics);
        const saved = localStorage.getItem('helix-mic-device');
        if (saved && mics.some((m) => m.deviceId === saved)) setSelectedId(saved);
        else if (mics.length) setSelectedId(mics[0].deviceId);
      } catch {
        // no mic access — handled gracefully
      }
    }
    load();
  }, []);

  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('helix-mic-device', id);
  };

  return { devices, selectedId, select };
}

export function VoiceButton({ onTranscript, onStateChange, onError, disabled }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');

  const changeState = (s: VoiceState) => {
    setState(s);
    onStateChange?.(s);
  };
  const [showMicMenu, setShowMicMenu] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { devices, selectedId, select } = useMicDevices();

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedId ? { deviceId: { exact: selectedId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        changeState('transcribing');

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const form = new FormData();
        form.append('audio', blob, 'audio.webm');

        try {
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          if (res.ok && data.text?.trim()) {
            onTranscript(data.text.trim());
          } else {
            const msg = data.error ?? 'Transcription failed — please try again';
            console.error('[VoiceButton] STT error:', msg);
            onError?.(msg);
          }
        } catch (err) {
          console.error('[VoiceButton] fetch error:', err);
          onError?.('Could not reach transcription service');
        } finally {
          changeState('idle');
        }
      };

      recorder.start(250);
      changeState('recording');
    } catch {
      changeState('idle');
    }
  }, [onTranscript, onStateChange, selectedId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const toggle = () => {
    if (disabled || state === 'transcribing') return;
    if (state === 'idle') startRecording();
    else if (state === 'recording') stopRecording();
  };

  const selectedDevice = devices.find((d) => d.deviceId === selectedId);
  const micLabel = selectedDevice?.label?.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Microphone';

  return (
    <div className="relative flex items-center">
      {/* Main mic button */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || state === 'transcribing'}
        title={
          state === 'recording' ? 'Stop recording' :
          state === 'transcribing' ? 'Transcribing…' :
          `Speak your question · ${micLabel}`
        }
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-l-lg transition-smooth',
          devices.length > 1 ? 'rounded-r-none' : 'rounded-lg',
          state === 'recording'
            ? 'bg-destructive text-destructive-foreground shadow-soft'
            : state === 'transcribing'
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
        )}
      >
        {state === 'transcribing' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === 'recording' ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Mic selector chevron — only when multiple devices exist */}
      {devices.length > 1 && state === 'idle' && (
        <button
          type="button"
          onClick={() => setShowMicMenu((v) => !v)}
          className="flex h-8 w-5 items-center justify-center rounded-r-lg border border-l-0 border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          title="Select microphone"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {/* Mic device dropdown */}
      {showMicMenu && (
        <div className="absolute bottom-full right-0 mb-1.5 z-50 min-w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Select microphone
          </div>
          {devices.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => { select(d.deviceId); setShowMicMenu(false); }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-smooth hover:bg-accent',
                d.deviceId === selectedId && 'bg-accent/60 font-semibold text-foreground'
              )}
            >
              <Mic className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
