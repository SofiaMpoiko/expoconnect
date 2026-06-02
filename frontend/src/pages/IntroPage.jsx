import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';

export default function IntroPage() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`intro-page relative flex min-h-dvh flex-col overflow-x-hidden bg-black pb-[env(safe-area-inset-bottom)] ${animate ? 'intro-page--animate' : ''}`}
    >
      <div className="intro-top relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-5 pt-10 text-center sm:max-w-xl sm:px-6 sm:pt-12">
        <BrandLogo />
      </div>

      <main className="relative z-10 mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center sm:max-w-xl sm:gap-8 sm:px-6 sm:py-10">
        <h1 className="intro-headline w-full min-w-0">
          <span className="intro-line intro-line--welcome block text-3xl font-bold uppercase leading-none tracking-tight text-white sm:text-5xl">
            Welcome
          </span>
          <span className="intro-line intro-line--booth mt-2 block text-lg font-medium uppercase leading-snug tracking-wide text-zinc-300 sm:mt-2.5 sm:text-2xl">
            to our booth
          </span>
        </h1>

        <p className="intro-sub w-full min-w-0 max-w-[min(100%,20rem)] text-sm leading-relaxed text-zinc-400 sm:max-w-xs sm:text-base">
          Share your details to receive our catalogue and product information.
        </p>

        <Link
          to="/register"
          className="intro-cta flex min-h-[52px] w-full max-w-[min(100%,300px)] items-center justify-center rounded-2xl border-0 px-6 py-4 text-[15px] font-semibold uppercase tracking-wide text-white active:scale-[0.98] sm:max-w-xs sm:px-8"
        >
          Continue
        </Link>
      </main>

      <div className="intro-footer-tags relative z-10 mt-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 pb-6 pt-2 text-center text-[9px] uppercase tracking-[0.18em] text-zinc-500 sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:pb-8 sm:text-left sm:text-[10px]">
        <span className="intro-tag min-w-0 text-zinc-500">
          #carbonzapp<span className="text-[#EE412F]">X</span>series
        </span>
        <span className="intro-tag min-w-0 font-semibold text-[#EE412F]">Innovation driven</span>
      </div>
    </div>
  );
}
