# SideStage

Music discovery for underrated artists. SideStage is an installable web app: add it to your phone's home screen and it opens full-screen like an app. It keeps working offline after your first visit.

**Open the app:** https://saiyuro.github.io/Sidestage/

## Install on iPhone

Use **Safari**. Chrome and Firefox on iPhone can't add web apps to the Home Screen.

1. Open the link above in Safari.
2. Tap the **Share** button (a square with an up arrow).
3. Scroll down, tap **Add to Home Screen**, then tap **Add**.
4. Open SideStage from your Home Screen.

## Install on Android

1. Open the link above in Chrome.
2. Tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
   Chrome may also show an "Install SideStage" card on the Discover page.

## Notes

- Accounts and lists are saved in the browser where you use them. On iPhone, the Home Screen app can keep its own separate data from Safari, so sign up inside the app you plan to use.
- Artists and songs are fictional. Previews are generated tones, not real recordings.
- The first visit needs an internet connection. After that, the app opens offline.

## For the owner: publishing updates

- Edit the files, then change the `CACHE` name at the top of `sw.js` (for example `sidestage-shell-v3` to `sidestage-shell-v4`) whenever `sw.js` or the list of cached files changes.
- Changes to `index.html` alone reach returning users within one or two visits.
