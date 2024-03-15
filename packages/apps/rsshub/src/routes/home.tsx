import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import HomeIcon from '../assets/home.svg?react';

export const Home: React.FC<{}> = () => {
  const [greetMsg, setGreetMsg] = useState('');
  const [name, setName] = useState('');

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const t: any = await invoke('get_channel', { name });
    console.log('t', t);
    setGreetMsg(t.title);
  }

  return (
    <div className="container">
      <div className="row">
        <HomeIcon />
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>

      <p>{greetMsg}</p>
    </div>
  );
};
