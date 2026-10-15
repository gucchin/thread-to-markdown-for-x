// Service worker. Stateless by design (MV3 may stop it at any time): the listener is registered
// at the top level on every start, and nothing is kept between events.
import { handleCommand } from './commands';

chrome.commands.onCommand.addListener((command, tab) => {
  void handleCommand(command, tab, {
    queryActiveTab: async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0],
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  });
});
