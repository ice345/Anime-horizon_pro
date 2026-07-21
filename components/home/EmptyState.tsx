import React from 'react';

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="grid min-h-64 place-items-center border-y border-dashed border-yearbook-line px-5 text-center">
    <div>
      <span aria-hidden="true" className="mx-auto mb-4 block text-3xl text-yearbook-sky">⌁</span>
      <p className="text-sm leading-6 text-yearbook-muted">{message}</p>
    </div>
  </div>
);
