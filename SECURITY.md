# Security Policy: BLX Realty CRM

## Device Security Controls

The application utilizes an Electron wrapper containing strict system policies:

- **No Clipboard Copying**: Right-clicks and `Ctrl+C` commands are neutralized.
- **Auto Screen Protection**: `setContentProtection(true)` prevents native windows grab tools on sensitive views.
- **Anti-Tampering Diagnostics**: Checking of launch argument parameters prevents dynamic debug injections.
- **Device Fingerprinting**: Active user sessions are locked to unique hardware identifier signatures.
- **Encrypted Storage**: Local configurations and attachments are secured using AES-256 blocks.

## Vulnerability Reporting

Please send vulnerability logs to security@blxrealty.com.
