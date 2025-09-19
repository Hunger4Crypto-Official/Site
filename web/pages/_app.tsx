// web/pages/_app.tsx
import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function H4CApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
