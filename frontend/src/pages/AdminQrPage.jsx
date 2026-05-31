import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import BrandLogo from '../components/BrandLogo.jsx';

function visitorIntroUrl() {
  return `${window.location.origin}/`;
}

export default function AdminQrPage() {
  const [animate, setAnimate] = useState(false);
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const url = visitorIntroUrl();
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, []);

  return (
    <div
      className={`intro-page qr-page relative flex min-h-dvh flex-col overflow-x-hidden bg-black pb-[env(safe-area-inset-bottom)] ${animate ? 'intro-page--animate' : ''}`}
    >
      <Link
        to="/admin"
        className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-300 backdrop-blur-sm hover:border-zinc-500 hover:text-white sm:left-6"
      >
        Dashboard
      </Link>

      <div className="intro-top relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-5 pt-10 text-center sm:max-w-xl sm:px-6 sm:pt-12">
        <BrandLogo />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-10 text-center sm:max-w-xl sm:px-6">
        <h1 className="qr-connect text-3xl font-bold uppercase leading-none tracking-tight text-white sm:text-4xl">
          Let's connect
        </h1>

        <div className="qr-code-wrap mt-8 rounded-3xl bg-white p-4 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)] sm:p-5">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="QR code — scan to open the visitor intro page"
              className="qr-code-img mx-auto block h-auto w-[min(72vw,280px)] max-w-full"
              width={280}
              height={280}
            />
          ) : (
            <div
              className="qr-code-img flex h-[min(72vw,280px)] w-[min(72vw,280px)] max-w-full items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-500"
              aria-busy="true"
            >
              Generating…
            </div>
          )}
        </div>

        <p className="qr-hint mt-6 max-w-xs text-sm leading-relaxed text-zinc-400 sm:text-base">
          Scan, share your contact details and our team will follow up soon.
        </p>
      </div>

      <div className="intro-footer-tags relative z-10 mt-auto flex items-end justify-between gap-4 px-5 pb-6 pt-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500 sm:px-6 sm:pb-8 sm:text-[10px]">
        <span className="intro-tag shrink-0 text-zinc-500">
          #carbonzapp<span className="text-[#EE412F]">X</span>series
        </span>
        <span className="intro-tag shrink-0 font-semibold text-[#EE412F]">Innovation driven</span>
      </div>
    </div>
  );
}
