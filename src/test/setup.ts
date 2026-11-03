import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import '../lib/zodLocale';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
