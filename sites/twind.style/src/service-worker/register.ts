import { writable, type Readable } from 'svelte/store'
import { dev, browser } from '$app/environment'
import { beforeNavigate } from '$app/navigation'
import { onDestroy } from 'svelte'
import { updated } from '$app/stores'

// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state
// "installing" - the install event has fired, but not yet complete
// "installed"  - install complete -> update available
// "activating" - the activate event has fired, but not yet complete
// "activated"  - fully active
// "redundant"  - discarded. Either failed install, or it's been
//                replaced by a newer version
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
export type ServiceWorkerStatus = ServiceWorkerState | 'unavailable'

export interface ServiceWorkerOptions extends RegistrationOptions {
  /**
   * if a new service worker is waiting (installed) intercept the next navigation
   * to make a page reload to activate the new service worker
   *
   * default: `true`
   */
  interceptNavigate?: boolean

  /**
   * default: 30 minutes; set to `0` or `null` to not regulary check for updates
   */
  updateIntervall?: number | null | false
}

export interface ServiceWorkerActivateInfo {
  from?: string | URL | null | undefined
  to?: string | URL | null | undefined
}

export interface ServiceWorkerStore extends Readable<ServiceWorkerStatus> {
  activate: (info?: ServiceWorkerActivateInfo) => Promise<boolean>
}

export function registerServiceWorker(
  scriptURL: string | URL,
  {
    interceptNavigate = true,
    updateIntervall = (typeof __SVELTEKIT_APP_VERSION_POLL_INTERVAL__ !== 'undefined' &&
      parseInt(__SVELTEKIT_APP_VERSION_POLL_INTERVAL__ as any, 10)) ||
      30 * 60 * 1000,
    ...options
  }: ServiceWorkerOptions = {},
): ServiceWorkerStore {
  const serviceWorker = writable<ServiceWorker | null>(null)

  if (browser && 'serviceWorker' in navigator) {
    // First, do a one-off check if there's currently a
    // service worker in control.
    if (navigator.serviceWorker.controller) {
      // 'activating' or 'active'
      serviceWorker.set(navigator.serviceWorker.controller)
    }

    if (dev) {
      navigator.serviceWorker
        .getRegistration(scriptURL)
        .then(async (registration) => {
          if (registration) {
            const unregistered = await registration.unregister()

            if (!unregistered) {
              throw new Error('registration.unregister() failed')
            }
          }
        })
        .catch((error) => {
          console.warn('Service worker unregistration failed:', error)
        })
    } else {
      // TODO: unregister current service worker?
      let updateTimer: ReturnType<typeof setInterval>
      let cleanup: (() => void) | undefined
      let update: (() => void) | undefined

      onDestroy(
        updated.subscribe(($updated) => {
          if ($updated) {
            console.debug('new app version detected')
            update?.()
          }
        }),
      )

      onDestroy(() => {
        clearInterval(updateTimer)
        cleanup?.()
      })

      navigator.serviceWorker
        .register(scriptURL, options)
        .then((registration) => {
          update = () => {
            registration.update().catch((error) => {
              console.warn('Service worker update failed:', error)
            })
          }

          if (updateIntervall) {
            updateTimer = setInterval(update, updateIntervall)
          }

          function onUpdateFound(this: ServiceWorkerRegistration) {
            // keep looking for updates
            serviceWorker.set(this.installing || this.waiting || this.active)
          }

          onUpdateFound.call(registration)

          registration.addEventListener('updatefound', onUpdateFound)
          cleanup = () => registration.removeEventListener('updatefound', onUpdateFound)
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error)
        })
    }
  }

  const status = writable<ServiceWorkerStatus>('unavailable')

  function onStateChange(this: ServiceWorker | null | undefined | void): void {
    let state: ServiceWorkerStatus = this?.state || 'unavailable'

    // normalize the state
    // activating & activated
    if (state.startsWith('activat') && !navigator.serviceWorker.controller) {
      // the service worker is active but is not yet controlling this page
      // installing & installed
      state = state.replace('activat', 'install') as 'installed'
    }

    status.set(state)
  }

  let $status: ServiceWorkerStatus
  onDestroy(status.subscribe((_) => ($status = _)))

  let $serviceWorker: ServiceWorker | null
  onDestroy(
    serviceWorker.subscribe(
      (_) => {
        $serviceWorker = _
        onStateChange.call(_)
        _?.addEventListener('statechange', onStateChange)
      },
      (_) => {
        _?.removeEventListener('statechange', onStateChange)
      },
    ),
  )

  if (interceptNavigate !== false) {
    // If a new service worker has been registered — do a full page refresh on the next navigation
    beforeNavigate(({ from, to, cancel }) => {
      if (to && $status === 'installed') {
        cancel()
        activate(() => {
          location.href = to.url.href
        })
      }
    })
  }

  function activate(callback: (activated: boolean) => void): void {
    if (!$serviceWorker) return callback(true)

    // Not using $status here because we need the unnormalized state name here
    function onStateChange(this: ServiceWorker): void {
      switch (this.state) {
        case 'installed': {
          this.postMessage({ type: 'activate' })
          break
        }

        case 'activated': {
          callback(true)
          return this.removeEventListener('statechange', onStateChange)
        }

        case 'redundant': {
          callback(false)
          return this.removeEventListener('statechange', onStateChange)
        }

        // all other states -> wait for one of the above
      }
    }

    onStateChange.call($serviceWorker)
    $serviceWorker.addEventListener('statechange', onStateChange)
  }

  return {
    subscribe: status.subscribe,
    activate: () => new Promise((resolve) => activate(resolve)),
  }
}
