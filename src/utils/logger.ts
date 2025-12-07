/**
 * Logger utility for VSCL Faceit Finder
 * Set DEBUG to false for production builds
 */

const DEBUG = false; // Set to false for production

export const logger = {
  log: (...args: any[]) => {
    if (DEBUG) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (DEBUG) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (DEBUG) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (DEBUG) {
      console.info(...args);
    }
  }
};
