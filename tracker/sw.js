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
    const target = new URL('./', self.registration.scope);
    if (sharedUrl) target.searchParams.set('capture', sharedUrl);
    target.searchParams.set('source', 'Galaxy Tab 공유');
    return Response.redirect(target.href, 303);
  })());
});
