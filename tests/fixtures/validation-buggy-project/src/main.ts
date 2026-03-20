import api from 'axios';
import db from 'better-sqlite3';
import claude from '@anthropic-ai/sdk';

// Missing polyfill: IntersectionObserver
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      console.log('Element visible', entry.target);
    }
  });
});

// Missing polyfill: AbortController
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

console.log('App initialized', { api, db, claude });
