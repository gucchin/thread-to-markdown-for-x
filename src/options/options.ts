// Options page entry: binds the options controller to chrome.storage.sync.
import { initOptions } from './optionsController';

void initOptions(document, chrome.storage.sync);
