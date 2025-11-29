# Xteam - Cross-Team Coordination System

A web-based information sharing and tracking system designed to improve cross-team coordination, vendor performance tracking, and accountability.

## Features

### Step 1 (Current Implementation)

- **Text Input**: Submit notes, comments, and text information
- **Barcode/QR Code Scanning**: Scan barcodes and QR codes using device camera
- **Photo Uploads**: Upload and store photos with drag-and-drop support
- **File Uploads**: Upload individual files with preview
- **Folder Uploads**: Upload entire folders at once
- **Archive Support**: Upload ZIP, RAR, 7Z, TAR, GZ archives
- **Client-Side Database**: All data stored locally in browser using IndexedDB
- **Categorization**: Organize records by category (Vendor Performance, Cross-Team Issue, Quality Report, Delay Report, Achievement, Other)
- **Record Management**: View, filter, and delete records
- **Data Export**: Export all records to JSON format

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: IndexedDB (client-side storage)
- **QR/Barcode Scanner**: html5-qrcode library
- **Hosting**: GitHub Pages

## Local Development

1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. Start using the application immediately (no build step required)

For local development with live reload, you can use any static file server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

## Deployment to GitHub Pages

### Initial Setup

1. Create a new repository named `helsinkimusken.github.io` on GitHub
2. Initialize git in your local Xteam directory:

```bash
cd d:/Tools/Xteam
git init
git add .
git commit -m "Initial commit: Xteam coordination system"
git branch -M main
git remote add origin https://github.com/helsinkimusken/helsinkimusken.github.io.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to repository Settings
   - Navigate to Pages section
   - Under "Source", select "Deploy from a branch"
   - Select branch `main` and folder `/ (root)`
   - Click Save

4. Your site will be live at: https://helsinkimusken.github.io

### Updating the Site

After making changes to the code:

```bash
git add .
git commit -m "Description of changes"
git push origin main
```

Changes will automatically deploy to GitHub Pages within a few minutes.

## Usage Guide

### Submitting a Record

1. **Enter Your Information**:
   - Add text in the text input area
   - Scan barcodes/QR codes using the scanner button
   - Upload photos, files, folders, or archives
   - Enter your name
   - Select a category

2. **Submit**: Click the "Submit Information" button

3. **View Records**: All submitted records appear in the right panel

### Managing Records

- **Filter**: Use the category dropdown to filter records
- **Export**: Click "Export Data" to download all records as JSON
- **Delete**: Click the delete button on individual records
- **Clear All**: Use "Clear All Data" to remove all records (with confirmation)

### Camera Permissions

For barcode/QR scanning to work:
- Allow camera access when prompted by your browser
- Ensure you're using HTTPS (required for camera access)
- On mobile devices, use the rear camera for better scanning

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 11.3+)
- Mobile browsers: Full support with camera access

## Data Storage

- All data is stored locally in your browser using IndexedDB
- Data persists between sessions
- Each browser/device maintains its own database
- Photos and small files (< 1MB) are stored as base64
- Larger files store metadata only

## Future Enhancements (Step 3)

- Real-time dashboard and analytics
- Data synchronization across devices
- Advanced filtering and search
- Performance metrics and reports
- Team collaboration features

## Security Notes

- This is a client-side only application
- Data is stored locally in the browser
- No server-side processing or storage
- For production use, consider adding:
  - Backend database for data persistence
  - User authentication
  - Data encryption
  - Server-side file storage

## Support

For issues or questions, refer to the PRD.md file or contact the development team.

## License

Internal use only - All rights reserved
