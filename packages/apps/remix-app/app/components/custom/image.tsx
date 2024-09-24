import React from 'react';

const Image: React.FC<{
  src?: string;
  className?: string;
}> = ({ src, className }) => {
  return <img src={src} loading="lazy" alt="default" className={className} />;
};

export default Image;
