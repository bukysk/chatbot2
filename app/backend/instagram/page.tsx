"use client";

import React from 'react';
import InstagramScraper from '../components/InstagramScraper';

export default function InstagramPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Instagram Scraper</h1>
        <p className="text-sm text-zinc-600">
          Automatically scrape and transcribe videos from Instagram accounts.
        </p>
      </div>
      
      <InstagramScraper />
    </div>
  );
}
