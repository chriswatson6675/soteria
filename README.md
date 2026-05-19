# Holiday Travel Companion App

A comprehensive web-based travel planning and management tool designed to help travelers organize their trips with ease. **Works online AND offline!**

## Features

### 🗺️ Map
- Interactive map powered by Leaflet and OpenStreetMap
- Save up to 6 favorite destinations as quick presets
- Plan routes between locations
- GPS integration for real-time location tracking
- Get directions via Google Maps (transit, walking, driving, cycling)
- **Works offline** — previously viewed map areas are cached

### 🌤️ Weather
- Real-time weather data for your current location
- 7-day weather forecast with temperature, precipitation, wind speed, and UV index
- Works worldwide with automatic timezone detection
- *Requires internet connection for updates*

### 🏨 Accommodation Management
- Save hotel and accommodation details for each destination
- Store names, addresses, phone numbers, and websites
- Add notes like check-in times and booking references
- One-click access to call or visit hotel websites
- **Fully offline** — all data stored on your device

### 📄 Documents
- Store important travel documents (PDFs and images)
- Upload passport scans, insurance documents, tickets, etc.
- Drag-and-drop file upload
- Link to a shared Google Drive folder for backup
- **Fully offline** — all documents stored locally on your device

### 🆘 Emergency Contacts
- Save your parent/guardian contact number
- Quick access to emergency numbers (999, 112, 911, 000)
- Store insurance helpline number
- All contact info readily available when needed
- **Fully offline** — always accessible

### 💱 Currency Converter
- Real-time currency exchange rates
- Convert between major currencies (GBP, EUR, USD, JPY, AUD, CAD, CHF, SGD, HKD)
- **Works offline** — uses last known exchange rates if no internet
- Manual update button to refresh rates when online

## Offline Support

### ✅ Works Completely Offline
- Emergency contacts
- Accommodation details
- Saved documents (PDFs and images)
- Map navigation (for previously viewed areas)
- Currency conversion (using cached rates)
- All interactive features

### 📡 Needs Internet For
- Live weather updates
- Latest currency exchange rates
- Getting directions in Google Maps
- Downloading new map areas
- Uploading to Google Drive backup

### How It Works
The app automatically detects when you go offline and:
1. Shows a notification at the top of the screen
2. Disables internet-dependent features
3. Continues to work with all locally stored data
4. When you come back online, it automatically refreshes weather and currency rates

## How to Use

1. Open the app in a web browser (or visit the GitHub Pages URL)
2. Allow location access for GPS features
3. Use the tabs to navigate between Map, Documents, Emergency, and Currency features
4. Click on preset locations to view them on the map
5. Add your own places by clicking on the map and saving them to preset slots
6. Download the app to your phone's home screen for easy access (works offline!)

## Project Structure

```
travelapp/
├── index.html      # Structure of the webpage
├── style.css       # All styling and layout
├── script.js       # All interactive features
├── README.md       # This file
└── .gitignore      # Files to exclude from GitHub
```

## Technology Used

- **HTML5** — Page structure
- **CSS3** — Styling and responsive design
- **Vanilla JavaScript** — All interactive features
- **Leaflet.js** — Interactive maps
- **OpenStreetMap** — Map data
- **Open-Meteo API** — Weather data
- **ExchangeRate-API** — Currency exchange rates
- **Font Awesome** — Icons

## Data Storage

- All data is stored locally in your browser using `localStorage`
- No personal data is sent to external servers (except API calls for weather and currency)
- Data persists between browser sessions and even when offline
- Clearing browser data/cache will delete saved information
- Documents are stored directly on your device (up to ~50 MB depending on browser)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Works on desktop and mobile browsers
- Can be installed as a web app on phones (Android/iOS)

## Installing on Your Phone

**Android:**
1. Open in Chrome
2. Tap the three-dot menu
3. Tap "Install app" or "Add to home screen"

**iOS:**
1. Open in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

The app will then work offline like a native app!

## Features in Development

- Offline map tile caching (pre-download maps for areas)
- Multi-language support
- Export trip details as PDF
- Share itineraries with friends
- Voice navigation

## License

MIT License — feel free to use and modify

## Contributing

If you'd like to contribute improvements, please:
1. Make changes to the code
2. Test in your browser (with internet and offline)
3. Submit suggestions or improvements

---

**Created with ❤️ for travelers everywhere**

