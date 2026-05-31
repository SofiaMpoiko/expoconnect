import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';

export default function ThankYouPage() {
  const location = useLocation();
  const offline = location.state?.offline === true;
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`thank-you-page intro-page relative flex min-h-dvh flex-col overflow-x-hidden bg-black pb-[env(safe-area-inset-bottom)] ${animate ? 'thank-you-page--animate' : ''}`}
    >
      <div className="intro-top relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-5 pt-10 text-center sm:max-w-xl sm:px-6 sm:pt-12">
        <Link
          to="/"
          className="inline-flex rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Back to welcome"
        >
          <BrandLogo />
        </Link>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-5 py-10 text-center sm:max-w-xl sm:gap-6 sm:px-6">
        {offline ? (
          <>
            <h1 className="thank-you-line thank-you-line--title -mt-20 mb-6 text-2xl font-semibold tracking-wide text-white sm:-mt-24 sm:text-3xl">
              Thank You!
            </h1>
            <p className="thank-you-line thank-you-line--body max-w-sm text-base leading-relaxed text-zinc-400 sm:max-w-md sm:text-lg">
              Your information has been saved on this device and will be sent automatically when you reconnect.
            </p>
          </>
        ) : (
          <div className="thank-you-line thank-you-line--body max-w-sm space-y-4 text-base leading-relaxed text-zinc-400 sm:max-w-md sm:text-lg">
            <p>Thank you for visiting us.</p>
            <p>Your information has been successfully received.</p>
            <p>Our team will follow up soon</p>
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg -mt-8 px-5 pb-4 text-center sm:max-w-xl sm:px-6">
        <Link
          to="/register"
          className="thank-you-line thank-you-link text-sm font-medium tracking-wide text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition-colors hover:text-white hover:decoration-zinc-400 sm:text-base"
        >
          Submit new request
        </Link>
      </div>

      <div className="intro-footer-tags relative z-10 mt-auto flex items-end justify-between gap-4 px-5 pb-6 pt-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500 sm:px-6 sm:pb-8 sm:text-[10px]">
        <span className="thank-you-line intro-tag shrink-0 text-zinc-500">
          #carbonzapp<span className="text-[#EE412F]">X</span>series
        </span>
        <span className="thank-you-line intro-tag shrink-0 font-semibold text-[#EE412F]">Innovation driven</span>
      </div>
    </div>
  );
}
