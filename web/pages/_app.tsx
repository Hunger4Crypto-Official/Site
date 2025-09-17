// web/pages/_app.tsx
import type { AppProps } from "next/app";
import "../styles.css"; // make sure this file exists at web/styles.css

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
