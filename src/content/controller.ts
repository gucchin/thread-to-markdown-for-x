import type {
  ExtractAndCopyRequest,
  ExtractAndCopyResponse,
  TriggerSource,
} from '../shared/messages';

/**
 * Wraps the pipeline so that concurrent triggers (button + popup + shortcut) share one run
 * instead of copying twice, and reports every result once through `onResult` with the source
 * of the trigger that started the run.
 */
export function createController(
  task: () => Promise<ExtractAndCopyResponse>,
  onResult: (response: ExtractAndCopyResponse, source: TriggerSource) => void = () => {},
): { run: (source: TriggerSource) => Promise<ExtractAndCopyResponse> } {
  let running: Promise<ExtractAndCopyResponse> | null = null;
  return {
    run(source) {
      running ??= task()
        .then((response) => {
          onResult(response, source);
          return response;
        })
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtractAndCopyResponse) => void,
) => boolean;

/** Answers EXTRACT_AND_COPY requests. Returns true to keep the channel open for the async reply. */
export function createMessageListener(
  isRequest: (message: unknown) => message is ExtractAndCopyRequest,
  run: (source: TriggerSource) => Promise<ExtractAndCopyResponse>,
): MessageListener {
  return (message, _sender, sendResponse) => {
    if (!isRequest(message)) return false;
    void run(message.source ?? 'popup').then(sendResponse);
    return true;
  };
}
