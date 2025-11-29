# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xteam (Cross-Team) is a coordination and vendor tracking system designed to address cross-team collaboration challenges. The system draws inspiration from Taobao's vendor performance tracking and DingTalk's coordination features.

**Core Problem Being Solved:**
- Poor cross-team coordination and accountability
- Lack of vendor/supplier performance tracking
- Insufficient visibility into team member contributions and delays
- Need for data-driven pressure and motivation mechanisms

## Project Architecture

### Step 1: Information Sharing System (Current Phase)
A web-based UI and database system for sharing and storing:
- Text input
- Barcode/QR code scanning
- Photo uploads
- File uploads (individual files, folders, zip/rar archives)

### Step 2: Deployment
- **Live URL:** https://helsinkimusken.github.io
- **Git Repository:** helsinkimusken.github.io (GitHub Pages)
- The local project (Xteam) syncs with the GitHub repository

### Step 3: Analytics (Future)
Real-time dashboard and data analysis for uploaded information.

## Development Workflow

### GitHub Pages Deployment
This project is deployed via GitHub Pages. To sync local changes:

```bash
# Initial setup (if not already done)
git init
git remote add origin https://github.com/helsinkimusken/helsinkimusken.github.io.git

# Regular workflow
git add .
git commit -m "Description of changes"
git push origin main
```

Changes pushed to the `main` branch will automatically deploy to https://helsinkimusken.github.io.

## Technical Considerations

### File Upload Requirements
The system must handle multiple file types and formats:
- Image files (for photos)
- Archive files (zip/rar)
- Barcode/QR code data
- Directory structures (folder uploads)

### Database Design
Plan for storing:
- User-submitted text content
- File metadata and references
- Barcode/QR code scan results
- Timestamps and user attribution
- Future: Performance metrics, comments, and tracking data (Step 3)

### Frontend Considerations
- Must support file upload UI (drag-drop, file picker)
- Barcode/QR code scanning (likely using device camera)
- Responsive design for mobile and desktop access
- GitHub Pages constraints (static site or client-side framework)
