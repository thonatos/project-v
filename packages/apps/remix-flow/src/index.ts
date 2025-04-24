import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { KnownDevices } from '@cloudflare/puppeteer';
import { CORS_ORIGINS } from './constants';
import { getBrowser } from './util';

type Env = {
  BUCKET: R2Bucket;
  BROWSER: Fetcher;
  WORKFLOW: Workflow;
};

type Params = {
  url: string;
  key?: string;
  selector?: string;
};

export class ScreenshotWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const key = event.payload.key;
    const url = event.payload.url;
    const selector = event.payload.selector;

    // screenshot the page
    const data = await step.do(
      'screenshot',
      {
        retries: {
          limit: 1,
          delay: '10 seconds',
        },
        timeout: '2 minutes',
      },
      async () => {
        const endpoint = this.env.BROWSER;
        let browser;
        let handler;

        const { browser: _browser } = await getBrowser(endpoint);
        browser = _browser;

        if (!browser) {
          throw new Error('Failed to connect to browser');
        }

        const page = await browser?.newPage();
        await page.emulate(KnownDevices['iPhone 13 Pro']);

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        handler = page;

        if (selector) {
          handler = await page.$(selector);
        }

        if (!handler) {
          throw new Error('Target element not found');
        }

        const screenshot = (await handler.screenshot({
          omitBackground: false,
          encoding: 'binary',
          type: 'webp',
          quality: 50,
        })) as Buffer | undefined;

        if (!screenshot) {
          throw new Error('Failed to take screenshot');
        }

        return screenshot;
      }
    );

    // upload the screenshot to r2
    await step.do('upload to r2', async () => {
      const fileName = key || Date.now();
      const fileKey = `remix/screenshot-${fileName}.webp`;
      const res = await this.env.BUCKET.put(fileKey, data);
      console.log('Screenshot uploaded to R2:', res.key);
    });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const source = new URL(req.url);
    const id = source.searchParams.get('id');
    const key = source.searchParams.get('key');
    const url = source.searchParams.get('url');
    const selector = source.searchParams.get('selector');

    const target = new URL(url || '');
    const targetHost = target.host;

    try {
      if (id) {
        console.log('Fetching workflow instance:', id);

        const instance = await env.WORKFLOW.get(id);
        return Response.json({
          data: {
            id,
            status: await instance.status(),
          },
        });
      }

      console.log('Creating new workflow instance:', url);

      if (!url) {
        return Response.json(
          {
            error: 'Missing url parameter',
          },
          { status: 400 }
        );
      }

      const passed = CORS_ORIGINS.some((o) => o.includes(targetHost));
      if (!passed) {
        return Response.json(
          {
            error: 'Invalid url',
          },
          { status: 400 }
        );
      }

      const instance = await env.WORKFLOW.create({
        params: {
          url,
          key,
          selector,
        },
      });

      console.log('Workflow instance created:', instance.id);

      return Response.json({
        data: {
          id: instance.id,
          details: await instance.status(),
        },
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      return Response.json(
        {
          error: 'Failed to create workflow',
        },
        { status: 500 }
      );
    }
  },
};
