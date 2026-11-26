import swissGridImg from '../assets/images/header_swiss_grid_1794554431619.jpg';
import indigoWavesImg from '../assets/images/header_indigo_waves_1794554430900.jpg';
import botanicalStudioImg from '../assets/images/header_botanical_studio_1794554431340.jpg';

export interface HeaderBannerPreset {
  id: string;
  label: string;
  src: string;
}

export const HEADER_BANNER_PRESETS: HeaderBannerPreset[] = [
  {
    id: 'preset:swiss_grid',
    label: 'Swiss Relief',
    src: swissGridImg,
  },
  {
    id: 'preset:indigo_waves',
    label: 'Indigo Layers',
    src: indigoWavesImg,
  },
  {
    id: 'preset:botanical_studio',
    label: 'Sunlit Studio',
    src: botanicalStudioImg,
  },
];

export function resolveHeaderImageUrl(headerImage: string | null | undefined): string | null {
  if (!headerImage) return null;
  const preset = HEADER_BANNER_PRESETS.find((p) => p.id === headerImage);
  if (preset) return preset.src;
  return headerImage;
}

export interface ThemePreset {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;
}

export const FORM_THEME_PRESETS: ThemePreset[] = [
  { id: 'swiss', name: 'Swiss Crisp', primaryColor: '#4F46E5', backgroundColor: '#FAFAFA' },
  { id: 'indigo', name: 'Midnight Cobalt', primaryColor: '#4338CA', backgroundColor: '#F4F6FB' },
  { id: 'emerald', name: 'Forest Sage', primaryColor: '#059669', backgroundColor: '#F3FAF7' },
  { id: 'rose', name: 'Editorial Crimson', primaryColor: '#E11D48', backgroundColor: '#FDF4F6' },
  { id: 'slate', name: 'Monochrome Ink', primaryColor: '#18181B', backgroundColor: '#F4F4F5' },
];
