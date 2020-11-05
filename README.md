# Wombat

Wombat is a standalone client-side URL rewriting system that performs the
rewrites through targeted JavaScript overrides.

Wombat was originally included in and distributed as part of [pywb](https://github.com/webrecorder/pywb)
but has now been refactored and split off into this module for improved maintainance.

pywb release >=2.3 rely on this standalone module. This standalone
module now includes a thorough testing suite that checks for the correctness of
the overrides with respect to web standards.

The remaining portions of this documentation covers the development and
testing of the library, as well as, the
creation of the system from library.

Before we continue, please note the following terminology:

  - `bundle`  
    A single file that is the result of concatenating multiple source
    files into a single file

  - `bundle entry point`  
    The root file that imports all additional functionality required to
    produce the resulting bundle

## Components

The Wombat client-side URL rewriting system is comprised of three files
(bundles)

  - `wombat.js`
  - `wombatProxyMode.js`
  - `wombatWorkers.js`

These files are located in the static directory of pywb and are
generated as part of the library's build step.

The library can be found in the `wombat` directory located in the root
of the projects repository (i.e. `pywb/wombat`).

**Note**: We do not go into details of each file included in a bundle as
those details are out of the scope of this documentation and ask those
interested to consult the documentation included in each files source
code.

**wombat.js**

This bundle is the primary bundle of Wombat as it is used in both
non-proxy recording and replay.

The entry point for this bundle is
`src/wbWombat.js`.

An representation of the bundles contents is shown below.

    wbWombat.js
     - wombat.js
       - funcMap.js
       - customStorage.js
       - wombatLocation.js
       - listeners.js
       - autoFetchWorker.js

**wombatProxyMode.js**

This bundle is an stripped down version of
`wombat.js` that applies a minimal set of
overrides to the browsers JavaScript APIs in order to facilitate pywb's
proxy recording mode

The entry point for this bundle is
`src/wbWombatProxyMode.js`

An representation of the bundles contents is shown below.

    wbWombatProxyMode.js
     - wombatLite.js
       - autoFetchWorkerProxyMode.js

**wombatWorkers.js**

This bundle is not a bundle per say but rather a flat file that applies
the minimal set of overrides necessary to ensure that JavaScript web and
service worker's operate as expected in both non-proxy recording and
replay.



