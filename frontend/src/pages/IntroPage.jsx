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

      <h1 className="intro-headline absolute bottom-[calc(50%+3rem)] left-0 right-0 z-10 mx-auto w-full max-w-lg px-5 text-center sm:bottom-[calc(50%+3.5rem)] sm:max-w-xl sm:px-6">
        <span className="intro-line intro-line--welcome block text-4xl font-bold uppercase leading-none tracking-tight text-white sm:text-5xl">
          Welcome
        </span>
        <span className="intro-line intro-line--booth mt-2 block text-xl font-medium uppercase leading-snug tracking-wide text-zinc-300 sm:mt-2.5 sm:text-2xl">
          to our booth
        </span>
      </h1>

      <div className="intro-lower absolute top-1/2 left-0 right-0 z-10 mx-auto mt-[4.75rem] flex w-full max-w-lg flex-col items-center px-5 text-center sm:mt-[5.75rem] sm:max-w-xl sm:px-6">
        <p className="intro-sub max-w-[280px] text-sm leading-relaxed text-zinc-400 sm:max-w-xs sm:text-base">
          Share your details to receive our catalogue and product information.
        </p>

        <Link
          to="/register"
          className="intro-cta mt-8 flex min-h-[52px] w-full max-w-[300px] items-center justify-center rounded-2xl border-0 px-8 py-4 text-[15px] font-semibold uppercase tracking-wide text-white active:scale-[0.98] sm:mt-9 sm:max-w-xs"
        >
          Continue
        </Link>
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
