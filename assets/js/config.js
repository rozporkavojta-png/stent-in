/* Nastavení webu kudyprojedu.cz
   googleMapsApiKey: klíč k Google Maps JavaScript API (console.cloud.google.com → APIs → Maps JavaScript API + Maps Embed API).
   Když je prázdný, mapa běží na OpenStreetMap (Leaflet) a Google Maps se používají přes odkazy:
   navigace, Street View a vložená mapa u detailu místa – ty fungují i bez klíče. */
window.KP_CONFIG = {
  googleMapsApiKey: '',
  defaultCenter: { lat: 49.3, lng: 13.6 }, // Česko a Bavorsko
  defaultZoom: 6,
};
