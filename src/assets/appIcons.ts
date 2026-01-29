// App icon imports - bundled by Vite for proper path resolution in packaged apps
import blueIcon from '../../public/app-icons/Blue.png';
import emeraldIcon from '../../public/app-icons/Emerald.png';
import greyIcon from '../../public/app-icons/Grey.png';
import pinkIcon from '../../public/app-icons/Pink.png';
import violetIcon from '../../public/app-icons/Violet.png';
import yellowIcon from '../../public/app-icons/Yellow.png';
import defaultIcon from './ThoughtsPlus.png';

export const APP_ICONS: Record<string, string> = {
    ThoughtsPlus: defaultIcon,
    Blue: blueIcon,
    Emerald: emeraldIcon,
    Grey: greyIcon,
    Pink: pinkIcon,
    Violet: violetIcon,
    Yellow: yellowIcon,
};

export const getAppIcon = (name: string): string => {
    return APP_ICONS[name] || APP_ICONS.ThoughtsPlus;
};
