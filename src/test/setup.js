// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import '@testing-library/jest-dom';

// Mock for btoa and atob (needed for hashState tests)
if (typeof global.btoa === 'undefined') {
    global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}

if (typeof global.atob === 'undefined') {
    global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}
