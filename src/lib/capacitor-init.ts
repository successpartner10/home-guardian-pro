import { Capacitor } from '@capacitor/core';

/**
 * Initialize Capacitor native plugins when running as a native app.
 * Safe to call on web — all calls are guarded by platform checks.
 */
export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  // ── Status Bar: transparent overlay ────────────────────────────────────────
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#00000000' });
  } catch (e) {
    console.warn('[Capacitor] StatusBar plugin not available:', e);
  }

  // ── Splash Screen: hide after React is ready ──────────────────────────────
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('[Capacitor] SplashScreen plugin not available:', e);
  }

  // ── Android Back Button: navigate back or minimize ────────────────────────
  try {
    const { App: CapApp } = await import('@capacitor/app');
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    });
  } catch (e) {
    console.warn('[Capacitor] App plugin not available:', e);
  }
}
