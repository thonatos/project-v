/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: (_theme: Record<string, unknown>) => ({
        DEFAULT: {
          css: {
            'blockquote p:first-of-type::before': {
              content: '',
            },
            'blockquote p:last-of-type::after': {
              content: '',
            },
          },
        },
      }),
    },
  },
};
