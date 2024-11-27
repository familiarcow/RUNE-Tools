import type { Metadata } from "next";
import Head from 'next/head';

export const metadata: Metadata = {
  title: "Bond Tracker - RUNE Tools",
};

export default function BondTracker() {
  return (
    <>
      <Head>
        <title>Bond Tracker - RUNE Tools</title>
      </Head>
      {/* ... rest of your component ... */}
    </>
  );
}