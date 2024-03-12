import { atom, createStore } from 'jotai';
import {
  Keys,
  Client,
  PublicKey,
  EventBuilder,
  Filter,
  Timestamp,
  Event,
  nip04_decrypt,
  initLogger,
  loadWasmAsync,
} from '@rust-nostr/nostr-sdk';

const NOSRT_ASSETS_NPUB_KEY = 'npub1dy7n73dcrs0n24ec87u4tuagevkpjnzyl7aput69vmn8saemgnuq0a4n6y';

export const keysAtom = atom<Keys | null>(null);
export const clientAtom = atom<Client | null>(null);
export const statusAtom = atom(false);

export const nostrStore = createStore();
nostrStore.set(keysAtom, null);
nostrStore.set(clientAtom, null);
nostrStore.set(statusAtom, false);

// subscribe
nostrStore.sub(keysAtom, () => {
  console.log('keysAtom', nostrStore.get(keysAtom));
});

nostrStore.sub(clientAtom, () => {
  console.log('clientAtom', nostrStore.get(clientAtom));
});

let unsubEvent;
const subscribeEvent = async () => {
  console.log('statusAtom', nostrStore.get(statusAtom));

  const keys = nostrStore.get(keysAtom);
  const client = nostrStore.get(clientAtom);
  const status = nostrStore.get(statusAtom);

  if (!keys || !client || !status) {
    return;
  }

  const handleEvent = (relayUrl: string, event: Event) => {
    console.log('relayUrl', relayUrl);
    console.log('event', event);

    if (event.kind == BigInt(4)) {
      try {
        const content = nip04_decrypt(keys.secretKey, event.pubkey, event.content);
        console.log('message:', content);
      } catch (error) {
        console.log('Impossible to decrypt DM:', error);
      }
    }
  };

  const filter = new Filter().pubkey(keys.publicKey).kind(BigInt(4)).since(Timestamp.now());
  console.log('filter', filter, filter.asJson());

  await client.subscribe([filter]);
  await client.handleEventNotifications(handleEvent);
};

unsubEvent = nostrStore.sub(statusAtom, subscribeEvent);

// methods
export const initAtom = atom(null, async (get, set, payload: { sk?: string }) => {
  // check client status
  const status = get(statusAtom);
  if (status) {
    return;
  }

  await loadWasmAsync();
  initLogger();

  // create nostr keys
  let keys = get(keysAtom);
  if (!keys) {
    const sk = payload?.sk;
    keys = sk ? Keys.fromSkStr(sk) : Keys.generate();
    set(keysAtom, keys);
  }

  // create nostr client
  let client = get(clientAtom);
  if (!client) {
    client = new Client(keys);
    set(clientAtom, client);
  }

  // conect to relays
  await client.addRelay('wss://relay.nostrassets.com');
  await client.connect();

  set(statusAtom, true);
});

export const createAtom = atom(null, async (get, set) => {
  const keys = Keys.generate();
  set(keysAtom, keys);
});

export const queryAtom = atom(null, async (get, _set) => {
  const keys = get(keysAtom);
  const client = get(clientAtom);
  const status = get(statusAtom);

  if (!keys || !client || !status) {
    return;
  }

  let public_key = PublicKey.fromBech32(NOSRT_ASSETS_NPUB_KEY);
  let event = EventBuilder.newEncryptedDirectMsg(keys, public_key, 'balance').toEvent(keys);

  console.log('event', event);
  await client.sendEvent(event);
});
