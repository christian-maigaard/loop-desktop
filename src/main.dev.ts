import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, Menu, Tray, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { menubar } from 'menubar';
import fetch from 'node-fetch';
import Jimp from 'jimp';
import TrayGenerator from './TrayGenerator';
import { NSdisplayData, Properties } from './types';
export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let tray: Tray | null = null;
let tray2: Tray | null = null;
let tray5: Tray | null = null;
let tray4: Tray | null = null;
let tray3: Tray | null = null;

let nightscoutBaseURL = 'https://maigaard.herokuapp.com';

const isMac = process.platform === 'darwin';

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

const doImageStuff = (glucose: string, exportImageName: string) => {
  const imgExported = exportImageName;

  const textData = {
    text: glucose.replace('.', ','), // the text to be rendered on the image
    maxWidth: 16 + 1,
    maxHeight: 16,
    placementX: -1,
    placementY: 0,
  };

  const image = new Jimp(16, 16, '#000000ff', (err) => {
    if (err) console.log(err);
  });

  Jimp.loadFont(getAssetPath('fonts/tahoma.fnt'))
    .then((font) => [image, font])
    .then((data) => {
      const tpl: any = data[0];
      const font: any = data[1];

      return tpl.print(
        font,
        textData.placementX,
        textData.placementY,
        {
          text: textData.text,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
        },
        textData.maxWidth,
        textData.maxHeight
      );
    })
    .then((tpl: any) => {
      tpl.quality(100).write(imgExported);
      return 'succes';
    }) // catch errors
    .catch((err) => {
      console.error(err);
      return 'err';
    });
};

const createWindowsTrayIcons = async (
  glucoseMmol: string,
  differenceString: string,
  direction: string,
  operator: string
) => {
  doImageStuff(glucoseMmol, getAssetPath('icons/glucose.png'));
  doImageStuff(differenceString, getAssetPath('icons/delta.png'));
  await doImageStuff(operator, getAssetPath('icons/operator.png'));

  tray2?.setImage(getAssetPath('icons/glucose.png'));
  tray5?.setImage(getAssetPath('icons/operator.png'));
  tray4?.setImage(getAssetPath('icons/delta.png'));
  tray3?.setImage(getAssetPath(`arrows/16x16_${direction}_white.ico`));
};

const handleGlucoseUpdate = async (nsDisplayData: NSdisplayData) => {
  const operator = nsDisplayData.deltaDisplay.charAt(0);
  // remove math operators from text, since this cant be displayed properly on windows tray icons
  const desltaDisplayWindows = nsDisplayData.deltaDisplay
    .replace('-', '')
    .replace('+', '');

  if (!isMac)
    createWindowsTrayIcons(
      nsDisplayData.sgv,
      desltaDisplayWindows,
      nsDisplayData.direction,
      operator
    );

  const displayTitle = ` ${nsDisplayData.sgv} ${nsDisplayData.deltaDisplay} ${nsDisplayData.directionArrow}`;
  tray?.setToolTip(displayTitle); // Windows specific
  tray?.setTitle(displayTitle); // macOS specific
};

const fetchGlucose = async () => {
  return fetch(`${nightscoutBaseURL}/api/v2/properties`)
    .then((response: any) => response.json())
    .then((result: any) => result)
    .catch((error: any) => console.log(error));
};

const handleGlucose = (properties: Properties) => {
  if (!properties || !properties.bgnow.sgvs[0].scaled) return;
  const nsGlucoseData: NSdisplayData = {
    sgv: properties.bgnow.sgvs[0].scaled ?? '',
    deltaDisplay: properties.delta.display,
    directionArrow: properties.direction.label,
    direction: properties.direction.value,
  };
  handleGlucoseUpdate(nsGlucoseData);
};

const updateGlucose = () => {
  fetchGlucose().then((r) => handleGlucose(r));
  setInterval(() => {
    fetchGlucose().then((r) => handleGlucose(r));
  }, 10000);
};

const rightClickMenu = () => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray?.popUpContextMenu(contextMenu);
};

const start = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const browserWindowOptions = {
    width: 600,
    height: 450,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
    },
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
  };

  if (!isMac) {
    const T = new TrayGenerator(getAssetPath('icons/blank_tray_icon.png'));
    tray2 = T.createTray();
    const T5 = new TrayGenerator(getAssetPath('icons/blank_tray_icon.png'));
    tray5 = T5.createTray();
    const T4 = new TrayGenerator(getAssetPath('icons/blank_tray_icon.png'));
    tray4 = T4.createTray();
    const T3 = new TrayGenerator(getAssetPath('icons/blank_tray_icon.png'));
    tray3 = T3.createTray();
  }
  const iconPath = !isMac ? 'icons/16x16_white.ico' : 'icons/tray_icon_mac.png';
  const reactAppPath = `file://${__dirname}/index.html`;
  const mb = menubar({
    index: reactAppPath,
    icon: getAssetPath(iconPath),
    preloadWindow: true,
    browserWindow: browserWindowOptions,
  });

  mb.on('ready', () => {
    mb.window?.webContents.setAudioMuted(true);

    // SSL/TSL: this is the self signed certificate support
    mb.app.on(
      'certificate-error',
      (event, webContents, url, error, certificate, callback) => {
        // On certificate error we disable default behaviour (stop loading the page)
        // and we then say "it is all fine - true" to the callback
        event.preventDefault();
        callback(true);
      }
    );
    mb.app?.dock?.hide(); // Hides dock on mac
    tray = mb.tray;
    mb.tray.on('right-click', rightClickMenu);
    updateGlucose();
    mb.app.setLoginItemSettings({
      openAtLogin: true,
    });
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(start).catch(console.log);

ipcMain.handle('settings-save', (event, ...args) => {
  const settings = args[0];
  nightscoutBaseURL = settings.nightscoutUrl;
});
