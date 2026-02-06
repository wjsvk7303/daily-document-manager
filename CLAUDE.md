# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**프로젝트명**: 문서를 일자로 보관 (Daily Document Manager)

A browser-based document management application using local storage for persistent data storage. No backend required.

## Architecture

- **Single Page Application**: Pure HTML/CSS/JavaScript without frameworks
- **Storage**: Browser LocalStorage API for data persistence
- **Structure**: All code in a single `index.html` file for easy deployment

## Core Features

- Document CRUD (Create, Read, Update, Delete)
- Date-based document organization and filtering
- Document title and content management
- Category classification system
- Search functionality
- Export/Import capabilities

## Data Schema

Documents are stored in LocalStorage with this structure:
```javascript
{
  id: string,           // Unique identifier
  title: string,        // Document title
  content: string,      // Document content
  category: string,     // Category name
  createdAt: string,    // ISO date string
  updatedAt: string     // ISO date string
}
```

## Development

Open `index.html` directly in a browser. No build process required.

## Key Implementation Notes

- All data is stored in `localStorage.getItem('documents')`
- Categories are dynamically extracted from existing documents
- Date filtering uses JavaScript Date objects for comparison
- Korean language UI
