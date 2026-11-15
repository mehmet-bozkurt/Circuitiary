import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    zoomGroup: 'Grafik yakınlaştırma',
    fitAll: 'Tüm hücreleri sığdır',
    zoomOut: 'Grafiği uzaklaştır',
    zoomIn: 'Grafiği yakınlaştır',
    loadError: '2D bağlantı haritası yüklenemedi. İnternet bağlantını denetleyip yeniden dene; sorun sürerse sayfayı yenile.',
    retry: 'Yeniden dene',
  },
  en: {
    zoomGroup: 'Graph zoom',
    fitAll: 'Fit all cells',
    zoomOut: 'Zoom the graph out',
    zoomIn: 'Zoom the graph in',
    loadError: 'The 2D connection map could not be loaded. Check your internet connection and try again; if the problem continues, reload the page.',
    retry: 'Try again',
  },
})
