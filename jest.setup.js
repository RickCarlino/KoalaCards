import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Set up window and navigator mocks
global.window = Object.create(window)
global.navigator = Object.create(navigator)

// Mock the mediaDevices API globally
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(),
  },
  writable: true,
})

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
