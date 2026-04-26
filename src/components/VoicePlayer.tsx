'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, ChevronDown, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlayState = 'idle' | 'loading' | 'playing';

interface Voice {
  voiceId: string;
  name: string;
  category: string;
  gender: string;
  accent: string;
  isBrowser?: boolean;
}

const STORAGE_KEY = 'genesis-tts-voice';

// ── Browser speech synthesis voices ────────────────────────────────────────
function getBrowserVoices(): Voice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().map((v) => ({
    voiceId: `browser:${v.name}`,
    name: v.name,
    category: 'browser',
    gender: '',
    accent: v.lang,
    isBrowser: true,
  }));
}

function useBrowserVoices() {
  const [voices, setVoices] = useState<Voice[]>([]);
  useEffect(() => {
    const load = () => setVoices(getBrowserVoices());
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}

// ── ElevenLabs voices (remote) ──────────────────────────────────────────────
function useRemoteVoices() {
  const [voices, setVoices] = useState<Voice[]>([]);
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/voice/voices');
        const data = await res.json();
        setVoices(data.voices ?? []);
      } catch {
        // no ElevenLabs key — graceful degradation
      }
    }
    load();
  }, []);
  return voices;
}

function useVoices() {
  const remote = useRemoteVoices();
  const browser = useBrowserVoices();
  const all = [...remote, ...browser];

  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (all.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    if (saved && all.some((v) => v.voiceId === saved)) {
      setSelectedId(saved);
    } else if (selectedId === '') {
      setSelectedId(all[0].voiceId);
    }
  }, [remote.length, browser.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return { voices: all, selectedId, select };
}

// ── Browser TTS playback ────────────────────────────────────────────────────
function speakWithBrowser(text: string, voiceName: string, onEnd: () => void): () => void {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
  if (match) utt.voice = match;
  utt.onend = onEnd;
  utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
  return () => window.speechSynthesis.cancel();
}

interface VoicePlayerProps {
  text: string;
  className?: string;
}

export function VoicePlayer({ text, className }: VoicePlayerProps) {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const cancelBrowserRef = useRef<(() => void) | null>(null);
  const { voices, selectedId, select } = useVoices();

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    cancelBrowserRef.current?.();
    cancelBrowserRef.current = null;
    setPlayState('idle');
  }, []);

  const play = useCallback(async () => {
    if (playState !== 'idle') { stop(); return; }

    const selected = voices.find((v) => v.voiceId === selectedId);
    setPlayState('loading');

    // ── Browser voice path ──────────────────────────────────────────────────
    if (selected?.isBrowser) {
      const voiceName = selectedId.replace('browser:', '');
      const clean = text.replace(/[#*`_>\[\]]/g, '').replace(/\n+/g, ' ').trim().slice(0, 600);
      setPlayState('playing');
      cancelBrowserRef.current = speakWithBrowser(clean, voiceName, () => setPlayState('idle'));
      return;
    }

    // ── ElevenLabs path ─────────────────────────────────────────────────────
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: selected?.isBrowser ? undefined : (selectedId || undefined) }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        toast.error('Text-to-speech failed', {
          description: errText || `Server returned ${res.status}. Check ELEVENLABS_API_KEY in .env.local`,
        });
        setPlayState('idle');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stop;
      audio.onerror = () => { toast.error('Audio playback failed'); stop(); };
      await audio.play();
      setPlayState('playing');
    } catch (err) {
      toast.error('Text-to-speech failed', {
        description: err instanceof Error ? err.message : 'Could not reach the speak API.',
      });
      setPlayState('idle');
    }
  }, [text, playState, stop, selectedId, voices]);

  if (!text?.trim()) return null;

  const selectedVoice = voices.find((v) => v.voiceId === selectedId);
  const voiceLabel = selectedVoice?.name ?? 'Default voice';

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={play}
        title={
          playState === 'playing' ? 'Stop' :
          playState === 'loading' ? 'Loading…' :
          `Read aloud · ${voiceLabel}`
        }
        className={cn(
          'flex h-5 shrink-0 items-center justify-center rounded-l transition-smooth',
          voices.length > 0 ? 'w-5 rounded-r-none' : 'w-5 rounded',
          playState === 'playing' ? 'text-primary' : 'text-muted-foreground/50 hover:text-primary',
          className
        )}
      >
        {playState === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" />
          : playState === 'playing' ? <VolumeX className="h-3 w-3" />
          : <Volume2 className="h-3 w-3" />}
      </button>

      {voices.length > 0 && playState === 'idle' && (
        <button
          type="button"
          onClick={() => setShowVoiceMenu((v) => !v)}
          title="Select speaker voice"
          className="flex h-5 w-3.5 items-center justify-center rounded-r text-muted-foreground/40 hover:text-primary transition-smooth"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      )}

      {showVoiceMenu && (
        <div className="absolute bottom-full right-0 mb-1.5 z-50 min-w-[230px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          {remote_and_browser_groups(voices, selectedId, (id) => { select(id); setShowVoiceMenu(false); })}
        </div>
      )}
    </div>
  );
}

function remote_and_browser_groups(
  voices: Voice[],
  selectedId: string,
  onSelect: (id: string) => void
) {
  const remote = voices.filter((v) => !v.isBrowser);
  const browser = voices.filter((v) => v.isBrowser);

  return (
    <>
      {remote.length > 0 && (
        <>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ElevenLabs voices
          </div>
          {remote.map((v) => <VoiceRow key={v.voiceId} voice={v} selectedId={selectedId} onSelect={onSelect} />)}
        </>
      )}
      {browser.length > 0 && (
        <>
          <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Browser voices
          </div>
          {browser.map((v) => <VoiceRow key={v.voiceId} voice={v} selectedId={selectedId} onSelect={onSelect} />)}
        </>
      )}
    </>
  );
}

function VoiceRow({ voice, selectedId, onSelect }: { voice: Voice; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(voice.voiceId)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-smooth hover:bg-accent',
        voice.voiceId === selectedId && 'bg-accent/60 font-semibold text-foreground'
      )}
    >
      <Mic className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{voice.name}</span>
      {(voice.gender || voice.accent) && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {[voice.gender, voice.accent].filter(Boolean).join(' · ')}
        </span>
      )}
    </button>
  );
}
