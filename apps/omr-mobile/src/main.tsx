import React from 'react';
import {createRoot} from 'react-dom/client';
import {StitchApp as App} from './StitchApp';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App/>);
