# Assurance Regent Branding Update

The application branding has been updated to use the supplied Assurance Regent logo.

## Implemented

- Replaced the text-only `AR` sidebar badge with the supplied Assurance Regent symbol.
- Added the Assurance Regent logo to the **Sign in** dialog.
- Added the Assurance Regent logo to the **Sign up** dialog.
- Embedded optimized logo image data directly inside the protected stylesheet, so these interface logos do not depend on an external image path or third-party URL.
- Preserved the protected `.arc` deployment format.
- Kept both GitHub Pages static-preview and Node/Express deployment structures intact.

## Deployment note

After replacing the repository files, publish the repository again. GitHub Pages may temporarily serve cached files, so a hard refresh may be required after deployment.
