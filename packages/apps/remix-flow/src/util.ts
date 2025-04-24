import puppeteer from '@cloudflare/puppeteer';
import type { BrowserWorker, ActiveSession } from '@cloudflare/puppeteer';

export const getActiveSession = async (endpoint: BrowserWorker) => {
  const sessions: ActiveSession[] = await puppeteer.sessions(endpoint);
  const sessionsIds = sessions
    .filter((v) => {
      return !v.connectionId; // remove sessions with workers connected to them
    })
    .map((v) => {
      return v.sessionId;
    });

  return sessionsIds;
};

export const getRandomSession = async (endpoint: BrowserWorker) => {
  const sessionsIds = await getActiveSession(endpoint);

  if (sessionsIds.length === 0) {
    return;
  }

  const sessionId = sessionsIds[Math.floor(Math.random() * sessionsIds.length)];

  return sessionId!;
};

export const getBrowser = async (endpoint: BrowserWorker) => {
  let browser;
  let sessionId = await getRandomSession(endpoint);

  if (sessionId) {
    try {
      browser = await puppeteer.connect(endpoint, sessionId);
    } catch (e) {
      // another worker may have connected first
      throw new Error(`Failed to connect to ${sessionId}. Error ${e}`);
    }
  }

  if (!browser) {
    // no open sessions, launch new session
    browser = await puppeteer.launch(endpoint, {
      keep_alive: 600000,
    });
  }

  // get current session id
  sessionId = browser.sessionId();
  console.log('sessionId', sessionId);

  return {
    browser,
    sessionId,
  };
};
