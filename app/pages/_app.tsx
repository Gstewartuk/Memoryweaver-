import "../styles.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { supabaseClient } from "../lib/supabaseClient";

export default function MyApp({ Component, pageProps }: AppProps) {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return <Component {...pageProps} session={session} />;
}
