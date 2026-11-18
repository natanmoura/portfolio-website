import { cutout, injectCSS } from './cutout-title.js';

injectCSS();
for (const el of document.querySelectorAll('header h1, main h2, .notes h2')) {
  cutout(el, { colorMode: 'text' });
}
