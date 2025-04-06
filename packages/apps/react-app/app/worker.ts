import { Github } from './modules/github';

const github = new Github();

self.onmessage = async (event: MessageEvent<any>) => {
  github.handleMessage(event, (callbackData) => {
    postMessage(callbackData);
  });
};
