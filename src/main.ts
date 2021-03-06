import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import 'hammerjs';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .then(_ => registerServiceWorker('sw-default'))
  .catch(err => console.log(err));

function registerServiceWorker(swName: string) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(`/${swName}.js`)
      .then(reg => {
        console.log('[App] Successful service worker registration', reg);
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[App] new version!');
              } else {
                console.log('[App] offline ready!');
              }
            }
          };
        };
      })
      .catch(err =>
        console.error('[App] Service worker registration failed', err)
      );
  } else {
    console.error('[App] Service Worker API is not supported in current browser');
  }
}
