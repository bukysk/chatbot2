"use client";

import React from 'react';
import ChatPrompt from '../components/ChatPrompt';
import RuntimeConfigCard from '../components/RuntimeConfigCard';

export default function RuntimePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Runtime / Prompt</h1>
      <ChatPrompt />
      <RuntimeConfigCard />
    </div>
  );
}
