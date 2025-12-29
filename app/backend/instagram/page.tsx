"use client";

import InstagramUrlFetcher from '../components/InstagramUrlFetcher';

export default function InstagramPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Instagram URLs</h1>
      <InstagramUrlFetcher />
    </div>
  );
}
