# Crypto Frontend

React 18 + TypeScript + Tailwind CSS frontend for cryptocurrency market data dashboard.

## Features

- Real-time market data dashboard with OHLCV cards
- Live price banner with bid/ask prices
- Trend indicators with arrows for price changes
- Dark theme with modern UI design
- Automatic data refresh every 5 seconds
- Error handling with retry functionality
- Loading states and skeleton components

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Set `REACT_APP_API_URL` to your backend API URL (default: http://localhost:3001)

## Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Components

### Dashboard
Main dashboard component that displays market data cards:
- Open, High, Low, Close prices
- Volume with formatted display (K/M suffixes)
- Account Equity placeholder
- Market information panel

### LivePriceBanner
Top banner showing real-time price information:
- Current BTC/USDT price
- Mark price calculation
- Bid/Ask spread

### DataCard
Reusable card component with:
- Loading skeleton states
- Trend arrows for price changes
- Custom value formatting
- Hover effects

## API Integration

The frontend connects to the backend API with:
- Automatic retry logic for failed requests
- Exponential backoff for rate limiting
- TypeScript interfaces for type safety
- Centralized API service layer

## Styling

Built with Tailwind CSS featuring:
- Dark theme (gray-900 background)
- White cards with shadows
- Primary blue accent color
- Responsive grid layout
- Modern typography and spacing
