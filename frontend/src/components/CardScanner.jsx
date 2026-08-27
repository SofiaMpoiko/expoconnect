import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';
import { api } from '../api.js';
import { emptyContact, interpretQrPayload, parseContactText } from '../lib/contactExtract.js';

async function enrichFromWebsite(url) {
  const res = await api.post('/admin/extract-website', { url }, { timeout: 20_000 });
  const c = res.data?.contact || {};
  return {
    full_name: c.full_name || '',
    company: c.company || url,
    email: c.email || '',
    notes: c.note || `Source: ${c.source_url || url}`,
  };
}

async function resolveQrPayload(raw) {
  const interpreted = interpretQrPayload(raw);

  if (interpreted.type === 'url') {
    try {
      return await enrichFromWebsite(interpreted.url);
    } catch (e) {
      return {
        full_name: '',
        company: interpreted.url,
        email: '',
        notes: `QR website: ${interpreted.url}\n(${e?.response?.data?.error || e?.message || 'Could not fetch site'})`,
      };
    }
  }

  if (interpreted.type === 'contact') {
    const c = interpreted.contact;
    const base = {
      full_name: c.full_name || '',
      company: c.company || '',
      email: c.email || '',
      notes: `Scanned from card QR (${c.source || 'contact'}).`,
    };

    // Contact QR that also has a URL but missing email/company → try website
    if (c.url && (!base.email || !base.company)) {
      try {
        const web = await enrichFromWebsite(c.url);
        return {
          full_name: base.full_name || web.full_name,
          company: base.company || web.company,
          email: base.email || web.email,
          notes: [base.notes, web.notes].filter(Boolean).join('\n'),
        };
      } catch {
        return {
          ...base,
          company: base.company || c.url,
        };
      }
    }

    if (!base.company && c.url) base.company = c.url;
    return base;
  }

  return {
    ...emptyContact(),
    notes: interpreted.raw ? `QR content:\n${interpreted.raw}` : '',
  };
}

/**
 * Admin card scanner: live QR decode + optional OCR capture.
 */
export default function CardScanner({ onResult, onSkip, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const handlingRef = useRef(false);
  const workerRef = useRef(null);

  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const finish = useCallback(
    async (contact) => {
      stopCamera();
      onResult(contact);
    },
    [onResult, stopCamera]
  );

  const handleQrRaw = useCallback(
    async (raw) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      setBusy(true);
      setStatus('QR found — extracting details…');
      try {
        const contact = await resolveQrPayload(raw);
        await finish(contact);
      } catch (e) {
        setError(e?.message || 'Could not process QR.');
        setStatus('Point at a business card QR, or capture text.');
        handlingRef.current = false;
        setBusy(false);
      }
    },
    [finish]
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera is not available in this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus('Point at a QR code — or capture text from the card.');

        const tick = () => {
          if (cancelled || handlingRef.current) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (v && canvas && v.readyState >= 2) {
            const w = v.videoWidth;
            const h = v.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
              if (code?.data) {
                handleQrRaw(code.data).catch(() => {});
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not open camera.');
          setStatus('Camera unavailable — use manual entry.');
        }
      }
    }

    start().catch(() => {});

    return () => {
      cancelled = true;
      stopCamera();
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
    };
  }, [handleQrRaw, stopCamera]);

  async function captureOcr() {
    if (handlingRef.current || busy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setError('Camera is not ready yet.');
      return;
    }

    handlingRef.current = true;
    setBusy(true);
    setError('');
    setStatus('Reading text from card… (first time may take a moment)');

    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);

      // Also try QR on the still frame first
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (code?.data) {
        const contact = await resolveQrPayload(code.data);
        await finish(contact);
        return;
      }

      if (!workerRef.current) {
        workerRef.current = await createWorker('eng');
      }
      const worker = workerRef.current;
      const { data } = await worker.recognize(canvas);
      const parsed = parseContactText(data?.text || '');
      await finish({
        full_name: parsed.full_name || '',
        company: parsed.company || '',
        email: parsed.email || '',
        notes:
          parsed.full_name || parsed.company || parsed.email
            ? 'Extracted via OCR from business card photo. Please verify.'
            : `OCR found little usable text. Raw:\n${(data?.text || '').trim().slice(0, 500)}`,
      });
    } catch (e) {
      setError(e?.message || 'OCR failed.');
      setStatus('Try again, improve lighting, or enter manually.');
      handlingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-cz-admin-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-cz-admin-ink">Scan business card</div>
          <div className="mt-1 text-sm text-cz-admin-muted">
            Detects QR (vCard / website) or reads printed text for name, company, and email.
          </div>
        </div>
        <button
          type="button"
          className="min-h-[44px] shrink-0 self-start rounded-2xl border border-cz-admin-line px-3 py-2 text-sm font-semibold"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          disabled={busy}
        >
          Close
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
      ) : null}

      <div className="relative mt-4 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          className="mx-auto h-[50dvh] min-h-[280px] w-full object-cover sm:h-[min(50dvh,480px)]"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-sm font-semibold text-white">
            {status}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-cz-admin-muted">{status}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          className="min-h-[44px] rounded-2xl border border-cz-admin-line px-4 py-3 text-sm font-semibold"
          disabled={busy}
          onClick={() => {
            stopCamera();
            onSkip();
          }}
        >
          Skip — type manually
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-2xl bg-[#EE412F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          disabled={busy}
          onClick={() => captureOcr().catch(() => {})}
        >
          {busy ? 'Working…' : 'Capture & read text'}
        </button>
      </div>
    </div>
  );
}
