// web/pages/_app.tsx
import type { AppProps, NextWebVitalsMetric } from 'next/app';
import '../styles/globals.css';

export default function H4CApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }

  const endpoint = process.env.NEXT_PUBLIC_VITALS_ENDPOINT;
  if (!endpoint) return;

  if (typeof navigator === 'undefined') {
    return;
  }

  try {
    const body = JSON.stringify(metric);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
      return;
    }

    fetch(endpoint, {
      body,
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to report web vitals', error);
    }
  }
}
