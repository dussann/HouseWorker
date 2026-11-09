import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { designTokens } from './designTokens';
import './index.css';
import App from './App';

const cssVariableName = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const rootStyle = document.documentElement.style;

Object.entries(designTokens.colors).forEach(([name, value]) => {
  rootStyle.setProperty(`--color-${cssVariableName(name)}`, value);
});
Object.entries(designTokens.radius).forEach(([name, value]) => {
  rootStyle.setProperty(`--radius-${cssVariableName(name)}`, `${value}px`);
});
rootStyle.setProperty('--control-height', `${designTokens.controlHeight}px`);
rootStyle.setProperty('--font-family', designTokens.fontFamily);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
