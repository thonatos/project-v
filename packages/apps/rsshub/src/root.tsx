import React from 'react';

export const App: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <div>
      <div>
        <nav>
          <ul>
            <li>
              <a href={`/`}>Your Name</a>
            </li>
            <li>
              <a href={`/info`}>Your Friend</a>
            </li>
          </ul>
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
};
