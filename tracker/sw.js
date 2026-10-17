self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'POST' || !requestUrl.pathname.endsWith('/tracker/share-target/')) return;

  event.respondWith((async () => {
    const form = await event.request.formData();
    const raw = String(form.get('url') || form.get('text') || '');
    const match = raw.match(/https?:\/\/[^\s]+/i);
    const sharedUrl = match ? match[0] : '';
    const suppliedTitle = String(form.get('title') || '').trim();
    const sharedText = String(form.get('text') || '').trim();
    // Some Android apps omit the formal title but put it on the first text line.
    const fallbackTitle = sharedText
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !/^https?:\/\//i.test(line)) || '';
    const target = new URL('./', self.registration.scope);
    if (sharedUrl) target.searchParams.set('capture', sharedUrl);
    const title = suppliedTitle || fallbackTitle;
    if (title) target.searchParams.set('title', title.slice(0, 200));
    target.searchParams.set('source', 'Galaxy Tab 공유');
    return Response.redirect(target.href, 303);
  })());
});
